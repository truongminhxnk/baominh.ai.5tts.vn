import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Xử lý chuỗi kết nối: Loại bỏ channel_binding nếu có để tránh lỗi driver
let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('channel_binding')) {
  console.log("⚠️ Đã phát hiện 'channel_binding' trong DATABASE_URL. Đang tự động loại bỏ để tương thích...");
  connectionString = connectionString.replace(/&channel_binding=require/g, '').replace(/\?channel_binding=require/g, '');
}

// Cấu hình kết nối Neon.tech
const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

// Middleware log request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Khởi tạo Database - Đảm bảo bảng bm_settings tồn tại
const initDb = async () => {
  let client;
  try {
    console.log("🔄 Đang kết nối tới Neon Database...");
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS bm_settings (
        id TEXT PRIMARY KEY,
        data JSONB
      );
    `);
    console.log("✅ Database Neon.tech đã kết nối và sẵn sàng.");
  } catch (err) {
    console.error("❌ LỖI KẾT NỐI DATABASE:", err.message);
    console.error("💡 Gợi ý: Kiểm tra lại DATABASE_URL trong Environment Variables trên Render.");
  } finally {
    if (client) client.release();
  }
};

// Chạy khởi tạo DB
initDb();

// API: Lấy dữ liệu theo ID
app.get('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`📥 Đang tải dữ liệu cho bảng: ${id}`);
  try {
    const { rows } = await pool.query('SELECT data FROM bm_settings WHERE id = $1', [id]);
    if (rows.length > 0) {
      console.log(`✅ Tải thành công ${id}.`);
      res.json(rows[0]?.data || null);
    } else {
      console.log(`ℹ️ Tải ${id}: Chưa có dữ liệu (trả về null).`);
      res.json(null);
    }
  } catch (err) {
    console.error(`❌ Lỗi tải dữ liệu ${id}:`, err.message);
    res.status(500).json({ error: "Lỗi kết nối cơ sở dữ liệu" });
  }
});

// API: Lưu dữ liệu (Upsert)
app.post('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`📤 Đang xử lý yêu cầu lưu bảng: ${id}`);
  
  try {
    const bodyData = req.body;
    
    // Log chi tiết để debug lỗi JSON
    if (bodyData === undefined || bodyData === null) {
      console.warn(`⚠️ Cảnh báo: Body nhận được là null/undefined cho bảng ${id}`);
    } else {
      console.log(`🔍 Loại dữ liệu: ${Array.isArray(bodyData) ? 'Array' : typeof bodyData}`);
      if (Array.isArray(bodyData)) {
         console.log(`📏 Số lượng phần tử: ${bodyData.length}`);
      }
    }
    
    // FIX: Sử dụng JSON.stringify(req.body) để đảm bảo dữ liệu (đặc biệt là Array) 
    // được gửi dưới dạng chuỗi JSON, tránh lỗi 'invalid input syntax for type json'
    const jsonData = JSON.stringify(bodyData);
    
    if (!jsonData) {
       throw new Error("Dữ liệu không hợp lệ (Không thể stringify)");
    }

    await pool.query(
      'INSERT INTO bm_settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
      [id, jsonData]
    );
    console.log(`✅ Lưu thành công bảng ${id}. Kích thước: ${(jsonData.length / 1024).toFixed(2)} KB`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Lỗi LƯU dữ liệu ${id}:`, err.message);
    console.error(`   Chi tiết lỗi DB:`, err);
    res.status(500).json({ error: "Lỗi lưu dữ liệu: " + err.message });
  }
});

// Map số tiền => gói cước
const PLAN_CONFIG = {
  150000: { planType: "MONTHLY", months: 1 },
  450000: { planType: "3MONTHS", months: 3 },
  900000: { planType: "6MONTHS", months: 6 },
  1800000: { planType: "YEARLY", months: 12 },
};

const DAILY_CHARS = 50000; // 50.000 ký tự / ngày cho mọi gói
const SEPAY_WEBHOOK_API_KEY = process.env.SEPAY_WEBHOOK_API_KEY || "";

// Helper: cộng thêm monthCount vào 1 timestamp (ms)
function addMonths(from, monthCount) {
  const d = new Date(from);
  const currentMonth = d.getMonth();
  const currentYear = d.getFullYear();
  const currentDate = d.getDate();
  
  // Tính tháng và năm mới
  let newMonth = currentMonth + monthCount;
  let newYear = currentYear;
  
  // Xử lý trường hợp vượt quá 12 tháng
  while (newMonth >= 12) {
    newMonth -= 12;
    newYear += 1;
  }
  while (newMonth < 0) {
    newMonth += 12;
    newYear -= 1;
  }
  
  // Tạo ngày mới, xử lý trường hợp ngày không hợp lệ (ví dụ: 31/2)
  const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
  const finalDate = Math.min(currentDate, daysInNewMonth);
  
  const newDate = new Date(newYear, newMonth, finalDate, d.getHours(), d.getMinutes(), d.getSeconds());
  return newDate.getTime();
}

// Webhook nhận từ SePay
app.post('/api/sepay_webhook', async (req, res) => {
  try {
    console.log("📥 Webhook SePay được gọi!");
    console.log("📥 Headers:", JSON.stringify(req.headers, null, 2));
    console.log("📥 Body:", JSON.stringify(req.body, null, 2));
    
    // 1. Xác thực API key
    // SePay gửi với format: Authorization: "Apikey {API_KEY}"
    const authHeader = req.headers["authorization"] || req.headers["x-api-key"] || "";
    let token = "";
    
    // Xử lý các format: "Apikey {key}", "apikey {key}", "Bearer {key}", hoặc chỉ {key}
    if (authHeader) {
      token = authHeader
        .replace(/^apikey\s+/i, "")
        .replace(/^bearer\s+/i, "")
        .replace(/^sepay\s+/i, "")
        .trim();
    }
    
    console.log(`🔑 API Key check: SEPAY_WEBHOOK_API_KEY=${SEPAY_WEBHOOK_API_KEY ? 'SET (' + SEPAY_WEBHOOK_API_KEY.substring(0, 10) + '...)' : 'NOT SET'}, received_token=${token ? 'PROVIDED (' + token.substring(0, 10) + '...)' : 'NOT PROVIDED'}`);
    console.log(`🔑 Full auth header: "${authHeader}"`);
    
    // Nếu có API key được cấu hình, phải khớp
    if (SEPAY_WEBHOOK_API_KEY) {
      if (token !== SEPAY_WEBHOOK_API_KEY) {
        console.log("❌ Webhook: Invalid API key - không khớp");
        return res.status(401).json({ error: "Invalid webhook api key" });
      }
      console.log("✅ Webhook: API key hợp lệ");
    } else {
      console.log("⚠️ Webhook: Không có SEPAY_WEBHOOK_API_KEY được cấu hình, cho phép tất cả (chế độ dev)");
    }

    const payload = req.body;

    // 2. Đọc thông tin giao dịch từ payload
    // SePay có thể gửi với nhiều format khác nhau
    const amount = parseInt(
      payload.transferAmount ||  // SePay format
      payload.amount || 
      payload.money || 
      payload.amount_money ||
      payload.total ||
      0
    );
    const description = (
      payload.description || 
      payload.content ||      // SePay format
      payload.note || 
      payload.message ||
      payload.transaction_content ||
      ""
    ).toString();
    
    // SePay gửi transferType: "in" = có tiền vào (thành công)
    const transferType = (payload.transferType || "").toLowerCase();
    const status = (
      payload.status || 
      payload.state ||
      payload.transaction_status ||
      (transferType === "in" ? "success" : "") ||  // Nếu transferType = "in" thì coi là success
      ""
    ).toLowerCase();
    const transId = String(
      payload.id ||            // SePay format (39636347)
      payload.referenceCode || // SePay format (FT26022754795688)
      payload.transId || 
      payload.transaction_id ||
      payload.trans_id ||
      payload.code ||
      ""
    );
    
    console.log(`📊 Transaction info: amount=${amount}, status="${status}", transferType="${transferType}", transId="${transId}"`);
    console.log(`📊 Description: "${description.substring(0, 200)}"`);

    // Chỉ xử lý giao dịch thành công: status = success HOẶC transferType = "in"
    const isSuccess = transferType === "in" || ["success", "thanh_cong", "completed", "thanh toán thành công"].includes(status);
    if (!isSuccess) {
      console.log(`ℹ️ Webhook: Ignore transaction với status="${status}", transferType="${transferType}"`);
      return res.status(200).json({ ok: true, message: "Ignore non-success transaction" });
    }

    // 3. Map số tiền -> gói
    const plan = PLAN_CONFIG[amount];
    if (!plan) {
      console.log(`ℹ️ Webhook: Unknown amount ${amount}, ignore`);
      return res.status(200).json({ ok: true, message: "Unknown amount, ignore" });
    }

    // 4. Tìm loginId trong nội dung: dạng VT-loginId hoặc VTloginId (không có dấu gạch)
    // SePay có thể gửi: "VTtruong2024vn", "VT-truong2024.vn", hoặc "VTguest"
    // Tìm trong cả description và content để đảm bảo không bỏ sót
    const searchText = (description || "").toLowerCase();
    let match = searchText.match(/vt-([a-z0-9_.-]+)/);  // Tìm VT-{loginId}
    if (!match) {
      match = searchText.match(/vt([a-z0-9_.-]+)/);     // Tìm VT{loginId} (không có dấu gạch)
    }
    
    if (!match) {
      console.log(`ℹ️ Webhook: No payment code (VT-xxx or VTxxx) found in "${description}"`);
      return res.status(200).json({ ok: true, message: "No payment code (VT-xxx or VTxxx) found" });
    }
    
    let loginId = match[1].toLowerCase();
    // Xử lý trường hợp SePay gửi "VTtruong2024vn" -> cần tách thành "truong2024.vn"
    // Nếu loginId không có dấu chấm và có "vn" ở cuối (và không phải là "guest"), có thể là domain
    if (loginId !== "guest" && loginId.endsWith("vn") && !loginId.includes(".")) {
      // Thử tách: "truong2024vn" -> "truong2024.vn"
      const withoutVn = loginId.slice(0, -2);
      if (withoutVn.length > 0) {
        loginId = `${withoutVn}.vn`;
      }
    }
    
    console.log(`🔍 Extracted loginId: "${loginId}" from description: "${description}"`);

    // 5. Tải danh sách users từ DB
    const usersRes = await pool.query('SELECT data FROM bm_settings WHERE id = $1', ['users']);
    if (usersRes.rows.length === 0) {
      return res.status(200).json({ ok: true, message: "Users table not found" });
    }

    const allUsers = usersRes.rows[0].data || [];
    let user = allUsers.find(u => u.loginId?.toLowerCase() === loginId);

    // Nếu không tìm thấy user, tự động tạo user mới (để xử lý trường hợp user "guest" chưa có trong DB)
    if (!user) {
      console.log(`ℹ️ Webhook: User not found for loginId "${loginId}", creating new user...`);
      user = {
        uid: loginId === "guest" ? "guest" : `user-${Date.now()}`,
        loginId: loginId,
        displayName: loginId === "guest" ? "Khách" : loginId,
        role: loginId === "guest" ? "GUEST" : "USER",
        email: "",
        photoURL: "",
        lastActive: new Date().toISOString(),
        isBlocked: false,
        planType: "TRIAL",
        expiryDate: Date.now(),
        credits: 0,
        characterLimit: 0,
        dailyKeyCount: 0,
        customVoices: []
      };
      allUsers.push(user);
      // Lưu user mới vào DB
      await pool.query(
        'INSERT INTO bm_settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
        ['users', JSON.stringify(allUsers)]
      );
      console.log(`✅ Webhook: Created new user with loginId "${loginId}"`);
    }

    // 6. Kiểm tra tránh xử lý trùng lặp (dùng transId hoặc timestamp)
    const paymentLogKey = `payment_${transId || Date.now()}`;
    const existingLog = await pool.query('SELECT data FROM bm_settings WHERE id = $1', ['payment_logs']);
    const paymentLogs = existingLog.rows[0]?.data || [];
    
    if (paymentLogs.some(log => log.transId === transId && log.loginId === loginId)) {
      console.log(`ℹ️ Webhook: Transaction ${transId} already processed`);
      return res.status(200).json({ ok: true, message: "Transaction already processed" });
    }

    // 7. Tính hạn dùng mới
    const now = Date.now();
    const currentExpiry = user.expiryDate || now;
    const base = currentExpiry > now ? currentExpiry : now;
    const newExpiry = addMonths(base, plan.months);

    // 8. Cập nhật user
    const updatedUser = {
      ...user,
      planType: plan.planType,
      expiryDate: newExpiry,
      characterLimit: DAILY_CHARS,
      credits: DAILY_CHARS,
      isBlocked: false,
      expiryNotifyLevel: 0
    };

    const updatedUsers = allUsers.map(u => u.uid === user.uid ? updatedUser : u);

    // 9. Lưu lại users và payment log
    await pool.query(
      'INSERT INTO bm_settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
      ['users', JSON.stringify(updatedUsers)]
    );

    paymentLogs.push({
      transId,
      loginId,
      amount,
      description,
      planType: plan.planType,
      months: plan.months,
      processedAt: new Date().toISOString()
    });

    await pool.query(
      'INSERT INTO bm_settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
      ['payment_logs', JSON.stringify(paymentLogs)]
    );

    const expiryDateStr = new Date(newExpiry).toLocaleString('vi-VN');
    console.log(`✅ Webhook: Đã cập nhật gói ${plan.planType} cho user ${loginId}, hạn dùng đến ${expiryDateStr}`);
    
    return res.status(200).json({ 
      success: true,
      ok: true, 
      message: `Payment processed for ${loginId}`,
      data: {
        loginId,
        planType: plan.planType,
        months: plan.months,
        expiryDate: newExpiry,
        expiryDateStr,
        transId
      }
    });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ error: "Internal error: " + err.message });
  }
});

// API: Kiểm tra thanh toán (để frontend polling)
app.get('/api/check_payment/:loginId', async (req, res) => {
  try {
    const { loginId } = req.params;
    console.log(`🔍 Check payment request for loginId: ${loginId}`);
    
    const usersRes = await pool.query('SELECT data FROM bm_settings WHERE id = $1', ['users']);
    if (usersRes.rows.length === 0) {
      console.log(`ℹ️ Users table not found`);
      return res.json({ found: false });
    }
    const allUsers = usersRes.rows[0].data || [];
    const user = allUsers.find(u => {
      const uLoginId = (u.loginId || u.uid || "").toLowerCase();
      return uLoginId === loginId.toLowerCase();
    });
    
    if (!user) {
      console.log(`ℹ️ User not found for loginId: ${loginId}`);
      return res.json({ found: false });
    }
    
    console.log(`✅ User found: ${user.loginId || user.uid}, planType: ${user.planType}, expiryDate: ${new Date(user.expiryDate || 0).toLocaleString('vi-VN')}`);
    return res.json({ found: true, user });
  } catch (err) {
    console.error("❌ Check payment error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// API: Test webhook (để debug)
app.post('/api/test_webhook', async (req, res) => {
  try {
    console.log("🧪 Test webhook called with body:", JSON.stringify(req.body, null, 2));
    console.log("🧪 Headers:", JSON.stringify(req.headers, null, 2));
    return res.json({ ok: true, message: "Test webhook received", body: req.body, headers: req.headers });
  } catch (err) {
    console.error("❌ Test webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Phục vụ ứng dụng Frontend cho các route không phải API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server Bảo Minh AI đang chạy tại cổng ${port}`);
});

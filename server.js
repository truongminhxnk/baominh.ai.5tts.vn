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

// Phục vụ ứng dụng Frontend cho các route không phải API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server Bảo Minh AI đang chạy tại cổng ${port}`);
});

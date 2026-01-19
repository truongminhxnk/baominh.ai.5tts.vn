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
// Dùng cổng 3000 mặc định, nhưng nếu đang chạy cùng Vite dev server thì nên dùng cổng khác để tránh xung đột
const port = process.env.PORT || 3000;

// SỬ DỤNG CHUỖI KẾT NỐI TỪ NGƯỜI DÙNG CUNG CẤP LÀM DỰ PHÒNG
const PROVIDED_DB_URL = "postgresql://neondb_owner:npg_8bwSYeuL3BZR@ep-calm-scene-a1oi61rv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
let connectionString = process.env.DATABASE_URL || PROVIDED_DB_URL;

// Xử lý chuỗi kết nối: Loại bỏ channel_binding nếu có để tránh lỗi driver
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
  // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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
    console.error("💡 Gợi ý: Kiểm tra lại DATABASE_URL.");
  } finally {
    if (client) client.release();
  }
};

// Chạy khởi tạo DB
initDb();

// API: Lấy dữ liệu theo ID
// Trả về { data: ... } thay vì raw data để tránh lỗi parse JSON null
app.get('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT data FROM bm_settings WHERE id = $1', [id]);
    if (rows.length > 0) {
      res.json({ success: true, data: rows[0]?.data || null });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (err) {
    console.error(`❌ Lỗi tải dữ liệu ${id}:`, err.message);
    res.status(500).json({ success: false, error: "Lỗi kết nối cơ sở dữ liệu" });
  }
});

// API: Lưu dữ liệu (Upsert)
app.post('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const bodyData = req.body;
    const jsonData = JSON.stringify(bodyData);
    
    if (!jsonData) {
       throw new Error("Dữ liệu không hợp lệ (Không thể stringify)");
    }

    await pool.query(
      'INSERT INTO bm_settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
      [id, jsonData]
    );
    console.log(`✅ Đã lưu ${id} vào DB.`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Lỗi LƯU dữ liệu ${id}:`, err.message);
    res.status(500).json({ success: false, error: "Lỗi lưu dữ liệu: " + err.message });
  }
});

// Phục vụ ứng dụng Frontend cho các route không phải API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Xử lý lỗi EADDRINUSE (Cổng đã được sử dụng)
const server = app.listen(port, () => {
  console.log(`🚀 Server Bảo Minh AI đang chạy tại http://localhost:${port}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`⚠️ Cổng ${port} đang bận, đang thử cổng ${Number(port) + 1}...`);
    server.close();
    app.listen(Number(port) + 1, () => {
       console.log(`🚀 Server Bảo Minh AI đang chạy tại http://localhost:${Number(port) + 1}`);
    });
  } else {
    console.error(e);
  }
});
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import https from 'https'; // --- MỚI THÊM: Import thư viện https ---
import connectDB from './config/database.js';
import productRoutes from './routes/productRoutes.js';
import importRoutes from './routes/importRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import debtRoutes from './routes/debtRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

dotenv.config();
connectDB();

const app = express();

app.use(express.json());
app.use(cors());

// --- MỚI THÊM: Cấu hình Keep-Alive cho Render ---
const APP_URL = 'https://lamanh-shop-backend.onrender.com'; // URL Render của bạn

// Hàm ping server
const keepAlive = () => {
    https.get(APP_URL, (res) => {
        if (res.statusCode === 200) {
            console.log(`[Keep-Alive] Ping thành công lúc: ${new Date().toLocaleTimeString()}`);
        } else {
            console.error(`[Keep-Alive] Ping thất bại với status: ${res.statusCode}`);
        }
    }).on('error', (e) => {
        console.error(`[Keep-Alive] Lỗi khi ping: ${e.message}`);
    });
};

// Thiết lập chu kỳ ping: 10 phút (Render ngủ sau 15 phút)
// 10 * 60 * 1000 = 600000 ms
setInterval(keepAlive, 600000); 
// ----------------------------------------------------

// Đăng ký đường dẫn
app.use('/api/products', productRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
  res.send('API Backend của Lâm Anh Shop đang chạy ngon lành!');
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server đang chạy ở chế độ ${process.env.NODE_ENV} trên cổng ${PORT}`);
  
  // Gọi keepAlive ngay lập tức khi server khởi động để kiểm tra kết nối (tùy chọn)
  // keepAlive(); 
});
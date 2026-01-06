import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import https from 'https';
import path from 'path'; // <--- MỚI: Import path
import { fileURLToPath } from 'url'; // <--- MỚI: Import để xử lý đường dẫn

import connectDB from './config/database.js';
import productRoutes from './routes/productRoutes.js';
import importRoutes from './routes/importRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import debtRoutes from './routes/debtRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

dotenv.config();
connectDB();

// --- MỚI: Cấu hình __dirname cho ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ----------------------------------------------

const app = express();

app.use(express.json());
app.use(cors());

// --- Cấu hình Keep-Alive cho Render ---
const APP_URL = 'https://lamanh-shop-backend.onrender.com'; 

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

setInterval(keepAlive, 600000); 
// --------------------------------------

// Đăng ký API Routes
app.use('/api/products', productRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- QUAN TRỌNG: Cấu hình Frontend (React) ---

// 1. Chỉ định thư mục chứa code React đã build (folder 'dist')
// Lưu ý: Kiểm tra xem folder build của bạn tên là 'dist' hay 'build'
// Giả sử cấu trúc thư mục là: root -> backend (server.js) và root -> client (React)
app.use(express.static(path.join(__dirname, '../client/dist'))); 

// 2. Catch-all route: Bắt mọi request không phải API để trả về index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ---------------------------------------------

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server đang chạy ở chế độ ${process.env.NODE_ENV} trên cổng ${PORT}`);
});
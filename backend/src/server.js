import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import https from 'https';
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

// --- CẤU HÌNH CORS (QUAN TRỌNG) ---
// Cho phép Frontend (Firebase) gọi API của Backend (Render)
// Để an toàn, sau này bạn nên thay '*' bằng domain Firebase của bạn
// Ví dụ: app.use(cors({ origin: 'https://lamanh-shop.web.app' }));
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

// Ping mỗi 10 phút
setInterval(keepAlive, 600000); 
// --------------------------------------

// Đăng ký API Routes
app.use('/api/products', productRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/exports', exportRoutes); // [cite: 1, 2, 3]
app.use('/api/partners', partnerRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- ROUTE TRANG CHỦ CỦA BACKEND ---
// Khi bạn truy cập link Render, nó sẽ hiện dòng này để biết Server còn sống
// Server KHÔNG phục vụ file index.html của React nữa
app.get('/', (req, res) => {
    res.send('<h1>API Server is running...</h1><p>Please access the website via Firebase URL.</p>');
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server đang chạy ở chế độ ${process.env.NODE_ENV} trên cổng ${PORT}`);
});
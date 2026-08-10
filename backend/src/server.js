import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import https from 'https';
import connectDB from './config/database.js';

import productRoutes from './routes/productRoutes.js';
import importRoutes from './routes/importRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
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

// --- Cấu hình Keep-Alive cho Render (Chỉ chạy 8h-22h giờ Việt Nam) ---
const APP_URL = process.env.APP_URL || 'https://lamanh-shop-backend.onrender.com'; 

if (process.env.NODE_ENV === 'production') {
  const keepAlive = () => {
      // Lấy giờ hiện tại theo múi giờ Việt Nam (UTC+7)
      const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const hourVN = nowVN.getHours();

      // Chỉ ping trong khoảng 8h sáng - 22h tối (giờ VN)
      if (hourVN < 8 || hourVN >= 22) {
          console.log(`[Keep-Alive] Bỏ qua ping - ngoài giờ hoạt động (${hourVN}h giờ VN)`);
          return;
      }

      https.get(APP_URL, (res) => {
          if (res.statusCode === 200) {
              console.log(`[Keep-Alive] Ping thành công lúc: ${nowVN.toLocaleTimeString('vi-VN')} (giờ VN)`);
          } else {
              console.error(`[Keep-Alive] Ping thất bại với status: ${res.statusCode}`);
          }
      }).on('error', (e) => {
          console.error(`[Keep-Alive] Lỗi khi ping: ${e.message}`);
      });
  };
  setInterval(keepAlive, 600000); 
}
// --------------------------------------

// Đăng ký API Routes
app.use('/api/products', productRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- ROUTE TRANG CHỦ CỦA BACKEND ---
app.get('/', (req, res) => {
    res.send('<h1>API Server is running...</h1>');
});

const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server đang chạy trên http://${HOST}:${PORT} (Cổng ${PORT})`);
});

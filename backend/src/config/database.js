import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Lấy chuỗi kết nối từ file .env
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${error.message}`);
    process.exit(1); // Thoát nếu lỗi
  }
};

// --- DÒNG QUAN TRỌNG NHẤT ĐỂ SỬA LỖI CỦA BẠN ---
export default connectDB;
import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/api', // Tự động nối thêm /api vào trước mọi đường dẫn
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cấu hình phản hồi (Response interceptor)
// Giúp lấy dữ liệu gọn gàng hơn (bỏ qua lớp .data thừa của axios)
axiosClient.interceptors.response.use(
  (response) => {
    if (response && response.data) {
      return response.data;
    }
    return response;
  },
  (error) => {
    console.error("Lỗi API:", error);
    throw error;
  }
);

export default axiosClient;
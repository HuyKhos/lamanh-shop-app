import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'https://lamanh-shop-backend.onrender.com/api', // Đã sửa: Thêm /api vào cuối
  headers: {
    'Content-Type': 'application/json',
  },
});

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

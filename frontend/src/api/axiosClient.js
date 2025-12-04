import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'http://localhost:5002/api', // Trỏ trực tiếp đến backend đang chạy local
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

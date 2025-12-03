import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Quy tắc: Hễ gọi đường dẫn nào bắt đầu bằng /api
      '/api': {
        target: 'http://localhost:5000', // Thì chuyển hướng sang Server Backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <--- BẮT BUỘC PHẢI CÓ DÒNG NÀY THÌ TAILWIND MỚI CHẠY

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
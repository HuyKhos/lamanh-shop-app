import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { ToastContainer } from 'react-toastify'; // <--- Import
import 'react-toastify/dist/ReactToastify.css';  // <--- Import CSS

// Import các trang
import Dashboard from './pages/Dashboard';
import ProductPage from './pages/ProductPage';
import ImportPage from './pages/ImportPage';
import ExportPage from './pages/ExportPage';
import PartnerPage from './pages/PartnerPage';
import DebtPage from './pages/DebtPage';

function App() {
  return (
    <BrowserRouter>
      {/* Cái loa thông báo đặt ở đây để trang nào cũng dùng được */}
      <ToastContainer position="top-right" autoClose={2000} />
      
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductPage />} />
          <Route path="imports" element={<ImportPage />} />
          <Route path="exports" element={<ExportPage />} />
          <Route path="partners" element={<PartnerPage />} />
          <Route path="debts" element={<DebtPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
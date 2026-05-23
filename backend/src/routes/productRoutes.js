import express from 'express';
// Nhớ import thêm updateProduct và deleteProduct từ controller
import { 
  createProduct, 
  getProducts, 
  updateProduct, 
  deleteProduct 
} from '../controllers/productController.js';

const router = express.Router();

// Đường dẫn gốc: /api/products (Lấy danh sách & Tạo mới)
router.route('/')
  .get(getProducts)
  .post(createProduct);

// Đường dẫn có ID: /api/products/:id (Sửa & Xóa theo ID cụ thể)
// --- ĐÂY LÀ PHẦN BẠN CẦN THÊM ---
router.route('/:id')
  .put(updateProduct)    // Method PUT để sửa
  .delete(deleteProduct); // Method DELETE để xóa

export default router;
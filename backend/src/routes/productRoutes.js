import express from 'express';
// 1. IMPORT ĐẦY ĐỦ CÁC HÀM TỪ CONTROLLER
import { 
  createProduct, 
  getProducts, 
  updateProduct, 
  deleteProduct,
  getProductHistory // <--- BẠN THIẾU DÒNG NÀY
} from '../controllers/productController.js';

const router = express.Router();

// 2. ĐƯỜNG DẪN CÓ ID CỤ THỂ
// Lưu ý: Đặt route có tham số đặc biệt (history) TRƯỚC route tổng quát (/:id)
router.get('/:id/history', getProductHistory);

router.route('/:id')
  .put(updateProduct)    // Method PUT để sửa
  .delete(deleteProduct); // Method DELETE để xóa

// 3. ĐƯỜNG DẪN GỐC: /api/products
router.route('/')
  .get(getProducts)
  .post(createProduct);

export default router;
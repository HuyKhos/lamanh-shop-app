import express from 'express';
import { 
  createImport, 
  getImports, 
  deleteImport,
  getNewImportCode // Đảm bảo đã import hàm này
} from '../controllers/importController.js';

const router = express.Router();

// --- QUAN TRỌNG: ĐƯỜNG DẪN NÀY PHẢI NẰM ĐẦU TIÊN ---
// Để tránh bị hiểu nhầm là /:id
router.get('/new-code', getNewImportCode); 

// Sau đó mới đến các đường dẫn gốc
router.route('/')
  .post(createImport)
  .get(getImports);

// Cuối cùng mới là đường dẫn có tham số :id
router.route('/:id')
  .delete(deleteImport);

export default router;
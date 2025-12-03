import express from 'express';
import { 
  createPartner, 
  getPartners, 
  updatePartner, 
  deletePartner 
} from '../controllers/partnerController.js';

const router = express.Router();

// Lấy danh sách & Tạo mới
router.route('/')
  .post(createPartner)
  .get(getPartners);

// --- PHẦN QUAN TRỌNG: API SỬA & XÓA THEO ID ---
router.route('/:id')
  .put(updatePartner)
  .delete(deletePartner);

export default router;
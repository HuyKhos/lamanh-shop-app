import express from 'express';
import { getDebts, updateDebt, updatePayment } from '../controllers/debtController.js';

const router = express.Router();
router.route('/payment/:id')
  .put(updatePayment);
// 2. Route chung (ID) đặt SAU
router.route('/:id')
  .put(updateDebt);

// 3. Route gốc
router.route('/')
  .get(getDebts);

export default router;
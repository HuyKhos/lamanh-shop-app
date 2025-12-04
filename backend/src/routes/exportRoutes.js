import express from 'express';
import { 
  createExport, 
  getExports, 
  deleteExport,
  getNewExportCode,
  updateExport
} from '../controllers/exportController.js';

const router = express.Router();

router.get('/new-code', getNewExportCode); // API lấy mã

router.route('/')
  .post(createExport)
  .get(getExports);

router.route('/:id')
  .delete(deleteExport)
  .put(updateExport);

export default router;
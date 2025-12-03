import express from 'express';
import { getDashboardData, getDashboardNote, saveDashboardNote } from '../controllers/dashboardController.js';
const router = express.Router();

router.get('/', getDashboardData);
router.get('/note', getDashboardNote); // GET /api/dashboard/note
router.post('/note', saveDashboardNote); // POST /api/dashboard/note

export default router;
import express from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import { checkInToWork, checkOutFromWork, getAttendanceSummary, getMyAttendance } from '../controller/myAttendanceController.js';

const router = express.Router();

router.use(verifyUser);
router.get('/summary', getAttendanceSummary);
router.get('/me', getMyAttendance);
router.post('/check-in', checkInToWork);
router.post('/check-out', checkOutFromWork);

export default router;

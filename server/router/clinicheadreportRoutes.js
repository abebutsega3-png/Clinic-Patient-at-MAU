import express from 'express';
import {
  getAnalyticsData,
  getDepartmentReports,
  markDepartmentReportReviewed,
  submitDepartmentReport
} from '../controller/reportclinicheadController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.get('/analytics', verifyUser, isClinicHead, getAnalyticsData);
router.get('/department-reports', verifyUser, isClinicHead, getDepartmentReports);
router.patch('/department-reports/:id/review', verifyUser, isClinicHead, markDepartmentReportReviewed);
router.post('/department-reports', verifyUser, submitDepartmentReport);

export default router;

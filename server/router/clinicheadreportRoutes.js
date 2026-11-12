import express from 'express';
import {
  getAnalyticsData,
  getClinicHeadReports,
  getDepartmentReports,
  getMyDepartmentReports,
  generateClinicHeadReport,
  addClinicHeadReportActionPlan,
  markDepartmentReportReviewed,
  resubmitDepartmentReport,
  submitDepartmentReport,
  reviewClinicHeadReport,
  updateClinicHeadReportActionPlan
} from '../controller/reportclinicheadController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.get('/analytics', verifyUser, isClinicHead, getAnalyticsData);
router.get('/clinic-head-reports', verifyUser, isClinicHead, getClinicHeadReports);
router.post('/clinic-head-reports', verifyUser, isClinicHead, generateClinicHeadReport);
router.patch('/clinic-head-reports/:id/review', verifyUser, isClinicHead, reviewClinicHeadReport);
router.post('/clinic-head-reports/:id/actions', verifyUser, isClinicHead, addClinicHeadReportActionPlan);
router.patch('/clinic-head-reports/:id/actions/:actionId', verifyUser, isClinicHead, updateClinicHeadReportActionPlan);
router.get('/department-reports', verifyUser, isClinicHead, getDepartmentReports);
router.get('/department-reports/mine', verifyUser, getMyDepartmentReports);
router.patch('/department-reports/:id/review', verifyUser, isClinicHead, markDepartmentReportReviewed);
router.patch('/department-reports/:id/resubmit', verifyUser, resubmitDepartmentReport);
router.post('/department-reports', verifyUser, submitDepartmentReport);

export default router;

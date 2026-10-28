import express from 'express';
import {
  createClinicApproval,
  createClinicInventoryItem,
  createClinicVisit,
  getClinicHeadDashboardData,
  updateApprovalStatus,
  updateClinicInventoryItem
} from '../controller/clinicheadController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.get('/clinic-head', verifyUser, isClinicHead, getClinicHeadDashboardData);
router.patch('/approve-cert/:id', verifyUser, isClinicHead, updateApprovalStatus);
router.post('/clinic-visits', verifyUser, isClinicHead, createClinicVisit);
router.post('/approvals', verifyUser, isClinicHead, createClinicApproval);
router.post('/inventory', verifyUser, isClinicHead, createClinicInventoryItem);
router.patch('/inventory/:id', verifyUser, isClinicHead, updateClinicInventoryItem);

export default router;

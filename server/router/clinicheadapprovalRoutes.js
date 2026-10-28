import express from 'express';
import {
  createApprovalRequest,
  bulkApproveRequests,
  getMyDepartmentRequests,
  getApprovalRequestDetails,
  getApprovalRequests,
  getMyNotifications,
  markNotificationRead,
  updatePurchasePriority,
  receivePurchaseRequest,
  resubmitApprovalRequest,
  updateApprovalStatus
} from '../controller/clinicheadapprovalController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.get('/', verifyUser, isClinicHead, getApprovalRequests);
router.post('/bulk-approve', verifyUser, isClinicHead, bulkApproveRequests);
router.get('/mine', verifyUser, getMyDepartmentRequests);
router.get('/notifications', verifyUser, getMyNotifications);
router.patch('/notifications/:id/read', verifyUser, markNotificationRead);
router.patch('/:id/priority', verifyUser, isClinicHead, updatePurchasePriority);
router.patch('/:id/fulfillment', verifyUser, receivePurchaseRequest);
router.get('/:id', verifyUser, isClinicHead, getApprovalRequestDetails);
router.patch('/:id/status', verifyUser, isClinicHead, updateApprovalStatus);
router.patch('/:id/resubmit', verifyUser, resubmitApprovalRequest);
router.post('/', verifyUser, createApprovalRequest);

export default router;
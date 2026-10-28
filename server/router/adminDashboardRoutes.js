import express from 'express';
import { getAdminDashboardData } from '../controller/adminDashboardController.js';
import { getAdminReports } from '../controller/adminReportsController.js';
import { getAdminAuditLogs } from '../controller/adminAuditLogController.js';
import {
  getAdminSystemHealth,
  getAdminSystemSettings,
  updateAdminSystemSettings,
} from '../controller/adminSystemSettingsController.js';
import {
  getAdminNotificationDetails,
  getAdminNotificationSettings,
  getAdminNotifications,
  retryAdminNotification,
  sendAdminNotification,
  updateAdminNotificationSettings,
} from '../controller/adminNotificationController.js';
import verifyUser, { isAdmin } from '../middleware/authmiddleware.js';

const router = express.Router();

router.get('/overview', verifyUser, isAdmin, getAdminDashboardData);
router.get('/reports', verifyUser, isAdmin, getAdminReports);
router.get('/audit-logs', verifyUser, isAdmin, getAdminAuditLogs);
router.get('/system-settings', verifyUser, isAdmin, getAdminSystemSettings);
router.put('/system-settings/:section', verifyUser, isAdmin, updateAdminSystemSettings);
router.get('/system-settings/health', verifyUser, isAdmin, getAdminSystemHealth);
router.get('/notifications', verifyUser, isAdmin, getAdminNotifications);
router.get('/notifications/settings', verifyUser, isAdmin, getAdminNotificationSettings);
router.put('/notifications/settings', verifyUser, isAdmin, updateAdminNotificationSettings);
router.post('/notifications', verifyUser, isAdmin, sendAdminNotification);
router.get('/notifications/:id', verifyUser, isAdmin, getAdminNotificationDetails);
router.post('/notifications/:id/retry', verifyUser, isAdmin, retryAdminNotification);

export default router;
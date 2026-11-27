import express from 'express';
import {
  assignAttendanceReplacement,
  copyLastWeekRoster,
  getAllStaff,
  getStaffProfile,
  getTodayAttendance,
  getWeeklyRoster,
  publishWeeklyRoster,
  saveWeeklyRoster
} from '../controller/Staff and rosterController.js';
import {
  decideAttendanceCorrection,
  getAttendanceCorrectionDetails,
  getAttendanceDashboard,
  getAttendanceHistory,
  getDailyAttendance,
  getMonthlyAttendanceReport,
  getStaffAttendanceDetails,
  listAttendanceCorrections,
  submitAttendanceCorrection
} from '../controller/staffAttendanceManagementController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, isClinicHead);
router.get('/staff', getAllStaff);
router.get('/staff/:staffId/profile', getStaffProfile);
router.get('/weekly', getWeeklyRoster);
router.get('/attendance/dashboard', getAttendanceDashboard);
router.get('/attendance/daily', getDailyAttendance);
router.get('/attendance/history', getAttendanceHistory);
router.get('/attendance/monthly-report', getMonthlyAttendanceReport);
router.get('/attendance/staff/:staffId', getStaffAttendanceDetails);
router.get('/attendance/corrections', listAttendanceCorrections);
router.get('/attendance/corrections/:correctionId', getAttendanceCorrectionDetails);
router.post('/attendance/corrections', submitAttendanceCorrection);
router.patch('/attendance/corrections/:correctionId', decideAttendanceCorrection);
router.get('/attendance/today', getTodayAttendance);
router.post('/attendance/today', (req, res) => res.status(410).json({
  success: false,
  message: 'Clinic Head attendance edits are disabled. Submit a correction request for self-recorded attendance instead.'
}));
router.post('/attendance/today/replacement', assignAttendanceReplacement);
router.post('/save', saveWeeklyRoster);
router.post('/publish', publishWeeklyRoster);
router.post('/copy-last-week', copyLastWeekRoster);

export default router;

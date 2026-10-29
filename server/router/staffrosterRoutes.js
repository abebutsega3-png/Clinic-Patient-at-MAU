import express from 'express';
import {
  assignAttendanceReplacement,
  copyLastWeekRoster,
  getAllStaff,
  getStaffProfile,
  getTodayAttendance,
  getWeeklyRoster,
  publishWeeklyRoster,
  saveTodayAttendance,
  saveWeeklyRoster
} from '../controller/Staff and rosterController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, isClinicHead);
router.get('/staff', getAllStaff);
router.get('/staff/:staffId/profile', getStaffProfile);
router.get('/weekly', getWeeklyRoster);
router.get('/attendance/today', getTodayAttendance);
router.post('/attendance/today', saveTodayAttendance);
router.post('/attendance/today/replacement', assignAttendanceReplacement);
router.post('/save', saveWeeklyRoster);
router.post('/publish', publishWeeklyRoster);
router.post('/copy-last-week', copyLastWeekRoster);

export default router;

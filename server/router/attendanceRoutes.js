const express = require('express');
const router = express.Router();
const { checkInStaff, getTodayAttendance } = require('../controllers/attendanceController');

// 1. ሰራተኛው መገኘቱን ሲመዘገብ (Check-in)
router.post('/check-in', checkInStaff);

// 2. የክሊኒክ ኃላፊው የዛሬውን መገኘት (Today's Attendance) በሙሉ ወይም በዲፓርትመንት ማጣሪያ ሲጠይቅ
router.get('/today', getTodayAttendance);

module.exports = router;
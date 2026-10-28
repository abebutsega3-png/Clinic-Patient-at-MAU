const express = require('express');
const router = express.Router();
const { getPharmacyOverview, getDispensingReport } = require('../controllers/pharmacyController');
const { verifyToken, isClinicHead } = require('../middleware/authMiddleware');

router.get('/overview', verifyToken, isClinicHead, getPharmacyOverview);
router.get('/dispensing-report', verifyToken, isClinicHead, getDispensingReport);

module.exports = router;
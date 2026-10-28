import express from 'express';
import {
  getDispensingReport,
  getPharmacyOverview
} from '../controller/clinicheadPharmacyController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, isClinicHead);
router.get('/overview', getPharmacyOverview);
router.get('/dispensing-report', getDispensingReport);

export default router;

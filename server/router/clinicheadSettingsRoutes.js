import express from 'express';
import {
  getClinicOperationalSettings,
  updateClinicOperationalSettings
} from '../controller/clinicheadSettingsController.js';
import verifyUser, { isClinicHead } from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, isClinicHead);
router.get('/', getClinicOperationalSettings);
router.put('/', updateClinicOperationalSettings);

export default router;

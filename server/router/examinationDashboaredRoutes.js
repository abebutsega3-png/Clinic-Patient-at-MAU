import { Router } from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import { requireClinicPermissions } from '../middleware/requireClinicPermissions.js';
import {
  getExaminationDashboard,
  getExaminationPatientHistory,
  listExaminationQueue,
  searchExaminationPatients,
  submitExamination,
  updateExaminationQueue,
} from '../controller/examinationdasboaredController.js';

const router = Router();

router.use(verifyUser);
router.get('/dashboard', requireClinicPermissions('dashboard:view', 'visits_queue:view'), getExaminationDashboard);
router.get('/queue', requireClinicPermissions('visits_queue:view'), listExaminationQueue);
router.patch('/queue/:id', requireClinicPermissions('visits_queue:send'), updateExaminationQueue);
router.get('/patients', requireClinicPermissions('patients:view'), searchExaminationPatients);
router.get('/patients/:id/history', requireClinicPermissions('clinical_records:view'), getExaminationPatientHistory);
router.post('/visits/:visitId/examination', requireClinicPermissions('clinical_records:create'), submitExamination);

export default router;
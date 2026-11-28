import { Router } from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import { requireClinicPermissions } from '../middleware/requireClinicPermissions.js';
import {
  createEmergencyLabRequest,
  createEmergencyPrescription,
  createEmergencyProcedure,
  createEmergencyReferral,
  getEmergencyDashboard,
  getEmergencyHistory,
  getEmergencyQueue,
  registerEmergencyArrival,
  updateEmergencyExamination,
  updateEmergencyTreatment,
  updateEmergencyTriage,
} from '../controller/emergencyController.js';

const router = Router();

router.use(verifyUser);
router.get('/dashboard', requireClinicPermissions('emergency_care:view'), getEmergencyDashboard);
router.get('/queue', requireClinicPermissions('emergency_care:view'), getEmergencyQueue);
router.get('/history', requireClinicPermissions('emergency_care:view'), getEmergencyHistory);
router.post('/visits', requireClinicPermissions('emergency_care:create'), registerEmergencyArrival);
router.patch('/visits/:visitId/triage', requireClinicPermissions('emergency_care:process'), updateEmergencyTriage);
router.patch('/visits/:visitId/examination', requireClinicPermissions('emergency_care:process'), updateEmergencyExamination);
router.patch('/visits/:visitId/treatment', requireClinicPermissions('emergency_care:process'), updateEmergencyTreatment);
router.post('/visits/:visitId/lab-requests', requireClinicPermissions('emergency_care:process', 'lab_requests:create'), createEmergencyLabRequest);
router.post('/visits/:visitId/prescriptions', requireClinicPermissions('emergency_care:process', 'prescriptions:create'), createEmergencyPrescription);
router.post('/visits/:visitId/procedures', requireClinicPermissions('emergency_care:process', 'injection_dressing:create'), createEmergencyProcedure);
router.post('/visits/:visitId/referrals', requireClinicPermissions('emergency_care:process', 'referrals:create'), createEmergencyReferral);

export default router;

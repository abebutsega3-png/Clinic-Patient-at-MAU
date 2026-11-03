import { Router } from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import {
  requireExaminationOrLabAccess,
  requireExaminationRoomAccess,
  requireLabProcessingAccess,
} from '../middleware/examinationRoomAuthorization.js';
import {
  getExaminationDashboard,
  getExaminationLabRequests,
  getExaminationPatientHistory,
  listExaminationQueue,
  approveLabResults,
  saveLabResults,
  saveExaminationDraft,
  searchExaminationPatients,
  submitPrescription,
  submitExamination,
  updateLabProcessingStatus,
  updateExaminationQueue,
} from '../controller/examinationdasboaredController.js';

const router = Router();

router.use(verifyUser);
router.get('/dashboard', requireExaminationRoomAccess(), getExaminationDashboard);
router.get('/lab-requests', requireExaminationOrLabAccess(), getExaminationLabRequests);
router.get('/queue', requireExaminationRoomAccess(), listExaminationQueue);
router.patch('/queue/:id', requireExaminationRoomAccess(), updateExaminationQueue);
router.get('/patients', requireExaminationRoomAccess(), searchExaminationPatients);
router.get('/patients/:id/history', requireExaminationRoomAccess(), getExaminationPatientHistory);
router.patch('/visits/:visitId/examination/draft', requireExaminationRoomAccess(), saveExaminationDraft);
router.post('/visits/:visitId/prescriptions', requireExaminationRoomAccess(), submitPrescription);
router.post('/visits/:visitId/examination', requireExaminationRoomAccess(), submitExamination);
router.patch('/visits/:visitId/lab-status', requireLabProcessingAccess(), updateLabProcessingStatus);
router.put('/visits/:visitId/lab-results', requireLabProcessingAccess(), saveLabResults);
router.post('/visits/:visitId/lab-results/approve', requireLabProcessingAccess(), approveLabResults);

export default router;
import { Router } from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import { requireCardRoomAccess } from '../middleware/cardRoomAuthorization.js';
import { requireClinicPermissions } from '../middleware/requireClinicPermissions.js';
import {
  createCardRoomPatient,
  createCardRoomVisit,
  getCardRoomDashboard,
  getCardRoomNotifications,
  getCardRoomPatient,
  getCardRoomPatientClinicalRecords,
  getCardRoomProfile,
  getCardRoomReports,
  listCardRoomPatients,
  listCardRoomQueue,
  listCardRoomVisits,
  updateCardRoomPatient,
  updateCardRoomQueue,
  submitCardRoomReport,
} from '../controller/cardRoomController.js';

const router = Router();

router.use(verifyUser);

router.get('/dashboard', requireCardRoomAccess(), getCardRoomDashboard);
router.get('/patients', requireCardRoomAccess(), requireClinicPermissions('patients:view'), listCardRoomPatients);
router.post('/patients', requireCardRoomAccess(), requireClinicPermissions('patients:create'), createCardRoomPatient);
router.get('/patients/:id/clinical-records', requireClinicPermissions('patients:view', 'clinical_records:view'), getCardRoomPatientClinicalRecords);
router.get('/patients/:id', requireCardRoomAccess(), requireClinicPermissions('patients:view'), getCardRoomPatient);
router.patch('/patients/:id', requireCardRoomAccess(), requireClinicPermissions('patients:edit'), updateCardRoomPatient);
router.get('/visits', requireCardRoomAccess(), listCardRoomVisits);
router.post('/visits', requireCardRoomAccess(), createCardRoomVisit);
router.get('/queue', requireCardRoomAccess(), listCardRoomQueue);
router.patch('/queue/:id', requireCardRoomAccess(), updateCardRoomQueue);
router.get('/reports', requireCardRoomAccess(), requireClinicPermissions('reports:own:view'), getCardRoomReports);
router.post('/reports/submit', requireCardRoomAccess(), requireClinicPermissions('reports:own:export'), submitCardRoomReport);
router.get('/notifications', requireCardRoomAccess(), getCardRoomNotifications);
router.get('/profile', requireCardRoomAccess(), getCardRoomProfile);
export default router;

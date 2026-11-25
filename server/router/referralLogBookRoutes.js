import { Router } from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import { requireExaminationRoomAccess } from '../middleware/examinationRoomAuthorization.js';
import {
  getAllReferrals,
  createReferral,
  updateReferral,
  deleteReferral,
} from '../controller/referrallogBookController.js';

const router = Router();

router.use(verifyUser);
router.get('/', requireExaminationRoomAccess(), getAllReferrals);
router.post('/', requireExaminationRoomAccess(), createReferral);
router.put('/:id', requireExaminationRoomAccess(), updateReferral);
router.delete('/:id', requireExaminationRoomAccess(), deleteReferral);

export default router;
import { Router } from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import { requireExaminationRoomAccess } from '../middleware/examinationRoomAuthorization.js';
import { getOpdRegister, syncOpdRegister } from '../controller/opdRegisterController.js';

const router = Router();

router.use(verifyUser, requireExaminationRoomAccess());
router.get('/', getOpdRegister);
router.post('/sync', syncOpdRegister);

export default router;

import express from 'express';
import {
  createManagedUser,
  getManagedUserDetails,
  getUserManagementOptions,
  listManagedUsers,
  resetManagedUserPassword,
  setManagedUserStatus,
  updateManagedUser,
} from '../controller/adminUserController.js';
import verifyUser, { isAdmin } from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, isAdmin);
router.get('/options', getUserManagementOptions);
router.get('/', listManagedUsers);
router.post('/', createManagedUser);
router.get('/:id', getManagedUserDetails);
router.patch('/:id', updateManagedUser);
router.patch('/:id/status', setManagedUserStatus);
router.patch('/:id/password', resetManagedUserPassword);

export default router;

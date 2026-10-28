import express from 'express';
import {
  createRole,
  deleteRole,
  getRoleUsers,
  getRoles,
  resetRolePermissions,
  updateRolePermissions,
} from '../controller/rolePermissionController.js';
import verifyUser, { isAdmin } from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, isAdmin);
router.get('/', getRoles);
router.post('/', createRole);
router.get('/:id/users', getRoleUsers);
router.put('/:id/reset-defaults', resetRolePermissions);
router.put('/:id', updateRolePermissions);
router.delete('/:id', deleteRole);

export default router;

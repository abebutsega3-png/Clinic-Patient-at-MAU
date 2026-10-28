import express from 'express';
import {
    createDepartment,
    deleteDepartment,
    getDepartmentStaff,
    getDepartments,
    updateDepartment,
    updateDepartmentStatus,
} from '../controller/departmentController.js';
import verifyUser, { isAdmin } from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, isAdmin);
router.get('/staff', getDepartmentStaff);
router.route('/')
    .get(getDepartments)
    .post(createDepartment);

router.put('/:id', updateDepartment);
router.patch('/:id/status', updateDepartmentStatus);
router.delete('/:id', deleteDepartment);

export default router;
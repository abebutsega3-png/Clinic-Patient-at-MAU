import express from 'express';
import {
  changeCurrentUserPassword,
  getCurrentUser,
  login,
  logout,
} from '../controller/authController.js';
import verifyUser from '../middleware/authmiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', verifyUser, logout);
router.get('/me', verifyUser, getCurrentUser);
router.patch('/change-password', verifyUser, changeCurrentUserPassword);

export default router;

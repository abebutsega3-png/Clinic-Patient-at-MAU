import express from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import {
  getDispensaryInventoryTransactions,
  getDispensaryStock,
  issueDispensaryStock,
  receiveDispensaryStock,
} from '../controller/dispensaryInventoryController.js';

const router = express.Router();
const dispensaryRoleNames = new Set(['pharmacist', 'drug store manager', 'dispensary room']);

router.use(verifyUser, (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ success: false, message: 'Change your temporary password before continuing.' });
  }
  const roles = [req.user?.activeRole, req.user?.role, ...(Array.isArray(req.user?.roles) ? req.user.roles : [])]
    .filter((role) => typeof role === 'string')
    .map((role) => role.trim().toLowerCase().replace(/[_-]+/g, ' '));
  if (roles.some((role) => dispensaryRoleNames.has(role))) return next();
  return res.status(403).json({ success: false, message: 'Pharmacy or dispensary staff access is required.' });
});

router.get('/stock', getDispensaryStock);
router.get('/transactions', getDispensaryInventoryTransactions);
router.post('/model19-receive', receiveDispensaryStock);
router.post('/model22-issue/:id', issueDispensaryStock);

export default router;

import express from 'express';
import {
  getDispensaryDashboard,
  getDispensaryHistory,
  savePrescriptionAllergyVerification,
  updatePrescriptionDispensing,
} from '../controller/dispensaryController.js';
import {
  getDispensaryInventoryTransactions,
  issueDispensaryStock,
  receiveDispensaryStock,
} from '../controller/dispensaryInventoryController.js';
import verifyUser from '../middleware/authmiddleware.js';

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

router.get('/dashboard', getDispensaryDashboard);
router.get('/history', getDispensaryHistory);
router.get('/inventory/transactions', getDispensaryInventoryTransactions);
router.post('/inventory/receipts', receiveDispensaryStock);
router.post('/inventory/:id/issues', issueDispensaryStock);
router.patch('/prescriptions/:visitId/allergy-verification', (req, res, next) => {
  const roles = [req.user?.activeRole, req.user?.role, ...(Array.isArray(req.user?.roles) ? req.user.roles : [])]
    .filter((role) => typeof role === 'string')
    .map((role) => role.trim().toLowerCase().replace(/[_-]+/g, ' '));
  if (roles.includes('pharmacist')) return next();
  return res.status(403).json({ success: false, message: 'Pharmacist access is required to verify prescription allergies.' });
}, savePrescriptionAllergyVerification);
router.patch('/prescriptions/:visitId', (req, res, next) => {
  const roles = [req.user?.activeRole, req.user?.role, ...(Array.isArray(req.user?.roles) ? req.user.roles : [])]
    .filter((role) => typeof role === 'string')
    .map((role) => role.trim().toLowerCase().replace(/[_-]+/g, ' '));
  if (roles.includes('pharmacist')) return next();
  return res.status(403).json({ success: false, message: 'Pharmacist access is required to process prescriptions.' });
}, updatePrescriptionDispensing);

export default router;

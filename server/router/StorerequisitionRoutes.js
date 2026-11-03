import express from 'express';
import verifyUser from '../middleware/authmiddleware.js';
import {
  createRequisition,
  decideRequisition,
  getRequisitions,
  issueRequisition,
  receiveRequisition,
} from '../controller/StorerequisitionController.js';

const router = express.Router();
const pharmacyRoles = new Set(['pharmacist', 'drug store manager', 'dispensary room']);
const storeManagerRoles = new Set([
  'clinic head',
  'clinic manager',
  'drug store',
  'drug store manager',
  'main store keeper',
  'main storekeeper',
  'store keeper',
  'storekeeper',
]);

const normalizeRoles = (req) => [
  req.user?.activeRole,
  req.user?.role,
  ...(Array.isArray(req.user?.roles) ? req.user.roles : []),
]
  .filter((role) => typeof role === 'string')
  .map((role) => role.trim().toLowerCase().replace(/[_-]+/g, ' '));

const requireAnyRole = (allowedRoles, message) => (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ success: false, message: 'Change your temporary password before continuing.' });
  }
  if (normalizeRoles(req).some((role) => allowedRoles.has(role))) return next();
  return res.status(403).json({ success: false, message });
};

router.use(verifyUser);
router.get('/', requireAnyRole(new Set([...pharmacyRoles, ...storeManagerRoles]), 'Pharmacy or store-management access is required.'), getRequisitions);
router.post('/', requireAnyRole(pharmacyRoles, 'Pharmacy or dispensary staff access is required.'), createRequisition);
router.patch('/:id/decision', requireAnyRole(storeManagerRoles, 'Store-manager or Clinic Head access is required to approve requisitions.'), decideRequisition);
router.patch('/:id/issue', requireAnyRole(storeManagerRoles, 'Store-manager or Clinic Head access is required to record Model 22 issues.'), issueRequisition);
router.patch('/:id/receive', requireAnyRole(pharmacyRoles, 'Pharmacy or dispensary staff access is required to confirm receipts.'), receiveRequisition);

export default router;

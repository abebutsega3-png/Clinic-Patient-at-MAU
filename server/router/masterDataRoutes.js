import express from 'express';
import verifyUser, { isAdmin } from '../middleware/authmiddleware.js';
import {
  createMasterDataRecord,
  getActiveMasterDataCatalog,
  getMasterData,
  getMasterDataAuditHistory,
  updateMasterDataRecord,
  updateMasterDataStatus,
} from '../controller/masterDataController.js';

const router = express.Router();

router.get('/catalog/:category', verifyUser, getActiveMasterDataCatalog);
router.use(verifyUser, isAdmin);
router.get('/', getMasterData);
router.get('/:id/audit', getMasterDataAuditHistory);
router.post('/', createMasterDataRecord);
router.put('/:id', updateMasterDataRecord);
router.patch('/:id/status', updateMasterDataStatus);

export default router;

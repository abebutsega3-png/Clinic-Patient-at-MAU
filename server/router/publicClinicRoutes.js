import express from 'express';
import { getPublicClinicOverview } from '../controller/publicClinicController.js';

const router = express.Router();

router.get('/overview', getPublicClinicOverview);

export default router;

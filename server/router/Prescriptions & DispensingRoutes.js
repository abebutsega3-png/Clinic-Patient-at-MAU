const express = require('express');
const router = express.Router();
const {
  getPendingOrders,
  dispensePrescription,
  getDispensingHistory
} = require('../controllers/Prescriptions & DispensingController');

router.get('/pending-orders', getPendingOrders);
router.post('/dispense/:id', dispensePrescription);
router.get('/history', getDispensingHistory);

module.exports = router;
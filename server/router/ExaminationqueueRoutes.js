const express = require('express');
const router = express.Router();
const {
  getQueueDashboard,
  addPatientToQueue,
  updatePatientStatus
} = require('../controllers/examinationqueueController');

// GET all queue items and stats
router.get('/', getQueueDashboard);

// POST new patient to queue
router.post('/add', addPatientToQueue);

// PATCH status (Call / Complete)
router.patch('/:id/status', updatePatientStatus);

module.exports = router;
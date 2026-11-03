const express = require('express');
const router = express.Router();
const { getConsultation, completeConsultation } = require('../controllers/consultationController');

router.get('/:id', getConsultation);
router.post('/:id/complete', completeConsultation);

module.exports = router;
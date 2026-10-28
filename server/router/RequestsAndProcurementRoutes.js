const express = require('express');
const router = express.Router();
const { getCardRoomRequests, createRequest } = require('../controllers/RequestsAndProcurementController');

router.get('/', getCardRoomRequests);
router.post('/', createRequest);

module.exports = router;
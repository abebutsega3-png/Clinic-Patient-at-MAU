const express = require('express');
const router = express.Router();
const { createLabRequest, getLabRequests } = require('../controllers/labController');

router.post('/request', createLabRequest);
router.get('/', getLabRequests);

module.exports = router;
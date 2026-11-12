const express = require('express');
const router = express.Router();
const { getReports, updateReportStatus } = require('../controllers/DepartmentreportController');

router.get('/', getReports);
router.patch('/:id/status', updateReportStatus);

module.exports = router;
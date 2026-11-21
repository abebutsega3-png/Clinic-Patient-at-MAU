const express = require('express');
const router = express.Router();
const {
  getOpdRegister,
  createOpdRecord,
  getOpdRecordById
} = require('../controllers/opdController');

router.get('/', getOpdRegister);
router.post('/', createOpdRecord);
router.get('/:id', getOpdRecordById);

module.exports = router;
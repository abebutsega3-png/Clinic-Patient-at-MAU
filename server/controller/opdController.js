const OpdRecord = require('../models/OpdRecord');

// 1. የ OPD Register መረጃዎችን እና Summary ቆጠራዎችን ማምጣት
const getOpdRegister = async (req, res) => {
  try {
    const { search, date } = req.query;
    let query = {};

    if (date) {
      query.serviceDate = date;
    }

    if (search && search.trim() !== '') {
      query.$or = [
        { mrn: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { identification: { $regex: search, $options: 'i' } },
        { diagnosis: { $regex: search, $options: 'i' } }
      ];
    }

    const records = await OpdRecord.find(query).sort({ createdAt: -1 });

    // Summary Cards Calculations
    const totalPatients = records.length;
    const newPatients = records.filter((r) => r.visitType === 'New').length;
    const repeatPatients = records.filter((r) => r.visitType === 'Repeat').length;
    const referralPatients = records.filter((r) => r.referral === 'Yes').length;

    res.status(200).json({
      success: true,
      summary: {
        totalPatients,
        newPatients,
        repeatPatients,
        referralPatients
      },
      data: records
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. አዲስ OPD Record መመዝገብ
const createOpdRecord = async (req, res) => {
  try {
    const newRecord = await OpdRecord.create(req.body);

    if (req.io) {
      req.io.emit('opd-register-updated', newRecord);
    }

    res.status(201).json({ success: true, data: newRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. የአንድ ታካሚ ዝርዝር መረጃ ማምጣት (View Details)
const getOpdRecordById = async (req, res) => {
  try {
    const record = await OpdRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'OPD record not found' });
    }
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getOpdRegister, createOpdRecord, getOpdRecordById };
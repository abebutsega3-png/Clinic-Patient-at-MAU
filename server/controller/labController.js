const LabRequest = require('../models/LabRequest');
const PatientQueue = require('../models/PatientQueue');

// @desc    Create a new lab request and add patient to lab queue
const createLabRequest = async (req, res) => {
  try {
    const { patientId, mrn, studentId, patientName, age, gender, requestBy, tests } = req.body;

    const newLabRequest = new LabRequest({
      patientId,
      mrn,
      studentId,
      patientName,
      age,
      gender,
      requestBy,
      tests,
      status: 'Pending'
    });

    const savedRequest = await newLabRequest.save();

    // Update patient status in consultation queue to 'Waiting for Lab'
    await PatientQueue.findOneAndUpdate(
      { studentId },
      { status: 'Waiting for Lab' }
    );

    res.status(201).json({
      success: true,
      message: 'Laboratory request submitted successfully and sent to lab queue.',
      data: savedRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get lab requests by patient or status
const getLabRequests = async (req, res) => {
  try {
    const requests = await LabRequest.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createLabRequest,
  getLabRequests
};
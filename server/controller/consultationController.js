const Consultation = require('../models/Consultation');
const PatientQueue = require('../models/PatientQueue');

// @desc    Start or Get Active Consultation
const getConsultation = async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('labRequests')
      .populate('prescriptions')
      .populate('procedureOrders');
    res.status(200).json({ success: true, data: consultation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Complete Consultation and update records
const completeConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { 
      ...req.body, 
      status: 'completed', 
      completedAt: Date.now() 
    };

    const consultation = await Consultation.findByIdAndUpdate(id, updateData, { new: true });

    // Update Queue to Completed
    if (consultation && consultation.queueEntry) {
      await PatientQueue.findByIdAndUpdate(consultation.queueEntry, { status: 'Completed' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Consultation completed successfully. Patient records and Patient Card updated.', 
      data: consultation 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getConsultation,
  completeConsultation
};
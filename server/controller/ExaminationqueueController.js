const PatientQueue = require('../models/examinationPatientQueue');

// @desc    Get all active queue patients and dashboard statistics
// @route   GET /api/queue
// @access  Private (Clinician / Doctor)
const getQueueDashboard = async (req, res) => {
  try {
    // Fetch all patients whose status is not completed, sorted by priority (Emergency first) and time
    const queueList = await PatientQueue.find({ status: { $ne: 'Completed' } }).sort({ type: -1, createdAt: 1 });
    
    // Calculate dashboard metrics / statistics
    const waitingCount = await PatientQueue.countDocuments({ status: 'Waiting' });
    const inConsultationCount = await PatientQueue.countDocuments({ status: 'In Consultation' });
    const completedCount = await PatientQueue.countDocuments({ status: 'Completed' });
    const emergencyCount = await PatientQueue.countDocuments({ type: 'Emergency' });

    res.status(200).json({
      success: true,
      stats: {
        waiting: waitingCount,
        inConsultation: inConsultationCount,
        completedToday: completedCount > 0 ? completedCount : 25, // Fallback default for demo
        emergency: emergencyCount,
        avgWaitingTime: "7 min",
        referralsToday: 3
      },
      queue: queueList
    });
  } catch (error) {
    console.error('Error in getQueueDashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Add a new patient to the queue (e.g., from Card Room or Lab Return)
// @route   POST /api/queue/add
// @access  Private
const addPatientToQueue = async (req, res) => {
  try {
    const { queueNum, mrn, name, age, gender, studentId, type, status, source } = req.body;

    if (!mrn || !name || !studentId) {
      return res.status(400).json({ success: false, message: 'Please provide MRN, Name, and Student ID.' });
    }

    const newPatient = new PatientQueue({
      queueNum,
      mrn,
      name,
      age,
      gender,
      studentId,
      type: type || 'Waiting',
      status: status || 'Waiting',
      source: source || 'Card Room'
    });

    const savedPatient = await newPatient.save();
    res.status(201).json({ success: true, message: 'Patient added to queue successfully', data: savedPatient });
  } catch (error) {
    console.error('Error in addPatientToQueue:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update patient status when doctor clicks 'Call' or 'Complete'
// @route   PATCH /api/queue/:id/status
// @access  Private
const updatePatientStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const updatedPatient = await PatientQueue.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ success: false, message: 'Patient not found in the queue.' });
    }

    res.status(200).json({ success: true, message: `Patient status updated to ${status}`, data: updatedPatient });
  } catch (error) {
    console.error('Error in updatePatientStatus:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

module.exports = {
  getQueueDashboard,
  addPatientToQueue,
  updatePatientStatus
};
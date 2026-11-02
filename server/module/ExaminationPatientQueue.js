const mongoose = require('mongoose');

const PatientQueueSchema = new mongoose.Schema({
  queueNum: { type: String, required: true },
  mrn: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  studentId: { type: String, required: true },
  type: { type: String, enum: ['Emergency', 'Waiting', 'Routine'], default: 'Waiting' },
  status: { type: String, enum: ['Emergency', 'Waiting', 'Lab Return', 'In Consultation', 'Completed'], default: 'Waiting' },
  waitTime: { type: String, default: '0 min' },
  source: { type: String, default: 'Card Room' }, // e.g., 'Card Room', 'Lab Return'
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExaminationPatientQueue', ExaminationPatientQueueSchema);
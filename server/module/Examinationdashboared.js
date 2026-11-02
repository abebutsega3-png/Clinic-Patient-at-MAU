const mongoose = require('mongoose');

const PatientQueueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['Waiting', 'In Consultation', 'Completed', 'Emergency'], default: 'Waiting' },
  waitMinutes: { type: Number, default: 0 },
  priority: { type: String, enum: ['Normal', 'High', 'Emergency'], default: 'Normal' },
  visitType: { type: String, enum: ['New', 'Repeat'], default: 'New' },
  vitals: {
    bp: String,
    temp: String,
    pulse: String
  },
  diagnosis: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('examination-dashboard', examination-dashboardSchema);
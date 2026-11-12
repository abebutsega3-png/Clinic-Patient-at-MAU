const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  department: { type: String, required: true },
  reportType: { type: String, required: true }, // e.g., 'Daily Summary', 'Lab Report', 'Inventory Report'
  date: { type: String, required: true },
  submittedBy: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Draft', 'Returned'], 
    default: 'Submitted' 
  },
  patientsServed: { type: Number, default: 0 },
  staffPresent: { type: Number, default: 0 },
  criticalNotes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('DepartmentReport', reportSchema);
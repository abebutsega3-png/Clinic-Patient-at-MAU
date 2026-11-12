const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffName: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  checkInTime: { type: Date },
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Late', 'On Leave', 'Pending Approval'], 
    default: 'Absent' 
  },
  reason: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
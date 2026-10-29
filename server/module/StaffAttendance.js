import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  timeIn: { type: String, match: /^$|^([01]\d|2[0-3]):[0-5]\d$/, default: '' },
  timeOut: { type: String, match: /^$|^([01]\d|2[0-3]):[0-5]\d$/, default: '' },
  note: { type: String, trim: true, default: '' },
  replacementStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  replacementShift: { type: String, enum: ['morning', 'afternoon', 'night', null], default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

const StaffAttendance = mongoose.models.StaffAttendance
  || mongoose.model('StaffAttendance', attendanceSchema);

export default StaffAttendance;

import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  staffName: { type: String, trim: true, default: '' },
  role: { type: String, trim: true, default: 'Staff' },
  date: { type: String, required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'half_day', 'early_leave'], required: true },
  lateArrival: { type: Boolean, default: false },
  shift: { type: String, enum: ['morning', 'afternoon', 'night', 'clinic-hours', 'off', 'leave'], default: 'off' },
  checkInTime: { type: Date, default: null },
  checkOutTime: { type: Date, default: null },
  timeIn: { type: String, match: /^$|^([01]\d|2[0-3]):[0-5]\d$/, default: '' },
  timeOut: { type: String, match: /^$|^([01]\d|2[0-3]):[0-5]\d$/, default: '' },
  workingMinutes: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true, default: '' },
  replacementStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  replacementShift: { type: String, enum: ['morning', 'afternoon', 'night', null], default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

const StaffAttendance = mongoose.models.StaffAttendance
  || mongoose.model('StaffAttendance', attendanceSchema);

export default StaffAttendance;

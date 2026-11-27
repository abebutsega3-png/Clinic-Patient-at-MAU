import mongoose from 'mongoose';

const attendanceAuditLogSchema = new mongoose.Schema({
  correctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceCorrection', required: true, index: true },
  attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAttendance', required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  date: { type: String, required: true },
  action: { type: String, enum: ['submitted', 'approved', 'rejected'], required: true },
  modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  modificationDate: { type: Date, default: Date.now, required: true },
  previousValues: { type: mongoose.Schema.Types.Mixed, required: true },
  newValues: { type: mongoose.Schema.Types.Mixed, required: true },
  reason: { type: String, required: true, trim: true }
}, { timestamps: true });

attendanceAuditLogSchema.index({ staffId: 1, date: -1 });

const AttendanceAuditLog = mongoose.models.AttendanceAuditLog
  || mongoose.model('AttendanceAuditLog', attendanceAuditLogSchema);

export default AttendanceAuditLog;

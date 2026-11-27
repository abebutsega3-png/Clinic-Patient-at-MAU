import mongoose from 'mongoose';

const attendanceValuesSchema = new mongoose.Schema({
  timeIn: { type: String, default: '' },
  timeOut: { type: String, default: '' },
  checkInTime: { type: Date, default: null },
  checkOutTime: { type: Date, default: null },
  workingMinutes: { type: Number, min: 0, default: 0 },
  status: { type: String, default: '' },
  lateArrival: { type: Boolean, default: false }
}, { _id: false });

const attendanceCorrectionSchema = new mongoose.Schema({
  attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAttendance', required: true, index: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  date: { type: String, required: true, index: true },
  previousValues: { type: attendanceValuesSchema, required: true },
  proposedValues: { type: attendanceValuesSchema, required: true },
  attendanceUpdatedAt: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewReason: { type: String, default: '', trim: true, maxlength: 1000 }
}, { timestamps: true });

attendanceCorrectionSchema.index({ status: 1, createdAt: -1 });
attendanceCorrectionSchema.index(
  { attendanceId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

const AttendanceCorrection = mongoose.models.AttendanceCorrection
  || mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);

export default AttendanceCorrection;

import mongoose from 'mongoose';

const clinicVisitSchema = new mongoose.Schema({
  visitId: { type: String, trim: true, default: undefined },
  patientRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
  patientId: { type: String, required: true, trim: true },
  patientName: { type: String, required: true, trim: true },
  visitDate: { type: Date, default: Date.now, index: true },
  department: { type: String, trim: true, default: '' },
  visitType: { type: String, enum: ['New Visit', 'Follow-up Visit', 'Emergency Visit'], default: 'New Visit' },
  priority: { type: String, enum: ['Normal', 'Urgent', 'Emergency'], default: 'Normal' },
  status: { type: String, enum: ['Registered', 'Waiting', 'Called', 'In Service', 'Routed', 'Sent to Examination', 'Completed', 'Cancelled', 'No-show'], default: 'Registered' },
  idempotencyKey: { type: String, trim: true, default: undefined },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  diagnosis: { type: String, trim: true, default: '' },
  waitTimeMinutes: { type: Number, min: 0, default: null },
  attendedByStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
  emergency: { type: Boolean, default: false, index: true },
  emergencyResolved: { type: Boolean, default: false },
  referred: { type: Boolean, default: false }
}, { timestamps: true });

clinicVisitSchema.index({ visitDate: -1, emergency: 1, department: 1 });
clinicVisitSchema.index({ visitId: 1 }, { unique: true, sparse: true });
clinicVisitSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const ClinicVisit = mongoose.models.ClinicVisit || mongoose.model('ClinicVisit', clinicVisitSchema);

export default ClinicVisit;

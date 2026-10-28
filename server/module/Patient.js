import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  patientId: { type: String, required: true, trim: true },
  cardNumber: { type: String, required: true, trim: true },
  fullName: { type: String, required: true, trim: true, maxlength: 200 },
  firstName: { type: String, trim: true, maxlength: 60, default: '' },
  fatherName: { type: String, trim: true, maxlength: 60, default: '' },
  grandfatherName: { type: String, trim: true, maxlength: 60, default: '' },
  sex: { type: String, enum: ['Female', 'Male', 'Other', ''], default: '' },
  dateOfBirth: { type: Date, default: null },
  age: { type: Number, min: 0, max: 125, default: null },
  patientType: { type: String, enum: ['New Patient', 'Existing Patient'], default: 'New Patient' },
  governmentIdNumber: { type: String, trim: true, default: undefined, maxlength: 80 },
  universityIdNumber: { type: String, trim: true, default: undefined, maxlength: 80 },
  phoneNumber: { type: String, trim: true, default: '', maxlength: 30 },
  patientCategory: { type: String, enum: ['Student', 'Staff', 'Other Authorized Patient'], required: true },
  campus: { type: String, trim: true, default: '', maxlength: 120 },
  academicDepartment: { type: String, trim: true, default: '', maxlength: 120 },
  region: { type: String, trim: true, default: '', maxlength: 100 },
  woreda: { type: String, trim: true, default: '', maxlength: 100 },
  kebele: { type: String, trim: true, default: '', maxlength: 100 },
  dormBlock: { type: String, trim: true, default: '', maxlength: 80 },
  houseNumber: { type: String, trim: true, default: '', maxlength: 40 },
  address: { type: String, trim: true, default: '', maxlength: 500 },
  emergencyContactName: { type: String, trim: true, default: '', maxlength: 120 },
  emergencyContactPhone: { type: String, trim: true, default: '', maxlength: 30 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  collection: 'patients',
});

patientSchema.index({ patientId: 1 }, { unique: true, sparse: true });
patientSchema.index({ cardNumber: 1 }, { unique: true, sparse: true });
patientSchema.index({ fullName: 1 });
patientSchema.index({ governmentIdNumber: 1 }, { unique: true, sparse: true });
patientSchema.index({ universityIdNumber: 1 }, { unique: true, sparse: true });
patientSchema.index({ createdAt: -1 });

const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);

export default Patient;

import mongoose from 'mongoose';

const masterDataRecordSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'job_title',
      'service',
      'patient_category',
      'visit_type',
      'priority',
      'queue_prefix',
      'queue_status',
      'medicine',
      'lab_test',
      'unit',
      'campus_location',
      'academic_department',
      'referral_reason',
      'cancellation_reason',
      'reference_status',
    ],
    index: true,
  },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  nameKey: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: '', trim: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  departmentName: { type: String, default: '', trim: true },
  location: { type: String, default: '', trim: true },
  durationMinutes: { type: Number, default: null, min: 1, max: 1440 },
  strength: { type: String, default: '', trim: true },
  dosageForm: { type: String, default: '', trim: true },
  unit: { type: String, default: '', trim: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
  isSeeded: { type: Boolean, default: false },
}, { timestamps: true });

masterDataRecordSchema.index({ category: 1, code: 1 }, { unique: true });
masterDataRecordSchema.index({ category: 1, nameKey: 1 }, { unique: true });

const MasterDataRecord = mongoose.models.MasterDataRecord
  || mongoose.model('MasterDataRecord', masterDataRecordSchema);

export default MasterDataRecord;

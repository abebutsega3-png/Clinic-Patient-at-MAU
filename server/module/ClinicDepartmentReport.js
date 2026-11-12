import mongoose from 'mongoose';

const clinicDepartmentReportSchema = new mongoose.Schema({
  reportType: { type: String, trim: true, default: 'Department Report', index: true },
  periodType: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  reportDate: { type: Date, default: null, index: true },
  periodStart: { type: Date, default: null },
  periodEnd: { type: Date, default: null },
  department: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, default: '' },
  patientsServed: { type: Number, min: 0, default: 0 },
  completedServices: { type: Number, min: 0, default: 0 },
  staffPresent: { type: Number, min: 0, default: 0 },
  staffAbsent: { type: Number, min: 0, default: 0 },
  pendingCases: { type: Number, min: 0, default: 0 },
  problemsIncidents: { type: String, default: '', maxlength: 5000 },
  medicineSupplyStatus: { type: String, default: '', maxlength: 3000 },
  additionalNotes: { type: String, default: '', maxlength: 5000 },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'returned', 'rejected', 'new', 'reviewed'],
    default: 'submitted',
    index: true
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewHistory: [{
    action: {
      type: String,
      enum: ['draft_saved', 'submitted', 'under_review', 'approved', 'returned', 'rejected', 'commented', 'resubmitted', 'reviewed'],
      required: true
    },
    status: { type: String, required: true },
    comment: { type: String, default: '', maxlength: 2000 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    actedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

clinicDepartmentReportSchema.index({ department: 1, submittedAt: -1 });
clinicDepartmentReportSchema.index({ submittedBy: 1, status: 1, submittedAt: -1 });

const ClinicDepartmentReport = mongoose.models.ClinicDepartmentReport
  || mongoose.model('ClinicDepartmentReport', clinicDepartmentReportSchema);

export default ClinicDepartmentReport;

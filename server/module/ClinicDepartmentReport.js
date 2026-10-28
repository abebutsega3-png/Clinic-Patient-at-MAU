import mongoose from 'mongoose';

const clinicDepartmentReportSchema = new mongoose.Schema({
  reportType: { type: String, trim: true, default: 'Department Report', index: true },
  department: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, default: '' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['new', 'reviewed'], default: 'new', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

const ClinicDepartmentReport = mongoose.models.ClinicDepartmentReport
  || mongoose.model('ClinicDepartmentReport', clinicDepartmentReportSchema);

export default ClinicDepartmentReport;

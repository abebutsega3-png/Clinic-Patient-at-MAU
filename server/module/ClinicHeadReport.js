import mongoose from 'mongoose';

const clinicHeadReportSchema = new mongoose.Schema({
  reportType: { type: String, enum: ['daily', 'weekly', 'monthly', 'custom'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'returned', 'closed'],
    default: 'draft',
    index: true
  },
  reviewHistory: [{
    action: {
      type: String,
      enum: ['generated', 'submitted', 'under_review', 'approved', 'returned', 'closed', 'commented'],
      required: true
    },
    status: { type: String, required: true },
    comment: { type: String, default: '', maxlength: 2000 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    actedAt: { type: Date, default: Date.now }
  }],
  actionPlans: [{
    issue: { type: String, required: true, trim: true, maxlength: 500 },
    solution: { type: String, default: '', trim: true, maxlength: 2000 },
    responsiblePerson: { type: String, required: true, trim: true, maxlength: 120 },
    dueDate: { type: Date, required: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
    status: { type: String, enum: ['open', 'in_progress', 'completed', 'closed'], default: 'open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null }
  }]
}, { timestamps: true });

clinicHeadReportSchema.index({ status: 1, periodStart: -1 });

const ClinicHeadReport = mongoose.models.ClinicHeadReport
  || mongoose.model('ClinicHeadReport', clinicHeadReportSchema);

export default ClinicHeadReport;

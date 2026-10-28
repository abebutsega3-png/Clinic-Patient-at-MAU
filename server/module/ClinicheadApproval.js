import mongoose from 'mongoose';

const approvalRequestSchema = new mongoose.Schema({
  requestType: {
    type: String,
    enum: ['medical_certificate', 'referral', 'staff_leave', 'leave_request', 'purchase_request'],
    required: true
  },

  requestNumber: { type: String, trim: true, default: '' },
  requesterUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  applicantName: { type: String, required: true, trim: true },
  applicantId: { type: String, required: true, trim: true },
  applicantRole: { type: String, enum: ['student', 'staff'], required: true },
  department: { type: String, trim: true, default: '' },
  requestedByDoctor: { type: String, default: '' },
  reason: { type: String, required: true },
  duration: { type: String, default: '' },
  targetHospital: { type: String, default: '' },
  attachmentUrl: { type: String, default: '' },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  leave: {
    leaveType: { type: String, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    totalDays: { type: Number, min: 0, default: 0 },
    balanceAtRequest: { type: Number, min: 0, default: null },
    departmentCoverage: { type: String, default: '' }
  },
  purchase: {
    requesterDepartment: { type: String, default: '' },
    itemName: { type: String, default: '' },
    category: { type: String, default: 'Other' },
    unit: { type: String, default: 'units' },
    requesterRole: { type: String, default: '' },
    quantity: { type: Number, min: 0, default: 0 },
    approvedQuantity: { type: Number, min: 0, default: null },
    estimatedCost: { type: Number, min: 0, default: 0 },
    currentStock: { type: Number, min: 0, default: null },
    monthlyUsage: { type: Number, min: 0, default: null },
    purchaseHistory: [{
      date: { type: Date },
      quantity: { type: Number, min: 0 },
      cost: { type: Number, min: 0 },
      supplier: { type: String, default: '' }
    }]
  },
  referral: {
    patientName: { type: String, default: '' },
    patientId: { type: String, default: '' },
    diagnosis: { type: String, default: '' },
    urgency: { type: String, default: '' },
    clinicalSummary: { type: String, default: '' },
    testResults: { type: String, default: '' },
    referralReason: { type: String, default: '' }
  },
  certificate: {
    certificateType: { type: String, default: '' },
    prescribedDays: { type: Number, min: 0, default: 0 },
    restStartDate: { type: Date, default: null },
    restEndDate: { type: Date, default: null },
    academicPurpose: { type: String, default: '' },
    clinicalAdvice: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'returned'],
    default: 'pending'
  },
  fulfillmentStatus: {
    type: String,
    enum: ['awaiting_approval', 'awaiting_delivery', 'received'],
    default: 'awaiting_approval'
  },
  rejectionReason: { type: String, default: '' },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  receivedBy: { type: String, default: '' },
  receivedAt: { type: Date, default: null },
  decisionHistory: [{
    action: { type: String, enum: ['submitted', 'approved', 'rejected', 'returned', 'resubmitted', 'priority_updated', 'received'], required: true },
    previousStatus: { type: String, default: '' },
    status: { type: String, required: true },
    comment: { type: String, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    actedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

approvalRequestSchema.index({ requestType: 1, status: 1, createdAt: -1 });
approvalRequestSchema.index({ department: 1, createdAt: -1 });

const ClinicApproval = mongoose.model('clinicheadapproval', approvalRequestSchema);

export default ClinicApproval;
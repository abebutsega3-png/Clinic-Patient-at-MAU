import mongoose from 'mongoose';

// 1. Audit Log Model (ለ Recent Activity)
const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  userRole: { type: String, default: 'Unknown' },
  action: { type: String, required: true },
  result: { type: String, enum: ['success', 'failure'], default: 'success', index: true },
  details: { type: String },
  ipAddress: { type: String },
  entityType: { type: String },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  changes: [{
    field: { type: String },
    from: { type: String },
    to: { type: String },
  }],
}, { timestamps: true });

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1, action: 1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// 2. Queue Model (ለ Live Department Status እና Summary Cards)
const queueSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  patientName: { type: String, trim: true, default: '' },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicVisit', default: null, index: true },
  queueNumber: { type: String, trim: true, default: undefined },
  clinicDate: { type: String, trim: true, default: undefined },
  visitType: { type: String, trim: true, default: '' },
  priority: { type: String, enum: ['Normal', 'Urgent', 'Emergency'], default: 'Normal' },
  cancellationReason: { type: String, trim: true, default: '' },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  department: { type: String, trim: true, required: true },
  status: { type: String, enum: ['waiting', 'called', 'routed', 'sent_to_examination', 'in_progress', 'completed', 'no_show', 'cancelled'], default: 'waiting' },
  arrivedAt: { type: Date, default: Date.now },
  calledAt: { type: Date, default: null },
  inProgressAt: { type: Date, default: null },
  completedAt: { type: Date },
  isEmergency: { type: Boolean, default: false }
}, { timestamps: true });

queueSchema.index({ queueNumber: 1, clinicDate: 1 }, { unique: true, sparse: true });
queueSchema.index({ clinicDate: 1, department: 1, status: 1, priority: 1 });

export const Queue = mongoose.model('Queue', queueSchema);
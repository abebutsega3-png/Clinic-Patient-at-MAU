import mongoose from 'mongoose';

const clinicNotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'clinicheadapproval', default: null, index: true },
  departmentReport: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicDepartmentReport', default: null, index: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  notificationType: {
    type: String,
    enum: ['clinic_workflow', 'system_announcement', 'user_account_update', 'security_alert', 'maintenance_announcement'],
    default: 'clinic_workflow',
    index: true,
  },
  channel: { type: String, enum: ['in_app', 'email'], default: 'in_app', index: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
  deliveryStatus: {
    type: String,
    enum: ['created', 'queued', 'sent', 'delivered', 'failed'],
    default: 'created',
    index: true,
  },
  recipientRole: { type: String, default: '' },
  recipientDepartment: { type: String, default: '' },
  targetPath: { type: String, default: '' },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  batchId: { type: String, default: undefined },
  deliveryAttempts: [{
    channel: { type: String, enum: ['in_app', 'email'], required: true },
    attemptedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['created', 'queued', 'sent', 'delivered', 'failed'], required: true },
    failureReason: { type: String, default: '' },
  }],
  readAt: { type: Date, default: null },
  dismissedAt: { type: Date, default: null, index: true },
  dismissedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

clinicNotificationSchema.index({ recipient: 1, createdAt: -1 });
clinicNotificationSchema.index(
  { batchId: 1, recipient: 1 },
  { unique: true, partialFilterExpression: { batchId: { $type: 'string' } } },
);

const ClinicNotification = mongoose.model('ClinicNotification', clinicNotificationSchema);

export default ClinicNotification;

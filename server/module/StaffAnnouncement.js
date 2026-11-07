import mongoose from 'mongoose';

const staffAnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 10000 },
  audienceType: { type: String, enum: ['all', 'role', 'department'], required: true },
  targetRole: { type: String, trim: true, default: '' },
  targetDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['sent'], default: 'sent' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
  }],
}, { timestamps: true });

staffAnnouncementSchema.index({ status: 1, createdAt: -1 });
staffAnnouncementSchema.index({ 'recipients.user': 1, createdAt: -1 });

const StaffAnnouncement = mongoose.models.StaffAnnouncement
  || mongoose.model('StaffAnnouncement', staffAnnouncementSchema);

export default StaffAnnouncement;

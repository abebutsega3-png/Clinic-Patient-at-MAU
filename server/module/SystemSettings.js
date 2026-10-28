import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, immutable: true, default: 'system' },
  general: {
    systemName: { type: String, trim: true, maxlength: 120, default: 'MAU Clinic Management System' },
    organizationName: { type: String, trim: true, maxlength: 120, default: 'Mekdela Amba University' },
    timezone: { type: String, trim: true, maxlength: 80, default: 'Africa/Addis_Ababa' },
    dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'DD/MM/YYYY' },
    timeFormat: { type: String, enum: ['12-hour', '24-hour'], default: '24-hour' },
    language: { type: String, enum: ['English', 'Amharic'], default: 'English' },
  },
  security: {
    minimumPasswordLength: { type: Number, min: 8, max: 32, default: 8 },
    requireLetter: { type: Boolean, default: true },
    requireNumber: { type: Boolean, default: true },
    requireUppercase: { type: Boolean, default: false },
    requireSpecialCharacter: { type: Boolean, default: false },
    sessionTimeoutMinutes: { type: Number, min: 15, max: 480, default: 480 },
    maximumLoginAttempts: { type: Number, min: 3, max: 10, default: 5 },
    lockoutDurationMinutes: { type: Number, min: 5, max: 120, default: 15 },
  },
  notificationSettings: {
    inAppEnabled: { type: Boolean, default: true },
    categories: {
      system_announcement: { type: Boolean, default: true },
      user_account_update: { type: Boolean, default: true },
      security_alert: { type: Boolean, default: true },
      maintenance_announcement: { type: Boolean, default: true },
    },
  },
}, { timestamps: true, strict: 'throw' });

const SystemSettings = mongoose.models.SystemSettings
  || mongoose.model('SystemSettings', systemSettingsSchema);

export default SystemSettings;

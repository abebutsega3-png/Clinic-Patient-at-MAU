import mongoose from 'mongoose';

const dayHoursSchema = new mongoose.Schema({
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], required: true },
  open: { type: String, default: '08:00' },
  close: { type: String, default: '17:00' },
  closed: { type: Boolean, default: false }
}, { _id: false });

const clinicOperationalSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'clinic', unique: true, immutable: true },
  clinicProfile: {
    name: { type: String, default: 'MAU Clinic', trim: true, maxlength: 120 },
    address: { type: String, default: '', trim: true, maxlength: 250 },
    phone: { type: String, default: '', trim: true, maxlength: 40 },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 160 },
    logoDataUrl: { type: String, default: '', maxlength: 750000 }
  },
  workingHours: {
    days: {
      type: [dayHoursSchema],
      default: () => [
        { day: 'Monday', open: '08:00', close: '17:00', closed: false },
        { day: 'Tuesday', open: '08:00', close: '17:00', closed: false },
        { day: 'Wednesday', open: '08:00', close: '17:00', closed: false },
        { day: 'Thursday', open: '08:00', close: '17:00', closed: false },
        { day: 'Friday', open: '08:00', close: '17:00', closed: false },
        { day: 'Saturday', open: '08:00', close: '12:00', closed: false },
        { day: 'Sunday', open: '08:00', close: '12:00', closed: true }
      ]
    },
    allDayService: { type: Boolean, default: false },
    allDayDepartments: { type: [String], default: ['Emergency', 'Triage'] }
  },
  officialMarks: {
    signatureDataUrl: { type: String, default: '', maxlength: 750000 },
    stampDataUrl: { type: String, default: '', maxlength: 750000 }
  },
  rosterRules: {
    shiftDurations: {
      morning: { type: Number, default: 6, min: 1, max: 24 },
      afternoon: { type: Number, default: 6, min: 1, max: 24 },
      night: { type: Number, default: 12, min: 1, max: 24 }
    },
    minimumStaff: {
      type: [{
        department: { type: String, required: true, trim: true },
        shift: { type: String, enum: ['morning', 'afternoon', 'night'], required: true },
        count: { type: Number, min: 0, max: 500, required: true }
      }],
      default: []
    },
    autoLockApprovedLeave: { type: Boolean, default: true }
  },
  inventoryRules: {
    categoryThresholds: {
      type: [{
        category: { type: String, required: true, trim: true },
        threshold: { type: Number, min: 0, max: 1000000, required: true }
      }],
      default: []
    },
    expiryWarningDays: { type: Number, default: 90, min: 1, max: 1095 }
  }
}, { timestamps: true });

const ClinicOperationalSettings = mongoose.models.ClinicOperationalSettings
  || mongoose.model('ClinicOperationalSettings', clinicOperationalSettingsSchema);

export default ClinicOperationalSettings;

import mongoose from 'mongoose';

// 1. የሰራተኞች መረጃ Model (View-Only for Clinic Head)
const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Doctor', 'Nurse', 'Lab', 'Pharmacy', 'Registration'], 
    required: true 
  },
  department: { 
    type: String, 
    enum: ['OPD', 'Triage', 'Laboratory', 'Pharmacy', 'Registration'], 
    required: true 
  },
  joinedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Active', 'On Leave', 'Inactive'], default: 'Active' }
}, { timestamps: true });

// 2. የ Duty Roster Model (አንድ ሰራተኛ + አንድ ቀን = አንድ Record)
const rosterSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true }, // Format: "YYYY-MM-DD"
  shift: { 
    type: String, 
    enum: ['morning', 'afternoon', 'night', 'off', 'leave'], 
    required: true 
  },
  isLocked: { type: Boolean, default: false }, // በ Approvals ምክንያት "leave" ከሆነ true ይሆናል
  assignedBy: { type: String, default: 'Clinic Head' }
}, { timestamps: true });

// አንድ ሰራተኛ በአንድ ቀን ሁለት ፈረቃ እንዳይኖረው መከልከያ
rosterSchema.index({ staffId: 1, date: 1 }, { unique: true });

const Staff = mongoose.models.Staff || mongoose.model('Staff', staffSchema);
const Roster = mongoose.models.Roster || mongoose.model('Roster', rosterSchema);

export { Staff, Roster };
const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  queueEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientQueue' },
  
  // Vitals & Clinical Notes
  vitals: {
    temperature: String,
    bp: String,
    rr: String,
    pr: String
  },
  chiefComplaint: String,
  hpi: String,
  examination: String,
  diagnosis: {
    mainDiagnosis: { type: String, required: true },
    hmisDx: { type: String, required: true }
  },

  // Inter-departmental Orders References
  labRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabRequest' }],
  prescriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' }],
  procedureOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProcedureOrder' }],
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Referral' }],

  disposition: { type: String, enum: ['Discharge', 'Admit', 'Refer', 'Follow-up'], default: 'Discharge' },
  followUpDate: Date,
  status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
  completedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Consultation', consultationSchema);
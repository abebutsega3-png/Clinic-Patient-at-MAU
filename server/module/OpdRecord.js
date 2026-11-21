const mongoose = require('mongoose');

const opdRecordSchema = new mongoose.Schema({
  identification: { type: String, required: true }, // e.g., P001
  mrn: { type: String, required: true }, // e.g., MRN01
  patientName: { type: String, default: '' },
  diagnosis: { type: String, required: true }, // e.g., URI, AGE, Pharyngitis, Gastritis, UTI
  screening: { type: String, enum: ['Yes', 'No'], default: 'No' },
  serviceDate: { type: String, required: true }, // e.g., 21/11/2026
  ncodDiagnosis: { type: String, enum: ['Yes', 'No'], default: 'No' },
  hivTbStatus: { type: String, default: 'Neg / Neg' },
  visitType: { type: String, enum: ['New', 'Repeat'], default: 'New' },
  testResults: { type: String, default: 'Normal' },
  age: { type: Number, required: true },
  sex: { type: String, enum: ['M', 'F'], required: true },
  roadTrafficAccident: { type: String, enum: ['Yes', 'No'], default: 'No' },
  referral: { type: String, enum: ['Yes', 'No'], default: 'No' },
  address: { type: String, default: '' }, // e.g., Dorm 1
  doctorName: { type: String, default: '' },
  doctorSignature: { type: String, default: '' },
  date: { type: String, required: true },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('OpdRecord', opdRecordSchema);
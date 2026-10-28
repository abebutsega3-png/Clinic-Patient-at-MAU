const mongoose = require('mongoose');

const patientRecordSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  department: { 
    type: String, 
    enum: ['OPD', 'Triage', 'Laboratory', 'Pharmacy', 'Registration'], 
    required: true 
  },
  doctorName: { type: String, required: true },
  diagnosis: { type: String, required: true }, // ለ "Top Diseases Chart" የሚያገለግል
  isEmergency: { type: Boolean, default: false }, // ለ "Emergency Patients Card" የሚያገለግል
  waitTimeMinutes: { type: Number, default: 0 }, // ለ "Avg Wait Time Card" የሚያገለግል
}, { timestamps: true }); // createdAt እና updatedAt በራሱ ይመዘገባል

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
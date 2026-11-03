const mongoose = require('mongoose');

const LabRequestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  mrn: { type: String, required: true },
  studentId: { type: String, required: true },
  patientName: { type: String, required: true },
  age: Number,
  gender: String,
  requestBy: { type: String, required: true }, // Doctor's name / ID
  date: { type: Date, default: Date.now },
  
  // Laboratory Categories Checkboxes
  tests: {
    hematology: [String],   // e.g., ['Hgb', 'WBC', 'Blood Group']
    serology: [String],     // e.g., ['Widal', 'VDRL', 'HIV']
    urinalysis: [String],   // e.g., ['Protein', 'Glucose', 'Pregnancy Test']
    stoolExam: [String],    // e.g., ['Direct', 'Occult Blood']
    bloodChemistry: [String], // e.g., ['RBS', 'BUN', 'Creatinine']
    bacteriology: [String]  // e.g., ['AFB', 'Gram Stain']
  },

  status: { type: String, enum: ['Pending', 'In Progress', 'Result Ready'], default: 'Pending' },
  
  // Results filled by Lab Technician
  results: {
    testedBy: String,
    dateOfReport: Date,
    approvedBy: String,
    findings: String
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LabRequest', LabRequestSchema);
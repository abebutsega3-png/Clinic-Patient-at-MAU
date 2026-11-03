const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  mrn: { type: String, required: true },
  studentId: { type: String, required: true },
  patientName: { type: String, required: true },
  prescribedBy: { type: String, required: true }, // Doctor's name
  allergyWarning: { type: String, default: '' },
  
  medicines: [
    {
      drugName: { type: String, required: true },
      dosage: { type: String, required: true }, // e.g. "500mg"
      frequency: { type: String, required: true }, // e.g. "TID (3x daily)"
      duration: { type: String, required: true }, // e.g. "5 days"
      quantity: { type: Number, required: true },
      dispensedQuantity: { type: Number, default: 0 },
      isAvailable: { type: Boolean, default: true }
    }
  ],

  status: { 
    type: String, 
    enum: ['Pending', 'Dispensed', 'Out of Stock', 'Cancelled'], 
    default: 'Pending' 
  },
  
  dispensedBy: { type: String }, // Pharmacist name
  dispensedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Prescriptions & Dispensing', Prescriptions & DispensingSchema);
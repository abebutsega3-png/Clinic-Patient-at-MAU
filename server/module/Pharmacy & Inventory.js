const mongoose = require('mongoose');

// 1. የመድኃኒት ክምችት Schema (Medicine Stock)
const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['Tablet', 'Syrup', 'Injection', 'Ointment', 'Equipment'], 
    required: true 
  },
  quantity: { type: Number, required: true, default: 0 },
  minReorderLevel: { type: Number, required: true, default: 10 },
  expiryDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['in_stock', 'low_stock', 'out_of_stock', 'expired'], 
    default: 'in_stock' 
  }
}, { timestamps: true });

// 2. የታደሉ መድኃኒቶች ታሪክ Schema (Dispensing Log)
const dispensingLogSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  medicineName: { type: String, required: true },
  quantityDispensed: { type: Number, required: true },
  dispensedToPatientId: { type: String, required: true },
  dispensedByDoctorOrPharmacist: { type: String, required: true },
  dispensedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Medicine = mongoose.model('Medicine', medicineSchema);
const DispensingLog = mongoose.model('DispensingLog', dispensingLogSchema);

module.exports = { Medicine, DispensingLog };
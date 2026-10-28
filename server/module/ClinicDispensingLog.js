import mongoose from 'mongoose';

const clinicDispensingLogSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, default: null },
  medicineName: { type: String, required: true, trim: true },
  quantityDispensed: { type: Number, required: true, min: 0 },
  department: { type: String, trim: true, default: '' },
  dispensedToPatientId: { type: String, default: '' },
  dispensedByDoctorOrPharmacist: { type: String, default: '' },
  dispensedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'dispensinglogs' });

const ClinicDispensingLog = mongoose.models.ClinicDispensingLog
  || mongoose.model('ClinicDispensingLog', clinicDispensingLogSchema);

export default ClinicDispensingLog;

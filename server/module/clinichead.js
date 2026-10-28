import mongoose from 'mongoose';

const medicalCertificateSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  reason: { type: String, required: true },
  doctorName: { type: String, required: true },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date, default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'returned'], default: 'pending' },
  requestDate: { type: Date, default: Date.now },
  reviewHistory: [{
    action: { type: String, enum: ['submitted', 'approved', 'rejected', 'returned'], required: true },
    previousStatus: { type: String, default: '' },
    status: { type: String, required: true },
    comment: { type: String, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    actedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const MedicalCertificate = mongoose.model('clinichead', medicalCertificateSchema);

export default MedicalCertificate;

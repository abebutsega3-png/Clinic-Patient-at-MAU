import mongoose from 'mongoose';

const examinationCardRoomTransferSchema = new mongoose.Schema({
  patientRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  patientId: { type: String, trim: true, required: true },
  mrn: { type: String, trim: true, required: true },
  patientName: { type: String, trim: true, required: true },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicVisit', default: null },
  sourceRoom: { type: String, default: 'EXAMINATION_ROOM' },
  destinationRoom: { type: String, default: 'CARD_ROOM' },
  documents: {
    individualFolder: { type: Boolean, default: true },
    patientCard: { type: Boolean, default: true },
    labRequestResult: { type: Boolean, default: true },
  },
  snapshot: {
    individualFolder: { type: mongoose.Schema.Types.Mixed, default: null },
    patientCard: { type: mongoose.Schema.Types.Mixed, default: null },
    labRequestResult: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  remarks: { type: String, trim: true, maxlength: 1000, default: '' },
  status: {
    type: String,
    enum: ['SENT_TO_CARD_ROOM', 'RECEIVED_BY_CARD_ROOM'],
    default: 'SENT_TO_CARD_ROOM',
    index: true,
  },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sentByName: { type: String, trim: true, default: '' },
  sentAt: { type: Date, default: Date.now, index: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receivedByName: { type: String, trim: true, default: '' },
  receivedAt: { type: Date, default: null },
}, { timestamps: true });

examinationCardRoomTransferSchema.index({ status: 1, sentAt: -1 });

const ExaminationCardRoomTransfer = mongoose.models.ExaminationCardRoomTransfer
  || mongoose.model('ExaminationCardRoomTransfer', examinationCardRoomTransferSchema);

export default ExaminationCardRoomTransfer;

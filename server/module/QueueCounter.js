import mongoose from 'mongoose';

const queueCounterSchema = new mongoose.Schema({
  _id: { type: String },
  sequence: { type: Number, default: 0, min: 0 },
}, { versionKey: false, collection: 'queuecounters' });

const QueueCounter = mongoose.models.QueueCounter
  || mongoose.model('QueueCounter', queueCounterSchema);

export default QueueCounter;

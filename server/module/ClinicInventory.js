import mongoose from 'mongoose';

const clinicInventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  itemCode: { type: String, trim: true, default: '' },
  masterDataId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterDataRecord', default: null, index: true },
  category: { type: String, trim: true, default: 'Other' },
  storageLocation: { type: String, trim: true, default: '' },
  quantity: { type: Number, required: true, min: 0 },
  reorderLevel: { type: Number, required: true, min: 0, default: 0 },
  unit: { type: String, trim: true, default: 'units' },
  expiryDate: { type: Date, default: null },
  batches: [{
    batchNumber: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 0, default: 0 },
    expiryDate: { type: Date, default: null }
  }]
}, { timestamps: true });

clinicInventorySchema.index({ quantity: 1, reorderLevel: 1 });

const ClinicInventory = mongoose.models.ClinicInventory
  || mongoose.model('ClinicInventory', clinicInventorySchema);

export default ClinicInventory;

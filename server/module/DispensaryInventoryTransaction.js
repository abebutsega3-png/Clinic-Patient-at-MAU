import mongoose from 'mongoose';

const dispensaryInventoryTransactionSchema = new mongoose.Schema({
  modelNumber: { type: String, required: true, trim: true },
  modelType: { type: String, enum: ['Model 19', 'Model 22'], required: true },
  transactionType: { type: String, required: true, trim: true },
  source: { type: String, trim: true, default: '' },
  destination: { type: String, trim: true, default: '' },
  poNumber: { type: String, trim: true, default: '' },
  buyer: { type: String, trim: true, default: '' },
  performedBy: { type: String, trim: true, default: '' },
  transactionDate: { type: Date, default: Date.now },
  items: [{
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicInventory', required: true },
    itemCode: { type: String, trim: true, default: '' },
    itemDescription: { type: String, required: true, trim: true },
    uom: { type: String, trim: true, default: '' },
    subInventory: { type: String, trim: true, default: '' },
    itemCategory: { type: String, trim: true, default: '' },
    batchNumber: { type: String, trim: true, default: '' },
    serialNumber: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date, default: null },
    sequenceFrom: { type: String, trim: true, default: '' },
    sequenceTo: { type: String, trim: true, default: '' },
    remark: { type: String, trim: true, default: '' },
  }],
}, { timestamps: true });

const DispensaryInventoryTransaction = mongoose.models.DispensaryInventoryTransaction
  || mongoose.model('DispensaryInventoryTransaction', dispensaryInventoryTransactionSchema);

export default DispensaryInventoryTransaction;

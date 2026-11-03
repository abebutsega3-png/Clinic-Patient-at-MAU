import mongoose from 'mongoose';

const requisitionItemSchema = new mongoose.Schema({
  itemCode: { type: String, required: true, trim: true, maxlength: 80 },
  itemDescription: { type: String, required: true, trim: true, maxlength: 200 },
  uom: { type: String, required: true, trim: true, maxlength: 40 },
  itemCategory: { type: String, trim: true, default: 'Medical Supplies', maxlength: 120 },
  requestedQty: { type: Number, required: true, min: 1 },
  approvedQty: { type: Number, default: 0, min: 0 },
  issuedQty: { type: Number, default: 0, min: 0 },
  receivedQty: { type: Number, default: 0, min: 0 },
  receipts: [{
    quantity: { type: Number, required: true, min: 0 },
    batchNumber: { type: String, required: true, trim: true },
    serialNumber: { type: String, trim: true, default: '' },
    expiryDate: { type: Date, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: String, trim: true, default: '' },
  }],
});

const requisitionSchema = new mongoose.Schema({
  requisitionNo: { type: String, required: true, unique: true, trim: true },
  requestedBy: { type: String, required: true, trim: true },
  department: { type: String, default: 'Dispensary / Pharmacy', trim: true },
  reason: { type: String, required: true, trim: true },
  items: {
    type: [requisitionItemSchema],
    required: true,
    validate: {
      validator: (items) => Array.isArray(items) && items.length > 0 && items.length <= 100,
      message: 'A requisition must contain between 1 and 100 items.',
    },
  },
  status: {
    type: String,
    enum: ['Pending Approval', 'Approved', 'Partially Issued', 'Issued', 'Issued (Model 22)', 'Partially Received', 'Rejected', 'Received'],
    default: 'Pending Approval',
  },
  model22Reference: { type: String, trim: true, default: '' },
  model22Issues: [{
    model22Reference: { type: String, required: true, trim: true },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: String, trim: true, default: '' },
    items: [{
      requisitionItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
      quantity: { type: Number, required: true, min: 0 },
    }],
  }],
  approvedBy: { type: String, trim: true, default: '' },
  approvedAt: { type: Date, default: null },
  issuedAt: { type: Date, default: null },
  receivedBy: { type: String, trim: true, default: '' },
  receivedAt: { type: Date, default: null },
  approvalRemark: { type: String, trim: true, default: '' },
}, { timestamps: true, optimisticConcurrency: true });

const StoreRequisition = mongoose.models.StoreRequisition
  || mongoose.model('StoreRequisition', requisitionSchema, 'storerequisitions');

export default StoreRequisition;

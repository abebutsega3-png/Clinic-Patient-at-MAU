const mongoose = require('mongoose');

const dispensaryItemSchema = new mongoose.Schema({
  itemCode: { type: String, required: true, unique: true }, // e.g. "107101101.0025"
  itemDescription: { type: String, required: true }, // e.g. "Amoxicillin 500mg (50x10)"
  uom: { type: String, required: true }, // Unit of Measurement: PKT, EA, LT, etc.
  subInventory: { type: String, default: 'Clinical S' },
  itemCategory: { type: String, required: true }, // e.g. "Medical Supplies & Related Accessories"
  
  // Stock & Batch Tracking
  batchNo: { type: String, required: true },
  serialNo: { type: String, default: '-' },
  quantity: { type: Number, required: true, default: 0 },
  unitPrice: { type: Number, required: true },
  totalAmount: { type: Number, default: 0 },
  expiryDate: { type: Date, required: true },
  
  // Government/MAU Official Voucher References
  model19Number: { type: String }, // Receipt Model 19 No.
  model22Number: { type: String }, // Issue Model 22 No.
  source: { type: String }, // e.g., "Ethiopian Pharmaceutical Supply Agency"
  
  status: { 
    type: String, 
    enum: ['Available', 'Low Stock', 'Out of Stock', 'Expired'], 
    default: 'Available' 
  }
}, { timestamps: true });

// Auto-calculate total amount before saving
dispensaryItemSchema.pre('save', function(next) {
  this.totalAmount = this.quantity * this.unitPrice;
  if (this.quantity === 0) {
    this.status = 'Out of Stock';
  } else if (this.quantity < 10) {
    this.status = 'Low Stock';
  } else {
    this.status = 'Available';
  }
  next();
});

module.exports = mongoose.model('Dispensaryinventory', dispensaryItemSchema);
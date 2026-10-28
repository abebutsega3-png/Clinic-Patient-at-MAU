const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  department: { type: String, default: 'Card Room', required: true },
  requesterName: { type: String, required: true },
  requestType: { type: String, enum: ['Purchase', 'Leave'], required: true },
  
  // Purchase Request fields
  category: { type: String },
  itemName: { type: String },
  quantity: { type: Number },
  urgency: { type: String, enum: ['Routine', 'Urgent'] },

  // Leave Request fields
  leaveType: { type: String, enum: ['Annual', 'Sick', 'Emergency'] },
  startDate: { type: Date },
  endDate: { type: Date },
  reason: { type: String },

  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RequestsAndProcurement', requestSchema);
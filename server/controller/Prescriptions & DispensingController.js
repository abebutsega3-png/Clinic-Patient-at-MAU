const Prescription = require('../models/Prescriptions & Dispensing');

// @desc    Get all pending prescription orders for Dispensary Queue
// @route   GET /api/dispensary/pending-orders
const getPendingOrders = async (req, res) => {
  try {
    const pendingOrders = await Prescription.find({ status: 'Pending' }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, count: pendingOrders.length, data: pendingOrders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Dispense medicine & update prescription status
// @route   POST /api/dispensary/dispense/:id
const dispensePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacistName } = req.body;

    const prescription = await Prescription.findByIdAndUpdate(
      id,
      {
        status: 'Dispensed',
        dispensedBy: pharmacistName || 'Pharmacist',
        dispensedAt: Date.now()
      },
      { new: true }
    );

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription order not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Medicine dispensed successfully and record updated.', 
      data: prescription 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get history of all dispensed medicines
// @route   GET /api/dispensary/history
const getDispensingHistory = async (req, res) => {
  try {
    const history = await Prescription.find({ status: 'Dispensed' }).sort({ dispensedAt: -1 });
    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPendingOrders,
  dispensePrescription,
  getDispensingHistory
};
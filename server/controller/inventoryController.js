const DispensaryItem = require('../models/Dispensaryinventory');

// @desc    Get all stock inventory items
// @route   GET /api/inventory/stock
const getStockList = async (req, res) => {
  try {
    const items = await DispensaryItem.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Receive new stock via Model 19 (Goods Receiving)
// @route   POST /api/inventory/model19-receive
const receiveModel19Stock = async (req, res) => {
  try {
    const {
      itemCode,
      itemDescription,
      uom,
      itemCategory,
      batchNo,
      quantity,
      unitPrice,
      expiryDate,
      model19Number,
      source
    } = req.body;

    const newItem = new DispensaryItem({
      itemCode,
      itemDescription,
      uom,
      itemCategory,
      batchNo,
      quantity,
      unitPrice,
      expiryDate,
      model19Number,
      source
    });

    await newItem.save();
    res.status(201).json({ success: true, message: 'Stock received via Model 19 successfully', data: newItem });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Issue stock items via Model 22
// @route   POST /api/inventory/model22-issue/:id
const issueModel22Stock = async (req, res) => {
  try {
    const { id } = req.params;
    const { issueQty, model22Number } = req.body;

    const item = await DispensaryItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in inventory' });
    }

    if (item.quantity < issueQty) {
      return res.status(400).json({ success: false, message: 'Insufficient stock quantity to issue' });
    }

    item.quantity -= issueQty;
    item.model22Number = model22Number;
    await item.save();

    res.status(200).json({ success: true, message: 'Stock issued via Model 22 successfully', data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get low stock & expiring item alerts
// @route   GET /api/inventory/alerts
const getStockAlerts = async (req, res) => {
  try {
    const lowStock = await DispensaryItem.find({ quantity: { $lte: 10 } });
    
    // Get items expiring in the next 90 days
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setDate(threeMonthsFromNow.getDate() + 90);

    const expiringSoon = await DispensaryItem.find({
      expiryDate: { $lte: threeMonthsFromNow }
    });

    res.status(200).json({
      success: true,
      alerts: {
        lowStockCount: lowStock.length,
        lowStock,
        expiringSoonCount: expiringSoon.length,
        expiringSoon
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getStockList,
  receiveModel19Stock,
  issueModel22Stock,
  getStockAlerts
};
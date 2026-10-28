const { Medicine, DispensingLog } = require('../models/Pharmacy$ Inventery');
const ApprovalRequest = require('../models/ApprovalRequest'); // የቀድሞው የመግዣ ጥያቄ ሞዴል

// 1. የክሊኒክ ኃላፊው የሚያያቸው የፋርማሲ መረጃዎች (Dashboard & Stock View)
exports.getPharmacyOverview = async (req, res) => {
  try {
    const { search, statusFilter } = req.query;
    const now = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(now.getMonth() + 3);

    // A. Stock Query Filter
    let stockQuery = {};
    if (search) {
      stockQuery.name = { $regex: search, $options: 'i' };
    }

    const allMedicines = await Medicine.find(stockQuery).sort({ name: 1 });

    // B. Calculate Dynamic Metrics (Summary Cards)
    let totalItems = allMedicines.length;
    let lowStockCount = 0;
    let expiringSoonCount = 0;
    let outOfStockCount = 0;

    const medicinesWithStatus = allMedicines.map(med => {
      let status = 'in_stock';
      
      if (med.quantity === 0) {
        status = 'out_of_stock';
        outOfStockCount++;
      } else if (med.quantity <= med.minReorderLevel) {
        status = 'low_stock';
        lowStockCount++;
      }

      if (new Date(med.expiryDate) <= threeMonthsLater && med.quantity > 0) {
        expiringSoonCount++;
      }

      return {
        ...med._doc,
        computedStatus: status
      };
    });

    // C. Status Filter
    let filteredMedicines = medicinesWithStatus;
    if (statusFilter && statusFilter !== 'all') {
      filteredMedicines = medicinesWithStatus.filter(m => m.computedStatus === statusFilter);
    }

    // D. Fetch Purchase Requests Status (Read-Only)
    const purchaseRequests = await ApprovalRequest.find({ requestType: 'purchase' })
      .select('purchaseDetails status createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      summaryCards: {
        totalItems,
        lowStockCount,
        expiringSoonCount,
        outOfStockCount
      },
      stockTable: filteredMedicines,
      purchaseRequests
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. የመድኃኒት ስርጭት ሪፖርት (Dispensing Report with Date Filter)
exports.getDispensingReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};
    if (startDate && endDate) {
      query.dispensedAt = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }

    // Grouping & Aggregating Total Quantities Dispensed Per Medicine
    const report = await DispensingLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$medicineName',
          totalQuantityDispensed: { $sum: '$quantityDispensed' },
          totalTimesDispensed: { $sum: 1 }
        }
      },
      { $sort: { totalQuantityDispensed: -1 } }
    ]);

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
import ClinicInventory from '../module/ClinicInventory.js';
import ApprovalRequest from '../module/ClinicheadApproval.js';
import ClinicDispensingLog from '../module/ClinicDispensingLog.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return null;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate || '') || !datePattern.test(endDate || '') || startDate > endDate) {
    return null;
  }
  const isCalendarDate = (value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return null;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
};

export const getPharmacyOverview = async (req, res) => {
  try {
    const { search = '', statusFilter = 'all' } = req.query;
    const now = new Date();
    if (!['all', 'in_stock', 'low_stock', 'out_of_stock', 'expired', 'expiring_soon'].includes(statusFilter)) {
      return res.status(400).json({ success: false, message: 'Choose a valid inventory status filter.' });
    }

    const [inventoryItems, purchaseRequests, pendingPurchaseRequestCount, settings] = await Promise.all([
      ClinicInventory.find().sort({ itemName: 1 }).lean(),
      ApprovalRequest.find({ requestType: 'purchase_request' })
        .select('requestNumber applicantName applicantId department reason priority purchase status fulfillmentStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      ApprovalRequest.countDocuments({ requestType: 'purchase_request', status: 'pending' }),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('inventoryRules').lean()
    ]);
    const expiryWarningDays = settings?.inventoryRules?.expiryWarningDays || 90;
    const expiryWarningDate = new Date(now.getTime() + (expiryWarningDays * 24 * 60 * 60 * 1000));
    const categoryThresholds = new Map(
      (settings?.inventoryRules?.categoryThresholds || [])
        .map(({ category, threshold }) => [category.trim().toLocaleLowerCase(), threshold])
    );
    const defaultThreshold = settings?.inventoryRules?.defaultThreshold ?? 20;

    const stockTable = inventoryItems.map((item) => {
      const batches = Array.isArray(item.batches) ? item.batches : [];
      const datedBatches = batches
        .filter((batch) => batch.expiryDate && Number(batch.quantity) > 0)
        .map((batch) => ({
          batchNumber: batch.batchNumber || '',
          quantity: batch.quantity,
          expiryDate: batch.expiryDate
        }))
        .sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate));
      const expiryEntries = (datedBatches.length
        ? datedBatches
        : Number(item.quantity) > 0 && item.expiryDate
          ? [{ batchNumber: '', quantity: item.quantity, expiryDate: item.expiryDate }]
          : [])
        .map((batch) => {
          const expiryDate = new Date(batch.expiryDate);
          return {
            ...batch,
            expired: expiryDate < now,
            expiringSoon: expiryDate >= now && expiryDate <= expiryWarningDate
          };
        });
      const expiryDates = expiryEntries.map(({ expiryDate }) => expiryDate);
      const expired = expiryEntries.some(({ expired: isExpired }) => isExpired);
      const expiringSoon = expiryEntries.some(({ expiringSoon: isExpiringSoon }) => isExpiringSoon);
      const categoryThreshold = categoryThresholds.get(String(item.category || '').trim().toLocaleLowerCase());
      const effectiveReorderLevel = categoryThreshold ?? defaultThreshold ?? Number(item.reorderLevel);
      const computedStatus = Number(item.quantity) <= 0
        ? 'out_of_stock'
        : Number(item.quantity) <= effectiveReorderLevel
          ? 'low_stock'
          : 'in_stock';

      return {
        ...item,
        batches: datedBatches,
        expiryEntries,
        expiryDates,
        expired,
        expiringSoon,
        effectiveReorderLevel,
        computedStatus
      };
    });
    const summaryCards = {
      totalItems: inventoryItems.length,
      lowStockCount: stockTable.filter((item) => item.computedStatus === 'low_stock').length,
      expiringSoonCount: stockTable.filter((item) => item.expiringSoon).length,
      outOfStockCount: stockTable.filter((item) => item.computedStatus === 'out_of_stock').length,
      expiredCount: stockTable.filter((item) => item.expired).length,
      pendingPurchaseRequestCount
    };
    const matchingSearch = search.trim()
      ? new RegExp(escapeRegex(search.trim()), 'i')
      : null;
    const filteredStock = stockTable.filter((item) => {
      if (matchingSearch && !matchingSearch.test(item.itemName)) return false;
      if (statusFilter === 'expired') return item.expired;
      if (statusFilter === 'expiring_soon') return item.expiringSoon;
      return statusFilter === 'all' || item.computedStatus === statusFilter;
    });

    return res.status(200).json({
      success: true,
      summaryCards,
      expiryWarningDays,
      stockTable: filteredStock,
      purchaseRequests
    });
  } catch (error) {
    console.error('Failed to load clinic-head pharmacy overview:', error);
    return res.status(500).json({ success: false, message: 'Unable to load pharmacy inventory overview.' });
  }
};

export const getDispensingReport = async (req, res) => {
  const range = parseDateRange(req.query.startDate, req.query.endDate);
  if ((req.query.startDate || req.query.endDate) && !range) {
    return res.status(400).json({ success: false, message: 'Provide a valid start and end date for the report.' });
  }

  try {
    const match = range ? { dispensedAt: { $gte: range.start, $lte: range.end } } : {};
    const report = await ClinicDispensingLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$medicineName',
          totalQuantityDispensed: { $sum: '$quantityDispensed' },
          totalTimesDispensed: { $sum: 1 },
          patientCount: { $addToSet: '$dispensedToPatientId' }
        }
      },
      {
        $project: {
          _id: 1,
          totalQuantityDispensed: 1,
          totalTimesDispensed: 1,
          patientCount: {
            $size: {
              $filter: {
                input: '$patientCount',
                as: 'patientId',
                cond: { $ne: ['$$patientId', ''] }
              }
            }
          }
        }
      },
      { $sort: { totalQuantityDispensed: -1, _id: 1 } }
    ]);

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('Failed to load clinic-head dispensing report:', error);
    return res.status(500).json({ success: false, message: 'Unable to load dispensing report.' });
  }
};

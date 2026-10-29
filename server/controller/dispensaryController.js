import { Queue } from '../module/AdminDashboardModels.js';
import ClinicDispensingLog from '../module/ClinicDispensingLog.js';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import Department from '../module/Department.js';
import Patient from '../module/Patient.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
const getClinicDateKey = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getInventoryStatus = (item, thresholds, defaultThreshold) => {
  const categoryThreshold = thresholds.get(String(item.category || '').trim().toLocaleLowerCase());
  const reorderLevel = categoryThreshold ?? defaultThreshold ?? Number(item.reorderLevel);
  return Number(item.quantity) <= 0
    ? 'out_of_stock'
    : Number(item.quantity) <= reorderLevel
      ? 'low_stock'
      : 'in_stock';
};

export const getDispensaryDashboard = async (req, res) => {
  try {
    const activeRole = String(req.user?.activeRole || req.user?.role || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ');
    const isPharmacist = activeRole === 'pharmacist';
    const today = getClinicDateKey(new Date());
    const [inventory, settings, dispensaryDepartment] = await Promise.all([
      ClinicInventory.find().select('itemName category quantity reorderLevel unit expiryDate batches').sort({ itemName: 1 }).lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('inventoryRules').lean(),
      Department.findOne({ code: 'DISP', status: 'Active' }).select('name').lean(),
    ]);

    const expiryWarningDays = settings?.inventoryRules?.expiryWarningDays || 90;
    const expiryWarningDate = new Date(Date.now() + expiryWarningDays * 24 * 60 * 60 * 1000);
    const thresholds = new Map((settings?.inventoryRules?.categoryThresholds || [])
      .map(({ category, threshold }) => [String(category).trim().toLocaleLowerCase(), threshold]));
    const defaultThreshold = settings?.inventoryRules?.defaultThreshold ?? 20;
    const inventoryStatus = inventory.map((item) => {
      const entries = (Array.isArray(item.batches) && item.batches.length
        ? item.batches.filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate)
        : Number(item.quantity) > 0 && item.expiryDate
          ? [{ quantity: item.quantity, expiryDate: item.expiryDate }]
          : [])
        .map((batch) => {
          const expiryDate = new Date(batch.expiryDate);
          return {
            expiryDate: batch.expiryDate,
            expired: expiryDate < new Date(),
            expiringSoon: expiryDate >= new Date() && expiryDate <= expiryWarningDate,
          };
        });
      const expired = entries.some((batch) => batch.expired);
      const expiringSoon = entries.some((batch) => batch.expiringSoon);
      const firstAlertExpiry = entries
        .filter((batch) => batch.expired || batch.expiringSoon)
        .sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate))[0]?.expiryDate;
      return {
        ...item,
        computedStatus: getInventoryStatus(item, thresholds, defaultThreshold),
        expired,
        expiringSoon,
        firstAlertExpiry,
      };
    });

    const queueFilter = isPharmacist && dispensaryDepartment
      ? {
        clinicDate: today,
        department: dispensaryDepartment.name,
        status: { $in: ['waiting', 'called', 'routed', 'in_progress'] },
      }
      : null;
    const [todayQueueCount, pendingDispenseCount, queue, weeklyTrend, topDispensed] = await Promise.all([
      queueFilter ? Queue.countDocuments({
        clinicDate: today,
        department: dispensaryDepartment.name,
        status: { $nin: ['cancelled', 'no_show'] },
      }) : Promise.resolve(null),
      queueFilter ? Queue.countDocuments(queueFilter) : Promise.resolve(null),
      queueFilter ? Queue.find(queueFilter)
        .select('patientId patientName visitId queueNumber priority status arrivedAt')
        .sort({ priority: -1, arrivedAt: 1 })
        .limit(8)
        .lean() : Promise.resolve([]),
      ClinicDispensingLog.aggregate([
        { $match: { dispensedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$dispensedAt', timezone: clinicTimeZone },
            },
            quantityDispensed: { $sum: '$quantityDispensed' },
            patients: { $addToSet: '$dispensedToPatientId' },
          },
        },
        {
          $project: {
            date: '$_id',
            quantityDispensed: 1,
            patientCount: {
              $size: {
                $filter: {
                  input: '$patients',
                  as: 'patient',
                  cond: { $ne: ['$$patient', ''] },
                },
              },
            },
          },
        },
        { $sort: { date: 1 } },
      ]),
      ClinicDispensingLog.aggregate([
        { $match: { dispensedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: '$medicineName',
            quantityDispensed: { $sum: '$quantityDispensed' },
            timesDispensed: { $sum: 1 },
          },
        },
        { $sort: { quantityDispensed: -1, _id: 1 } },
        { $limit: 5 },
      ]),
    ]);

    const patientIds = [...new Set(queue.map((item) => item.patientId).filter(Boolean))];
    const patients = patientIds.length
      ? await Patient.find({ patientId: { $in: patientIds } }).select('patientId cardNumber').lean()
      : [];
    const cardNumbers = new Map(patients.map((patient) => [patient.patientId, patient.cardNumber]));
    const lowStockItems = inventoryStatus
      .filter((item) => ['low_stock', 'out_of_stock'].includes(item.computedStatus))
      .slice(0, 5)
      .map(({ itemName, quantity, unit, computedStatus }) => ({ itemName, quantity, unit, status: computedStatus }));
    const expiryItems = inventoryStatus
      .filter((item) => item.expired || item.expiringSoon)
      .sort((left, right) => new Date(left.firstAlertExpiry || 0) - new Date(right.firstAlertExpiry || 0))
      .slice(0, 5)
      .map(({ itemName, firstAlertExpiry, expired }) => ({
        itemName,
        expiryDate: firstAlertExpiry,
        status: expired ? 'Expired' : 'Expiring soon',
      }));
    const trendByDate = new Map(weeklyTrend.map((day) => [day.date, day]));
    const firstTrendDate = new Date(`${today}T00:00:00.000Z`);
    firstTrendDate.setUTCDate(firstTrendDate.getUTCDate() - 6);
    const completeWeeklyTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(firstTrendDate);
      date.setUTCDate(date.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      return trendByDate.get(dateKey) || { date: dateKey, quantityDispensed: 0, patientCount: 0 };
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          todayQueueCount,
          pendingDispenseCount,
          lowStockCount: inventoryStatus.filter((item) => ['low_stock', 'out_of_stock'].includes(item.computedStatus)).length,
          expiringSoonCount: inventoryStatus.filter((item) => item.expiringSoon).length,
          expiredCount: inventoryStatus.filter((item) => item.expired).length,
          totalStockItems: inventoryStatus.length,
        },
        queueAvailable: isPharmacist && Boolean(dispensaryDepartment),
        pendingQueue: queue.map((item) => ({
          patientName: item.patientName || 'Patient',
          cardNumber: cardNumbers.get(item.patientId) || item.patientId,
          queueNumber: item.queueNumber || '—',
          priority: item.priority,
          status: item.status,
          arrivedAt: item.arrivedAt,
          prescriptionAvailable: false,
        })),
        alerts: { lowStockItems, expiryItems },
        weeklyTrend: completeWeeklyTrend,
        topDispensed: topDispensed.map(({ _id, ...item }) => ({ name: _id, ...item })),
      },
    });
  } catch (error) {
    console.error('Failed to load dispensary dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load dispensary dashboard data.' });
  }
};

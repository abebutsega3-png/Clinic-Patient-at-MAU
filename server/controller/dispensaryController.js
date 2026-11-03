import mongoose from 'mongoose';
import { Queue } from '../module/AdminDashboardModels.js';
import ClinicDispensingLog from '../module/ClinicDispensingLog.js';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import ClinicVisit from '../module/ClinicVisit.js';
import Department from '../module/Department.js';
import Patient from '../module/Patient.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

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

export const getDispensaryDashboard = async (req, res) => {
  try {
    const activeRole = String(req.user?.activeRole || req.user?.role || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ');
    const isPharmacist = activeRole === 'pharmacist';
    const today = getClinicDateKey(new Date());
    const [inventory, settings, dispensaryDepartment, prescriptionVisits] = await Promise.all([
      ClinicInventory.find().select('itemName itemCode category storageLocation quantity reorderLevel unit expiryDate batches').sort({ itemName: 1 }).lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('inventoryRules').lean(),
      Department.findOne({ code: 'DISP', status: 'Active' }).select('name').lean(),
      ClinicVisit.find({
        'examination.prescriptions.0': { $exists: true },
        $or: [
          { 'examination.prescriptionStatus': { $in: ['Pending', 'Partially dispensed', ''] } },
          { 'examination.prescriptionStatus': { $exists: false } },
        ],
      })
        .select('visitId patientId patientName patientRecordId visitDate diagnosis examination.vitals examination.prescriptionPatientType examination.prescriptions examination.prescriptionStatus examination.prescriber examination.prescriptionEvaluatedBy examination.prescriptionEvaluatedAt examination.prescriptionAllergyReviewedBy examination.prescriptionAllergyReviewedAt examination.prescriptionDispensedBy examination.prescriptionDispensedAt')
        .populate({ path: 'patientRecordId', select: 'fullName cardNumber universityIdNumber governmentIdNumber age sex phoneNumber region town woreda kebele allergies' })
        .sort({ visitDate: 1 })
        .limit(100)
        .lean(),
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
      const availableQuantity = (Array.isArray(item.batches) && item.batches.length
        ? item.batches
          .filter((batch) => Number(batch.quantity) > 0 && String(batch.batchNumber || '').trim()
            && batch.expiryDate && new Date(batch.expiryDate) >= new Date())
          .reduce((sum, batch) => sum + Number(batch.quantity), 0)
        : 0);
      const categoryThreshold = thresholds.get(String(item.category || '').trim().toLocaleLowerCase());
      const reorderLevel = categoryThreshold ?? defaultThreshold ?? Number(item.reorderLevel);
      return {
        ...item,
        computedStatus: availableQuantity <= 0
          ? 'out_of_stock'
          : availableQuantity <= reorderLevel ? 'low_stock' : 'in_stock',
        availableQuantity,
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
        pendingPrescriptions: prescriptionVisits.map((visit) => ({
          visitId: String(visit._id),
          visitNumber: visit.visitId || '',
          patientName: visit.patientRecordId?.fullName || visit.patientName || 'Patient',
          cardNumber: visit.patientRecordId?.cardNumber || visit.patientId || '—',
          sex: visit.patientRecordId?.sex || '',
          age: visit.patientRecordId?.age ?? null,
          governmentIdNumber: visit.patientRecordId?.governmentIdNumber || '',
          phoneNumber: visit.patientRecordId?.phoneNumber || '',
          region: visit.patientRecordId?.region || '',
          town: visit.patientRecordId?.town || '',
          woreda: visit.patientRecordId?.woreda || '',
          kebele: visit.patientRecordId?.kebele || '',
          visitDate: visit.visitDate,
          diagnosis: visit.diagnosis || '',
          studentId: visit.patientRecordId?.universityIdNumber || '',
          allergies: visit.patientRecordId?.allergies || [],
          status: visit.examination?.prescriptionStatus || 'Pending',
          patientType: visit.examination?.prescriptionPatientType || 'outpatient',
          weight: visit.examination?.vitals?.weight || '',
          prescriber: visit.examination?.prescriber || {},
          evaluatedBy: visit.examination?.prescriptionEvaluatedBy || '',
          evaluatedAt: visit.examination?.prescriptionEvaluatedAt || null,
          allergyReviewedBy: visit.examination?.prescriptionAllergyReviewedBy || '',
          allergyReviewedAt: visit.examination?.prescriptionAllergyReviewedAt || null,
          dispensedBy: visit.examination?.prescriptionDispensedBy || '',
          dispensedAt: visit.examination?.prescriptionDispensedAt || null,
          prescriptions: (visit.examination?.prescriptions || []).map((item) => ({
            id: String(item._id),
            medicine: item.medicine,
            strength: item.strength || '',
            form: item.form || '',
            dose: item.dose || item.dosage || '',
            frequency: item.frequency || '',
            duration: item.duration || '',
            instructions: item.instructions || '',
            quantity: item.quantity || '',
            quantityUnit: item.quantityUnit || '',
            priceCents: item.priceCents || 0,
            stock: (() => {
              const stockItem = inventoryStatus.find((candidate) => (
                String(candidate.itemName || '').trim().toLowerCase()
                === String(item.medicine || '').trim().toLowerCase()
              ));
              return stockItem
                ? {
                  quantity: stockItem.availableQuantity,
                  unit: stockItem.unit,
                  status: stockItem.computedStatus,
                  batches: (stockItem.batches || [])
                    .filter((batch) => Number(batch.quantity) > 0)
                    .map(({ batchNumber, quantity, expiryDate }) => ({ batchNumber, quantity, expiryDate })),
                }
                : { quantity: 0, unit: '', status: 'not_listed', batches: [] };
            })(),
          })),
        })),
        alerts: { lowStockItems, expiryItems },
        inventory: inventoryStatus,
        expiryWarningDays,
        weeklyTrend: completeWeeklyTrend,
        topDispensed: topDispensed.map(({ _id, ...item }) => ({ name: _id, ...item })),
      },
    });
  } catch (error) {
    console.error('Failed to load dispensary dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load dispensary dashboard data.' });
  }
};

const parseReportDate = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const calendarDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value) return null;
  return new Date(calendarDate.getTime() + (endOfDay ? 21 * 60 * 60 * 1000 - 1 : -3 * 60 * 60 * 1000));
};

export const getDispensaryHistory = async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? parseReportDate(startDate) : null;
  const end = endDate ? parseReportDate(endDate, true) : null;
  if ((startDate && !start) || (endDate && !end) || (start && end && start > end)) {
    return res.status(400).json({ success: false, message: 'Provide a valid report date range.' });
  }
  try {
    const filter = {};
    if (start || end) filter.dispensedAt = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
    const logs = await ClinicDispensingLog.find(filter)
      .sort({ dispensedAt: -1 })
      .limit(500)
      .lean();
    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('Failed to load dispensary issue history:', error);
    return res.status(500).json({ success: false, message: 'Unable to load dispensary issue history.' });
  }
};

export const updatePrescriptionDispensing = async (req, res) => {
  const { visitId } = req.params;
  const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
  const allergyReviewed = req.body?.allergyReviewed === true;
  const allowedStatuses = new Set(['Pending', 'Dispensed', 'Cancelled']);
  const prices = req.body?.prices;
  if (!visitId || !/^[a-f\d]{24}$/i.test(visitId) || !allowedStatuses.has(status) || !Array.isArray(prices)) {
    return res.status(400).json({ success: false, message: 'Provide a valid prescription status and medicine price list.' });
  }
  if (status === 'Dispensed' && !allergyReviewed) {
    return res.status(409).json({ success: false, message: 'Review and confirm the patient allergy status before dispensing.' });
  }
  try {
    const session = await mongoose.startSession();
    let savedVisit;
    try {
      await session.withTransaction(async () => {
        const visit = await ClinicVisit.findById(visitId).session(session);
        if (!visit) {
          const error = new Error('Prescription visit not found.');
          error.statusCode = 404;
          throw error;
        }
        const examination = visit.examination;
        const currentStatus = examination?.prescriptionStatus || 'Pending';
        if (!examination?.prescriptions?.length) {
          const error = new Error('This visit has no prescription items to process.');
          error.statusCode = 409;
          throw error;
        }
        if (!['Pending', 'Partially dispensed'].includes(currentStatus)
          || (currentStatus === 'Partially dispensed' && status === 'Pending')) {
          const error = new Error('This prescription is no longer available for the requested status change.');
          error.statusCode = 409;
          throw error;
        }
        if (prices.length !== examination.prescriptions.length
          || prices.some((item, index) => !item || item.id !== String(examination.prescriptions[index]._id)
            || !Number.isInteger(item.priceCents) || item.priceCents < 0 || item.priceCents > 100000000)) {
          const error = new Error('Enter a valid non-negative Birr/Cent price for every prescribed medicine.');
          error.statusCode = 400;
          throw error;
        }

        if (status === 'Dispensed') {
          for (const prescription of examination.prescriptions) {
            const quantityText = String(prescription.quantity || '').trim();
            const quantityMatch = quantityText.match(/^(\d+(?:\.\d+)?)$/);
            const quantity = quantityMatch ? Number(quantityMatch[1]) : NaN;
            if (!Number.isFinite(quantity) || quantity <= 0) {
              const error = new Error(`Add a numeric quantity for ${prescription.medicine} before dispensing.`);
              error.statusCode = 409;
              throw error;
            }
            const inventoryItem = await ClinicInventory.findOne({
              itemName: { $regex: `^${String(prescription.medicine).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            }).session(session);
            if (!inventoryItem) {
              const error = new Error(`${prescription.medicine} is not listed in dispensary inventory.`);
              error.statusCode = 409;
              throw error;
            }
            const now = new Date();
            const batches = [...(inventoryItem.batches || [])]
              .filter((batch) => Number(batch.quantity) > 0 && String(batch.batchNumber || '').trim()
                && batch.expiryDate && new Date(batch.expiryDate) >= now)
              .sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate));
            const hasBatches = inventoryItem.batches?.length > 0;
            const available = batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
            const usableAvailable = Math.min(available, Number(inventoryItem.quantity));
            if (usableAvailable < quantity) {
              const error = new Error(`${prescription.medicine} is out of stock or has insufficient unexpired stock (available: ${usableAvailable}).`);
              error.statusCode = 409;
              throw error;
            }
            let remaining = quantity;
            const batchIssues = [];
            if (hasBatches) {
              for (const batch of batches) {
                if (!remaining) break;
                const issued = Math.min(Number(batch.quantity), remaining);
                batch.quantity -= issued;
                remaining -= issued;
                batchIssues.push({
                  batchNumber: batch.batchNumber || '',
                  expiryDate: batch.expiryDate,
                  quantityDispensed: issued,
                });
              }
              inventoryItem.batches = inventoryItem.batches.map((batch) => (
                batches.find((validBatch) => String(validBatch._id) === String(batch._id)) || batch
              ));
            }
            inventoryItem.quantity -= quantity;
            await inventoryItem.save({ session });
            await ClinicDispensingLog.create(batchIssues.map((issue) => ({
              medicineId: inventoryItem._id,
              medicineName: inventoryItem.itemName,
              quantityDispensed: issue.quantityDispensed,
              batchNumber: issue.batchNumber,
              expiryDate: issue.expiryDate,
              department: 'Pharmacy',
              dispensedToPatientId: visit.patientId,
              dispensedByDoctorOrPharmacist: String(req.user?.name || '').trim(),
              dispensedAt: now,
            })), { session });
          }
        }

        prices.forEach(({ priceCents }, index) => {
          examination.prescriptions[index].priceCents = priceCents;
        });
        const now = new Date();
        examination.prescriptionEvaluatedBy = String(req.user?.name || '').trim();
        examination.prescriptionEvaluatedAt = now;
        if (status === 'Dispensed') {
          examination.prescriptionAllergyReviewedBy = String(req.user?.name || '').trim();
          examination.prescriptionAllergyReviewedAt = now;
        }
        examination.prescriptionStatus = status;
        if (status === 'Dispensed' || status === 'Partially dispensed') {
          examination.prescriptionDispensedBy = String(req.user?.name || '').trim();
          examination.prescriptionDispensedAt = now;
        }
        savedVisit = await visit.save({ session });
      });
    } finally {
      await session.endSession();
    }
    await writeAuditEvent({
      req,
      action: `PRESCRIPTION_${status.toUpperCase().replaceAll(' ', '_')}`,
      entityType: 'clinic_visit',
      entityId: savedVisit._id,
      details: `Pharmacy updated prescription ${savedVisit.visitId || savedVisit.patientId} to ${status}.`,
    });
    req.app.get('io')?.emit('clinic:prescription-updated', { visitId: String(savedVisit._id) });
    return res.status(200).json({ success: true, message: `Prescription ${status.toLowerCase()}.`, data: savedVisit });
  } catch (error) {
    console.error('Failed to update pharmacy prescription:', error);
    if (error.codeName === 'IllegalOperation' && /transaction/i.test(error.message || '')) {
      return res.status(503).json({
        success: false,
        message: 'Safe dispensing requires MongoDB replica set or mongos transaction support; no stock was issued.',
      });
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Unable to update the prescription.',
    });
  }
};

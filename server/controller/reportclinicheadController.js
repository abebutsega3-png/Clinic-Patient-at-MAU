import mongoose from 'mongoose';
import ClinicVisit from '../module/ClinicVisit.js';
import ClinicDispensingLog from '../module/ClinicDispensingLog.js';
import ClinicDepartmentReport from '../module/ClinicDepartmentReport.js';
import ClinicNotification from '../module/ClinicNotification.js';
import StaffAttendance from '../module/StaffAttendance.js';
import Department from '../module/Department.js';
import { Queue } from '../module/AdminDashboardModels.js';
import { findStaffMembers } from './Staff and rosterController.js';
import ClinicInventory from '../module/ClinicInventory.js';
import ApprovalRequest from '../module/ClinicheadApproval.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const parseDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return { start: null, end: null };
  if (!datePattern.test(startDate || '') || !datePattern.test(endDate || '') || startDate > endDate) {
    return null;
  }

  const startDateCheck = new Date(`${startDate}T00:00:00.000Z`);
  const endDateCheck = new Date(`${endDate}T00:00:00.000Z`);
  if (
    Number.isNaN(startDateCheck.getTime())
    || Number.isNaN(endDateCheck.getTime())
    || startDateCheck.toISOString().slice(0, 10) !== startDate
    || endDateCheck.toISOString().slice(0, 10) !== endDate
  ) return null;
  const start = new Date(`${startDate}T00:00:00+03:00`);
  const end = new Date(`${endDate}T23:59:59.999+03:00`);
  return { start, end };
};

const buildMatch = (range, department) => {
  const match = {};
  if (range.start || range.end) match.visitDate = { $gte: range.start, $lte: range.end };
  if (department && department !== 'All') match.department = department;
  return match;
};

export const getAnalyticsData = async (req, res) => {
  const { startDate = '', endDate = '', department = 'All' } = req.query;
  const range = parseDateRange(startDate, endDate);
  if (!range) {
    return res.status(400).json({ success: false, message: 'Provide a valid start and end date, with start date no later than end date.' });
  }

  try {
    const visitMatch = buildMatch(range, department);
    const trendInterval = range.start && range.end
      && (range.end.getTime() - range.start.getTime()) / 86400000 > 62
      ? 'month'
      : 'day';
    const trendDateFormat = trendInterval === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const dispensingMatch = {};
    if (range.start || range.end) dispensingMatch.dispensedAt = { $gte: range.start, $lte: range.end };
    if (department !== 'All') dispensingMatch.department = department;
    const queueWaitMatch = {
      ...(range.start || range.end ? { arrivedAt: { $gte: range.start, $lte: range.end } } : {}),
      ...(department !== 'All' ? { department } : {}),
      status: { $in: ['in_progress', 'completed'] },
      inProgressAt: { $type: 'date' },
      $expr: { $gte: ['$inProgressAt', '$arrivedAt'] }
    };
    const requestMatch = { requestType: 'purchase_request' };
    if (range.start || range.end) requestMatch.createdAt = { $gte: range.start, $lte: range.end };
    if (department !== 'All') {
      requestMatch.$or = [
        { department },
        { 'purchase.requesterDepartment': department }
      ];
    }

    const [
      summaryRows,
      patientTrends,
      topDiseases,
      departmentWorkload,
      medicineUsage,
      departments,
      configuredDepartments,
      staffDirectory,
      staffPatients,
      queueWaitSummary,
      departmentWaitRows,
      dispensingLogCount,
      leaveRequestCount,
      requisitionSummary,
      inventoryItems,
      inventorySettings
    ] = await Promise.all([
      ClinicVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: null,
            totalPatients: { $sum: 1 },
            emergencyPatients: { $sum: { $cond: ['$emergency', 1, 0] } }
          }
        }
      ]),
      ClinicVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: { $dateToString: { format: trendDateFormat, date: '$visitDate', timezone: 'Africa/Addis_Ababa' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      ClinicVisit.aggregate([
        { $match: { ...visitMatch, diagnosis: { $nin: ['', null] } } },
        { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 }
      ]),
      ClinicVisit.aggregate([
        { $match: { ...visitMatch, department: { $nin: ['', null] } } },
        {
          $group: {
            _id: '$department',
            patientCount: { $sum: 1 }
          }
        },
        { $sort: { patientCount: -1, _id: 1 } }
      ]),
      ClinicDispensingLog.aggregate([
        { $match: dispensingMatch },
        {
          $group: {
            _id: '$medicineName',
            quantityDispensed: { $sum: '$quantityDispensed' },
            timesDispensed: { $sum: 1 }
          }
        },
        { $sort: { quantityDispensed: -1, _id: 1 } },
        { $limit: 10 }
      ]),
      ClinicVisit.distinct('department', { department: { $nin: ['', null] } }),
      Department.find({
        $or: [{ status: 'Active' }, { status: { $exists: false } }]
      }).select('name').sort({ name: 1 }).lean(),
      findStaffMembers({
        ...(department !== 'All' ? { department } : {}),
        includeStudents: true
      }).then((members) => members.filter((staff) => staff.status !== 'Inactive')),
      ClinicVisit.aggregate([
        {
          $match: {
            ...visitMatch,
            status: 'Completed',
            attendedByStaffId: { $ne: null }
          }
        },
        { $group: { _id: '$attendedByStaffId', patientsServed: { $sum: 1 } } }
      ]),
      Queue.aggregate([
        { $match: queueWaitMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgWaitMinutes: {
              $avg: { $divide: [{ $subtract: ['$inProgressAt', '$arrivedAt'] }, 60000] }
            }
          }
        }
      ]),
      Queue.aggregate([
        { $match: queueWaitMatch },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            avgWaitMinutes: {
              $avg: { $divide: [{ $subtract: ['$inProgressAt', '$arrivedAt'] }, 60000] }
            }
          }
        }
      ]),
      ClinicDispensingLog.countDocuments(dispensingMatch),
      ApprovalRequest.countDocuments({
        requestType: { $in: ['leave_request', 'staff_leave'] },
        status: 'approved',
        ...(range.start || range.end ? {
          'leave.startDate': { $lte: range.end },
          'leave.endDate': { $gte: range.start }
        } : {}),
        ...(department !== 'All' ? { department } : {})
      }),
      ApprovalRequest.aggregate([
        { $match: requestMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            estimatedCost: { $sum: { $ifNull: ['$purchase.estimatedCost', 0] } },
            totalApprovalHours: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'approved'] }, { $ne: ['$approvedAt', null] }] },
                  { $divide: [{ $subtract: ['$approvedAt', '$createdAt'] }, 3600000] },
                  0
                ]
              }
            },
            approvedCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'approved'] }, { $ne: ['$approvedAt', null] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      ClinicInventory.find().select('itemName category quantity reorderLevel batches expiryDate').lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('inventoryRules').lean()
    ]);

    const staffIds = staffDirectory.map((staff) => staff._id);
    const attendanceMatch = {
      ...(range.start || range.end ? { date: { $gte: startDate, $lte: endDate } } : {}),
      ...(department !== 'All' ? { staffId: { $in: staffIds } } : {})
    };
    const [staffAttendance, attendanceSummary] = await Promise.all([
      StaffAttendance.aggregate([
        {
          $match: {
            ...attendanceMatch,
            status: { $in: ['present', 'late'] }
          }
        },
        { $group: { _id: '$staffId', attendedDays: { $sum: 1 } } }
      ]),
      StaffAttendance.aggregate([
        { $match: attendanceMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const summary = summaryRows[0] || {};
    const medicineSummary = await ClinicDispensingLog.aggregate([
      { $match: dispensingMatch },
      { $group: { _id: null, totalQuantity: { $sum: '$quantityDispensed' } } }
    ]);
    const attendanceByStaff = new Map(staffAttendance.map((entry) => [String(entry._id), entry.attendedDays]));
    const patientsByStaff = new Map(staffPatients.map((entry) => [String(entry._id), entry.patientsServed]));
    const attendanceCounts = Object.fromEntries(attendanceSummary.map(({ _id, count }) => [_id, count]));
    const staffPerformance = staffDirectory.map((staff) => ({
      staffId: staff._id,
      name: staff.name,
      role: staff.role,
      department: staff.department,
      patientsServed: patientsByStaff.get(String(staff._id)) || 0,
      attendedDays: attendanceByStaff.get(String(staff._id)) || 0,
      averagePatientsPerAttendedDay: attendanceByStaff.get(String(staff._id))
        ? Number(((patientsByStaff.get(String(staff._id)) || 0) / attendanceByStaff.get(String(staff._id))).toFixed(1))
        : null
    }));
    const requisitions = Object.fromEntries(requisitionSummary.map(({ _id, count }) => [_id, count]));
    const estimatedCostByStatus = Object.fromEntries(requisitionSummary.map(({ _id, estimatedCost }) => [_id, estimatedCost || 0]));
    const approvedRequisitions = requisitionSummary.reduce((total, row) => total + (row.approvedCount || 0), 0);
    const totalApprovalHours = requisitionSummary.reduce((total, row) => total + (row.totalApprovalHours || 0), 0);
    const expiryWarningDays = inventorySettings?.inventoryRules?.expiryWarningDays || 90;
    const clinicDateParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
    const clinicToday = new Date(`${clinicDateParts.year}-${clinicDateParts.month}-${clinicDateParts.day}T00:00:00+03:00`);
    const expiryLimit = new Date(clinicToday.getTime() + expiryWarningDays * 86400000);
    const categoryThresholds = new Map(
      (inventorySettings?.inventoryRules?.categoryThresholds || [])
        .map(({ category, threshold }) => [category.trim().toLocaleLowerCase(), threshold])
    );
    const defaultThreshold = inventorySettings?.inventoryRules?.defaultThreshold ?? 20;
    const currentInventory = {
      itemCount: inventoryItems.length,
      lowStockCount: inventoryItems.filter((item) => {
        const threshold = categoryThresholds.get(String(item.category || '').trim().toLocaleLowerCase())
          ?? defaultThreshold
          ?? Number(item.reorderLevel);
        return Number(item.quantity) > 0 && Number(item.quantity) <= threshold;
      }).length,
      outOfStockCount: inventoryItems.filter((item) => Number(item.quantity) <= 0).length,
      expiredBatchCount: 0,
      expiringBatchCount: 0,
      expiryByMonth: []
    };
    const expiryByMonth = new Map();
    inventoryItems.forEach((item) => {
      const batches = Array.isArray(item.batches) && item.batches.length
        ? item.batches.filter((batch) => batch.expiryDate && Number(batch.quantity) > 0)
        : Number(item.quantity) > 0 && item.expiryDate ? [{ expiryDate: item.expiryDate, quantity: item.quantity }] : [];
      batches.forEach((batch) => {
        const expiryDate = new Date(batch.expiryDate);
        if (expiryDate < clinicToday) {
          currentInventory.expiredBatchCount += 1;
        } else if (expiryDate <= expiryLimit) {
          currentInventory.expiringBatchCount += 1;
        }
        if (expiryDate >= clinicToday && expiryDate <= expiryLimit) {
          const monthParts = Object.fromEntries(new Intl.DateTimeFormat('en', {
            timeZone: 'Africa/Addis_Ababa',
            year: 'numeric',
            month: '2-digit'
          }).formatToParts(expiryDate).map(({ type, value }) => [type, value]));
          const month = `${monthParts.year}-${monthParts.month}`;
          expiryByMonth.set(month, (expiryByMonth.get(month) || 0) + 1);
        }
      });
    });
    currentInventory.expiryByMonth = [...expiryByMonth.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([_id, count]) => ({ _id, count }));

    return res.status(200).json({
      success: true,
      trendInterval,
      summary: {
        totalPatients: summary.totalPatients || 0,
        avgWaitTime: queueWaitSummary[0]?.avgWaitMinutes == null
          ? null
          : Math.round(queueWaitSummary[0].avgWaitMinutes),
        emergencyPatients: summary.emergencyPatients || 0,
        totalMedicinesDispensed: dispensingLogCount ? medicineSummary[0]?.totalQuantity || 0 : null,
        attendance: {
          present: attendanceCounts.present || 0,
          late: attendanceCounts.late || 0,
          absent: attendanceCounts.absent || 0,
          approvedLeaveRequests: leaveRequestCount
        },
        requisitions: {
          pending: requisitions.pending || 0,
          approved: requisitions.approved || 0,
          rejected: requisitions.rejected || 0,
          returned: requisitions.returned || 0,
          pendingEstimatedCost: estimatedCostByStatus.pending || 0,
          approvedEstimatedCost: estimatedCostByStatus.approved || 0,
          averageApprovalHours: approvedRequisitions
            ? Number((totalApprovalHours / approvedRequisitions).toFixed(1))
            : null
        }
      },
      patientTrends,
      topDiseases,
      departmentWorkload: departmentWorkload.map((row) => ({
        ...row,
        avgWaitMinutes: departmentWaitRows.find((waitRow) => waitRow._id === row._id)?.avgWaitMinutes ?? null
      })),
      medicineUsage,
      staffPerformance,
      currentInventory,
      inventoryNote: 'Inventory figures are a current snapshot. Historical stock-out, expiry loss and unfilled-demand events are not recorded.',
      departments: [...new Set([
        ...configuredDepartments.map(({ name }) => name),
        ...departments,
        ...staffDirectory.map(({ department: staffDepartment }) => staffDepartment)
      ].filter(Boolean))].sort((left, right) => left.localeCompare(right))
    });
  } catch (error) {
    console.error('Failed to load clinic-head analytics:', error);
    return res.status(500).json({ success: false, message: 'Unable to load clinic reports and analytics.' });
  }
};

export const getDepartmentReports = async (req, res) => {
  const { startDate = '', endDate = '', department = 'All' } = req.query;
  const range = parseDateRange(startDate, endDate);
  if (!range) {
    return res.status(400).json({ success: false, message: 'Provide a valid start and end date, with start date no later than end date.' });
  }

  try {
    const filter = {};
    if (department !== 'All') filter.department = department;
    if (range.start || range.end) filter.submittedAt = { $gte: range.start, $lte: range.end };
    const reports = await ClinicDepartmentReport.find(filter)
      .populate('submittedBy', 'name username')
      .sort({ submittedAt: -1 })
      .limit(200)
      .lean();
    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    console.error('Failed to load department reports:', error);
    return res.status(500).json({ success: false, message: 'Unable to load department reports.' });
  }
};

export const submitDepartmentReport = async (req, res) => {
  const { title, content = '' } = req.body;
  const department = req.user.department?.trim();
  if (!department || typeof title !== 'string' || !title.trim() || typeof content !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Your account must have a department, and the report must include a title and text content.'
    });
  }

  try {
    const report = await ClinicDepartmentReport.create({
      department,
      title: title.trim(),
      content: content.trim()
    });
    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error('Failed to submit department report:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit department report.' });
  }
};

export const markDepartmentReportReviewed = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid department report ID.' });
  }

  try {
    const report = await ClinicDepartmentReport.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'reviewed', reviewedBy: req.user._id, reviewedAt: new Date() } },
      { new: true, runValidators: true }
    ).populate('submittedBy', 'name username').lean();
    if (!report) return res.status(404).json({ success: false, message: 'Department report not found.' });
    if (report.reportType === 'Card Room Report' && report.submittedBy) {
      try {
        await ClinicNotification.create({
          recipient: report.submittedBy,
          sender: req.user._id,
          departmentReport: report._id,
          title: 'Card Room report acknowledged',
          message: `The Clinic Student Head acknowledged your report: ${report.title}.`,
          notificationType: 'clinic_workflow',
          channel: 'in_app',
          priority: 'normal',
          recipientRole: 'Card Chief',
        });
      } catch (notificationError) {
        console.error('Card Room report was acknowledged, but the submitter notification failed:', notificationError);
      }
    }
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('Failed to mark department report as reviewed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update department report status.' });
  }
};

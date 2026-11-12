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
import DispensaryInventoryTransaction from '../module/DispensaryInventoryTransaction.js';
import ApprovalRequest from '../module/ClinicheadApproval.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import ClinicHeadReport from '../module/ClinicHeadReport.js';
import { notifyClinicHeads } from '../utils/clinicHeadAlert.js';

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

const buildDepartmentReportMatch = (range, department, status = 'approved') => {
  const match = { status };
  if (department && department !== 'All') match.department = department;
  if (range.start || range.end) {
    const reportDateRange = { $gte: range.start, $lte: range.end };
    match.$or = [
      { reportDate: reportDateRange },
      { reportDate: null, submittedAt: reportDateRange },
      { reportDate: { $exists: false }, submittedAt: reportDateRange }
    ];
  }
  return match;
};

export const getAnalyticsData = async (req, res) => {
  const { startDate = '', endDate = '', department = 'All' } = req.query;
  const range = parseDateRange(startDate, endDate);
  if (!range) {
    return res.status(400).json({ success: false, message: 'Provide a valid start and end date, with start date no later than end date.' });
  }
  if (typeof department !== 'string' || department.length > 120) {
    return res.status(400).json({ success: false, message: 'Choose a valid department filter.' });
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

    const approvedReportMatch = buildDepartmentReportMatch(range, department);
    const pendingReportMatch = buildDepartmentReportMatch(range, department, {
      $in: ['submitted', 'under_review', 'new']
    });
    const approvalPeriodMatch = { status: 'pending' };
    if (range.start || range.end) approvalPeriodMatch.createdAt = { $gte: range.start, $lte: range.end };
    if (department !== 'All') {
      approvalPeriodMatch.$or = [
        { department },
        { 'purchase.requesterDepartment': department }
      ];
    }
    const queuePeriodMatch = {
      ...(range.start || range.end ? { arrivedAt: { $gte: range.start, $lte: range.end } } : {}),
      ...(department !== 'All' ? { department } : {})
    };
    const referralMatch = {
      ...visitMatch,
      $or: [
        { referred: true },
        { 'examination.referral.department': { $nin: ['', null] } }
      ]
    };
    const inventoryTransactionMatch = {};
    if (range.start || range.end) {
      inventoryTransactionMatch.transactionDate = { $gte: range.start, $lte: range.end };
    }
    const [
      completedServices,
      pendingCases,
      pendingApprovalCount,
      pendingDepartmentReportCount,
      departmentReportAggregates,
      incidentReports,
      referralRows,
      referralDetails,
      inventoryMovementRows,
      referralApprovalRows
    ] = await Promise.all([
      ClinicVisit.countDocuments({ ...visitMatch, status: 'Completed' }),
      Queue.countDocuments({
        ...queuePeriodMatch,
        status: { $in: ['waiting', 'called', 'routed', 'sent_to_examination', 'in_progress'] }
      }),
      ApprovalRequest.countDocuments(approvalPeriodMatch),
      ClinicDepartmentReport.countDocuments(pendingReportMatch),
      ClinicDepartmentReport.aggregate([
        { $match: approvedReportMatch },
        {
          $group: {
            _id: '$department',
            reports: { $sum: 1 },
            patientsServed: { $sum: { $ifNull: ['$patientsServed', 0] } },
            patientsServedReportCount: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$patientsServed', null] }, null] }, 1, 0] }
            },
            completedServices: { $sum: { $ifNull: ['$completedServices', 0] } },
            completedServicesReportCount: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$completedServices', null] }, null] }, 1, 0] }
            },
            pendingCases: { $sum: { $ifNull: ['$pendingCases', 0] } },
            pendingCasesReportCount: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$pendingCases', null] }, null] }, 1, 0] }
            },
            staffPresent: { $sum: { $ifNull: ['$staffPresent', 0] } },
            staffPresentReportCount: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$staffPresent', null] }, null] }, 1, 0] }
            },
            staffAbsent: { $sum: { $ifNull: ['$staffAbsent', 0] } },
            staffAbsentReportCount: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$staffAbsent', null] }, null] }, 1, 0] }
            },
            incidentReports: {
              $sum: {
                $cond: [{
                  $regexMatch: {
                    input: { $ifNull: ['$problemsIncidents', ''] },
                    regex: '.+',
                    options: 's'
                  }
                }, 1, 0]
              }
            },
            criticalIssues: {
              $sum: {
                $cond: [{
                  $regexMatch: {
                    input: { $concat: [
                      { $ifNull: ['$problemsIncidents', ''] },
                      ' ',
                      { $ifNull: ['$medicineSupplyStatus', ''] }
                    ] },
                    regex: 'critical|urgent|shortage|out of stock|unavailable',
                    options: 'i'
                  }
                }, 1, 0]
              }
            }
          }
        },
        { $sort: { patientsServed: -1, _id: 1 } }
      ]),
      ClinicDepartmentReport.find({
        $and: [
          approvedReportMatch,
          {
            $or: [
              { problemsIncidents: { $nin: ['', null] } },
              { medicineSupplyStatus: /shortage|out of stock|unavailable|critical|urgent/i }
            ]
          }
        ]
      })
        .select('department title reportDate submittedAt problemsIncidents medicineSupplyStatus submittedBy')
        .populate('submittedBy', 'name username')
        .sort({ reportDate: -1, submittedAt: -1 })
        .limit(100)
        .lean(),
      ClinicVisit.aggregate([
        { $match: referralMatch },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: [{ $ifNull: ['$examination.referral.department', ''] }, ''] },
                'Not recorded',
                '$examination.referral.department'
              ]
            },
            referrals: { $sum: 1 },
            urgent: { $sum: { $cond: ['$examination.referral.emergency', 1, 0] } }
          }
        },
        { $sort: { referrals: -1, _id: 1 } }
      ]),
      ClinicVisit.aggregate([
        { $match: referralMatch },
        {
          $group: {
            _id: {
              source: {
                $cond: [
                  { $eq: [{ $ifNull: ['$department', ''] }, ''] },
                  'Not recorded',
                  '$department'
                ]
              },
              destination: {
                $cond: [
                  { $eq: [{ $ifNull: ['$examination.referral.department', ''] }, ''] },
                  'Not recorded',
                  '$examination.referral.department'
                ]
              },
              reason: {
                $cond: [
                  { $eq: [{ $ifNull: ['$examination.referral.reason', ''] }, ''] },
                  'Not recorded',
                  '$examination.referral.reason'
                ]
              }
            },
            count: { $sum: 1 },
            urgent: { $sum: { $cond: ['$examination.referral.emergency', 1, 0] } }
          }
        },
        { $sort: { count: -1, '_id.source': 1, '_id.destination': 1 } },
        { $limit: 50 }
      ]),
      DispensaryInventoryTransaction.aggregate([
        { $match: inventoryTransactionMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: { modelType: '$modelType', transactionId: '$_id' },
            quantity: { $sum: '$items.quantity' }
          }
        },
        {
          $group: {
            _id: '$_id.modelType',
            transactions: { $sum: 1 },
            quantity: { $sum: '$quantity' }
          }
        }
      ]),
      ApprovalRequest.aggregate([
        {
          $match: {
            requestType: 'referral',
            ...(range.start || range.end ? { createdAt: { $gte: range.start, $lte: range.end } } : {}),
            ...(department !== 'All' ? { department } : {})
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const approvedReportSummary = departmentReportAggregates.reduce((summaryValue, row) => ({
      reports: summaryValue.reports + row.reports,
      patientsServed: summaryValue.patientsServed + (row.patientsServedReportCount ? row.patientsServed : 0),
      completedServices: summaryValue.completedServices + (row.completedServicesReportCount ? row.completedServices : 0),
      pendingCases: summaryValue.pendingCases + (row.pendingCasesReportCount ? row.pendingCases : 0),
      staffPresent: summaryValue.staffPresent + (row.staffPresentReportCount ? row.staffPresent : 0),
      staffAbsent: summaryValue.staffAbsent + (row.staffAbsentReportCount ? row.staffAbsent : 0),
      incidentReports: summaryValue.incidentReports + row.incidentReports,
      criticalIssues: summaryValue.criticalIssues + row.criticalIssues
    }), {
      reports: 0,
      patientsServed: 0,
      completedServices: 0,
      pendingCases: 0,
      staffPresent: 0,
      staffAbsent: 0,
      incidentReports: 0,
      criticalIssues: 0
    });
    const workloadByDepartment = new Map(departmentWorkload.map((row) => [row._id, row]));
    const approvedReportsByDepartment = new Map(departmentReportAggregates.map((row) => [row._id, row]));
    const departmentPerformance = [...new Set([
      ...configuredDepartments.map(({ name }) => name),
      ...departments,
      ...staffDirectory.map(({ department: staffDepartment }) => staffDepartment),
      ...departmentReportAggregates.map(({ _id }) => _id)
    ].filter(Boolean))].sort((left, right) => left.localeCompare(right)).map((name) => {
      const report = approvedReportsByDepartment.get(name);
      const workload = workloadByDepartment.get(name);
      return {
        department: name,
        patientsRegistered: workload?.patientCount || 0,
        averageWaitMinutes: departmentWaitRows.find((row) => row._id === name)?.avgWaitMinutes ?? null,
        approvedReports: report?.reports || 0,
        patientsServed: report?.patientsServedReportCount ? report.patientsServed : null,
        completedServices: report?.completedServicesReportCount ? report.completedServices : null,
        pendingCases: report?.pendingCasesReportCount ? report.pendingCases : null,
        staffPresent: report?.staffPresentReportCount ? report.staffPresent : null,
        staffAbsent: report?.staffAbsentReportCount ? report.staffAbsent : null,
        incidentReports: report?.incidentReports || 0,
        criticalIssues: report?.criticalIssues || 0,
        departmentStatus: report?.reports ? 'Approved report received' : 'No approved report'
      };
    });
    const referralRequestStatuses = Object.fromEntries(referralApprovalRows.map(({ _id, count }) => [_id, count]));
    const movementsByModel = Object.fromEntries(inventoryMovementRows.map(({ _id, transactions, quantity }) => [
      _id,
      { transactions, quantity }
    ]));
    const referrals = {
      total: referralRows.reduce((total, row) => total + row.referrals, 0),
      urgent: referralRows.reduce((total, row) => total + row.urgent, 0),
      byDepartment: referralRows,
      details: referralDetails,
      approvalRequests: {
        pending: referralRequestStatuses.pending || 0,
        approved: referralRequestStatuses.approved || 0,
        rejected: referralRequestStatuses.rejected || 0,
        returned: referralRequestStatuses.returned || 0
      },
      outcomeTracking: 'Referral completion at the receiving facility is not recorded.'
    };
    const pendingDecisions = pendingApprovalCount + pendingDepartmentReportCount;

    return res.status(200).json({
      success: true,
      trendInterval,
      summary: {
        totalPatients: summary.totalPatients || 0,
        completedServices,
        pendingCases,
        totalStaff: staffDirectory.length,
        departmentsReported: departmentReportAggregates.length,
        approvedDepartmentReports: approvedReportSummary.reports,
        criticalIssues: approvedReportSummary.criticalIssues,
        pendingDecisions,
        avgWaitTime: queueWaitSummary[0]?.avgWaitMinutes == null
          ? null
          : Math.round(queueWaitSummary[0].avgWaitMinutes),
        emergencyPatients: summary.emergencyPatients || 0,
        totalMedicinesDispensed: dispensingLogCount ? medicineSummary[0]?.totalQuantity || 0 : null,
        attendance: {
          present: attendanceCounts.present || 0,
          late: attendanceCounts.late || 0,
          absent: attendanceCounts.absent || 0,
          approvedLeaveRequests: leaveRequestCount,
          overtime: null
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
      departmentPerformance,
      approvedDepartmentSummary: {
        ...approvedReportSummary,
        staffTotal: approvedReportSummary.staffPresent + approvedReportSummary.staffAbsent,
        note: 'Department metrics come only from approved reports. Missing values were not supplied in legacy reports.'
      },
      incidentReports: incidentReports.map((report) => ({
        department: report.department,
        title: report.title,
        reportDate: report.reportDate || report.submittedAt,
        submittedBy: report.submittedBy?.name || report.submittedBy?.username || 'Department staff',
        problems: report.problemsIncidents,
        supplies: report.medicineSupplyStatus
      })),
      referrals,
      inventoryMovements: {
        receivedTransactions: movementsByModel['Model 19']?.transactions || 0,
        receivedQuantity: movementsByModel['Model 19']?.quantity || 0,
        issuedTransactions: movementsByModel['Model 22']?.transactions || 0,
        issuedQuantity: movementsByModel['Model 22']?.quantity || 0
      },
      currentInventory,
      inventoryNote: 'Model 19 receipts and Model 22 issues are totaled for the selected period. Current stock is a snapshot; expiry losses and unfilled-demand events are not recorded.',
      departments: [...new Set([
        ...configuredDepartments.map(({ name }) => name),
        ...departments,
        ...staffDirectory.map(({ department: staffDepartment }) => staffDepartment),
        ...departmentReportAggregates.map(({ _id }) => _id)
      ].filter(Boolean))].sort((left, right) => left.localeCompare(right))
    });
  } catch (error) {
    console.error('Failed to load clinic-head analytics:', error);
    return res.status(500).json({ success: false, message: 'Unable to load clinic reports and analytics.' });
  }
};

const departmentReportStatuses = ['draft', 'submitted', 'under_review', 'approved', 'returned', 'rejected', 'new', 'reviewed'];
const reportCountFields = ['patientsServed', 'completedServices', 'staffPresent', 'staffAbsent', 'pendingCases'];
const reportTextFields = ['problemsIncidents', 'medicineSupplyStatus', 'additionalNotes', 'content'];

const isValidDateOnly = (value) => {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeDepartmentReport = (body, { draft = false } = {}) => {
  const reportType = typeof body.reportType === 'string' ? body.reportType.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const periodType = body.periodType || 'daily';
  if (!reportType || reportType.length > 120 || !title || title.length > 180) {
    return { error: 'Enter a report type and a title (maximum 180 characters).' };
  }
  if (!['daily', 'weekly', 'monthly'].includes(periodType)) {
    return { error: 'Choose a daily, weekly, or monthly reporting period.' };
  }
  if (!draft && !isValidDateOnly(body.reportDate)) {
    return { error: 'Choose a valid report date.' };
  }
  if (body.reportDate && !isValidDateOnly(body.reportDate)) {
    return { error: 'Choose a valid report date.' };
  }

  const data = {
    reportType,
    title,
    periodType,
    reportDate: null,
    periodStart: null,
    periodEnd: null
  };
  if (body.reportDate) data.reportDate = new Date(`${body.reportDate}T00:00:00.000Z`);
  for (const [field, input] of [['periodStart', body.periodStart], ['periodEnd', body.periodEnd]]) {
    if (input) {
      if (!isValidDateOnly(input)) return { error: 'Choose valid period start and end dates.' };
      data[field] = new Date(`${input}T00:00:00.000Z`);
    }
  }
  if (data.periodStart && data.periodEnd && data.periodStart > data.periodEnd) {
    return { error: 'Period start date must not be after the end date.' };
  }
  for (const field of reportCountFields) {
    const raw = body[field];
    const value = raw === '' || raw == null ? 0 : Number(raw);
    if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) {
      return { error: `${field} must be a whole number from 0 to 1,000,000.` };
    }
    data[field] = value;
  }
  for (const field of reportTextFields) {
    const value = body[field] == null ? '' : body[field];
    const limit = field === 'medicineSupplyStatus' ? 3000 : field === 'content' ? 10000 : 5000;
    if (typeof value !== 'string' || value.length > limit) {
      return { error: `${field} must be text no longer than ${limit} characters.` };
    }
    data[field] = value.trim();
  }
  return { data };
};

const reportActor = (user) => ({
  actorId: user?._id || null,
  actorName: user?.name || user?.username || 'Clinic staff'
});

const sendReportSubmissionNotifications = async (req, report) => {
  const warningMessages = [];
  const criticalIssue = /critical|urgent|shortage|out of stock|unavailable/i
    .test(`${report.problemsIncidents} ${report.medicineSupplyStatus}`);
  try {
    await notifyClinicHeads({
      batchId: `department-report-submitted:${report._id}`,
      title: criticalIssue ? 'Critical issue reported' : 'New department report submitted',
      message: `${report.department} submitted ${report.title}.`,
      targetPath: `/clinic-head/department-reports?reportId=${report._id}`,
      priority: criticalIssue ? 'urgent' : 'high',
      notificationType: 'clinic_workflow'
    });
  } catch (error) {
    console.error('Department report was saved, but Clinic Head notifications failed:', error);
    warningMessages.push('The report was saved, but Clinic Head notifications could not be sent.');
  }
  req.app.get('io')?.emit('clinic:department-report-submitted', { reportId: String(report._id) });
  return warningMessages;
};

const sendReportSubmitterNotification = async (report, user, action) => {
  const recipient = report.submittedBy?._id || report.submittedBy;
  if (!recipient) return null;
  const actionLabels = {
    under_review: 'is under review',
    approved: 'was approved',
    returned: 'was returned for correction',
    rejected: 'was rejected',
    reviewed: 'was reviewed',
    commented: 'has a new Clinic Head comment'
  };
  try {
    await ClinicNotification.create({
      recipient,
      sender: user._id,
      departmentReport: report._id,
      title: `Department report ${actionLabels[action] || 'was updated'}`,
      message: `${report.title} ${actionLabels[action] || 'was updated'}.${report.reviewHistory[report.reviewHistory.length - 1]?.comment ? ` Comment: ${report.reviewHistory[report.reviewHistory.length - 1].comment}` : ''}`,
      notificationType: 'clinic_workflow',
      channel: 'in_app',
      priority: action === 'rejected' ? 'high' : 'normal',
      recipientRole: 'Department Staff',
      targetPath: `/department-reports?reportId=${report._id}`
    });
    return null;
  } catch (error) {
    console.error('Department report status was updated, but submitter notification failed:', error);
    return 'The report was updated, but the submitter notification could not be sent.';
  }
};

const applyReportDateRange = (filter, range) => {
  if (!range.start && !range.end) return;
  const dateRange = { $gte: range.start, $lte: range.end };
  filter.$or = [
    { reportDate: dateRange },
    { reportDate: null, submittedAt: dateRange },
    { reportDate: { $exists: false }, submittedAt: dateRange }
  ];
};

export const getDepartmentReports = async (req, res) => {
  const {
    startDate = '',
    endDate = '',
    department = 'All',
    reportType = 'All',
    status = 'All',
    submittedBy = 'All'
  } = req.query;
  const range = parseDateRange(startDate, endDate);
  if (!range) {
    return res.status(400).json({ success: false, message: 'Provide a valid start and end date, with start date no later than end date.' });
  }
  if ((status !== 'All' && !departmentReportStatuses.includes(status))
    || (submittedBy !== 'All' && !mongoose.isValidObjectId(submittedBy))
    || typeof department !== 'string'
    || typeof reportType !== 'string'
    || reportType.length > 120) {
    return res.status(400).json({ success: false, message: 'Choose a valid department, report type, submitter, or status filter.' });
  }

  try {
    const filter = {};
    if (department !== 'All') filter.department = department;
    if (reportType !== 'All') filter.reportType = reportType;
    if (status !== 'All') filter.status = status;
    else filter.status = { $ne: 'draft' };
    if (submittedBy !== 'All') filter.submittedBy = submittedBy;
    applyReportDateRange(filter, range);
    const reportTypeOptionsFilter = {};
    if (department !== 'All') reportTypeOptionsFilter.department = department;
    applyReportDateRange(reportTypeOptionsFilter, range);
    const comparisonFilter = {};
    applyReportDateRange(comparisonFilter, range);
    comparisonFilter.status = { $nin: ['draft', 'rejected'] };
    const submitterFilter = { ...filter };
    delete submitterFilter.submittedBy;
    const [reports, configuredDepartments, summaryRows, availableReportTypes, comparison, submitterRows] = await Promise.all([
      ClinicDepartmentReport.find(filter)
        .populate('submittedBy', 'name username')
        .populate('reviewHistory.actorId', 'name username')
        .sort({ submittedAt: -1 })
        .limit(200)
        .lean(),
      Department.find({
        $or: [{ status: 'Active' }, { status: { $exists: false } }]
      }).select('name').sort({ name: 1 }).lean(),
      ClinicDepartmentReport.aggregate([
        { $match: filter },
        {
          $facet: {
            total: [{ $count: 'count' }],
            statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            departments: [{ $group: { _id: '$department' } }],
            reportTypes: [{ $group: { _id: '$reportType' } }]
          }
        }
      ]),
      ClinicDepartmentReport.distinct('reportType', reportTypeOptionsFilter),
      ClinicDepartmentReport.aggregate([
        { $match: comparisonFilter },
        {
          $group: {
            _id: '$department',
            patientsServed: { $sum: { $ifNull: ['$patientsServed', 0] } },
            completedServices: { $sum: { $ifNull: ['$completedServices', 0] } },
            pendingCases: { $sum: { $ifNull: ['$pendingCases', 0] } },
            staffAbsent: { $sum: { $ifNull: ['$staffAbsent', 0] } },
            supplyIssueReports: {
              $sum: {
                $cond: [{
                  $regexMatch: {
                    input: { $ifNull: ['$medicineSupplyStatus', ''] },
                    regex: 'shortage|out of stock|unavailable|low stock',
                    options: 'i'
                  }
                }, 1, 0]
              }
            },
            incidentReports: {
              $sum: {
                $cond: [{
                  $regexMatch: {
                    input: { $ifNull: ['$problemsIncidents', ''] },
                    regex: '.+',
                    options: 's'
                  }
                }, 1, 0]
              }
            },
            reports: { $sum: 1 }
          }
        },
        { $sort: { patientsServed: -1, _id: 1 } }
      ]),
      ClinicDepartmentReport.find(submitterFilter)
        .select('submittedBy')
        .populate('submittedBy', 'name username')
        .sort({ submittedAt: -1 })
        .limit(200)
        .lean()
    ]);
    const summary = summaryRows[0] || {};
    const statusCounts = Object.fromEntries((summary.statuses || []).map(({ _id, count }) => [_id, count]));
    const reportedDepartments = (summary.departments || []).map(({ _id }) => _id).filter(Boolean);
    const departments = [...new Set([
      ...configuredDepartments.map(({ name }) => name),
      ...reportedDepartments
    ].filter(Boolean))].sort((left, right) => left.localeCompare(right));
    const matchedReportTypes = (summary.reportTypes || []).map(({ _id }) => _id).filter(Boolean);
    const reportTypes = availableReportTypes.filter(Boolean).sort((left, right) => left.localeCompare(right));
    const needsReview = (statusCounts.new || 0) + (statusCounts.submitted || 0) + (statusCounts.under_review || 0);

    return res.status(200).json({
      success: true,
      data: reports,
      departments,
      reportTypes,
      comparison,
      submitters: [...new Map(submitterRows
        .filter((report) => report.submittedBy?._id)
        .map(({ submittedBy: submitter }) => [String(submitter._id), {
          _id: submitter._id,
          name: submitter.name || submitter.username || 'Department staff'
        }])).values()],
      summary: {
        total: summary.total?.[0]?.count || 0,
        needsReview,
        reviewed: (statusCounts.reviewed || 0) + (statusCounts.approved || 0),
        approved: statusCounts.approved || 0,
        returned: statusCounts.returned || 0,
        rejected: statusCounts.rejected || 0,
        departmentsReporting: reportedDepartments.length,
        reportTypes: matchedReportTypes.length
      }
    });
  } catch (error) {
    console.error('Failed to load department reports:', error);
    return res.status(500).json({ success: false, message: 'Unable to load department reports.' });
  }
};

export const getMyDepartmentReports = async (req, res) => {
  const department = req.user.department?.trim();
  if (!department) {
    return res.status(400).json({ success: false, message: 'Your account must be assigned to a department to access its reports.' });
  }
  try {
    const reports = await ClinicDepartmentReport.find({ department })
      .populate('submittedBy', 'name username')
      .populate('reviewHistory.actorId', 'name username')
      .sort({ submittedAt: -1 })
      .limit(100)
      .lean();
    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    console.error('Failed to load department submissions:', error);
    return res.status(500).json({ success: false, message: 'Unable to load department submissions.' });
  }
};

const createOrUpdateDepartmentReport = async (req, { existingReport = null } = {}) => {
  const department = req.user.department?.trim();
  if (!department) return { error: 'Your account must be assigned to a department before submitting reports.', status: 400 };
  const body = req.body || {};
  const draft = body.status === 'draft';
  const normalized = normalizeDepartmentReport(body, { draft });
  if (normalized.error) return { error: normalized.error, status: 400 };
  const now = new Date();
  const status = draft ? 'draft' : 'submitted';
  const action = draft ? 'draft_saved' : existingReport ? 'resubmitted' : 'submitted';
  const report = existingReport || new ClinicDepartmentReport({
    department,
    submittedBy: req.user._id
  });
  Object.assign(report, normalized.data, {
    department,
    status,
    submittedAt: now
  });
  report.reviewHistory.push({
    action,
    status,
    ...reportActor(req.user),
    actedAt: now
  });
  await report.save();
  return { report, draft };
};

export const submitDepartmentReport = async (req, res) => {
  try {
    const result = await createOrUpdateDepartmentReport(req);
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });
    const notificationWarnings = result.draft ? [] : await sendReportSubmissionNotifications(req, result.report);
    return res.status(201).json({
      success: true,
      data: result.report,
      ...(notificationWarnings.length ? { warning: notificationWarnings.join(' ') } : {})
    });
  } catch (error) {
    console.error('Failed to submit department report:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit department report.' });
  }
};

export const resubmitDepartmentReport = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid department report ID.' });
  }
  try {
    const report = await ClinicDepartmentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Department report not found.' });
    if (String(report.submittedBy) !== String(req.user._id) || report.department !== req.user.department?.trim()) {
      return res.status(403).json({ success: false, message: 'You can only update reports you submitted for your department.' });
    }
    if (!['draft', 'returned'].includes(report.status)) {
      return res.status(409).json({ success: false, message: 'Only draft or returned reports can be updated.' });
    }
    const result = await createOrUpdateDepartmentReport(req, { existingReport: report });
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });
    const notificationWarnings = result.draft ? [] : await sendReportSubmissionNotifications(req, result.report);
    return res.status(200).json({
      success: true,
      data: result.report,
      ...(notificationWarnings.length ? { warning: notificationWarnings.join(' ') } : {})
    });
  } catch (error) {
    console.error('Failed to resubmit department report:', error);
    return res.status(500).json({ success: false, message: 'Unable to resubmit department report.' });
  }
};

export const markDepartmentReportReviewed = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid department report ID.' });
  }
  const body = req.body || {};
  const action = body.action || 'reviewed';
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const normalizedAction = action === 'comment' ? 'commented' : action;
  const validActions = ['under_review', 'approved', 'returned', 'rejected', 'reviewed', 'commented'];
  if (!validActions.includes(normalizedAction) || comment.length > 2000) {
    return res.status(400).json({ success: false, message: 'Choose a valid review action and provide a comment of no more than 2,000 characters.' });
  }
  if (['returned', 'rejected'].includes(normalizedAction) && !comment) {
    return res.status(400).json({ success: false, message: 'Add a comment explaining why this report is being returned or rejected.' });
  }
  try {
    const report = await ClinicDepartmentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Department report not found.' });
    const currentStatus = report.status;
    const statusTransitions = {
      under_review: ['submitted', 'new'],
      approved: ['under_review'],
      returned: ['under_review'],
      rejected: ['under_review'],
      reviewed: ['submitted', 'under_review', 'new']
    };
    if (normalizedAction !== 'commented'
      && !statusTransitions[normalizedAction].includes(currentStatus)) {
      return res.status(409).json({ success: false, message: `A report with status "${currentStatus}" cannot be ${normalizedAction.replace('_', ' ')}.` });
    }
    if (normalizedAction === 'commented' && currentStatus === 'draft') {
      return res.status(409).json({ success: false, message: 'Draft reports cannot be reviewed or commented on.' });
    }
    if (normalizedAction === 'commented' && !comment) {
      return res.status(400).json({ success: false, message: 'Enter a comment before adding it to the report.' });
    }

    const nextStatus = normalizedAction === 'commented' ? currentStatus : normalizedAction;
    const now = new Date();
    const updatedReport = await ClinicDepartmentReport.findOneAndUpdate(
      { _id: report._id, status: currentStatus },
      {
        $set: {
          status: nextStatus,
          ...(normalizedAction === 'approved' || normalizedAction === 'reviewed'
            ? { reviewedBy: req.user._id, reviewedAt: now }
            : {})
        },
        $push: {
          reviewHistory: {
            action: normalizedAction,
            status: nextStatus,
            comment,
            ...reportActor(req.user),
            actedAt: now
          }
        }
      },
      { new: true, runValidators: true }
    )
      .populate('submittedBy', 'name username')
      .populate('reviewHistory.actorId', 'name username')
      .lean();
    if (!updatedReport) {
      return res.status(409).json({ success: false, message: 'This report changed during review. Refresh and try again.' });
    }

    let warning = null;
    warning = await sendReportSubmitterNotification(updatedReport, req.user, normalizedAction);
    req.app.get('io')?.emit('clinic:department-report-updated', { reportId: String(updatedReport._id) });
    return res.status(200).json({
      success: true,
      data: updatedReport,
      ...(warning ? { warning } : {})
    });
  } catch (error) {
    console.error('Failed to update department report review:', error);
    return res.status(500).json({ success: false, message: 'Unable to update department report.' });
  }
};

const clinicHeadSnapshotFields = [
  'summary',
  'patientTrends',
  'topDiseases',
  'departmentPerformance',
  'staffPerformance',
  'medicineUsage',
  'currentInventory',
  'inventoryMovements',
  'approvedDepartmentSummary',
  'incidentReports',
  'referrals'
];

const normalizeClinicHeadSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { error: 'Generate the clinic summary before saving the report.' };
  }
  const data = Object.fromEntries(clinicHeadSnapshotFields
    .filter((field) => snapshot[field] !== undefined)
    .map((field) => [field, snapshot[field]]));
  if (!Object.keys(data).length || JSON.stringify(data).length > 250000) {
    return { error: 'The clinic report summary is empty or too large to save.' };
  }
  return { data };
};

export const getClinicHeadReports = async (req, res) => {
  const { startDate = '', endDate = '' } = req.query;
  const range = parseDateRange(startDate, endDate);
  if (!range) {
    return res.status(400).json({ success: false, message: 'Provide a valid report date range.' });
  }
  try {
    const filter = {};
    if (range.start || range.end) {
      filter.periodStart = { $lte: range.end };
      filter.periodEnd = { $gte: range.start };
    }
    const reports = await ClinicHeadReport.find(filter)
      .populate('generatedBy', 'name username')
      .populate('reviewHistory.actorId', 'name username')
      .sort({ periodStart: -1, createdAt: -1 })
      .limit(100)
      .lean();
    return res.status(200).json({ success: true, data: reports });
  } catch (error) {
    console.error('Failed to load Clinic Head reports:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Clinic Head reports.' });
  }
};

export const generateClinicHeadReport = async (req, res) => {
  const body = req.body || {};
  const reportType = body.reportType;
  if (!['daily', 'weekly', 'monthly', 'custom'].includes(reportType)) {
    return res.status(400).json({ success: false, message: 'Choose a daily, weekly, monthly, or custom report period.' });
  }
  const range = parseDateRange(body.startDate, body.endDate);
  if (!range || !range.start || !range.end) {
    return res.status(400).json({ success: false, message: 'Provide a valid start and end date for the report.' });
  }
  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim()
    : `${reportType[0].toUpperCase()}${reportType.slice(1)} Clinic Report`;
  if (title.length > 180) {
    return res.status(400).json({ success: false, message: 'Report title must be no more than 180 characters.' });
  }
  const snapshot = normalizeClinicHeadSnapshot(body.snapshot);
  if (snapshot.error) return res.status(400).json({ success: false, message: snapshot.error });

  try {
    const report = await ClinicHeadReport.create({
      reportType,
      title,
      periodStart: range.start,
      periodEnd: range.end,
      generatedBy: req.user._id,
      snapshot: snapshot.data,
      status: 'draft',
      reviewHistory: [{
        action: 'generated',
        status: 'draft',
        ...reportActor(req.user)
      }]
    });
    req.app.get('io')?.emit('clinic:clinic-head-report-updated', { reportId: String(report._id) });
    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error('Failed to generate Clinic Head report:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the generated Clinic Head report.' });
  }
};

export const reviewClinicHeadReport = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid Clinic Head report ID.' });
  }
  const body = req.body || {};
  const action = body.action === 'comment' ? 'commented' : body.action;
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  if (!['submitted', 'under_review', 'approved', 'returned', 'closed', 'commented'].includes(action)
    || comment.length > 2000) {
    return res.status(400).json({ success: false, message: 'Choose a valid management action and a comment of no more than 2,000 characters.' });
  }
  if (['returned', 'commented'].includes(action) && !comment) {
    return res.status(400).json({ success: false, message: 'Add a comment explaining the decision.' });
  }
  try {
    const report = await ClinicHeadReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Clinic Head report not found.' });
    const transitions = {
      submitted: ['draft', 'returned'],
      under_review: ['submitted'],
      approved: ['under_review'],
      returned: ['under_review'],
      closed: ['approved']
    };
    if (action !== 'commented' && !transitions[action].includes(report.status)) {
      return res.status(409).json({ success: false, message: `A report with status "${report.status}" cannot be ${action.replace('_', ' ')}.` });
    }
    if (action === 'commented' && report.status === 'closed') {
      return res.status(409).json({ success: false, message: 'Closed reports cannot be commented on.' });
    }
    const status = action === 'commented' ? report.status : action;
    const updatedReport = await ClinicHeadReport.findOneAndUpdate(
      { _id: report._id, status: report.status },
      {
        $set: { status },
        $push: {
          reviewHistory: {
            action,
            status,
            comment,
            ...reportActor(req.user),
            actedAt: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    )
      .populate('generatedBy', 'name username')
      .populate('reviewHistory.actorId', 'name username')
      .lean();
    if (!updatedReport) {
      return res.status(409).json({ success: false, message: 'This report changed during review. Refresh and try again.' });
    }
    req.app.get('io')?.emit('clinic:clinic-head-report-updated', { reportId: String(updatedReport._id) });
    return res.status(200).json({ success: true, data: updatedReport });
  } catch (error) {
    console.error('Failed to update Clinic Head report review:', error);
    return res.status(500).json({ success: false, message: 'Unable to update Clinic Head report.' });
  }
};

export const addClinicHeadReportActionPlan = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid Clinic Head report ID.' });
  }
  const body = req.body || {};
  const issue = typeof body.issue === 'string' ? body.issue.trim() : '';
  const solution = typeof body.solution === 'string' ? body.solution.trim() : '';
  const responsiblePerson = typeof body.responsiblePerson === 'string' ? body.responsiblePerson.trim() : '';
  if (!issue || issue.length > 500 || solution.length > 2000 || !responsiblePerson || responsiblePerson.length > 120
    || !isValidDateOnly(body.dueDate) || !['low', 'normal', 'high', 'critical'].includes(body.priority)) {
    return res.status(400).json({ success: false, message: 'Provide an issue, responsible person, valid due date, and priority.' });
  }
  try {
    const report = await ClinicHeadReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Clinic Head report not found.' });
    if (report.status === 'closed') {
      return res.status(409).json({ success: false, message: 'Action plans cannot be added to a closed report.' });
    }
    report.actionPlans.push({
      issue,
      solution,
      responsiblePerson,
      dueDate: new Date(`${body.dueDate}T00:00:00.000Z`),
      priority: body.priority,
      createdBy: req.user._id
    });
    await report.save();
    const updatedReport = await ClinicHeadReport.findById(report._id)
      .populate('generatedBy', 'name username')
      .populate('reviewHistory.actorId', 'name username')
      .lean();
    req.app.get('io')?.emit('clinic:clinic-head-report-updated', { reportId: String(report._id) });
    return res.status(201).json({ success: true, data: updatedReport });
  } catch (error) {
    console.error('Failed to create Clinic Head action plan:', error);
    return res.status(500).json({ success: false, message: 'Unable to create the action plan.' });
  }
};

export const updateClinicHeadReportActionPlan = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.actionId)) {
    return res.status(400).json({ success: false, message: 'Invalid Clinic Head report or action plan ID.' });
  }
  const body = req.body || {};
  const updates = {};
  if (body.status !== undefined) {
    if (!['open', 'in_progress', 'completed', 'closed'].includes(body.status)) {
      return res.status(400).json({ success: false, message: 'Choose a valid action plan status.' });
    }
    updates.status = body.status;
    updates.completedAt = ['completed', 'closed'].includes(body.status) ? new Date() : null;
  }
  if (body.solution !== undefined) {
    if (typeof body.solution !== 'string' || body.solution.length > 2000) {
      return res.status(400).json({ success: false, message: 'Action plan solution must be no more than 2,000 characters.' });
    }
    updates.solution = body.solution.trim();
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: 'Provide an action plan status or solution to update.' });
  }
  try {
    const report = await ClinicHeadReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Clinic Head report not found.' });
    const actionPlan = report.actionPlans.id(req.params.actionId);
    if (!actionPlan) return res.status(404).json({ success: false, message: 'Action plan not found.' });
    if (report.status === 'closed' && updates.status !== 'closed') {
      return res.status(409).json({ success: false, message: 'A closed report cannot have its action plans reopened.' });
    }
    Object.assign(actionPlan, updates);
    await report.save();
    const updatedReport = await ClinicHeadReport.findById(report._id)
      .populate('generatedBy', 'name username')
      .populate('reviewHistory.actorId', 'name username')
      .lean();
    req.app.get('io')?.emit('clinic:clinic-head-report-updated', { reportId: String(report._id) });
    return res.status(200).json({ success: true, data: updatedReport });
  } catch (error) {
    console.error('Failed to update Clinic Head action plan:', error);
    return res.status(500).json({ success: false, message: 'Unable to update the action plan.' });
  }
};

import mongoose from 'mongoose';
import ClinicVisit from '../module/ClinicVisit.js';
import ClinicDispensingLog from '../module/ClinicDispensingLog.js';
import ClinicDepartmentReport from '../module/ClinicDepartmentReport.js';
import ClinicNotification from '../module/ClinicNotification.js';
import StaffAttendance from '../module/StaffAttendance.js';
import { Staff } from '../module/StaffAndRoster.js';

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
    const dispensingMatch = {};
    if (range.start || range.end) dispensingMatch.dispensedAt = { $gte: range.start, $lte: range.end };
    if (department !== 'All') dispensingMatch.department = department;

    const [
      summaryRows,
      patientTrends,
      topDiseases,
      departmentWorkload,
      medicineUsage,
      departments,
      staffDepartments,
      staffDirectory,
      staffAttendance,
      staffPatients
    ] = await Promise.all([
      ClinicVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: null,
            totalPatients: { $sum: 1 },
            emergencyPatients: { $sum: { $cond: ['$emergency', 1, 0] } },
            avgWaitMinutes: { $avg: '$waitTimeMinutes' }
          }
        }
      ]),
      ClinicVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitDate', timezone: 'Africa/Addis_Ababa' } },
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
            patientCount: { $sum: 1 },
            avgWaitMinutes: { $avg: '$waitTimeMinutes' }
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
      Staff.distinct('department', { department: { $nin: ['', null] } }),
      Staff.find(department !== 'All' ? { department } : {}).select('name role department').sort({ name: 1 }).lean(),
      StaffAttendance.aggregate([
        {
          $match: {
            ...(range.start || range.end ? {
              date: { $gte: startDate, $lte: endDate }
            } : {}),
            status: { $in: ['present', 'late'] }
          }
        },
        { $group: { _id: '$staffId', attendedDays: { $sum: 1 } } }
      ]),
      ClinicVisit.aggregate([
        { $match: { ...visitMatch, attendedByStaffId: { $ne: null } } },
        { $group: { _id: '$attendedByStaffId', patientsServed: { $sum: 1 } } }
      ])
    ]);

    const summary = summaryRows[0] || {};
    const medicineSummary = await ClinicDispensingLog.aggregate([
      { $match: dispensingMatch },
      { $group: { _id: null, totalQuantity: { $sum: '$quantityDispensed' } } }
    ]);
    const attendanceByStaff = new Map(staffAttendance.map((entry) => [String(entry._id), entry.attendedDays]));
    const patientsByStaff = new Map(staffPatients.map((entry) => [String(entry._id), entry.patientsServed]));
    const staffPerformance = staffDirectory.map((staff) => ({
      staffId: staff._id,
      name: staff.name,
      role: staff.role,
      department: staff.department,
      patientsServed: patientsByStaff.get(String(staff._id)) || 0,
      attendedDays: attendanceByStaff.get(String(staff._id)) || 0
    }));

    return res.status(200).json({
      success: true,
      summary: {
        totalPatients: summary.totalPatients || 0,
        avgWaitTime: summary.avgWaitMinutes == null ? null : Math.round(summary.avgWaitMinutes),
        emergencyPatients: summary.emergencyPatients || 0,
        totalMedicinesDispensed: medicineSummary[0]?.totalQuantity || 0
      },
      patientTrends,
      topDiseases,
      departmentWorkload,
      medicineUsage,
      staffPerformance,
      departments: [...new Set([...departments, ...staffDepartments])].sort((left, right) => left.localeCompare(right))
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

import User from '../module/User.js';
import MedicalCertificate from '../module/clinichead.js';
import ClinicVisit from '../module/ClinicVisit.js';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicApproval from '../module/ClinicheadApproval.js';
import ClinicNotification from '../module/ClinicNotification.js';
import StaffAttendance from '../module/StaffAttendance.js';
import { Roster, Staff } from '../module/StaffAndRoster.js';
import MasterDataRecord from '../module/MasterDataRecord.js';
import mongoose from 'mongoose';

const staffRoles = [
  'Doctor',
  'Nurse',
  'Pharmacist',
  'Pharmacy',
  'Lab Technician',
  'Lab',
  'Registration',
  'Receptionist'
];
const clinicTimeZone = 'Africa/Addis_Ababa';

const getClinicDateParts = (date) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const startOfClinicDay = (date) => {
  const { year, month, day } = getClinicDateParts(date);
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)) - (3 * 60 * 60 * 1000));
};

const startOfClinicWeek = (date) => {
  const start = startOfClinicDay(date);
  const clinicDate = new Date(start.getTime() + (3 * 60 * 60 * 1000));
  const daysSinceMonday = (clinicDate.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
};

const formatDateKey = (date) => {
  const { year, month, day } = getClinicDateParts(date);
  return `${year}-${month}-${day}`;
};

const getOutbreakNotice = (visits, now) => {
  const currentPeriodStart = new Date(now);
  currentPeriodStart.setDate(currentPeriodStart.getDate() - 7);
  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
  const counts = new Map();

  for (const visit of visits) {
    const diagnosis = visit.diagnosis?.trim();
    if (!diagnosis || !visit.visitDate) continue;
    const key = diagnosis.toLocaleLowerCase();
    const entry = counts.get(key) || { diagnosis, recent: 0, previous: 0 };
    if (visit.visitDate >= currentPeriodStart && visit.visitDate <= now) {
      entry.recent += 1;
    } else if (visit.visitDate >= previousPeriodStart && visit.visitDate < currentPeriodStart) {
      entry.previous += 1;
    }
    counts.set(key, entry);
  }

  const topIncrease = [...counts.values()]
    .filter(({ recent, previous }) => recent >= 2 && previous > 0)
    .map((entry) => ({
      ...entry,
      increasePercent: Math.round(((entry.recent - entry.previous) / entry.previous) * 100)
    }))
    .filter(({ increasePercent }) => increasePercent >= 30)
    .sort((left, right) => right.increasePercent - left.increasePercent)[0];

  return {
    diagnosisRecords: visits.filter((visit) => visit.diagnosis?.trim()).length,
    notice: topIncrease
      ? {
        diagnosis: topIncrease.diagnosis,
        recentCases: topIncrease.recent,
        previousCases: topIncrease.previous,
        increasePercent: topIncrease.increasePercent
      }
      : null
  };
};

export const getClinicHeadDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfClinicDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const weekStart = startOfClinicWeek(now);
    const twoWeeksAgo = new Date(weekStart);
    twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 7);

    const [
      staffOnDutyCount,
      totalStaffCount,
      pendingCertificateCount,
      pendingCertificates,
      pendingOtherApprovalCount,
      pendingOtherApprovals,
      pendingMedicalApprovalCount,
      pendingReferralCount,
      pendingLeaveCount,
      todayTotalPatients,
      activeEmergencyCases,
      emergencyVisitCount,
      hospitalReferralCount,
      staffRoleCounts,
      staffOnDutyRoleCounts,
      staffDirectoryCount,
      staffAttendanceOnDutyCount,
      todayAttendanceRecordCount,
      todayRosterOnDutyCount,
      visitsThisWeek,
      visitsForOutbreakAnalysis,
      recentVisits,
      recentApprovals,
      recentCertificates,
      inventoryItemCount,
      lowStockItems
    ] = await Promise.all([
      User.countDocuments({ role: { $in: staffRoles }, onDutyToday: true }),
      User.countDocuments({ role: { $in: staffRoles } }),
      MedicalCertificate.countDocuments({ status: 'pending' }),
      MedicalCertificate.find({ status: 'pending' }).sort({ requestDate: -1 }).limit(8).lean(),
      ClinicApproval.countDocuments({ status: 'pending' }),
      ClinicApproval.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(8).lean(),
      ClinicApproval.countDocuments({ status: 'pending', requestType: 'medical_certificate' }),
      ClinicApproval.countDocuments({ status: 'pending', requestType: 'referral' }),
      ClinicApproval.countDocuments({ status: 'pending', requestType: { $in: ['staff_leave', 'leave_request'] } }),
      ClinicVisit.countDocuments({ visitDate: { $gte: todayStart, $lt: tomorrowStart } }),
      ClinicVisit.countDocuments({
        visitDate: { $gte: todayStart, $lt: tomorrowStart },
        $or: [
          { emergency: true, emergencyResolved: false },
          { referred: true }
        ]
      }),
      ClinicVisit.countDocuments({
        visitDate: { $gte: todayStart, $lt: tomorrowStart },
        emergency: true,
        emergencyResolved: false
      }),
      ClinicVisit.countDocuments({
        visitDate: { $gte: todayStart, $lt: tomorrowStart },
        referred: true
      }),
      User.aggregate([
        { $match: { role: { $in: staffRoles } } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { role: { $in: staffRoles }, onDutyToday: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Staff.countDocuments({ status: { $ne: 'Inactive' } }),
      StaffAttendance.countDocuments({
        date: formatDateKey(now),
        status: { $in: ['present', 'late'] }
      }),
      StaffAttendance.countDocuments({ date: formatDateKey(now) }),
      Roster.countDocuments({
        date: formatDateKey(now),
        shift: { $in: ['morning', 'afternoon', 'night'] }
      }),
      ClinicVisit.find({ visitDate: { $gte: weekStart, $lt: tomorrowStart } })
        .select('visitDate').lean(),
      ClinicVisit.find({ visitDate: { $gte: twoWeeksAgo, $lte: now } })
        .select('visitDate diagnosis').lean(),
      ClinicVisit.find({}).sort({ visitDate: -1 }).limit(5)
        .select('patientName visitDate emergency referred').lean(),
      ClinicApproval.find({}).sort({ updatedAt: -1 }).limit(5)
        .select('requestType applicantName status updatedAt').lean(),
      MedicalCertificate.find({}).sort({ requestDate: -1 }).limit(5)
        .select('studentName status requestDate').lean(),
      ClinicInventory.countDocuments(),
      ClinicInventory.find({ $expr: { $lte: ['$quantity', '$reorderLevel'] } })
        .sort({ quantity: 1 }).select('itemName quantity reorderLevel unit').lean()
    ]);

    const staffCounts = new Map(staffRoleCounts.map(({ _id, count }) => [_id, count]));
    const staffOnDutyCounts = new Map(staffOnDutyRoleCounts.map(({ _id, count }) => [_id, count]));
    const dashboardTotalStaff = staffDirectoryCount || totalStaffCount;
    const dashboardStaffOnDuty = todayAttendanceRecordCount > 0
      ? staffAttendanceOnDutyCount
      : todayRosterOnDutyCount > 0 ? todayRosterOnDutyCount : staffOnDutyCount;
    const staffBreakdown = todayAttendanceRecordCount > 0 || todayRosterOnDutyCount > 0
      ? []
      : staffRoles.map((role) => ({
      role,
      onDuty: staffOnDutyCounts.get(role) || 0,
      total: staffCounts.get(role) || 0
      }));

    const approvals = [
      ...pendingCertificates.map((certificate) => ({
        _id: certificate._id,
        type: 'Medical Certificate',
        applicant: certificate.studentName,
        details: `${certificate.studentId} · ${certificate.reason}`,
        requestDate: certificate.requestDate,
        recordType: 'certificate'
      })),
      ...pendingOtherApprovals.map((approval) => ({
        _id: approval._id,
        type: approval.requestType === 'referral'
          ? 'Referral'
          : ['staff_leave', 'leave_request'].includes(approval.requestType)
            ? 'Staff Leave'
            : 'Medical Certificate',
        applicant: approval.applicantName,
        details: `${approval.applicantId} · ${approval.reason}`,
        requestDate: approval.createdAt,
        recordType: 'approval'
      }))
    ].sort((left, right) => new Date(right.requestDate) - new Date(left.requestDate));

    const patientFlow = Array.from({ length: 7 }, (_, index) => {
      const dayStart = new Date(weekStart);
      dayStart.setUTCDate(dayStart.getUTCDate() + index);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const count = visitsThisWeek.filter((visit) => (
        visit.visitDate >= dayStart && visit.visitDate < dayEnd
      )).length;
      return {
        day: dayStart.toLocaleDateString('en', { weekday: 'short', timeZone: clinicTimeZone }),
        date: formatDateKey(dayStart),
        count
      };
    });

    const outbreak = getOutbreakNotice(
      visitsForOutbreakAnalysis.map((visit) => ({
        ...visit,
        visitDate: new Date(visit.visitDate)
      })),
      now
    );

    const recentActivity = [
      ...recentVisits.map((visit) => ({
        id: `visit-${visit._id}`,
        type: visit.emergency ? 'Emergency case' : visit.referred ? 'Hospital referral' : 'Patient visit',
        description: `Clinic visit recorded for ${visit.patientName}.`,
        createdAt: visit.visitDate
      })),
      ...recentApprovals.map((approval) => ({
        id: `approval-${approval._id}`,
        type: approval.status === 'approved' ? 'Approval completed' : 'Approval request',
        description: `${approval.applicantName}'s ${approval.requestType.replace('_', ' ')} request is ${approval.status}.`,
        createdAt: approval.updatedAt
      })),
      ...recentCertificates.map((certificate) => ({
        id: `certificate-${certificate._id}`,
        type: 'Medical certificate',
        description: `${certificate.studentName}'s certificate request is ${certificate.status}.`,
        createdAt: certificate.requestDate
      }))
    ]
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 6);

    return res.status(200).json({
      success: true,
      metrics: {
        todayTotalPatients,
        staffOnDuty: `${dashboardStaffOnDuty}/${dashboardTotalStaff}`,
        staffBreakdown,
        pendingApprovalsCount: pendingCertificateCount + pendingOtherApprovalCount,
        pendingApprovalsBreakdown: {
          medicalCertificates: pendingCertificateCount + pendingMedicalApprovalCount,
          referrals: pendingReferralCount,
          staffLeave: pendingLeaveCount
        },
        emergencyCases: activeEmergencyCases,
        emergencyVisitCount,
        hospitalReferralCount,
        criticalStockItems: lowStockItems.length
      },
      pendingApprovalsList: approvals.slice(0, 8),
      patientFlow,
      recentActivity,
      alerts: {
        lowStock: lowStockItems,
        inventoryItemCount,
        outbreakNotice: outbreak.notice,
        diagnosisRecords: outbreak.diagnosisRecords
      },
      dataSources: {
        patientVisits: 'clinicVisits',
        dutyRoster: 'roster.shift',
        staffAttendance: 'staffattendances',
        medicalCertificates: 'clinicheads',
        otherApprovals: 'clinicapprovals',
        inventory: 'clinicinventories',
        diagnosisTrend: 'clinicVisits.diagnosis'
      }
    });
  } catch (error) {
    console.error('Failed to load clinic-head dashboard data:', error);
    return res.status(500).json({ success: false, message: 'Unable to load clinic-head dashboard data.' });
  }
};

export const updateApprovalStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be either 'approved' or 'rejected'."
    });
  }

  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid approval ID.' });
    }

    const updateOptions = { new: true, runValidators: true };
    const approvalType = req.body.recordType;
    if (approvalType && !['certificate', 'approval'].includes(approvalType)) {
      return res.status(400).json({ success: false, message: 'Invalid approval type.' });
    }

    const updatedCert = approvalType === 'approval'
      ? await ClinicApproval.findOneAndUpdate(
      { _id: id, status: 'pending' },
      {
        $set: { status },
        $push: {
          decisionHistory: {
            action: status,
            previousStatus: 'pending',
            status,
            comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : '',
            actorId: req.user._id,
            actorName: req.user.name || 'Clinic Head',
            actedAt: new Date()
          }
        }
      },
      updateOptions
      )
      : await MedicalCertificate.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: { status },
          $push: {
            reviewHistory: {
              action: status,
              previousStatus: 'pending',
              status,
              comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : '',
              actorId: req.user._id,
              actorName: req.user.name || 'Clinic Head',
              actedAt: new Date()
            }
          }
        },
        updateOptions
      );

    if (!updatedCert) {
      return res.status(404).json({
        success: false,
        message: 'Pending approval not found. It may already have been reviewed.'
      });
    }

    let warning = '';
    try {
      const applicantId = approvalType === 'approval'
        ? updatedCert.applicantId
        : updatedCert.studentId;
      const applicant = applicantId
        ? await User.findOne({
          $or: [
            { employeeId: applicantId },
            { username: applicantId },
            { email: applicantId.toLowerCase() }
          ]
        }).select('_id').lean()
        : null;
      if (applicant) {
        await ClinicNotification.create({
          recipient: applicant._id,
          request: updatedCert._id,
          title: `Request ${status}`,
          message: `Your ${approvalType === 'approval' ? updatedCert.requestType.replaceAll('_', ' ') : 'medical certificate'} request was ${status}.`
        });
      }
    } catch (notificationError) {
      console.error('Approval saved, but notification creation failed:', notificationError);
      warning = 'Decision saved, but the notification could not be created.';
    }

    return res.status(200).json({ success: true, warning, data: updatedCert });
  } catch (error) {
    console.error('Failed to update medical certificate approval:', error);
    return res.status(500).json({ success: false, message: 'Unable to update medical certificate approval.' });
  }
};

export const createClinicVisit = async (req, res) => {
  const {
    patientId,
    patientName,
    diagnosis = '',
    department = '',
    waitTimeMinutes = null,
    attendedByStaffId = null,
    emergency = false,
    referred = false
  } = req.body;

  if (
    typeof patientId !== 'string' || !patientId.trim()
    || typeof patientName !== 'string' || !patientName.trim()
    || typeof diagnosis !== 'string'
    || typeof department !== 'string'
    || (waitTimeMinutes !== null && (!Number.isFinite(waitTimeMinutes) || waitTimeMinutes < 0))
    || (attendedByStaffId !== null && !mongoose.isValidObjectId(attendedByStaffId))
    || typeof emergency !== 'boolean'
    || typeof referred !== 'boolean'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Provide patientId and patientName, valid diagnosis, department and wait time, and boolean emergency/referred values.'
    });
  }

  const visitDate = req.body.visitDate ? new Date(req.body.visitDate) : new Date();
  if (Number.isNaN(visitDate.getTime())) {
    return res.status(400).json({ success: false, message: 'visitDate must be a valid date.' });
  }

  try {
    const visit = await ClinicVisit.create({
      patientId: patientId.trim(),
      patientName: patientName.trim(),
      visitDate,
      department: department.trim(),
      diagnosis: diagnosis.trim(),
      waitTimeMinutes,
      attendedByStaffId,
      emergency,
      referred
    });
    return res.status(201).json({ success: true, data: visit });
  } catch (error) {
    console.error('Failed to record clinic visit:', error);
    return res.status(500).json({ success: false, message: 'Unable to record clinic visit.' });
  }
};

export const createClinicApproval = async (req, res) => {
  const {
    requestType,
    applicantName,
    applicantId,
    applicantRole,
    requestedByDoctor,
    reason
  } = req.body;
  if (
    !['medical_certificate', 'referral', 'staff_leave'].includes(requestType)
    || typeof applicantName !== 'string' || !applicantName.trim()
    || typeof applicantId !== 'string' || !applicantId.trim()
    || !['student', 'staff'].includes(applicantRole)
    || typeof requestedByDoctor !== 'string' || !requestedByDoctor.trim()
    || typeof reason !== 'string' || !reason.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'Provide a valid request type, applicant name and ID, applicant role, requesting clinician, and reason.'
    });
  }

  try {
    const approval = await ClinicApproval.create(req.body);
    return res.status(201).json({ success: true, data: approval });
  } catch (error) {
    console.error('Failed to create clinic approval request:', error);
    return res.status(500).json({ success: false, message: 'Unable to create approval request.' });
  }
};

export const createClinicInventoryItem = async (req, res) => {
  const { itemName, quantity, reorderLevel, unit = 'units', masterDataId } = req.body;
  if (
    (typeof itemName !== 'string' && !masterDataId)
    || (typeof itemName === 'string' && !itemName.trim() && !masterDataId)
    || !Number.isFinite(quantity) || quantity < 0
    || !Number.isFinite(reorderLevel) || reorderLevel < 0
    || typeof unit !== 'string' || !unit.trim()
    || (masterDataId && !mongoose.isValidObjectId(masterDataId))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Provide a medicine catalog reference or item name, non-negative quantity and reorderLevel numbers, and a valid unit.'
    });
  }

  try {
    let catalogMedicine = null;
    if (masterDataId) {
      catalogMedicine = await MasterDataRecord.findOne({
        _id: masterDataId,
        category: 'medicine',
        status: 'Active',
      }).select('code name unit').lean();
      if (!catalogMedicine) {
        return res.status(400).json({ success: false, message: 'Select an active medicine from the master catalog.' });
      }
    }
    const item = await ClinicInventory.create({
      itemName: catalogMedicine?.name || itemName.trim(),
      itemCode: catalogMedicine?.code || '',
      masterDataId: catalogMedicine?._id || null,
      category: catalogMedicine ? 'Medicine' : 'Other',
      quantity,
      reorderLevel,
      unit: catalogMedicine?.unit || unit.trim()
    });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Failed to create inventory item:', error);
    return res.status(500).json({ success: false, message: 'Unable to create inventory item.' });
  }
};

export const updateClinicInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { quantity, reorderLevel } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid inventory item ID.' });
  }
  if (
    (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0))
    || (reorderLevel !== undefined && (!Number.isFinite(reorderLevel) || reorderLevel < 0))
    || (quantity === undefined && reorderLevel === undefined)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Provide a non-negative quantity and/or reorderLevel.'
    });
  }

  try {
    const item = await ClinicInventory.findByIdAndUpdate(
      id,
      { $set: { ...(quantity !== undefined && { quantity }), ...(reorderLevel !== undefined && { reorderLevel }) } },
      { new: true, runValidators: true }
    );
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Failed to update inventory item:', error);
    return res.status(500).json({ success: false, message: 'Unable to update inventory item.' });
  }
};

import mongoose from 'mongoose';
import ApprovalRequest from '../module/ClinicheadApproval.js';
import MedicalCertificate from '../module/clinichead.js';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicNotification from '../module/ClinicNotification.js';
import { Staff, Roster } from '../module/StaffAndRoster.js';
import User from '../module/User.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';

const requestTypes = ['leave_request', 'staff_leave', 'purchase_request', 'referral', 'medical_certificate'];
const statuses = ['pending', 'approved', 'rejected', 'returned'];
const leaveRequestTypes = ['leave_request', 'staff_leave'];
const staffRoleMap = {
  Doctor: 'Doctor',
  Nurse: 'Nurse',
  Lab: 'Lab',
  'Lab Technician': 'Lab',
  Pharmacy: 'Pharmacy',
  Pharmacist: 'Pharmacy',
  Registration: 'Registration',
  Receptionist: 'Registration'
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeIdentity = (value) => String(value || '').trim().toLowerCase();

const getLeaveApplicantProfiles = async (requests) => {
  const identifiers = [...new Set(requests.map((request) => String(request.applicantId || '').trim()).filter(Boolean))];
  const objectIds = identifiers.filter((identifier) => mongoose.isValidObjectId(identifier));
  const userFilters = [];
  if (identifiers.length) {
    userFilters.push(
      { employeeId: { $in: identifiers } },
      { username: { $in: identifiers } },
      { email: { $in: identifiers.map((identifier) => identifier.toLowerCase()) } }
    );
  }
  if (objectIds.length) userFilters.push({ _id: { $in: objectIds } });

  const users = userFilters.length
    ? await User.find({ $or: userFilters })
      .select('name employeeId username email position role activeRole department')
      .lean()
    : [];
  const staffIdentities = [...new Set([
    ...users.map((user) => normalizeIdentity(user.email)),
    ...requests.map((request) => normalizeIdentity(request.applicantId)).filter((identity) => identity.includes('@'))
  ].filter(Boolean))];
  const staffNames = [...new Set(requests.map((request) => String(request.applicantName || '').trim()).filter(Boolean))];
  const staffFilters = [];
  if (staffIdentities.length) staffFilters.push({ email: { $in: staffIdentities } });
  if (staffNames.length) {
    staffFilters.push({
      name: { $in: requests.map((request) => request.applicantName).filter(Boolean) }
    });
  }
  const staffMembers = staffFilters.length
    ? await Staff.find({ $or: staffFilters }).select('name email role department status').lean()
    : [];

  const usersByIdentity = new Map();
  for (const user of users) {
    for (const identity of [user.employeeId, user.username, user.email, user._id]) {
      if (identity) usersByIdentity.set(normalizeIdentity(identity), user);
    }
  }
  const staffByEmail = new Map(staffMembers.map((staff) => [normalizeIdentity(staff.email), staff]));

  return new Map(requests.map((request) => {
    const user = usersByIdentity.get(normalizeIdentity(request.applicantId));
    const staff = (user?.email && staffByEmail.get(normalizeIdentity(user.email)))
      || staffByEmail.get(normalizeIdentity(request.applicantId))
      || staffMembers.find((member) => (
        normalizeIdentity(member.name) === normalizeIdentity(request.applicantName)
        && (!request.department || normalizeIdentity(member.department) === normalizeIdentity(request.department))
      ));
    const userRoles = [user?.position, user?.activeRole, user?.role]
      .map((userRole) => staffRoleMap[userRole])
      .filter(Boolean);
    return [String(request._id), {
      role: staff?.role || userRoles[0] || 'Staff role not recorded',
      department: staff?.department || user?.department || request.department || '',
      staffId: staff?._id ? String(staff._id) : ''
    }];
  }));
};

const getDepartmentLeaveCoverage = async (request, conflicts, applicantProfiles) => {
  const applicantProfile = applicantProfiles.get(String(request._id));
  const department = applicantProfile?.department || request.department;
  if (!department) return null;

  let staffMembers = await Staff.find({
    department: { $regex: `^${escapeRegex(department)}$`, $options: 'i' },
    status: { $nin: ['Inactive', 'On Leave'] }
  }).select('name email role').lean();
  if (!staffMembers.length) {
    const userRoles = Object.keys(staffRoleMap);
    const users = await User.find({
      department: { $regex: `^${escapeRegex(department)}$`, $options: 'i' },
      status: { $nin: ['Inactive', 'On Leave'] },
      $or: [
        { role: { $in: userRoles } },
        { activeRole: { $in: userRoles } },
        { roles: { $in: userRoles } },
        { position: { $in: userRoles } }
      ]
    }).select('name email role activeRole roles position').lean();
    staffMembers = users.map((user) => ({
      ...user,
      role: [user.activeRole, user.role, ...(user.roles || []), user.position]
        .map((userRole) => staffRoleMap[userRole])
        .find(Boolean)
    })).filter((staff) => staff.role);
  }
  const role = staffRoleMap[applicantProfile?.role] || applicantProfile?.role;
  const roleStaff = role && role !== 'Staff role not recorded'
    ? staffMembers.filter((staff) => staff.role === role)
    : staffMembers;
  const relevantConflicts = conflicts.filter((conflict) => {
    if (!role || role === 'Staff role not recorded') return true;
    const conflictRole = applicantProfiles.get(String(conflict._id))?.role;
    return !conflictRole || conflictRole === 'Staff role not recorded' || conflictRole === role;
  });
  const currentRequestIsLeave = ['pending', 'approved'].includes(request.status);
  const plannedLeaves = currentRequestIsLeave ? [request, ...relevantConflicts] : relevantConflicts;
  const unavailableStaff = new Set(plannedLeaves.map((conflict) => (
    applicantProfiles.get(String(conflict._id))?.staffId
      || normalizeIdentity(conflict.applicantId)
      || String(conflict._id)
  )));

  return {
    department,
    role: role || 'All roles',
    activeStaff: roleStaff.length,
    overlappingLeaveRequests: relevantConflicts.length,
    plannedLeaveCount: plannedLeaves.length,
    estimatedAvailableStaff: Math.max(0, roleStaff.length - unavailableStaff.size),
    staffDirectoryAvailable: roleStaff.length > 0
  };
};

const buildFilters = (queryParams) => {
  const {
    status = 'pending',
    type = 'all',
    search = '',
    department = '',
    startDate = '',
    endDate = ''
  } = queryParams;
  const query = {};

  if (status !== 'all') {
    if (!statuses.includes(status)) throw new Error('Invalid status filter.');
    query.status = status;
  }

  if (type !== 'all') {
    if (!requestTypes.includes(type)) throw new Error('Invalid request type filter.');
    query.requestType = type === 'leave_request'
      ? { $in: ['leave_request', 'staff_leave'] }
      : type;
  }

  if (department) {
    query.$or = [
      { department: { $regex: escapeRegex(department), $options: 'i' } },
      { 'purchase.requesterDepartment': { $regex: escapeRegex(department), $options: 'i' } }
    ];
  }

  if (search) {
    const searchPattern = escapeRegex(search);
    const searchFilters = [
      { applicantName: { $regex: searchPattern, $options: 'i' } },
      { applicantId: { $regex: searchPattern, $options: 'i' } },
      { requestNumber: { $regex: searchPattern, $options: 'i' } }
    ];
    query.$and = [...(query.$or ? [{ $or: query.$or }] : []), { $or: searchFilters }];
    delete query.$or;
  }

  if (startDate || endDate) {
    const start = startDate ? parseClinicDate(startDate) : null;
    const end = endDate ? parseClinicDate(endDate, true) : null;
    if ((startDate && !start) || (endDate && !end)) throw new Error('Invalid date filter.');
    if (type === 'leave_request') {
      if (start) query['leave.endDate'] = { $gte: start };
      if (end) query['leave.startDate'] = { $lte: end };
    } else {
      query.createdAt = {
        ...(start ? { $gte: start } : {}),
        ...(end ? { $lte: end } : {})
      };
    }
  }

  return query;
};

const notifyClinicHeads = async (request, title, message) => {
  const clinicHeads = await User.find({ role: 'Clinic Head', status: 'Active' }).select('_id').lean();
  if (clinicHeads.length) {
    await ClinicNotification.insertMany(clinicHeads.map(({ _id }) => ({
      recipient: _id,
      request: request._id,
      title,
      message
    })));
  }
};

const getTodayRange = () => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const start = new Date(Date.UTC(
    Number(dateParts.year),
    Number(dateParts.month) - 1,
    Number(dateParts.day)
  ) - (3 * 60 * 60 * 1000));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const parseClinicDate = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day) - (3 * 60 * 60 * 1000);
  return new Date(timestamp + (endOfDay ? (24 * 60 * 60 * 1000) - 1 : 0));
};

export const getApprovalRequests = async (req, res) => {
  let query;
  try {
    query = buildFilters(req.query);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  try {
    const { start, end } = getTodayRange();
    const { search = '' } = req.query;
    const includeLegacyCertificates = query.requestType === 'medical_certificate' && !req.query.department;
    const legacyQuery = {};
    if (query.status) legacyQuery.status = query.status;
    if (query.createdAt) legacyQuery.requestDate = query.createdAt;
    if (search) {
      const searchPattern = escapeRegex(search);
      legacyQuery.$or = [
        { studentName: { $regex: searchPattern, $options: 'i' } },
        { studentId: { $regex: searchPattern, $options: 'i' } }
      ];
    }
    const [requests, legacyCertificates, pending, approvedToday, rejectedToday, urgentRequests, departments] = await Promise.all([
      ApprovalRequest.find(query).sort({ priority: -1, createdAt: -1 }).limit(200).lean(),
      includeLegacyCertificates
        ? MedicalCertificate.find(legacyQuery).sort({ requestDate: -1 }).limit(200).lean()
        : Promise.resolve([]),
      Promise.all([
        ApprovalRequest.countDocuments({ status: 'pending' }),
        MedicalCertificate.countDocuments({ status: 'pending' })
      ]).then(([newCount, legacyCount]) => newCount + legacyCount),
      Promise.all([
        ApprovalRequest.countDocuments({ status: 'approved', updatedAt: { $gte: start, $lt: end } }),
        MedicalCertificate.countDocuments({ status: 'approved', updatedAt: { $gte: start, $lt: end } })
      ]).then(([newCount, legacyCount]) => newCount + legacyCount),
      Promise.all([
        ApprovalRequest.countDocuments({ status: 'rejected', updatedAt: { $gte: start, $lt: end } }),
        MedicalCertificate.countDocuments({ status: 'rejected', updatedAt: { $gte: start, $lt: end } })
      ]).then(([newCount, legacyCount]) => newCount + legacyCount),
      ApprovalRequest.countDocuments({ status: 'pending', priority: 'urgent' }),
      ApprovalRequest.distinct('department', { department: { $nin: ['', null] } })
    ]);

    const leaveRequests = requests.filter((request) => leaveRequestTypes.includes(request.requestType));
    const leaveApplicantProfiles = await getLeaveApplicantProfiles(leaveRequests);
    const allRequests = [
      ...requests.map((request) => ({
        ...request,
        ...(leaveApplicantProfiles.has(String(request._id))
          ? { staffRole: leaveApplicantProfiles.get(String(request._id)).role }
          : {}),
        recordSource: 'approval'
      })),
      ...legacyCertificates.map((certificate) => ({
        _id: certificate._id,
        requestType: 'medical_certificate',
        applicantName: certificate.studentName,
        applicantId: certificate.studentId,
        applicantRole: 'student',
        requestedByDoctor: certificate.doctorName,
        reason: certificate.reason,
        approvedBy: certificate.approvedBy || '',
        approvedAt: certificate.approvedAt || null,
        certificate: { certificateType: 'Medical certificate' },
        status: certificate.status,
        priority: 'normal',
        createdAt: certificate.requestDate,
        decisionHistory: certificate.reviewHistory || [],
        recordSource: 'legacy-certificate'
      }))
    ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 200);

    let responseSummary = { pending, approvedToday, rejectedToday, urgentRequests };
    if (req.query.type === 'purchase_request') {
      const purchaseSummaryFilter = { requestType: 'purchase_request' };
      if (req.query.department) {
        purchaseSummaryFilter.department = {
          $regex: `^${escapeRegex(req.query.department)}$`,
          $options: 'i'
        };
      }
      const [purchasePending, purchaseApprovedToday, purchaseRejectedToday, purchaseUrgent] = await Promise.all([
        ApprovalRequest.countDocuments({ ...purchaseSummaryFilter, status: 'pending' }),
        ApprovalRequest.countDocuments({ ...purchaseSummaryFilter, status: 'approved', updatedAt: { $gte: start, $lt: end } }),
        ApprovalRequest.countDocuments({ ...purchaseSummaryFilter, status: 'rejected', updatedAt: { $gte: start, $lt: end } }),
        ApprovalRequest.countDocuments({ ...purchaseSummaryFilter, status: 'pending', priority: 'urgent' })
      ]);
      responseSummary = {
        pending: purchasePending,
        approvedToday: purchaseApprovedToday,
        rejectedToday: purchaseRejectedToday,
        urgentRequests: purchaseUrgent
      };
    }

    return res.status(200).json({
      success: true,
      count: allRequests.length,
      data: allRequests,
      summary: responseSummary,
      departments: departments.sort((left, right) => left.localeCompare(right))
    });
  } catch (error) {
    console.error('Failed to load approval requests:', error);
    return res.status(500).json({ success: false, message: 'Unable to load approval requests.' });
  }
};

export const getMyDepartmentRequests = async (req, res) => {
  const requestedType = typeof req.query.type === 'string' ? req.query.type : 'purchase';
  const requestTypes = {
    purchase: ['purchase_request'],
    leave: ['leave_request', 'staff_leave'],
    all: ['purchase_request', 'leave_request', 'staff_leave']
  };
  if (!requestTypes[requestedType]) {
    return res.status(400).json({ success: false, message: 'Choose purchase, leave, or all request types.' });
  }
  try {
    const requests = await ApprovalRequest.find({
      requestType: { $in: requestTypes[requestedType] },
      requesterUser: req.user._id
    }).sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error('Failed to load staff requests:', error);
    return res.status(500).json({ success: false, message: 'Unable to load your requests.' });
  }
};

export const getApprovalRequestDetails = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid approval request ID.' });
  }

  try {
    if (req.query.source === 'legacy-certificate') {
      const certificate = await MedicalCertificate.findById(req.params.id).lean();
      if (!certificate) return res.status(404).json({ success: false, message: 'Medical certificate not found.' });
      return res.status(200).json({
        success: true,
        data: {
          request: {
            ...certificate,
            requestType: 'medical_certificate',
            applicantName: certificate.studentName,
            applicantId: certificate.studentId,
            applicantRole: 'student',
            requestedByDoctor: certificate.doctorName,
            approvedBy: certificate.approvedBy || '',
            approvedAt: certificate.approvedAt || null,
            certificate: { certificateType: 'Medical certificate' },
            createdAt: certificate.requestDate,
            decisionHistory: certificate.reviewHistory || [],
            recordSource: 'legacy-certificate'
          },
          departmentConflicts: [],
          currentStock: null
        }
      });
    }
    const request = await ApprovalRequest.findById(req.params.id).lean();
    if (!request) return res.status(404).json({ success: false, message: 'Approval request not found.' });

    const details = { request, departmentConflicts: [], currentStock: null };
    if (['leave_request', 'staff_leave'].includes(request.requestType)
      && request.leave?.startDate && request.leave?.endDate && request.department) {
      details.departmentConflicts = await ApprovalRequest.find({
        _id: { $ne: request._id },
        requestType: { $in: ['leave_request', 'staff_leave'] },
        department: request.department,
        status: { $in: ['pending', 'approved'] },
        'leave.startDate': { $lte: request.leave.endDate },
        'leave.endDate': { $gte: request.leave.startDate }
      }).select('applicantName applicantId leave.startDate leave.endDate status').lean();
      const profiles = await getLeaveApplicantProfiles([request, ...details.departmentConflicts]);
      details.staffRole = profiles.get(String(request._id))?.role || 'Staff role not recorded';
      details.staffCoverage = await getDepartmentLeaveCoverage(request, details.departmentConflicts, profiles);
    }

    if (request.requestType === 'purchase_request' && request.purchase?.itemName) {
      const inventoryItem = await ClinicInventory.findOne({
        itemName: { $regex: `^${escapeRegex(request.purchase.itemName)}$`, $options: 'i' }
      }).select('itemName quantity unit reorderLevel').lean();
      details.currentStock = inventoryItem;
    }

    return res.status(200).json({ success: true, data: details });
  } catch (error) {
    console.error('Failed to load approval request details:', error);
    return res.status(500).json({ success: false, message: 'Unable to load request details.' });
  }
};

const createDecisionNotifications = async (request, status) => {
  const message = `Your ${request.requestType.replaceAll('_', ' ')} request ${status}.`;
  const recipients = request.requesterUser ? [String(request.requesterUser)] : [];
  if (!request.requesterUser && request.applicantId) {
    const applicant = await User.findOne({
      $or: [
        { employeeId: request.applicantId },
        { username: request.applicantId },
        { email: request.applicantId.toLowerCase() }
      ]
    }).select('_id').lean();
    if (applicant) recipients.push(String(applicant._id));
  }

  if (request.requestType === 'purchase_request') {
    const pharmacyStaff = await User.find({
      role: { $in: ['Pharmacist', 'Lab Technician'] },
      status: 'Active'
    }).select('_id').lean();
    recipients.push(...pharmacyStaff.map(({ _id }) => String(_id)));
  }

  const uniqueRecipients = [...new Set(recipients)];
  if (uniqueRecipients.length) {
    await ClinicNotification.insertMany(uniqueRecipients.map((recipient) => ({
      recipient,
      request: request._id,
      title: request.requestType === 'purchase_request' && status === 'approved'
        ? 'Purchase request approved'
        : `Request ${status}`,
      message: request.requestType === 'purchase_request' && status === 'approved'
        ? `${request.purchase?.itemName || 'A purchase request'} was approved.`
        : message
    })));
  }
};

const decideRequest = async (requestId, status, comment, actor, approvedQuantity = null) => {
  const pendingRequest = await ApprovalRequest.findOne({ _id: requestId, status: 'pending' })
    .select('requestType purchase.quantity')
    .lean();
  if (!pendingRequest) return null;
  const request = await ApprovalRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    {
      $set: {
        status,
        ...(pendingRequest.requestType === 'purchase_request'
          ? {
            fulfillmentStatus: status === 'approved' ? 'awaiting_delivery' : 'awaiting_approval',
            ...(status === 'approved'
              ? { 'purchase.approvedQuantity': approvedQuantity ?? pendingRequest.purchase?.quantity }
              : {})
          }
          : {}),
        rejectionReason: status === 'rejected' ? comment : '',
        approvedBy: status === 'approved' ? actor.name : '',
        approvedAt: status === 'approved' ? new Date() : undefined
      },
      $push: {
        decisionHistory: {
          action: status,
          previousStatus: 'pending',
          status,
          comment,
          actorId: actor._id,
          actorName: actor.name || 'Clinic Head',
          actedAt: new Date()
        }
      }
    },
    { new: true, runValidators: true }
  );
  return request;
};

const addApprovedLeaveToRoster = async (request, actor) => {
  if (!leaveRequestTypes.includes(request.requestType)
    || !request.leave?.startDate
    || !request.leave?.endDate) return '';

  const startDate = new Date(request.leave.startDate);
  const endDate = new Date(request.leave.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return 'Leave was approved, but its dates could not be added to the duty roster.';
  }
  const dayCount = Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1;
  if (dayCount > 366) {
    return 'Leave was approved, but its date range is too long to add to the duty roster automatically.';
  }

  let applicant = request.applicantId
    ? await User.findOne({
      $or: [
        { employeeId: request.applicantId },
        { username: request.applicantId },
        { email: request.applicantId.toLowerCase() }
      ]
    }).select('_id email employeeId username').lean()
    : null;
  if (!applicant && request.requesterUser) {
    const requester = await User.findById(request.requesterUser)
      .select('_id email employeeId username')
      .lean();
    const requesterIds = [requester?.employeeId, requester?.username, String(requester?._id)].filter(Boolean);
    if (requesterIds.includes(request.applicantId)) applicant = requester;
  }
  if (!applicant) return 'Leave was approved, but the staff account could not be matched to a roster record.';

  const staffRecord = applicant.email
    ? await Staff.findOne({ email: applicant.email }).select('_id').lean()
    : null;
  const staffCollectionHasRecords = await Staff.exists({});
  const staffId = staffRecord?._id || (!staffCollectionHasRecords ? applicant._id : null);
  if (!staffId) return 'Leave was approved, but the staff member could not be matched to the staff directory.';

  const settings = await ClinicOperationalSettings.findOne({ key: 'clinic' })
    .select('rosterRules.autoLockApprovedLeave')
    .lean();
  const autoLockApprovedLeave = settings?.rosterRules?.autoLockApprovedLeave !== false;
  const updates = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      updateOne: {
        filter: { staffId, date: date.toISOString().slice(0, 10) },
        update: {
          $set: {
            shift: 'leave',
            isLocked: autoLockApprovedLeave,
            assignedBy: actor.name || 'Clinic Head'
          }
        },
        upsert: true
      }
    };
  });
  await Roster.bulkWrite(updates);
  return '';
};

const decideLegacyCertificate = async (requestId, status, comment, actor) => {
  const certificate = await MedicalCertificate.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    {
      $set: {
        status,
        ...(status === 'approved'
          ? { approvedBy: actor.name || 'Clinic Head', approvedAt: new Date() }
          : {})
      },
      $push: {
        reviewHistory: {
          action: status,
          previousStatus: 'pending',
          status,
          comment,
          actorId: actor._id,
          actorName: actor.name || 'Clinic Head',
          actedAt: new Date()
        }
      }
    },
    { new: true, runValidators: true }
  );
  if (!certificate) return null;

  let warning = '';
  try {
    const applicant = await User.findOne({
      $or: [{ employeeId: certificate.studentId }, { username: certificate.studentId }]
    }).select('_id').lean();
    if (applicant) {
      await ClinicNotification.create({
        recipient: applicant._id,
        request: certificate._id,
        title: `Medical certificate ${status}`,
        message: `Your medical certificate request was ${status}.`
      });
    }
  } catch (notificationError) {
    console.error('Certificate decision saved, but notification creation failed:', notificationError);
    warning = 'Decision saved, but the notification could not be created.';
  }
  return { certificate, warning };
};

export const updatePurchasePriority = async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body || {};
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid purchase request ID.' });
  }
  if (!['normal', 'urgent'].includes(priority)) {
    return res.status(400).json({ success: false, message: 'Priority must be normal or urgent.' });
  }

  try {
    const request = await ApprovalRequest.findOneAndUpdate(
      { _id: id, requestType: 'purchase_request', status: 'pending' },
      {
        $set: { priority },
        $push: {
          decisionHistory: {
            action: 'priority_updated',
            previousStatus: 'pending',
            status: 'pending',
            comment: `Priority marked ${priority}.`,
            actorId: req.user._id,
            actorName: req.user.name || 'Clinic Head',
            actedAt: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Pending purchase request not found.' });
    }
    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Failed to update purchase request priority:', error);
    return res.status(500).json({ success: false, message: 'Unable to update purchase request priority.' });
  }
};

export const receivePurchaseRequest = async (req, res) => {
  const { id } = req.params;
  const roles = [
    req.user.activeRole,
    req.user.role,
    ...(Array.isArray(req.user.roles) ? req.user.roles : [])
  ].filter(Boolean);
  const isClinicHead = roles.some((role) => role.toLowerCase() === 'clinic head');
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid purchase request ID.' });
  }

  try {
    const request = await ApprovalRequest.findOneAndUpdate(
      {
        _id: id,
        requestType: 'purchase_request',
        status: 'approved',
        fulfillmentStatus: 'awaiting_delivery',
        ...(isClinicHead
          ? {}
          : {
            $or: [
              { requesterUser: req.user._id },
              ...(req.user.department ? [{ department: req.user.department }] : [])
            ]
          })
      },
      {
        $set: {
          fulfillmentStatus: 'received',
          receivedBy: req.user.name || 'Clinic staff',
          receivedAt: new Date()
        },
        $push: {
          decisionHistory: {
            action: 'received',
            previousStatus: 'approved',
            status: 'approved',
            comment: `${req.user.name || 'Clinic staff'} confirmed receipt of the approved quantity.`,
            actorId: req.user._id,
            actorName: req.user.name || 'Clinic staff',
            actedAt: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Approved purchase request was not found, is already received, or does not belong to your account.'
      });
    }
    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Failed to record purchase delivery:', error);
    return res.status(500).json({ success: false, message: 'Unable to record purchase delivery.' });
  }
};

export const updateApprovalStatus = async (req, res) => {
  const { id } = req.params;
  const { status, comment = '', rejectionReason = '', approvedQuantity } = req.body;
  const decisionComment = typeof comment === 'string' ? comment.trim() : '';
  const rejectionNote = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
  const finalComment = status === 'rejected' ? (rejectionNote || decisionComment) : decisionComment;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid approval request ID.' });
  }
  if (!['approved', 'rejected', 'returned'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Choose approve, reject, or return for correction.' });
  }
  if (status !== 'approved' && !finalComment) {
    return res.status(400).json({ success: false, message: 'A comment is required for rejection or return.' });
  }
  if (approvedQuantity !== undefined
    && (!Number.isInteger(approvedQuantity) || approvedQuantity < 1)) {
    return res.status(400).json({ success: false, message: 'Approved quantity must be a positive whole number.' });
  }

  try {
    if (req.body.recordSource === 'legacy-certificate') {
      const result = await decideLegacyCertificate(id, status, finalComment, req.user);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Pending certificate not found; it may already be reviewed.' });
      }
      return res.status(200).json({ success: true, warning: result.warning, data: result.certificate });
    }
    let requestComment = finalComment;
    if (approvedQuantity !== undefined) {
      const currentRequest = await ApprovalRequest.findOne({ _id: id, status: 'pending' })
        .select('requestType purchase.quantity')
        .lean();
      if (!currentRequest || currentRequest.requestType !== 'purchase_request') {
        return res.status(400).json({ success: false, message: 'Quantity adjustments are only available for pending purchase requests.' });
      }
      if (approvedQuantity > currentRequest.purchase.quantity) {
        return res.status(400).json({ success: false, message: 'Approved quantity cannot exceed the requested quantity.' });
      }
      if (status !== 'approved') {
        return res.status(400).json({ success: false, message: 'An adjusted quantity can only be saved when approving the request.' });
      }
      if (approvedQuantity !== currentRequest.purchase.quantity) {
        requestComment = [
          `Approved quantity adjusted from ${currentRequest.purchase.quantity} to ${approvedQuantity}.`,
          finalComment
        ].filter(Boolean).join(' ');
      }
    }
    const request = await decideRequest(id, status, requestComment, req.user, approvedQuantity);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Pending request not found; it may already be reviewed.' });
    }

    let notificationWarning = '';
    if (status === 'approved') {
      try {
        notificationWarning = await addApprovedLeaveToRoster(request, req.user);
      } catch (rosterError) {
        console.error('Leave approved, but roster update failed:', rosterError);
        notificationWarning = 'Leave was approved, but could not be added to the duty roster.';
      }
    }
    try {
      await createDecisionNotifications(request, status);
    } catch (notificationError) {
      console.error('Request decision saved, but notification creation failed:', notificationError);
      notificationWarning = [notificationWarning, 'Decision saved, but the notification could not be created.'].filter(Boolean).join(' ');
    }

    return res.status(200).json({
      success: true,
      message: `Request ${status}.`,
      warning: notificationWarning,
      data: request
    });
  } catch (error) {
    console.error('Failed to update approval request:', error);
    return res.status(500).json({ success: false, message: 'Unable to update approval request.' });
  }
};

export const bulkApproveRequests = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100
    || ids.some((item) => !mongoose.isValidObjectId(typeof item === 'string' ? item : item?.id)
      || (typeof item !== 'string' && !['approval', 'legacy-certificate'].includes(item?.recordSource)))) {
    return res.status(400).json({ success: false, message: 'Provide between 1 and 100 valid request IDs.' });
  }

  try {
    const results = await Promise.all(ids.map(async (item) => {
      const id = typeof item === 'string' ? item : item.id;
      const source = typeof item === 'string' ? 'approval' : item.recordSource;
      const decision = source === 'legacy-certificate'
        ? await decideLegacyCertificate(id, 'approved', '', req.user)
        : await decideRequest(id, 'approved', '', req.user);
      if (!decision) return { id, success: false, message: 'Not pending or not found.' };
      let notificationWarning = source === 'legacy-certificate' ? decision.warning : '';
      if (source === 'approval') {
        try {
          notificationWarning = await addApprovedLeaveToRoster(decision, req.user);
        } catch (rosterError) {
          console.error(`Leave approved, but roster update failed for request ${id}:`, rosterError);
          notificationWarning = 'Leave was approved, but could not be added to the duty roster.';
        }
      }
      try {
        if (source === 'approval') await createDecisionNotifications(decision, 'approved');
      } catch (error) {
        console.error(`Bulk approval notification failed for request ${id}:`, error);
        notificationWarning = [notificationWarning, 'Decision saved, but notification creation failed.'].filter(Boolean).join(' ');
      }
      return { id, success: true, warning: notificationWarning };
    }));
    return res.status(200).json({
      success: results.some(({ success }) => success),
      data: results,
      approvedCount: results.filter(({ success }) => success).length,
      notificationWarningCount: results.filter(({ warning }) => Boolean(warning)).length
    });
  } catch (error) {
    console.error('Failed to bulk approve requests:', error);
    return res.status(500).json({ success: false, message: 'Unable to bulk approve requests.' });
  }
};

export const resubmitApprovalRequest = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid approval request ID.' });
  }
  const updates = {};
  for (const field of ['reason', 'department', 'duration', 'targetHospital', 'attachmentUrl']) {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] !== 'string' || (field === 'reason' && !req.body[field].trim())) {
        return res.status(400).json({ success: false, message: `Invalid ${field} correction.` });
      }
      updates[field] = req.body[field].trim();
    }
  }
  for (const field of ['leave', 'purchase', 'referral', 'certificate']) {
    if (req.body[field] !== undefined) {
      if (!req.body[field] || typeof req.body[field] !== 'object' || Array.isArray(req.body[field])) {
        return res.status(400).json({ success: false, message: `Invalid ${field} corrections.` });
      }
      updates[field] = req.body[field];
    }
  }
  if (req.body.priority !== undefined) {
    if (!['normal', 'urgent'].includes(req.body.priority)) {
      return res.status(400).json({ success: false, message: 'Priority must be normal or urgent.' });
    }
    updates.priority = req.body.priority;
  }
  try {
    const request = await ApprovalRequest.findOneAndUpdate(
      { _id: id, requesterUser: req.user._id, status: 'returned' },
      {
        $set: { status: 'pending', rejectionReason: '', ...updates },
        $push: {
          decisionHistory: {
            action: 'resubmitted',
            previousStatus: 'returned',
            status: 'pending',
            comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : '',
            actorId: req.user._id,
            actorName: req.user.name,
            actedAt: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
    if (!request) {
      return res.status(404).json({ success: false, message: 'Returned request not found for this account.' });
    }
    let warning = '';
    try {
      await notifyClinicHeads(request, 'Request resubmitted', `${request.applicantName} resubmitted ${request.requestType.replaceAll('_', ' ')}.`);
    } catch (notificationError) {
      console.error('Request resubmitted, but clinic-head notification creation failed:', notificationError);
      warning = 'Request resubmitted, but clinic-head notification could not be created.';
    }
    return res.status(200).json({ success: true, warning, data: request });
  } catch (error) {
    console.error('Failed to resubmit approval request:', error);
    return res.status(500).json({ success: false, message: 'Unable to resubmit approval request.' });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await ClinicNotification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('Failed to load clinic notifications:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
  }
};

export const markNotificationRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
  }
  try {
    const notification = await ClinicNotification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return res.status(500).json({ success: false, message: 'Unable to update notification.' });
  }
};

export const createApprovalRequest = async (req, res) => {
  const {
    requestType,
    applicantName,
    applicantId,
    applicantRole,
    requestedByDoctor = '',
    reason,
    department: submittedDepartment = '',
    priority = 'normal',
    duration = '',
    targetHospital = '',
    attachmentUrl = '',
    leave = {},
    purchase = {},
    referral = {},
    certificate = {}
  } = req.body || {};
  const safeLeave = leave && typeof leave === 'object' && !Array.isArray(leave) ? leave : {};
  const safePurchase = purchase && typeof purchase === 'object' && !Array.isArray(purchase) ? purchase : {};
  const safeReferral = referral && typeof referral === 'object' && !Array.isArray(referral) ? referral : {};
  const safeCertificate = certificate && typeof certificate === 'object' && !Array.isArray(certificate) ? certificate : {};
  const requesterRoles = [
    req.user.activeRole,
    req.user.role,
    ...(Array.isArray(req.user.roles) ? req.user.roles : [])
  ].filter(Boolean);
  const isClinicHead = requesterRoles.some((role) => role.toLowerCase() === 'clinic head');
  const isCardRoomStaff = requesterRoles.some((role) => role.trim().toLowerCase() === 'card chief');
  const isNonStaffRequester = requesterRoles.length > 0
    && requesterRoles.every((role) => ['student', 'patient', 'admin', 'administrator'].includes(role.trim().toLowerCase()));
  const isStaffRequest = ['purchase_request', 'leave_request', 'staff_leave'].includes(requestType);
  const department = isStaffRequest && !isClinicHead
    ? (isCardRoomStaff ? 'Card Room' : req.user.department || '')
    : submittedDepartment;
  if (!requestTypes.includes(requestType)
    || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Provide a valid request type and a reason.'
    });
  }

  const invalid = (message) => res.status(400).json({ success: false, message });
  const isText = (value) => typeof value === 'string' && value.trim().length > 0;
  const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

  if (isStaffRequest && !isClinicHead && isNonStaffRequester) {
    return res.status(403).json({ success: false, message: 'Clinic staff access is required to submit this request.' });
  }

  if (requestType === 'leave_request' || requestType === 'staff_leave') {
    const start = new Date(safeLeave.startDate);
    const end = new Date(safeLeave.endDate);
    if (!isText(department)
      || !isText(safeLeave.leaveType)
      || !safeLeave.startDate || Number.isNaN(start.getTime())
      || !safeLeave.endDate || Number.isNaN(end.getTime())
      || end < start
      || !Number.isFinite(Number(safeLeave.totalDays)) || Number(safeLeave.totalDays) <= 0
      || (safeLeave.balanceAtRequest != null && !isNonNegativeNumber(safeLeave.balanceAtRequest))) {
      return invalid('Leave requests require a department, leave type, valid date range, and positive total days.');
    }
  }

  if (requestType === 'purchase_request'
    && (!isText(department)
      || !isText(safePurchase.itemName)
      || !Number.isFinite(Number(safePurchase.quantity)) || Number(safePurchase.quantity) <= 0
      || !Number.isInteger(Number(safePurchase.quantity))
      || !isNonNegativeNumber(safePurchase.estimatedCost)
      || (safePurchase.currentStock != null && !isNonNegativeNumber(safePurchase.currentStock))
      || (safePurchase.monthlyUsage != null && !isNonNegativeNumber(safePurchase.monthlyUsage)))) {
    return invalid('Purchase requests require a department, item, positive quantity, and a valid estimated cost.');
  }

  if (requestType === 'referral'
    && (!isText(applicantName)
      || !isText(applicantId)
      || !isText(targetHospital)
      || !isText(requestedByDoctor)
      || !isText(safeReferral.diagnosis)
      || !isText(safeReferral.referralReason))) {
    return invalid('Referral requests require the patient name and ID, hospital, doctor, diagnosis, and referral reason.');
  }

  if (requestType === 'medical_certificate'
    && (!isText(applicantName)
      || !isText(applicantId)
      || !isText(requestedByDoctor)
      || !isText(safeCertificate.certificateType)
      || (safeCertificate.prescribedDays != null && !isNonNegativeNumber(safeCertificate.prescribedDays)))) {
    return invalid('Medical certificates require the patient name and ID, certificate type, and issuing doctor.');
  }
  if (requestType === 'medical_certificate') {
    const hasRestStart = Boolean(safeCertificate.restStartDate);
    const hasRestEnd = Boolean(safeCertificate.restEndDate);
    const restStartDate = hasRestStart ? new Date(safeCertificate.restStartDate) : null;
    const restEndDate = hasRestEnd ? new Date(safeCertificate.restEndDate) : null;
    if (hasRestStart !== hasRestEnd
      || (restStartDate && Number.isNaN(restStartDate.getTime()))
      || (restEndDate && Number.isNaN(restEndDate.getTime()))
      || (restStartDate && restEndDate && restEndDate < restStartDate)) {
      return invalid('Provide a valid medical certificate rest period with an end date on or after the start date.');
    }
    if (safeCertificate.academicPurpose != null && typeof safeCertificate.academicPurpose !== 'string') {
      return invalid('Academic purpose must be text.');
    }
    if (safeCertificate.clinicalAdvice != null && typeof safeCertificate.clinicalAdvice !== 'string') {
      return invalid('Dietary and rest instructions must be text.');
    }
  }

  try {
    const request = await ApprovalRequest.create({
      requestType,
      department: typeof department === 'string' ? department.trim() : '',
      priority: priority === 'urgent' ? 'urgent' : 'normal',
      duration: typeof duration === 'string' ? duration.trim() : '',
      targetHospital: typeof targetHospital === 'string' ? targetHospital.trim() : '',
      attachmentUrl: typeof attachmentUrl === 'string' ? attachmentUrl.trim() : '',
      leave: safeLeave,
      purchase: requestType === 'purchase_request'
        ? {
          ...safePurchase,
          requesterDepartment: department.trim(),
          category: isText(safePurchase.category) ? safePurchase.category.trim() : 'Other',
          unit: isText(safePurchase.unit) ? safePurchase.unit.trim() : 'units',
          requesterRole: isClinicHead
            ? (typeof safePurchase.requesterRole === 'string' ? safePurchase.requesterRole.trim() : '')
            : (req.user.activeRole || req.user.role || req.user.position || 'Staff')
        }
        : safePurchase,
      referral: safeReferral,
      certificate: safeCertificate,
      applicantName: isStaffRequest && !isClinicHead
        ? req.user.name
        : typeof applicantName === 'string' && applicantName.trim()
        ? applicantName.trim()
        : req.user.name,
      applicantId: isStaffRequest && !isClinicHead
        ? req.user.employeeId || req.user.username || String(req.user._id)
        : typeof applicantId === 'string' && applicantId.trim()
        ? applicantId.trim()
        : req.user.employeeId || req.user.username || String(req.user._id),
      applicantRole: isStaffRequest
        ? 'staff'
        : applicantRole === 'student' ? 'student' : 'staff',
      requesterUser: req.user._id,
      requestedByDoctor: typeof requestedByDoctor === 'string' ? requestedByDoctor.trim() : '',
      reason: reason.trim(),
      requestNumber: `REQ-${Date.now().toString(36).toUpperCase()}`,
      decisionHistory: [{
        action: 'submitted',
        status: 'pending',
        actorId: req.user._id,
        actorName: req.user.name,
        actedAt: new Date()
      }]
    });
    let warning = '';
    try {
      const requestMessage = request.requestType === 'purchase_request'
        ? `${request.priority === 'urgent' ? 'Urgent: ' : ''}${request.applicantName} from ${request.department} requested ${request.purchase.quantity} ${request.purchase.unit} of ${request.purchase.itemName}.`
        : `${request.applicantName} submitted a ${request.requestType.replaceAll('_', ' ')} request.`;
      await notifyClinicHeads(request, 'New approval request', requestMessage);
    } catch (notificationError) {
      console.error('Approval request created, but clinic-head notification creation failed:', notificationError);
      warning = 'Request submitted, but clinic-head notification could not be created.';
    }
    return res.status(201).json({ success: true, warning, data: request });
  } catch (error) {
    console.error('Failed to create approval request:', error);
    return res.status(400).json({ success: false, message: error.message || 'Unable to create approval request.' });
  }
};

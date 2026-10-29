import { createHash } from 'node:crypto';
import { Staff, Roster } from '../module/StaffAndRoster.js';
import StaffAttendance from '../module/StaffAttendance.js';
import ClinicVisit from '../module/ClinicVisit.js';
import ClinicNotification from '../module/ClinicNotification.js';
import User from '../module/User.js';
import Department from '../module/Department.js';
import RolePermission from '../module/RolePermission.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import { notifyClinicHeads } from '../utils/clinicHeadAlert.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeRoleName = (value) => value.trim().toLowerCase();
const isSystemAdminRole = (role) => (
  ['admin', 'system admin', 'system_admin'].includes(normalizeRoleName(role.roleName))
  || ['admin', 'system admin', 'system_admin'].includes(normalizeRoleName(role.displayName || ''))
);
const getClinicDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

const getActiveStaffRoles = async () => {
  const roles = await RolePermission.find({
    $or: [{ status: 'Active' }, { status: { $exists: false } }]
  })
    .select('roleName displayName')
    .sort({ displayName: 1, roleName: 1 })
    .lean();
  const staffRoles = roles.filter((role) => role.roleName && !isSystemAdminRole(role));
  if (!staffRoles.some((role) => normalizeRoleName(role.roleName) === 'student')) {
    staffRoles.push({ roleName: 'Student', displayName: 'Student' });
  }
  return staffRoles;
};

export const findStaffMembers = async ({ department, role, search, status, includeStudents = false } = {}) => {
  const activeRoles = (await getActiveStaffRoles()).filter((staffRole) => (
    includeStudents || normalizeRoleName(staffRole.roleName) !== 'student'
  ));
  const rolesByName = new Map();
  activeRoles.forEach((staffRole) => {
    rolesByName.set(normalizeRoleName(staffRole.roleName), staffRole);
    if (staffRole.displayName) rolesByName.set(normalizeRoleName(staffRole.displayName), staffRole);
  });
  const findAssignedRole = (user) => (
    [user.activeRole, user.role, ...(user.roles || []), user.position]
      .filter((assignedRole) => typeof assignedRole === 'string' && assignedRole.trim())
      .map((assignedRole) => rolesByName.get(normalizeRoleName(assignedRole)))
      .find(Boolean)
  );
  const validRoleNames = activeRoles.map((staffRole) => staffRole.roleName);
  const roleFilter = role && role !== 'All'
    ? activeRoles.find((staffRole) => normalizeRoleName(staffRole.roleName) === normalizeRoleName(role))
    : null;
  if (role && role !== 'All' && !roleFilter) return [];

  const staffQuery = {};
  if (department && department !== 'All') staffQuery.department = department;
  if (roleFilter) staffQuery.role = roleFilter.roleName;
  if (status && status !== 'All') staffQuery.status = status;

  const storedStaff = await Staff.find(staffQuery).sort({ name: 1 }).lean();
  const isStudentRole = roleFilter && normalizeRoleName(roleFilter.roleName) === 'student';

  if (!validRoleNames.length) return [];
  const roleIdentifiers = activeRoles.flatMap((staffRole) => (
    [staffRole.roleName, staffRole.displayName].filter(Boolean)
  ));
  const studentRoleClauses = [
    { role: { $regex: '^student$', $options: 'i' } },
    { activeRole: { $regex: '^student$', $options: 'i' } },
    { roles: { $regex: '^student$', $options: 'i' } },
    { position: { $regex: '^student$', $options: 'i' } }
  ];
  const userQuery = {
    $or: [
      { role: { $in: roleIdentifiers } },
      { activeRole: { $in: roleIdentifiers } },
      { roles: { $in: roleIdentifiers } },
      { position: { $in: roleIdentifiers } }
    ]
  };
  if (includeStudents) userQuery.$or.push(...studentRoleClauses);
  if (department && department !== 'All') userQuery.department = department;
  if (status && status !== 'All') userQuery.status = status;
  if (roleFilter) {
    const assignedRoleClauses = [
      { role: { $in: [roleFilter.roleName, roleFilter.displayName].filter(Boolean) } },
      { activeRole: { $in: [roleFilter.roleName, roleFilter.displayName].filter(Boolean) } },
      { roles: { $in: [roleFilter.roleName, roleFilter.displayName].filter(Boolean) } },
      { position: { $in: [roleFilter.roleName, roleFilter.displayName].filter(Boolean) } }
    ];
    userQuery.$or = isStudentRole
      ? [...assignedRoleClauses, ...studentRoleClauses]
      : assignedRoleClauses;
  }
  if (search) userQuery.name = { $regex: escapeRegex(search), $options: 'i' };

  const users = await User.find(userQuery)
    .select('name username employeeId email phoneNumber profileImage role activeRole roles position department dateJoined status')
    .sort({ name: 1 })
    .lean();

  const userStaffMembers = users
    .map((user) => {
      const assignedRole = findAssignedRole(user);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        employeeId: user.employeeId || user.username || '',
        profileImage: user.profileImage || '',
        role: assignedRole?.roleName,
        roleLabel: assignedRole?.displayName,
        department: user.department || '',
        joinedDate: user.dateJoined,
        status: user.status
      };
    })
    .filter((staff) => (
      staff.role
      && (!roleFilter || normalizeRoleName(staff.role) === normalizeRoleName(roleFilter.roleName))
      && (!status || status === 'All' || staff.status === status)
    ));
  const usersByEmail = new Map(users
    .filter((user) => user.email)
    .map((user) => [user.email.toLowerCase(), user]));
  const storedStaffMembers = storedStaff
    .map((staff) => {
      const linkedUser = staff.email ? usersByEmail.get(staff.email.toLowerCase()) : null;
      const assignedRole = linkedUser
        ? findAssignedRole(linkedUser)
        : rolesByName.get(normalizeRoleName(staff.role));
      const member = assignedRole
        ? {
          ...staff,
          _id: staff._id,
          name: linkedUser?.name || staff.name,
          email: linkedUser?.email || staff.email,
          phone: linkedUser?.phoneNumber || staff.phone,
          profileImage: linkedUser?.profileImage || '',
          employeeId: linkedUser?.employeeId || linkedUser?.username || '',
          role: assignedRole.roleName,
          roleLabel: assignedRole.displayName,
          department: linkedUser?.department || staff.department,
          status: linkedUser?.status || staff.status
        }
        : null;
      if (!member
        || (!linkedUser && normalizeRoleName(member.name) === normalizeRoleName(member.role))
        || (roleFilter && normalizeRoleName(member.role) !== normalizeRoleName(roleFilter.roleName))
        || (department && department !== 'All' && member.department !== department)
        || (status && status !== 'All' && member.status !== status)
        || (search && !new RegExp(escapeRegex(search), 'i').test(member.name || ''))) {
        return null;
      }
      return member;
    })
    .filter(Boolean);
  const storedEmails = new Set(storedStaffMembers.map((staff) => staff.email?.toLowerCase()).filter(Boolean));
  const storedIds = new Set(storedStaffMembers.map((staff) => String(staff._id)));
  return [
    ...storedStaffMembers,
    ...userStaffMembers.filter((staff) => (
      !storedIds.has(String(staff._id))
      && (!staff.email || !storedEmails.has(staff.email.toLowerCase()))
    ))
  ];
};

const findCurrentStaffMembers = async () => (
  (await findStaffMembers()).filter((staff) => staff.status !== 'Inactive')
);

// 1. የሰራተኞች ዝርዝር ማምጫ (View Only)
export const getAllStaff = async (req, res) => {
  try {
    const { department, role, search, status } = req.query;
    const [staffList, roles, departments] = await Promise.all([
      findStaffMembers({ department, role, search, status, includeStudents: true }),
      getActiveStaffRoles(),
      Department.find({
        $or: [{ status: 'Active' }, { status: { $exists: false } }]
      })
        .select('name')
        .sort({ name: 1 })
        .lean()
    ]);
    res.status(200).json({
      success: true,
      data: staffList,
      roles: roles.map(({ roleName, displayName }) => ({ value: roleName, label: displayName || roleName })),
      departments: departments.map(({ name }) => ({ value: name, label: name }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStaffProfile = async (req, res) => {
  try {
    const { staffId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(staffId || '')) {
      return res.status(400).json({ success: false, message: 'Provide a valid staff member ID.' });
    }

    const staff = (await findStaffMembers({ includeStudents: true }))
      .find((member) => String(member._id) === staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const today = getClinicDate();
    const historyStart = new Date(`${today}T00:00:00.000Z`);
    historyStart.setUTCDate(historyStart.getUTCDate() - 89);
    const fromDate = historyStart.toISOString().slice(0, 10);
    const historyFrom = new Date(`${fromDate}T00:00:00.000Z`);
    const historyThrough = new Date(`${today}T23:59:59.999Z`);
    const [roster, attendance, completedVisitCount] = await Promise.all([
      Roster.find({ staffId, date: { $gte: fromDate, $lte: today } })
        .sort({ date: -1 })
        .limit(90)
        .lean(),
      StaffAttendance.find({ staffId, date: { $gte: fromDate, $lte: today } })
        .sort({ date: -1 })
        .limit(90)
        .lean(),
      ClinicVisit.countDocuments({
        attendedByStaffId: staffId,
        status: 'Completed',
        visitDate: { $gte: historyFrom, $lte: historyThrough }
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        staff,
        roster,
        attendance,
        completedVisitCount,
        historyFrom: fromDate,
        historyThrough: today
      }
    });
  } catch (error) {
    console.error('Failed to load staff profile:', error);
    return res.status(500).json({ success: false, message: 'Unable to load staff profile history.' });
  }
};

// 2. የተመረጠው ሳምንት Roster ዳታ ማምጫ
export const getWeeklyRoster = async (req, res) => {
  try {
    const { startDate, endDate, department, role } = req.query; // e.g. startDate="2026-10-19", endDate="2026-10-25"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '')
      || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')
      || startDate > endDate) {
      return res.status(400).json({ success: false, message: 'Provide a valid roster date range.' });
    }

    const [staffMembers, allStaffMembers, roles, departments] = await Promise.all([
      findStaffMembers({ department, role }),
      findCurrentStaffMembers(),
      getActiveStaffRoles(),
      Department.find({
        $or: [{ status: 'Active' }, { status: { $exists: false } }]
      }).select('name').sort({ name: 1 }).lean()
    ]);
    const staffIds = staffMembers.map((staff) => staff._id);
    const allStaffIds = allStaffMembers.map((staff) => staff._id);
    const [rosterEntries, staffingRoster, settings] = await Promise.all([
      Roster.find({
        staffId: { $in: staffIds },
        date: { $gte: startDate, $lte: endDate }
      }).lean(),
      Roster.find({
        staffId: { $in: allStaffIds },
        date: { $gte: startDate, $lte: endDate },
        shift: { $in: ['morning', 'afternoon', 'night'] }
      }).select('staffId date shift publishedAt').lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('rosterRules').lean()
    ]);

    const allStaffById = new Map(allStaffMembers.map((staff) => [String(staff._id), staff]));
    const staffingCounts = {};
    staffingRoster.forEach((entry) => {
      const staff = allStaffById.get(String(entry.staffId));
      if (!staff?.department) return;
      const key = `${staff.department}_${entry.date}_${entry.shift}`;
      staffingCounts[key] = (staffingCounts[key] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      staff: staffMembers,
      roster: rosterEntries,
      rosterRules: settings?.rosterRules || null,
      staffingCounts,
      roles: roles
        .filter((item) => normalizeRoleName(item.roleName) !== 'student')
        .map(({ roleName, displayName }) => ({ value: roleName, label: displayName || roleName })),
      departments: departments.map(({ name }) => ({ value: name, label: name })),
      isPublished: staffingRoster.length > 0 && staffingRoster.every((entry) => entry.publishedAt)
    });
  } catch (error) {
    console.error('Failed to load weekly staff roster:', error);
    res.status(500).json({ success: false, message: 'Unable to load staff and roster data.' });
  }
};

export const getTodayAttendance = async (req, res) => {
  try {
    const { department, role, search, status } = req.query;
    const date = getClinicDate();
    const staffMembers = (await findStaffMembers({ department, role, search }))
      .filter((staff) => staff.status !== 'Inactive');
    const staffIds = staffMembers.map((staff) => staff._id);
    const [attendanceEntries, leaveEntries, rosterEntries, roles, departments] = await Promise.all([
      StaffAttendance.find({ staffId: { $in: staffIds }, date }).lean(),
      Roster.find({ staffId: { $in: staffIds }, date, shift: 'leave' }).lean(),
      Roster.find({ staffId: { $in: staffIds }, date }).lean(),
      getActiveStaffRoles(),
      Department.find({
        $or: [{ status: 'Active' }, { status: { $exists: false } }]
      }).select('name').sort({ name: 1 }).lean()
    ]);
    const attendanceByStaff = new Map(attendanceEntries.map((entry) => [String(entry.staffId), entry]));
    const leaveStaffIds = new Set(leaveEntries.map((entry) => String(entry.staffId)));
    const rosterByStaff = new Map(rosterEntries.map((entry) => [String(entry.staffId), entry]));
    const replacementIds = attendanceEntries
      .map((entry) => entry.replacementStaffId && String(entry.replacementStaffId))
      .filter(Boolean);
    const replacementDirectory = replacementIds.length
      ? await findCurrentStaffMembers()
      : staffMembers;
    const staffById = new Map(replacementDirectory.map((staff) => [String(staff._id), staff]));
    const records = staffMembers.map((staff) => {
      const attendance = attendanceByStaff.get(String(staff._id));
      const roster = rosterByStaff.get(String(staff._id));
      const replacement = attendance?.replacementStaffId
        ? staffById.get(String(attendance.replacementStaffId))
        : null;
      const onLeave = leaveStaffIds.has(String(staff._id)) || staff.status === 'On Leave' || roster?.shift === 'leave';
      return {
        ...staff,
        attendanceStatus: onLeave ? 'on_leave' : attendance?.status || 'unrecorded',
        timeIn: attendance?.timeIn || '',
        timeOut: attendance?.timeOut || '',
        attendanceNote: attendance?.note || '',
        rosterShift: onLeave ? 'leave' : roster?.shift || 'off',
        isScheduled: !onLeave && ['morning', 'afternoon', 'night'].includes(roster?.shift),
        attendanceRecordedAt: attendance?.updatedAt || attendance?.createdAt || null,
        replacementStaffId: attendance?.replacementStaffId ? String(attendance.replacementStaffId) : '',
        replacementName: replacement?.name || ''
      };
    }).filter((staff) => !status || status === 'All' || staff.attendanceStatus === status);

    return res.status(200).json({
      success: true,
      date,
      data: records,
      roles: roles
        .filter((item) => normalizeRoleName(item.roleName) !== 'student')
        .map(({ roleName, displayName }) => ({ value: roleName, label: displayName || roleName })),
      departments: departments.map(({ name }) => ({ value: name, label: name }))
    });
  } catch (error) {
    console.error('Failed to load today attendance:', error);
    return res.status(500).json({ success: false, message: 'Unable to load today attendance.' });
  }
};

export const saveTodayAttendance = async (req, res) => {
  try {
    const { attendanceUpdates } = req.body || {};
    const validStatuses = ['present', 'absent', 'late', 'unrecorded'];
    if (!Array.isArray(attendanceUpdates)
      || attendanceUpdates.length > 1000
      || attendanceUpdates.some((item) => (
        !item
        || typeof item.staffId !== 'string'
        || !/^[a-f\d]{24}$/i.test(item.staffId)
        || !validStatuses.includes(item.status)
        || (item.timeIn != null && item.timeIn !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.timeIn))
        || (item.timeOut != null && item.timeOut !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.timeOut))
        || (item.note != null && typeof item.note !== 'string')
      ))) {
      return res.status(400).json({ success: false, message: 'Attendance updates contain invalid staff or status values.' });
    }

    const attendanceKeys = attendanceUpdates.map((item) => item.staffId);
    if (new Set(attendanceKeys).size !== attendanceKeys.length) {
      return res.status(400).json({ success: false, message: 'Only one attendance record per staff member is allowed each day.' });
    }
    const staffDirectory = await findCurrentStaffMembers();
    const staffById = new Map(staffDirectory.map((staff) => [String(staff._id), staff]));
    const validStaffIds = new Set(staffById.keys());
    if (attendanceUpdates.some((item) => !validStaffIds.has(item.staffId))) {
      return res.status(400).json({ success: false, message: 'Attendance includes a staff member not in the directory.' });
    }

    const date = getClinicDate();
    const staffIds = [...new Set(attendanceUpdates.map((item) => item.staffId))];
    const [leaveEntries, scheduledEntries, operationalSettings] = await Promise.all([
      Roster.find({
        staffId: { $in: staffIds },
        date,
        shift: 'leave'
      }).select('staffId').lean(),
      Roster.find({
        staffId: { $in: staffIds },
        date,
        shift: { $in: ['morning', 'afternoon', 'night'] }
      }).select('staffId shift').lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' })
        .select('rosterRules.shiftTimes rosterRules.gracePeriodMinutes rosterRules.lateAlertTriggerMinutes')
        .lean()
    ]);
    const leaveStaffIds = new Set(leaveEntries.map((entry) => String(entry.staffId)));
    const scheduledStaffIds = new Set(scheduledEntries.map((entry) => String(entry.staffId)));
    const shiftByStaffId = new Map(scheduledEntries.map((entry) => [String(entry.staffId), entry.shift]));
    if (attendanceUpdates.some((item) => (
      !leaveStaffIds.has(item.staffId)
      && !scheduledStaffIds.has(item.staffId)
    ))) {
      return res.status(409).json({
        success: false,
        message: 'Attendance can only be recorded for staff members scheduled to work today.'
      });
    }
    const eligibleUpdates = attendanceUpdates.filter((item) => (
      !leaveStaffIds.has(item.staffId)
      && staffById.get(item.staffId)?.status !== 'On Leave'
    ));
    const updates = eligibleUpdates.filter((item) => item.status !== 'unrecorded');
    const clearIds = eligibleUpdates
      .filter((item) => item.status === 'unrecorded')
      .map((item) => item.staffId);
    const gracePeriodMinutes = operationalSettings?.rosterRules?.gracePeriodMinutes ?? 15;
    const lateAlertTriggerMinutes = operationalSettings?.rosterRules?.lateAlertTriggerMinutes ?? 30;
    const shiftTimes = operationalSettings?.rosterRules?.shiftTimes || {};
    const alertableAttendance = [];
    const operations = updates.map((item) => {
      let status = item.status;
      if (status === 'present' && item.timeIn) {
        const shiftStart = shiftTimes[shiftByStaffId.get(item.staffId)]?.start;
        if (shiftStart) {
          const [startHour, startMinute] = shiftStart.split(':').map(Number);
          const [inHour, inMinute] = item.timeIn.split(':').map(Number);
          const startAt = startHour * 60 + startMinute;
          let timeInAt = inHour * 60 + inMinute;
          if (startAt >= 12 * 60 && timeInAt < 12 * 60) timeInAt += 24 * 60;
          if (timeInAt > startAt + gracePeriodMinutes) status = 'late';
        }
      }

      let lateAlertTriggered = false;
      if (status === 'late' && item.timeIn) {
        const shiftStart = shiftTimes[shiftByStaffId.get(item.staffId)]?.start;
        if (shiftStart) {
          const [startHour, startMinute] = shiftStart.split(':').map(Number);
          const [inHour, inMinute] = item.timeIn.split(':').map(Number);
          const startAt = startHour * 60 + startMinute;
          let timeInAt = inHour * 60 + inMinute;
          if (startAt >= 12 * 60 && timeInAt < 12 * 60) timeInAt += 24 * 60;
          lateAlertTriggered = timeInAt > startAt + gracePeriodMinutes + lateAlertTriggerMinutes;
        }
      }

      if (status === 'absent' || lateAlertTriggered) {
        const staff = staffById.get(item.staffId);
        alertableAttendance.push({
          batchId: `staff-attendance:${date}:${item.staffId}:${status}`,
          title: status === 'late' ? 'Staff member arrived late' : 'Staff member marked absent',
          message: `${staff?.name || 'A staff member'} in ${staff?.department || 'an unlisted department'} was marked ${status}${item.timeIn ? ` at ${item.timeIn}` : ''}${item.note?.trim() ? `. Note: ${item.note.trim()}` : '.'}`,
          targetPath: `/clinic-head/staff?staff=${encodeURIComponent(staff?.name || '')}`,
          priority: status === 'absent' ? 'urgent' : 'high'
        });
      }

      return {
      updateOne: {
        filter: { staffId: item.staffId, date },
        update: {
          $set: {
            status,
            timeIn: status === 'absent' ? '' : item.timeIn || '',
            timeOut: status === 'absent' ? '' : item.timeOut || '',
            note: item.note?.trim() || '',
            recordedBy: req.user._id
          }
        },
        upsert: true
      }
      };
    });

    if (operations.length) await StaffAttendance.bulkWrite(operations);
    const deleteResult = clearIds.length
      ? await StaffAttendance.deleteMany({ staffId: { $in: clearIds }, date })
      : { deletedCount: 0 };
    let notificationWarning = '';
    try {
      await Promise.all(alertableAttendance.map((alert) => notifyClinicHeads(alert)));
    } catch (notificationError) {
      console.error('Attendance saved, but Clinic Head alert delivery failed:', notificationError);
      notificationWarning = 'Attendance was saved, but one or more Clinic Head alerts could not be created.';
    }
    const affectedCount = operations.length + deleteResult.deletedCount;
    return res.status(200).json({
      success: true,
      message: `Attendance saved for ${affectedCount} staff member${affectedCount === 1 ? '' : 's'}.`,
      ...(notificationWarning ? { warning: notificationWarning } : {}),
      savedCount: operations.length,
      clearedCount: deleteResult.deletedCount,
      skippedLeaveCount: attendanceUpdates.length - eligibleUpdates.length
    });
  } catch (error) {
    console.error('Failed to save today attendance:', error);
    return res.status(500).json({ success: false, message: 'Unable to save today attendance.' });
  }
};

export const assignAttendanceReplacement = async (req, res) => {
  try {
    const { absentStaffId, replacementStaffId } = req.body || {};
    if (!/^[a-f\d]{24}$/i.test(absentStaffId || '')
      || !/^[a-f\d]{24}$/i.test(replacementStaffId || '')
      || absentStaffId === replacementStaffId) {
      return res.status(400).json({ success: false, message: 'Select a valid, different replacement staff member.' });
    }

    const staffDirectory = await findCurrentStaffMembers();
    const staffById = new Map(staffDirectory.map((staff) => [String(staff._id), staff]));
    const absentStaff = staffById.get(absentStaffId);
    const replacementStaff = staffById.get(replacementStaffId);
    if (!absentStaff || !replacementStaff) {
      return res.status(404).json({ success: false, message: 'The absent staff member or replacement was not found in the active directory.' });
    }
    if (absentStaff.department !== replacementStaff.department) {
      return res.status(400).json({ success: false, message: 'Choose a replacement from the same department.' });
    }

    const date = getClinicDate();
    const absentAttendance = await StaffAttendance.findOne({ staffId: absentStaffId, date });
    if (!absentAttendance || absentAttendance.status !== 'absent') {
      return res.status(409).json({ success: false, message: 'Record the staff member as absent before assigning a replacement.' });
    }

    const [absentRoster, replacementRoster, replacementAttendance] = await Promise.all([
      Roster.findOne({ staffId: absentStaffId, date }).lean(),
      Roster.findOne({ staffId: replacementStaffId, date }).lean(),
      StaffAttendance.findOne({ staffId: replacementStaffId, date }).lean()
    ]);
    if (replacementStaff.status === 'On Leave'
      || replacementRoster?.shift === 'leave'
      || replacementRoster?.isLocked) {
      return res.status(409).json({ success: false, message: 'A staff member on approved leave cannot be assigned as a replacement.' });
    }
    if (['absent', 'on_leave'].includes(replacementAttendance?.status)) {
      return res.status(409).json({ success: false, message: 'Choose a replacement who is not absent or on leave.' });
    }
    if (replacementRoster && replacementRoster.shift !== 'off') {
      return res.status(409).json({ success: false, message: 'The selected replacement already has a shift today.' });
    }
    if (!absentRoster || !['morning', 'afternoon', 'night'].includes(absentRoster.shift)) {
      return res.status(409).json({ success: false, message: 'The absent staff member has no assigned work shift to cover today.' });
    }

    const replacementShift = absentRoster.shift;
    if (replacementRoster) {
      const assignment = await Roster.updateOne(
        { _id: replacementRoster._id, isLocked: { $ne: true }, shift: 'off' },
        { $set: { shift: replacementShift, assignedBy: req.user?.name || 'Clinic Head' } }
      );
      if (assignment.modifiedCount !== 1) {
        return res.status(409).json({ success: false, message: 'The replacement roster changed. Refresh and choose another staff member.' });
      }
    } else {
      await Roster.create({
        staffId: replacementStaffId,
        date,
        shift: replacementShift,
        assignedBy: req.user?.name || 'Clinic Head'
      });
    }

    const savedAttendance = await StaffAttendance.updateOne(
      { _id: absentAttendance._id, status: 'absent' },
      { $set: { replacementStaffId, replacementShift } }
    );
    if (savedAttendance.modifiedCount !== 1) {
      return res.status(409).json({ success: false, message: 'Attendance changed while assigning the replacement. Reload and verify the roster.' });
    }

    return res.status(200).json({
      success: true,
      message: `${replacementStaff.name} is assigned to cover the ${replacementShift} shift.`,
      data: { absentStaffId, replacementStaffId, replacementName: replacementStaff.name, replacementShift }
    });
  } catch (error) {
    console.error('Failed to assign attendance replacement:', error);
    return res.status(500).json({ success: false, message: 'Unable to assign the replacement staff member.' });
  }
};

// 3. Roster መዝግቦ ማስቀመጥ (Bulk Save / Update)
export const saveWeeklyRoster = async (req, res) => {
  try {
    const { rosterUpdates } = req.body; // Array of { staffId, date, shift }
    const validShifts = ['morning', 'afternoon', 'night', 'off'];
    if (!Array.isArray(rosterUpdates)
      || rosterUpdates.length > 5000
      || rosterUpdates.some((item) => (
        !item
        || typeof item.staffId !== 'string'
        || !/^[a-f\d]{24}$/i.test(item.staffId)
        || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')
        || !validShifts.includes(item.shift)
      ))) {
      return res.status(400).json({ success: false, message: 'Roster updates contain invalid staff, date, or shift values.' });
    }

    const keys = rosterUpdates.map((item) => `${item.staffId}_${item.date}`);
    if (new Set(keys).size !== keys.length) {
      return res.status(400).json({ success: false, message: 'A staff member can only have one shift per day.' });
    }
    const validStaffIds = new Set((await findCurrentStaffMembers()).map((staff) => String(staff._id)));
    if (rosterUpdates.some((item) => !validStaffIds.has(item.staffId))) {
      return res.status(400).json({ success: false, message: 'Roster includes a staff member not in the directory.' });
    }
    const lockedRosterEntries = await Roster.find({
      staffId: { $in: rosterUpdates.map((item) => item.staffId) },
      date: { $in: rosterUpdates.map((item) => item.date) },
      isLocked: true
    }).select('staffId date shift').lean();
    const lockedKeys = new Set(lockedRosterEntries.map((item) => `${item.staffId}_${item.date}`));
    if (keys.some((key) => lockedKeys.has(key))) {
      return res.status(409).json({ success: false, message: 'Approved leave shifts are locked and cannot be changed.' });
    }

    const existingEntries = await Roster.find({
      staffId: { $in: rosterUpdates.map((item) => item.staffId) },
      date: { $in: rosterUpdates.map((item) => item.date) }
    }).select('staffId date shift publishedAt').lean();
    const existingByKey = new Map(existingEntries.map((entry) => [
      `${entry.staffId}_${entry.date}`,
      entry
    ]));
    const bulkOps = rosterUpdates.map(item => ({
      updateOne: {
        filter: { staffId: item.staffId, date: item.date, isLocked: false }, // locked የሆኑትን አይቀይርም
        update: { 
          $set: { 
            shift: item.shift, 
            assignedBy: req.user?.name || 'Clinic Head',
            publishedAt: existingByKey.get(`${item.staffId}_${item.date}`)?.shift === item.shift
              ? existingByKey.get(`${item.staffId}_${item.date}`).publishedAt || null
              : null
          } 
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await Roster.bulkWrite(bulkOps);
    }

    res.status(200).json({ success: true, message: 'የሥራ ፈረቃው በስኬት ተቀምጧል!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const publishWeeklyRoster = async (req, res) => {
  try {
    const { startDate, endDate } = req.body || {};
    const validDate = (date) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
    };
    if (!validDate(startDate) || !validDate(endDate)) {
      return res.status(400).json({ success: false, message: 'Provide a valid roster week.' });
    }

    const expectedEnd = new Date(`${startDate}T00:00:00.000Z`);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 6);
    if (endDate !== expectedEnd.toISOString().slice(0, 10)) {
      return res.status(400).json({ success: false, message: 'The roster publication period must be exactly seven days.' });
    }

    const directory = await findCurrentStaffMembers();
    const currentStaffIds = directory
      .map((staff) => String(staff._id))
      .filter((id) => /^[a-f\d]{24}$/i.test(id));
    const rosterEntries = await Roster.find({
      staffId: { $in: currentStaffIds },
      date: { $gte: startDate, $lte: endDate },
      shift: { $in: ['morning', 'afternoon', 'night'] }
    }).select('staffId date shift').lean();
    if (!rosterEntries.length) {
      return res.status(409).json({ success: false, message: 'Save at least one assigned shift before publishing the roster.' });
    }

    const rosterStaffIds = new Set(rosterEntries.map((entry) => String(entry.staffId)));
    const assignedStaff = directory.filter((staff) => rosterStaffIds.has(String(staff._id)));
    const assignedIds = assignedStaff
      .map((staff) => String(staff._id))
      .filter((id) => /^[a-f\d]{24}$/i.test(id));
    const assignedEmails = assignedStaff
      .map((staff) => staff.email)
      .filter((email) => typeof email === 'string' && email.trim());
    const recipients = await User.find({
      status: 'Active',
      $or: [
        ...(assignedIds.length ? [{ _id: { $in: assignedIds } }] : []),
        ...(assignedEmails.length ? [{ email: { $in: assignedEmails } }] : [])
      ]
    }).select('_id role department').lean();
    if (!recipients.length) {
      return res.status(409).json({
        success: false,
        message: 'No active staff accounts could be matched to the assigned shifts. Check staff account records before publishing.'
      });
    }

    const assignmentsHash = createHash('sha256')
      .update(rosterEntries
        .map((entry) => `${entry.staffId}_${entry.date}_${entry.shift}`)
        .sort()
        .join('|'))
      .digest('hex')
      .slice(0, 16);
    const batchId = `roster-${startDate}-${endDate}-${assignmentsHash}`;
    await ClinicNotification.bulkWrite(recipients.map((recipient) => ({
      updateOne: {
        filter: { batchId, recipient: recipient._id },
        update: {
          $setOnInsert: {
            recipient: recipient._id,
            title: 'Duty roster published',
            message: `The duty roster for ${startDate} to ${endDate} has been published. Please review your assigned shifts.`,
            notificationType: 'clinic_workflow',
            channel: 'in_app',
            priority: 'normal',
            deliveryStatus: 'delivered',
            recipientRole: recipient.role || '',
            recipientDepartment: recipient.department || '',
            sender: req.user?._id,
            batchId
          }
        },
        upsert: true
      }
    })));

    const publishedAt = new Date();
    await Roster.updateMany(
      {
        staffId: { $in: currentStaffIds },
        date: { $gte: startDate, $lte: endDate },
        shift: { $in: ['morning', 'afternoon', 'night'] }
      },
      { $set: { publishedAt } }
    );

    return res.status(200).json({
      success: true,
      message: `Roster published. In-app notifications were sent to ${recipients.length} staff member(s).`,
      publishedAt,
      recipientCount: recipients.length
    });
  } catch (error) {
    console.error('Failed to publish weekly staff roster:', error);
    return res.status(500).json({ success: false, message: 'Unable to publish the duty roster.' });
  }
};

// 4. ያለፈውን ሳምንት Roster ኮፒ ማድረጊያ (Copy Last Week)
export const copyLastWeekRoster = async (req, res) => {
  try {
    const { currentStartDate, prevStartDate, prevEndDate, staffIds } = req.body || {};
    const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '');
    if (!validDate(currentStartDate)
      || !validDate(prevStartDate)
      || !validDate(prevEndDate)
      || !Array.isArray(staffIds)
      || staffIds.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
      return res.status(400).json({ success: false, message: 'Provide a valid week range and staff list to copy.' });
    }
    const expectedPreviousStart = new Date(`${currentStartDate}T00:00:00.000Z`);
    expectedPreviousStart.setUTCDate(expectedPreviousStart.getUTCDate() - 7);
    const expectedPreviousEnd = new Date(expectedPreviousStart);
    expectedPreviousEnd.setUTCDate(expectedPreviousEnd.getUTCDate() + 6);
    if (prevStartDate !== expectedPreviousStart.toISOString().slice(0, 10)
      || prevEndDate !== expectedPreviousEnd.toISOString().slice(0, 10)) {
      return res.status(400).json({ success: false, message: 'The selected dates are not consecutive weeks.' });
    }
    const currentStaffIds = new Set((await findCurrentStaffMembers()).map((staff) => String(staff._id)));
    if (staffIds.some((id) => !currentStaffIds.has(id))) {
      return res.status(400).json({ success: false, message: 'Roster includes a staff member not in the active directory.' });
    }

    const previousRoster = await Roster.find({
      staffId: { $in: staffIds },
      date: { $gte: prevStartDate, $lte: prevEndDate },
      shift: { $ne: 'leave' } // Leave የነበሩትን ፈረቃዎች አይገልብጥም
    });

    const newEntries = previousRoster.map((entry) => {
      const previousDate = new Date(`${entry.date}T00:00:00.000Z`);
      previousDate.setUTCDate(previousDate.getUTCDate() + 7);
      return {
        staffId: entry.staffId,
        date: previousDate.toISOString().slice(0, 10),
        shift: entry.shift,
        assignedBy: req.user?.name || 'Clinic Head'
      };
    });

    const currentEndDate = new Date(`${currentStartDate}T00:00:00.000Z`);
    currentEndDate.setUTCDate(currentEndDate.getUTCDate() + 6);
    const lockedTargetEntries = await Roster.find({
      staffId: { $in: newEntries.map((entry) => entry.staffId) },
      date: { $gte: currentStartDate, $lte: currentEndDate.toISOString().slice(0, 10) },
      isLocked: true
    }).select('staffId date').lean();
    const lockedTargets = new Set(lockedTargetEntries.map((entry) => `${entry.staffId}_${entry.date}`));
    const bulkOps = newEntries.map(item => ({
      updateOne: {
        filter: { staffId: item.staffId, date: item.date, isLocked: false },
        update: { $set: { shift: item.shift, assignedBy: req.user?.name || 'Clinic Head', publishedAt: null } },
        upsert: true
      }
    })).filter((operation) => {
      const { staffId, date } = operation.updateOne.filter;
      return !lockedTargets.has(`${staffId}_${date}`);
    });

    if (bulkOps.length > 0) {
      await Roster.bulkWrite(bulkOps);
    }

    res.status(200).json({ success: true, copiedCount: bulkOps.length, message: 'Last week’s roster has been copied.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
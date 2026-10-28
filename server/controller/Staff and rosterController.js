import { Staff, Roster } from '../module/StaffAndRoster.js';
import StaffAttendance from '../module/StaffAttendance.js';
import User from '../module/User.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';

const userRoleMap = {
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

const findStaffMembers = async ({ department, role, search, status } = {}) => {
  const staffQuery = {};
  if (department && department !== 'All') staffQuery.department = department;
  if (role && role !== 'All') staffQuery.role = role;
  if (status && status !== 'All') staffQuery.status = status;
  if (search) staffQuery.name = { $regex: escapeRegex(search), $options: 'i' };

  const storedStaff = await Staff.find(staffQuery).sort({ name: 1 }).lean();
  if (storedStaff.length) return storedStaff;

  const relevantRoles = Object.keys(userRoleMap);
  const userQuery = {
    $or: [
      { role: { $in: relevantRoles } },
      { activeRole: { $in: relevantRoles } },
      { roles: { $in: relevantRoles } },
      { position: { $in: relevantRoles } }
    ]
  };
  if (department && department !== 'All') userQuery.department = department;
  if (status && status !== 'All') userQuery.status = status;
  if (search) userQuery.name = { $regex: escapeRegex(search), $options: 'i' };

  const users = await User.find(userQuery)
    .select('name email phoneNumber role activeRole roles position department dateJoined status')
    .sort({ name: 1 })
    .lean();

  return users
    .map((user) => {
      const roles = [user.activeRole, user.role, ...(user.roles || []), user.position].filter(Boolean);
      const mappedRole = roles.map((item) => userRoleMap[item]).find(Boolean);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        role: mappedRole,
        department: user.department || '',
        joinedDate: user.dateJoined,
        status: user.status
      };
    })
    .filter((staff) => (
      staff.role
      && (!role || role === 'All' || staff.role === role)
      && (!status || status === 'All' || staff.status === status)
    ));
};

const findCurrentStaffMembers = async () => (
  (await findStaffMembers()).filter((staff) => staff.status !== 'Inactive')
);

// 1. የሰራተኞች ዝርዝር ማምጫ (View Only)
export const getAllStaff = async (req, res) => {
  try {
    const { department, role, search, status } = req.query;
    const staffList = await findStaffMembers({ department, role, search, status });
    res.status(200).json({ success: true, data: staffList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const staffMembers = (await findStaffMembers({ department, role }))
      .filter((staff) => staff.status !== 'Inactive');
    const staffIds = staffMembers.map(s => s._id);

    // 2. Fetch Roster Records for the date range
    const [rosterEntries, settings] = await Promise.all([
      Roster.find({
        staffId: { $in: staffIds },
        date: { $gte: startDate, $lte: endDate }
      }).lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('rosterRules').lean()
    ]);

    res.status(200).json({
      success: true,
      staff: staffMembers,
      roster: rosterEntries,
      rosterRules: settings?.rosterRules || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTodayAttendance = async (req, res) => {
  try {
    const { department, role, search, status } = req.query;
    const date = getClinicDate();
    const staffMembers = (await findStaffMembers({ department, role, search }))
      .filter((staff) => staff.status !== 'Inactive');
    const staffIds = staffMembers.map((staff) => staff._id);
    const [attendanceEntries, leaveEntries, rosterEntries] = await Promise.all([
      StaffAttendance.find({ staffId: { $in: staffIds }, date }).lean(),
      Roster.find({ staffId: { $in: staffIds }, date, shift: 'leave' }).lean(),
      Roster.find({ staffId: { $in: staffIds }, date }).lean()
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
        attendanceNote: attendance?.note || '',
        rosterShift: onLeave ? 'leave' : roster?.shift || 'off',
        replacementStaffId: attendance?.replacementStaffId ? String(attendance.replacementStaffId) : '',
        replacementName: replacement?.name || ''
      };
    }).filter((staff) => !status || status === 'All' || staff.attendanceStatus === status);

    return res.status(200).json({ success: true, date, data: records });
  } catch (error) {
    console.error('Failed to load today attendance:', error);
    return res.status(500).json({ success: false, message: 'Unable to load today attendance.' });
  }
};

export const saveTodayAttendance = async (req, res) => {
  try {
    const { attendanceUpdates } = req.body || {};
    const validStatuses = ['present', 'absent', 'late'];
    if (!Array.isArray(attendanceUpdates)
      || attendanceUpdates.length > 1000
      || attendanceUpdates.some((item) => (
        !item
        || typeof item.staffId !== 'string'
        || !/^[a-f\d]{24}$/i.test(item.staffId)
        || !validStatuses.includes(item.status)
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
    const leaveEntries = await Roster.find({
      staffId: { $in: staffIds },
      date,
      shift: 'leave'
    }).select('staffId').lean();
    const leaveStaffIds = new Set(leaveEntries.map((entry) => String(entry.staffId)));
    const updates = attendanceUpdates.filter((item) => (
      !leaveStaffIds.has(item.staffId)
      && staffById.get(item.staffId)?.status !== 'On Leave'
    ));
    const operations = updates.map((item) => ({
      updateOne: {
        filter: { staffId: item.staffId, date },
        update: {
          $set: {
            status: item.status,
            note: item.note?.trim() || '',
            recordedBy: req.user._id
          }
        },
        upsert: true
      }
    }));

    if (operations.length) await StaffAttendance.bulkWrite(operations);
    return res.status(200).json({
      success: true,
      message: 'Today attendance has been saved.',
      savedCount: operations.length,
      skippedLeaveCount: attendanceUpdates.length - updates.length
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
    }).select('staffId date').lean();
    const lockedKeys = new Set(lockedRosterEntries.map((item) => `${item.staffId}_${item.date}`));
    if (keys.some((key) => lockedKeys.has(key))) {
      return res.status(409).json({ success: false, message: 'Approved leave shifts are locked and cannot be changed.' });
    }

    const bulkOps = rosterUpdates.map(item => ({
      updateOne: {
        filter: { staffId: item.staffId, date: item.date, isLocked: false }, // locked የሆኑትን አይቀይርም
        update: { 
          $set: { 
            shift: item.shift, 
            assignedBy: req.user?.name || 'Clinic Head' 
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
        update: { $set: { shift: item.shift } },
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
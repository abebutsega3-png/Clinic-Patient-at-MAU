import { findStaffMembers } from './Staff and rosterController.js';
import { Roster } from '../module/StaffAndRoster.js';
import StaffAttendance from '../module/StaffAttendance.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

const getClinicDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

const getClinicTime = (date = new Date()) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Addis_Ababa',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
}).format(date);

const getCurrentStaff = async (user) => {
  const members = await findStaffMembers();
  return members.find((member) => (
    String(member._id) === String(user._id)
    || (user.email && member.email?.toLowerCase() === user.email.toLowerCase())
  ));
};

const getShiftInfo = async (staffId, date) => {
  const [roster, operationalSettings] = await Promise.all([
    Roster.findOne({ staffId, date }).select('shift').lean(),
    ClinicOperationalSettings.findOne({ key: 'clinic' })
      .select('rosterRules.shiftTimes rosterRules.gracePeriodMinutes workingHours.days')
      .lean()
  ]);
  const gracePeriodMinutes = operationalSettings?.rosterRules?.gracePeriodMinutes ?? 15;
  const shift = roster?.shift || 'off';
  if (['morning', 'afternoon', 'night'].includes(shift)) {
    return {
      shift,
      shiftLabel: `${shift} shift`,
      isScheduled: true,
      shiftStart: operationalSettings?.rosterRules?.shiftTimes?.[shift]?.start || '',
      gracePeriodMinutes
    };
  }
  if (shift === 'leave') {
    return { shift, shiftLabel: 'On leave', isScheduled: false, shiftStart: '', gracePeriodMinutes };
  }

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'long'
  }).format(new Date(`${date}T12:00:00+03:00`));
  const clinicDay = operationalSettings?.workingHours?.days?.find((day) => day.day === weekday);
  const isClinicOpen = clinicDay ? !clinicDay.closed : weekday !== 'Sunday';
  const shiftStart = clinicDay?.open || '08:00';
  return {
    shift: isClinicOpen ? 'clinic-hours' : 'off',
    shiftLabel: isClinicOpen ? 'Clinic hours' : 'No shift assigned',
    isScheduled: isClinicOpen,
    shiftStart,
    gracePeriodMinutes
  };
};

const emitAttendanceUpdate = (req, staffId, date) => {
  req.app.get('io')?.emit('staff-attendance-updated', { staffId: String(staffId), date });
};

const getMonthRange = (month, today) => {
  const value = month || today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, monthNumber] = value.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { month: value, from: `${value}-01`, to: `${value}-${String(lastDay).padStart(2, '0')}` };
};

export const getAttendanceSummary = async (req, res) => {
  const roles = [
    req.user?.activeRole,
    req.user?.role,
    ...(Array.isArray(req.user?.roles) ? req.user.roles : [])
  ].map(normalizeRole);
  const allowedRoles = ['pharmacist', 'drug store manager', 'dispensary room', 'clinic head'];
  if (!roles.some((role) => allowedRoles.includes(role))) {
    return res.status(403).json({ success: false, message: 'Dispensary or Clinic Head access is required.' });
  }

  try {
    const date = getClinicDate();
    const staffMembers = (await findStaffMembers()).filter((staff) => staff.status !== 'Inactive');
    const staffIds = staffMembers.map((staff) => staff._id);
    const [attendance, rosterEntries, operationalSettings] = await Promise.all([
      StaffAttendance.find({ staffId: { $in: staffIds }, date }).select('staffId status').lean(),
      Roster.find({ staffId: { $in: staffIds }, date }).select('staffId shift').lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('workingHours.days').lean()
    ]);

    const attendanceByStaff = new Map(attendance.map((entry) => [String(entry.staffId), entry]));
    const rosterByStaff = new Map(rosterEntries.map((entry) => [String(entry.staffId), entry]));
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      weekday: 'long'
    }).format(new Date(`${date}T12:00:00+03:00`));
    const clinicDay = operationalSettings?.workingHours?.days?.find((day) => day.day === weekday);
    const clinicOpen = clinicDay ? !clinicDay.closed : weekday !== 'Sunday';
    const scheduledStaff = staffMembers.filter((staff) => {
      if (staff.status === 'On Leave') return false;
      const shift = rosterByStaff.get(String(staff._id))?.shift;
      if (shift === 'leave') return false;
      if (['morning', 'afternoon', 'night'].includes(shift)) return true;
      if (shift && shift !== 'off') return false;
      return clinicOpen;
    });

    const scheduledIds = new Set(scheduledStaff.map((staff) => String(staff._id)));
    const present = attendance.filter((entry) => (
      scheduledIds.has(String(entry.staffId)) && ['present', 'late'].includes(entry.status)
    )).length;
    const absent = attendance.filter((entry) => (
      scheduledIds.has(String(entry.staffId)) && entry.status === 'absent'
    )).length;
    const total = scheduledStaff.length;

    return res.status(200).json({
      success: true,
      date,
      data: {
        present,
        absent,
        unreported: Math.max(0, total - present - absent),
        total,
        percentage: total ? Math.round((present / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Failed to load attendance summary:', error);
    return res.status(500).json({ success: false, message: 'Unable to load attendance summary.' });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const staff = await getCurrentStaff(req.user);
    if (!staff) {
      return res.status(403).json({ success: false, message: 'Your account is not listed as active clinic staff.' });
    }

    const today = getClinicDate();
    const range = getMonthRange(req.query.month, today);
    if (!range) return res.status(400).json({ success: false, message: 'Choose a valid attendance month.' });

    const [attendance, roster, history] = await Promise.all([
      StaffAttendance.findOne({ staffId: staff._id, date: today }).lean(),
      getShiftInfo(staff._id, today),
      StaffAttendance.find({ staffId: staff._id, date: { $gte: range.from, $lte: range.to } })
        .sort({ date: -1 })
        .lean()
    ]);
    const isOnLeave = staff.status === 'On Leave' || roster.shift === 'leave';

    return res.status(200).json({
      success: true,
      date: today,
      month: range.month,
      staff: { name: staff.name, role: staff.roleLabel || staff.role, department: staff.department || '' },
      schedule: {
        shift: roster.shift,
        shiftLabel: roster.shiftLabel,
        isScheduled: roster.isScheduled && !isOnLeave && staff.status !== 'Inactive',
        shiftStart: roster.shiftStart
      },
      attendance,
      history
    });
  } catch (error) {
    console.error('Failed to load personal attendance:', error);
    return res.status(500).json({ success: false, message: 'Unable to load your attendance.' });
  }
};

export const checkInToWork = async (req, res) => {
  try {
    const staff = await getCurrentStaff(req.user);
    if (!staff || staff.status === 'Inactive') {
      return res.status(403).json({ success: false, message: 'Your account is not listed as active clinic staff.' });
    }

    const now = new Date();
    const date = getClinicDate(now);
    const timeIn = getClinicTime(now);
    const [schedule, existing] = await Promise.all([
      getShiftInfo(staff._id, date),
      StaffAttendance.findOne({ staffId: staff._id, date }).lean()
    ]);
    if (staff.status === 'On Leave' || schedule.shift === 'leave') {
      return res.status(409).json({ success: false, message: 'You are marked as on leave today.' });
    }
    if (!schedule.isScheduled) {
      return res.status(409).json({ success: false, message: 'You do not have a work shift assigned for today.' });
    }
    if (existing?.timeIn) {
      return res.status(409).json({ success: false, message: 'You are already checked in today.', attendance: existing });
    }

    const [startHour, startMinute] = (schedule.shiftStart || '08:00').split(':').map(Number);
    const [inHour, inMinute] = timeIn.split(':').map(Number);
    const startAt = startHour * 60 + startMinute;
    let timeInAt = inHour * 60 + inMinute;
    if (startAt >= 12 * 60 && timeInAt < 12 * 60) timeInAt += 24 * 60;
    const status = timeInAt > startAt + schedule.gracePeriodMinutes ? 'late' : 'present';
    const attendanceFields = {
      staffName: staff.name,
      role: staff.roleLabel || staff.role || 'Staff',
      status,
      checkInTime: now,
      timeIn,
      timeOut: '',
      checkOutTime: null,
      recordedBy: req.user._id
    };

    let attendance;
    if (existing) {
      const attendanceFilter = { _id: existing._id };
      if (existing.timeIn) {
        attendanceFilter.timeIn = existing.timeIn;
      } else {
        attendanceFilter.$or = [{ timeIn: '' }, { timeIn: { $exists: false } }];
      }
      const update = await StaffAttendance.updateOne(
        attendanceFilter,
        { $set: attendanceFields }
      );
      if (update.modifiedCount !== 1) {
        return res.status(409).json({ success: false, message: 'Your attendance changed. Refresh and try again.' });
      }
      attendance = await StaffAttendance.findById(existing._id).lean();
    } else {
      try {
        attendance = await StaffAttendance.create({
          staffId: staff._id,
          date,
          ...attendanceFields
        });
      } catch (error) {
        if (error.code === 11000) {
          const current = await StaffAttendance.findOne({ staffId: staff._id, date }).lean();
          return res.status(409).json({ success: false, message: 'You are already checked in today.', attendance: current });
        }
        throw error;
      }
    }

    emitAttendanceUpdate(req, staff._id, date);
    return res.status(200).json({
      success: true,
      message: 'Check-in recorded and reported to the Clinic Head.',
      syncStatus: 'sent',
      attendance
    });
  } catch (error) {
    console.error('Failed to check in staff member:', error);
    return res.status(500).json({ success: false, message: 'Unable to record your check-in.' });
  }
};

export const checkOutFromWork = async (req, res) => {
  try {
    const staff = await getCurrentStaff(req.user);
    if (!staff) {
      return res.status(403).json({ success: false, message: 'Your account is not listed as active clinic staff.' });
    }

    const now = new Date();
    const date = getClinicDate(now);
    const timeOut = getClinicTime(now);
    const attendance = await StaffAttendance.findOne({ staffId: staff._id, date });
    if (!attendance?.timeIn) {
      return res.status(409).json({ success: false, message: 'Check in before checking out.' });
    }
    if (attendance.timeOut) {
      return res.status(409).json({ success: false, message: 'You are already checked out today.', attendance });
    }

    const checkoutFilter = {
      _id: attendance._id,
      timeIn: attendance.timeIn,
      $or: [{ timeOut: '' }, { timeOut: { $exists: false } }]
    };
    const update = await StaffAttendance.updateOne(checkoutFilter, {
      $set: { timeOut, checkOutTime: now }
    });
    if (update.modifiedCount !== 1) {
      const current = await StaffAttendance.findById(attendance._id).lean();
      return res.status(409).json({
        success: false,
        message: 'Your attendance changed. Refresh and verify your check-out.',
        attendance: current
      });
    }
    const savedAttendance = await StaffAttendance.findById(attendance._id).lean();
    emitAttendanceUpdate(req, staff._id, date);

    return res.status(200).json({
      success: true,
      message: 'Check-out recorded and reported to the Clinic Head.',
      syncStatus: 'sent',
      attendance: savedAttendance
    });
  } catch (error) {
    console.error('Failed to check out staff member:', error);
    return res.status(500).json({ success: false, message: 'Unable to record your check-out.' });
  }
};

import mongoose from 'mongoose';
import { findStaffMembers } from './Staff and rosterController.js';
import AttendanceAuditLog from '../module/AttendanceAuditLog.js';
import AttendanceCorrection from '../module/AttendanceCorrection.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import Department from '../module/Department.js';
import { Roster } from '../module/StaffAndRoster.js';
import StaffAttendance from '../module/StaffAttendance.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
const validDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const validTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const attendanceStatuses = ['present', 'late', 'absent', 'on_leave', 'half_day', 'early_leave', 'unrecorded'];

const getClinicDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

const getClinicMinutes = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: clinicTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
};

const isValidDate = (value) => {
  if (!validDatePattern.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const getWeekday = (date) => new Intl.DateTimeFormat('en-US', {
  timeZone: clinicTimeZone,
  weekday: 'long'
}).format(new Date(`${date}T12:00:00+03:00`));

const getClockMinutes = (value) => {
  if (typeof value !== 'string' || !validTimePattern.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

const getDateList = (from, to) => {
  const dates = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  for (let cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
};

const validateDateRange = (from, to, maximumDays = 366) => {
  if (!isValidDate(from) || !isValidDate(to) || from > to) return false;
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  return days <= maximumDays;
};

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize };
};

const getShiftForDate = (staff, roster, date, settings) => {
  const weekday = getWeekday(date);
  const clinicDay = settings?.workingHours?.days?.find((day) => day.day === weekday);
  const clinicOpen = clinicDay ? !clinicDay.closed : weekday !== 'Sunday';
  const assignedShift = roster?.shift;
  const onLeave = assignedShift === 'leave' || (date === getClinicDate() && staff.status === 'On Leave');
  const shift = onLeave
    ? 'leave'
    : assignedShift || (clinicOpen ? 'clinic-hours' : 'off');
  const isScheduled = !onLeave && (
    ['morning', 'afternoon', 'night'].includes(shift)
    || (shift === 'clinic-hours' && clinicOpen)
  );
  const shiftTimes = settings?.rosterRules?.shiftTimes?.[shift];
  const shiftStart = shiftTimes?.start || (shift === 'clinic-hours' ? clinicDay?.open : '') || '';
  const shiftEnd = shiftTimes?.end || (shift === 'clinic-hours' ? clinicDay?.close : '') || '';
  const startMinutes = getClockMinutes(shiftStart);
  const endMinutes = getClockMinutes(shiftEnd);
  const clinicHoursMinutes = startMinutes == null || endMinutes == null
    ? 8 * 60
    : (endMinutes - startMinutes + 1440) % 1440;
  return {
    shift,
    shiftStart,
    shiftEnd,
    isScheduled,
    onLeave,
    gracePeriodMinutes: settings?.rosterRules?.gracePeriodMinutes ?? 15,
    absenceCutoffMinutes: settings?.rosterRules?.attendanceCutoffMinutes ?? 120,
    expectedMinutes: shift === 'clinic-hours'
      ? clinicHoursMinutes
      : (settings?.rosterRules?.shiftDurations?.[shift] || 8) * 60
  };
};

const hasAbsenceCutoffPassed = (date, schedule, now = new Date()) => {
  const today = getClinicDate(now);
  if (date > today || !schedule.isScheduled) return false;
  const shiftStart = getClockMinutes(schedule.shiftStart);
  if (shiftStart == null) return false;
  const elapsedDays = (Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${date}T00:00:00.000Z`)) / 86400000;
  const elapsedMinutes = elapsedDays * 1440 + getClinicMinutes(now);
  return elapsedMinutes >= shiftStart + schedule.absenceCutoffMinutes;
};

const getEffectiveAttendanceStatus = (attendance, schedule, date) => {
  if (schedule.onLeave) return 'on_leave';
  const cutoffPassed = hasAbsenceCutoffPassed(date, schedule);
  if (attendance?.status === 'absent' && !cutoffPassed) return 'unrecorded';
  return attendance?.status || (schedule.isScheduled && cutoffPassed ? 'absent' : 'unrecorded');
};

const getWorkingMinutes = (attendance) => {
  if (Number.isFinite(attendance?.workingMinutes) && attendance.workingMinutes > 0) {
    return attendance.workingMinutes;
  }
  if (attendance?.checkInTime && attendance?.checkOutTime) {
    const minutes = Math.round((new Date(attendance.checkOutTime) - new Date(attendance.checkInTime)) / 60000);
    return Math.max(0, minutes);
  }
  return 0;
};

const toValues = (attendance) => ({
  timeIn: attendance.timeIn || '',
  timeOut: attendance.timeOut || '',
  checkInTime: attendance.checkInTime || null,
  checkOutTime: attendance.checkOutTime || null,
  workingMinutes: getWorkingMinutes(attendance),
  status: attendance.status || '',
  lateArrival: attendance.lateArrival || attendance.status === 'late'
});

const getAttendanceRows = async ({ date, department, role, search, staffId } = {}) => {
  const selectedDate = date || getClinicDate();
  if (!isValidDate(selectedDate)) return { error: 'Choose a valid attendance date.' };
  const staffMembers = (await findStaffMembers({
    department: department && department !== 'All' ? department : undefined,
    role: role && role !== 'All' ? role : undefined
  })).filter((staff) => staff.status !== 'Inactive'
    && (!staffId || String(staff._id) === String(staffId)));
  const staffIds = staffMembers.map((staff) => staff._id);
  const [attendanceEntries, rosterEntries, settings] = await Promise.all([
    StaffAttendance.find({ staffId: { $in: staffIds }, date: selectedDate }).lean(),
    Roster.find({ staffId: { $in: staffIds }, date: selectedDate }).lean(),
    ClinicOperationalSettings.findOne({ key: 'clinic' })
      .select('workingHours.days rosterRules.shiftTimes rosterRules.shiftDurations rosterRules.gracePeriodMinutes rosterRules.attendanceCutoffMinutes')
      .lean()
  ]);
  const attendanceByStaff = new Map(attendanceEntries.map((entry) => [String(entry.staffId), entry]));
  const rosterByStaff = new Map(rosterEntries.map((entry) => [String(entry.staffId), entry]));
  const query = String(search || '').trim().toLowerCase();
  const rows = staffMembers.map((staff) => {
    const attendance = attendanceByStaff.get(String(staff._id));
    const schedule = getShiftForDate(staff, rosterByStaff.get(String(staff._id)), selectedDate, settings);
    const attendanceStatus = getEffectiveAttendanceStatus(attendance, schedule, selectedDate);
    return {
      ...staff,
      date: selectedDate,
      attendanceId: attendance?._id ? String(attendance._id) : '',
      attendanceStatus,
      timeIn: attendance?.timeIn || '',
      timeOut: attendance?.timeOut || '',
      checkInTime: attendance?.checkInTime || null,
      checkOutTime: attendance?.checkOutTime || null,
      lateArrival: attendance?.lateArrival || attendance?.status === 'late',
      workingMinutes: getWorkingMinutes(attendance),
      attendanceNote: attendance?.note || '',
      attendanceRecordedAt: attendance?.updatedAt || attendance?.createdAt || null,
      rosterShift: schedule.shift,
      isScheduled: schedule.isScheduled,
      shiftStart: schedule.shiftStart,
      shiftEnd: schedule.shiftEnd
    };
  }).filter((staff) => !query || [
    staff.name, staff.employeeId, staff.username, staff.role, staff.department, staff._id
  ].some((value) => String(value || '').toLowerCase().includes(query)));

  return { date: selectedDate, rows, settings };
};

const paginateRows = (rows, query) => {
  const { page, pageSize } = getPagination(query);
  const totalRecords = rows.length;
  const start = (page - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    pagination: { page, pageSize, totalRecords, totalPages: Math.ceil(totalRecords / pageSize) }
  };
};

export const getAttendanceDashboard = async (req, res) => {
  try {
    const result = await getAttendanceRows({
      date: req.query.date,
      department: req.query.department,
      role: req.query.role
    });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const rows = result.rows;
    const scheduled = rows.filter((row) => row.isScheduled || row.attendanceStatus === 'on_leave');
    const counts = {
      totalStaff: rows.length,
      present: rows.filter((row) => row.isScheduled && ['present', 'half_day', 'early_leave'].includes(row.attendanceStatus)).length,
      absent: rows.filter((row) => row.attendanceStatus === 'absent' && row.isScheduled).length,
      late: rows.filter((row) => row.isScheduled && (row.lateArrival || row.attendanceStatus === 'late')).length,
      onLeave: rows.filter((row) => row.attendanceStatus === 'on_leave').length,
      unrecorded: rows.filter((row) => row.attendanceStatus === 'unrecorded' && row.isScheduled).length,
      scheduled: scheduled.filter((row) => row.isScheduled).length
    };
    const departments = new Map();
    rows.filter((row) => row.isScheduled || row.attendanceStatus === 'on_leave').forEach((row) => {
      const name = row.department || 'Unassigned';
      const value = departments.get(name) || { department: name, total: 0, present: 0, late: 0, absent: 0, onLeave: 0 };
      value.total += 1;
      if (['present', 'half_day', 'early_leave'].includes(row.attendanceStatus)) value.present += 1;
      if (row.lateArrival || row.attendanceStatus === 'late') value.late += 1;
      if (row.attendanceStatus === 'absent') value.absent += 1;
      if (row.attendanceStatus === 'on_leave') value.onLeave += 1;
      departments.set(name, value);
    });
    const activityRows = rows
      .filter((row) => row.attendanceRecordedAt)
      .sort((left, right) => new Date(right.attendanceRecordedAt) - new Date(left.attendanceRecordedAt))
      .slice(0, 8)
      .map((row) => ({
        staffId: String(row._id),
        name: row.name,
        department: row.department || '',
        status: row.attendanceStatus,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        recordedAt: row.attendanceRecordedAt
      }));
    return res.status(200).json({
      success: true,
      date: result.date,
      data: {
        summary: counts,
        departments: [...departments.values()].sort((left, right) => left.department.localeCompare(right.department)),
        recentActivities: activityRows
      }
    });
  } catch (error) {
    console.error('Failed to load attendance dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load attendance dashboard.' });
  }
};

export const getDailyAttendance = async (req, res) => {
  try {
    const result = await getAttendanceRows({
      date: req.query.date,
      department: req.query.department,
      role: req.query.role,
      search: req.query.search
    });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    let rows = result.rows;
    if (req.query.status && req.query.status !== 'All' && !attendanceStatuses.includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Choose a valid attendance status.' });
    }
    if (req.query.status && req.query.status !== 'All') {
      rows = rows.filter((row) => row.attendanceStatus === req.query.status);
    }
    if (req.query.recordedOnly === 'true') {
      rows = rows.filter((row) => row.attendanceId);
    }
    const { data, pagination } = paginateRows(rows, req.query);
    const departments = await Department.find({
      $or: [{ status: 'Active' }, { status: { $exists: false } }]
    }).select('name').sort({ name: 1 }).lean();
    return res.status(200).json({
      success: true,
      date: result.date,
      data,
      departments: departments.map(({ name }) => name),
      pagination
    });
  } catch (error) {
    console.error('Failed to load daily attendance:', error);
    return res.status(500).json({ success: false, message: 'Unable to load daily attendance.' });
  }
};

const getHistoryRows = async ({ from, to, department, role, search, status, staffId, includeInactive = false } = {}) => {
  const today = getClinicDate();
  const fromDate = from || today;
  const toDate = to || today;
  if (!validateDateRange(fromDate, toDate)) {
    return { error: 'Choose a valid date range no longer than 366 days.' };
  }
  const staffMembers = (await findStaffMembers({
    department: department && department !== 'All' ? department : undefined,
    role: role && role !== 'All' ? role : undefined
  })).filter((staff) => (includeInactive || staff.status !== 'Inactive')
    && (!staffId || String(staff._id) === String(staffId)));
  const staffIds = staffMembers.map((staff) => staff._id);
  const [attendanceEntries, rosterEntries, settings] = await Promise.all([
    StaffAttendance.find({ staffId: { $in: staffIds }, date: { $gte: fromDate, $lte: toDate } }).lean(),
    Roster.find({ staffId: { $in: staffIds }, date: { $gte: fromDate, $lte: toDate } }).lean(),
    ClinicOperationalSettings.findOne({ key: 'clinic' })
      .select('workingHours.days rosterRules.shiftTimes rosterRules.shiftDurations rosterRules.gracePeriodMinutes rosterRules.attendanceCutoffMinutes')
      .lean()
  ]);
  const attendanceByKey = new Map(attendanceEntries.map((entry) => [`${entry.date}:${entry.staffId}`, entry]));
  const rosterByKey = new Map(rosterEntries.map((entry) => [`${entry.date}:${entry.staffId}`, entry]));
  const rows = [];
  getDateList(fromDate, toDate).forEach((date) => {
    staffMembers.forEach((staff) => {
      const key = `${date}:${staff._id}`;
      const attendance = attendanceByKey.get(key);
      const schedule = getShiftForDate(staff, rosterByKey.get(key), date, settings);
      const attendanceStatus = getEffectiveAttendanceStatus(attendance, schedule, date);
      if (!schedule.isScheduled && !schedule.onLeave && !attendance) return;
      if (status && status !== 'All' && status !== attendanceStatus) return;
      const workingMinutes = getWorkingMinutes(attendance);
      rows.push({
        ...staff,
        date,
        attendanceId: attendance?._id ? String(attendance._id) : '',
        attendanceStatus,
        timeIn: attendance?.timeIn || '',
        timeOut: attendance?.timeOut || '',
        checkInTime: attendance?.checkInTime || null,
        checkOutTime: attendance?.checkOutTime || null,
        lateArrival: attendance?.lateArrival || attendance?.status === 'late',
        workingMinutes,
        attendanceNote: attendance?.note || '',
        attendanceRecordedAt: attendance?.updatedAt || attendance?.createdAt || null,
        rosterShift: schedule.shift,
        isScheduled: schedule.isScheduled
      });
    });
  });
  return { rows, staffMembers };
};

export const getAttendanceHistory = async (req, res) => {
  try {
    if (req.query.staffId && !mongoose.isValidObjectId(req.query.staffId)) {
      return res.status(400).json({ success: false, message: 'Provide a valid staff member ID.' });
    }
    if (req.query.status && req.query.status !== 'All' && !attendanceStatuses.includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Choose a valid attendance status.' });
    }
    const result = await getHistoryRows({
      from: req.query.from,
      to: req.query.to,
      department: req.query.department,
      role: req.query.role,
      search: req.query.search,
      status: req.query.status,
      staffId: req.query.staffId,
      includeInactive: true
    });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const query = String(req.query.search || '').trim().toLowerCase();
    const rows = result.rows.filter((row) => !query || [
      row.name, row.employeeId, row.username, row.role, row.department, row._id
    ].some((value) => String(value || '').toLowerCase().includes(query)));
    const totalWorkingMinutes = rows.reduce((total, row) => total + row.workingMinutes, 0);
    const { data, pagination } = paginateRows(rows, req.query);
    return res.status(200).json({
      success: true,
      data,
      pagination,
      summary: { totalRecords: rows.length, totalWorkingMinutes }
    });
  } catch (error) {
    console.error('Failed to load attendance history:', error);
    return res.status(500).json({ success: false, message: 'Unable to load attendance history.' });
  }
};

export const getMonthlyAttendanceReport = async (req, res) => {
  try {
    const month = req.query.month || getClinicDate().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Choose a valid report month.' });
    }
    const [year, monthNumber] = month.split('-').map(Number);
    const from = `${month}-01`;
    const monthEnd = `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, '0')}`;
    const to = monthEnd < getClinicDate() ? monthEnd : getClinicDate();
    if (from > to) {
      return res.status(400).json({ success: false, message: 'Monthly attendance reports are not available for future months.' });
    }
    const result = await getHistoryRows({
      from,
      to,
      department: req.query.department,
      role: req.query.role
    });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const summaryByStaff = new Map(result.staffMembers.map((staff) => [String(staff._id), {
      staffId: String(staff._id),
      employeeId: staff.employeeId || '',
      name: staff.name || '',
      department: staff.department || '',
      position: staff.roleLabel || staff.role || '',
      totalWorkingDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      leaveDays: 0,
      totalWorkingMinutes: 0
    }]));
    result.rows.forEach((row) => {
      const summary = summaryByStaff.get(String(row._id));
      if (!summary) return;
      if (row.attendanceStatus === 'on_leave') {
        summary.leaveDays += 1;
        return;
      }
      if (row.isScheduled) summary.totalWorkingDays += 1;
      if (row.isScheduled && ['present', 'half_day', 'early_leave'].includes(row.attendanceStatus)) summary.presentDays += 1;
      if (row.isScheduled && (row.lateArrival || row.attendanceStatus === 'late')) summary.lateDays += 1;
      if (row.isScheduled && row.attendanceStatus === 'absent') summary.absentDays += 1;
      summary.totalWorkingMinutes += row.workingMinutes;
    });
    const data = [...summaryByStaff.values()].map((row) => ({
      ...row,
      totalWorkingHours: Math.round((row.totalWorkingMinutes / 60) * 100) / 100,
      attendancePercentage: row.totalWorkingDays
        ? Math.round(((row.presentDays + row.lateDays) / row.totalWorkingDays) * 1000) / 10
        : 0
    }));
    return res.status(200).json({ success: true, month, data });
  } catch (error) {
    console.error('Failed to generate monthly attendance report:', error);
    return res.status(500).json({ success: false, message: 'Unable to generate monthly attendance report.' });
  }
};

export const getStaffAttendanceDetails = async (req, res) => {
  try {
    const { staffId } = req.params;
    if (!mongoose.isValidObjectId(staffId)) {
      return res.status(400).json({ success: false, message: 'Provide a valid staff member ID.' });
    }
    const staff = (await findStaffMembers()).find((member) => String(member._id) === staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    const today = getClinicDate();
    const defaultFromDate = new Date(`${today}T00:00:00.000Z`);
    defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 89);
    const from = req.query.from || defaultFromDate.toISOString().slice(0, 10);
    const result = await getHistoryRows({
      from,
      to: req.query.to || today,
      staffId,
      includeInactive: true
    });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    return res.status(200).json({
      success: true,
      data: {
        staff,
        attendance: result.rows,
        totalWorkingMinutes: result.rows.reduce((total, row) => total + row.workingMinutes, 0)
      }
    });
  } catch (error) {
    console.error('Failed to load staff attendance details:', error);
    return res.status(500).json({ success: false, message: 'Unable to load staff attendance details.' });
  }
};

const getCorrectionRows = async ({ status, page, pageSize }) => {
  const filter = status && status !== 'All' ? { status } : {};
  const [items, totalRecords] = await Promise.all([
    AttendanceCorrection.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    AttendanceCorrection.countDocuments(filter)
  ]);
  const staffMembers = await findStaffMembers();
  const staffById = new Map(staffMembers.map((staff) => [String(staff._id), staff]));
  const data = items.map((item) => ({
    ...item,
    staff: staffById.get(String(item.staffId)) || { _id: item.staffId, name: item.previousValues.staffName || 'Staff member unavailable' }
  }));
  return { data, pagination: { page, pageSize, totalRecords, totalPages: Math.ceil(totalRecords / pageSize) } };
};

export const listAttendanceCorrections = async (req, res) => {
  try {
    if (req.query.status && !['All', 'pending', 'approved', 'rejected'].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Choose a valid correction status.' });
    }
    const { page, pageSize } = getPagination(req.query);
    const result = await getCorrectionRows({ status: req.query.status, page, pageSize });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to load attendance corrections:', error);
    return res.status(500).json({ success: false, message: 'Unable to load attendance corrections.' });
  }
};

const getLocalDateTime = (date, time, addDay = false) => {
  const targetDate = addDay
    ? new Date(Date.parse(`${date}T00:00:00.000Z`) + 86400000).toISOString().slice(0, 10)
    : date;
  return new Date(`${targetDate}T${time}:00+03:00`);
};

const calculateCorrectedValues = (date, proposed, shift, settings) => {
  if (proposed.timeIn && !validTimePattern.test(proposed.timeIn)) return null;
  if (proposed.timeOut && !validTimePattern.test(proposed.timeOut)) return null;
  if (proposed.timeOut && !proposed.timeIn) return null;
  let checkInTime = proposed.timeIn ? getLocalDateTime(date, proposed.timeIn) : null;
  let checkOutTime = null;
  if (proposed.timeOut) {
    const overnight = shift === 'night' && proposed.timeOut < proposed.timeIn;
    if (!overnight && proposed.timeOut <= proposed.timeIn) return null;
    checkOutTime = getLocalDateTime(date, proposed.timeOut, overnight);
  }
  const workingMinutes = checkInTime && checkOutTime
    ? Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000)
    : 0;
  const clinicDay = settings?.workingHours?.days?.find((day) => day.day === getWeekday(date));
  const startTime = settings?.rosterRules?.shiftTimes?.[shift]?.start
    || (shift === 'clinic-hours' ? clinicDay?.open : '')
    || '';
  const endTime = settings?.rosterRules?.shiftTimes?.[shift]?.end
    || (shift === 'clinic-hours' ? clinicDay?.close : '')
    || '';
  const shiftStartMinutes = getClockMinutes(startTime);
  const shiftEndMinutes = getClockMinutes(endTime);
  const expectedMinutes = shift === 'clinic-hours' && shiftStartMinutes != null && shiftEndMinutes != null
    ? (shiftEndMinutes - shiftStartMinutes + 1440) % 1440
    : (settings?.rosterRules?.shiftDurations?.[shift] || 8) * 60;
  let status = 'present';
  if (proposed.timeIn && startTime) {
    let inMinutes = getClockMinutes(proposed.timeIn);
    let startMinutes = getClockMinutes(startTime);
    if (shift === 'night' && inMinutes < 12 * 60) inMinutes += 1440;
    if (shift === 'night' && startMinutes < 12 * 60) startMinutes += 1440;
    status = inMinutes > startMinutes + (settings?.rosterRules?.gracePeriodMinutes ?? 15) ? 'late' : 'present';
  }
  const lateArrival = status === 'late';
  if (proposed.timeOut && workingMinutes <= expectedMinutes / 2) {
    status = 'half_day';
  } else if (proposed.timeOut && endTime) {
    let outMinutes = getClockMinutes(proposed.timeOut);
    let endMinutes = getClockMinutes(endTime);
    if (shift === 'night' && outMinutes < 12 * 60) outMinutes += 1440;
    if (shift === 'night' && endMinutes < 12 * 60) endMinutes += 1440;
    if (outMinutes < endMinutes) status = 'early_leave';
  }
  return { checkInTime, checkOutTime, workingMinutes, status, lateArrival };
};

export const submitAttendanceCorrection = async (req, res) => {
  try {
    const { staffId, date, correctedCheckInTime, correctedCheckOutTime, reason } = req.body || {};
    if (!mongoose.isValidObjectId(staffId) || !isValidDate(date)) {
      return res.status(400).json({ success: false, message: 'Provide a valid staff member and attendance date.' });
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Enter a correction reason of 1–1000 characters.' });
    }
    if ((correctedCheckInTime && !validTimePattern.test(correctedCheckInTime))
      || (correctedCheckOutTime && !validTimePattern.test(correctedCheckOutTime))
      || (!correctedCheckInTime && !correctedCheckOutTime)) {
      return res.status(400).json({ success: false, message: 'Enter at least one corrected time in HH:MM format.' });
    }
    const [staff, attendance, roster, settings] = await Promise.all([
      findStaffMembers().then((members) => members.find((member) => String(member._id) === String(staffId))),
      StaffAttendance.findOne({ staffId, date }).lean(),
      Roster.findOne({ staffId, date }).select('shift').lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' })
        .select('rosterRules.shiftTimes rosterRules.shiftDurations rosterRules.gracePeriodMinutes workingHours.days')
        .lean()
    ]);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    if (!attendance) {
      return res.status(409).json({ success: false, message: 'A correction can only be requested for an existing self-recorded attendance entry.' });
    }
    const proposedValues = {
      timeIn: correctedCheckInTime || attendance.timeIn || '',
      timeOut: correctedCheckOutTime || attendance.timeOut || ''
    };
    if (!proposedValues.timeIn) {
      return res.status(400).json({ success: false, message: 'A corrected check-in time is required.' });
    }
    if (proposedValues.timeIn === attendance.timeIn && proposedValues.timeOut === (attendance.timeOut || '')) {
      return res.status(400).json({ success: false, message: 'The proposed times do not change the existing attendance.' });
    }
    const shift = roster?.shift || attendance.shift || 'clinic-hours';
    const calculated = calculateCorrectedValues(date, proposedValues, shift, settings);
    if (!calculated) {
      return res.status(400).json({ success: false, message: 'Corrected times are invalid or checkout must follow check-in.' });
    }
    const correctionValues = {
      ...proposedValues,
      checkInTime: calculated.checkInTime,
      checkOutTime: calculated.checkOutTime,
      workingMinutes: calculated.workingMinutes,
      status: calculated.status,
      lateArrival: calculated.lateArrival
    };
    const session = await mongoose.startSession();
    let correction;
    try {
      await session.withTransaction(async () => {
        [correction] = await AttendanceCorrection.create([{
          attendanceId: attendance._id,
          staffId,
          date,
          previousValues: toValues(attendance),
          proposedValues: correctionValues,
          attendanceUpdatedAt: attendance.updatedAt,
          reason: reason.trim(),
          requestedBy: req.user._id
        }], { session });
        await AttendanceAuditLog.create([{
          correctionId: correction._id,
          attendanceId: attendance._id,
          staffId,
          date,
          action: 'submitted',
          modifiedBy: req.user._id,
          previousValues: toValues(attendance),
          newValues: correctionValues,
          reason: reason.trim()
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    return res.status(201).json({ success: true, message: 'Correction request submitted for review.', data: correction });
  } catch (error) {
    console.error('Failed to submit attendance correction:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A pending correction already exists for this attendance record.' });
    }
    if (/transaction numbers are only allowed|replica set|mongos/i.test(error.message || '')) {
      return res.status(503).json({
        success: false,
        message: 'Attendance correction requests require MongoDB transaction support. Configure MongoDB as a replica set.'
      });
    }
    return res.status(500).json({ success: false, message: 'Unable to submit attendance correction.' });
  }
};

export const decideAttendanceCorrection = async (req, res) => {
  const { correctionId } = req.params;
  const { decision, reason = '' } = req.body || {};
  if (!mongoose.isValidObjectId(correctionId) || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Provide a valid correction and decision.' });
  }
  if (decision === 'rejected' && (typeof reason !== 'string' || !reason.trim())) {
    return res.status(400).json({ success: false, message: 'Provide a reason when rejecting a correction.' });
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const correction = await AttendanceCorrection.findOne({
        _id: correctionId,
        status: 'pending'
      }).session(session);
      if (!correction) {
        result = { conflict: true };
        return;
      }
      const attendance = await StaffAttendance.findById(correction.attendanceId).session(session);
      if (!attendance || attendance.updatedAt.getTime() !== correction.attendanceUpdatedAt.getTime()) {
        result = { conflict: true };
        return;
      }
      const oldValues = toValues(attendance);
      let newValues = correction.proposedValues.toObject
        ? correction.proposedValues.toObject()
        : correction.proposedValues;
      if (decision === 'approved') {
        const [roster, settings] = await Promise.all([
          Roster.findOne({ staffId: correction.staffId, date: correction.date }).select('shift').session(session).lean(),
          ClinicOperationalSettings.findOne({ key: 'clinic' })
            .select('rosterRules.shiftTimes rosterRules.shiftDurations rosterRules.gracePeriodMinutes workingHours.days')
            .session(session)
            .lean()
        ]);
        const calculated = calculateCorrectedValues(
          correction.date,
          newValues,
          roster?.shift || attendance.shift || 'clinic-hours',
          settings
        );
        if (!calculated) {
          result = { conflict: true };
          return;
        }
        attendance.timeIn = newValues.timeIn;
        attendance.timeOut = newValues.timeOut;
        attendance.checkInTime = calculated.checkInTime;
        attendance.checkOutTime = calculated.checkOutTime;
        attendance.workingMinutes = calculated.workingMinutes;
        attendance.status = calculated.status;
        attendance.lateArrival = calculated.lateArrival;
        await attendance.save({ session });
        newValues = toValues(attendance);
      }
      correction.status = decision;
      correction.reviewedBy = req.user._id;
      correction.reviewedAt = new Date();
      correction.reviewReason = reason.trim();
      await correction.save({ session });
      await AttendanceAuditLog.create([{
        correctionId: correction._id,
        attendanceId: correction.attendanceId,
        staffId: correction.staffId,
        date: correction.date,
        action: decision,
        modifiedBy: req.user._id,
        previousValues: oldValues,
        newValues: decision === 'approved'
          ? newValues
          : { ...newValues, correctionStatus: decision },
        reason: decision === 'rejected' ? reason.trim() : correction.reason
      }], { session });
      result = { correction, attendance: decision === 'approved' ? attendance : null };
    });
    if (result?.conflict) {
      return res.status(409).json({
        success: false,
        message: 'The attendance record changed or this correction is no longer pending. Refresh before deciding.'
      });
    }
    const io = req.app.get('io');
    io?.emit('staff-attendance-updated', { staffId: String(result.correction.staffId), date: result.correction.date });
    return res.status(200).json({
      success: true,
      message: `Correction ${decision}.`,
      data: result.correction
    });
  } catch (error) {
    console.error('Failed to decide attendance correction:', error);
    const transactionUnavailable = /transaction numbers are only allowed|replica set|mongos/i.test(error.message || '');
    return res.status(transactionUnavailable ? 503 : 500).json({
      success: false,
      message: transactionUnavailable
        ? 'Attendance correction decisions require MongoDB transaction support. Configure MongoDB as a replica set.'
        : 'Unable to decide attendance correction.'
    });
  } finally {
    await session.endSession();
  }
};

export const getAttendanceCorrectionDetails = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.correctionId)) {
      return res.status(400).json({ success: false, message: 'Provide a valid correction ID.' });
    }
    const correction = await AttendanceCorrection.findById(req.params.correctionId)
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .lean();
    if (!correction) return res.status(404).json({ success: false, message: 'Correction request not found.' });
    const [audit, staff] = await Promise.all([
      AttendanceAuditLog.find({ correctionId: correction._id })
        .populate('modifiedBy', 'name email')
        .sort({ modificationDate: 1 })
        .lean(),
      findStaffMembers().then((members) => members.find((member) => String(member._id) === String(correction.staffId)))
    ]);
    return res.status(200).json({ success: true, data: { correction, audit, staff: staff || null } });
  } catch (error) {
    console.error('Failed to load attendance correction details:', error);
    return res.status(500).json({ success: false, message: 'Unable to load correction details.' });
  }
};

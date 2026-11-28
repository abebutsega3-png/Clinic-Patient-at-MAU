export const DEPARTMENTS = [
  'Card Room',
  'Examination Room',
  'Laboratory Room',
  'Dispensary Room',
  'Injection & Dressing Room',
  'Emergency Room',
];

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function getShiftName(shifts, shiftId) {
  return shifts.find((shift) => shift.id === shiftId)?.name || 'Unassigned';
}

export function getStaff(staff, staffId) {
  return staff.find((member) => member.id === staffId);
}

export function getShiftTime(shift) {
  return shift ? `${shift.startTime} – ${shift.endTime} Ethiopian clock` : '—';
}

export function shiftTimesOverlap(first, second) {
  const toMinutes = (value) => {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(value || '');
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return null;
    return (Number(match[1]) % 12) * 60 + Number(match[2]);
  };
  const intervals = (shift) => {
    const start = toMinutes(shift?.startTime);
    const end = toMinutes(shift?.endTime);
    if (start === null || end === null || start === end) return null;
    const endOnClock = end <= start ? end + 12 * 60 : end;
    return endOnClock <= 12 * 60
      ? [[start, endOnClock]]
      : [[start, 12 * 60], [0, endOnClock - 12 * 60]];
  };
  const firstIntervals = intervals(first);
  const secondIntervals = intervals(second);
  if (!firstIntervals || !secondIntervals) return true;
  return firstIntervals.some(([firstStart, firstEnd]) => secondIntervals.some(([secondStart, secondEnd]) => (
    firstStart < secondEnd && secondStart < firstEnd
  )));
}

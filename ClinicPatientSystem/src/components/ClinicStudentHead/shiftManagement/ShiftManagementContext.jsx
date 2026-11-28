import { useMemo, useState } from 'react';
import { ShiftManagementContext } from './ShiftManagementStore.js';
import { WEEKDAYS } from './shiftManagementData.js';

const today = new Date();
const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const dayOffset = (amount) => {
  const date = new Date(today);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
};

const seedShifts = [
  { id: 'SH-001', name: 'Morning Shift', startTime: '2:30', endTime: '6:30', duration: '4 hours', breakDuration: 30, gracePeriod: 10, workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], description: 'Morning clinic coverage', status: 'Active' },
  { id: 'SH-002', name: 'Afternoon Shift', startTime: '7:30', endTime: '11:30', duration: '4 hours', breakDuration: 30, gracePeriod: 10, workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], description: 'Afternoon clinic coverage', status: 'Active' },
  { id: 'SH-003', name: 'Night Shift', startTime: '12:00', endTime: '2:30', duration: '2.5 hours', breakDuration: 15, gracePeriod: 10, workingDays: WEEKDAYS, description: 'Night clinic coverage', status: 'Active' },
];

const seedStaff = [
  { id: 'ST-1001', name: 'Alemu Bekele', position: 'Nurse', department: 'Examination Room', active: true },
  { id: 'ST-1002', name: 'Hana Tadesse', position: 'Nurse', department: 'Emergency Room', active: true },
  { id: 'ST-1003', name: 'Dawit Girma', position: 'Laboratory Technician', department: 'Laboratory Room', active: true },
  { id: 'ST-1004', name: 'Mekdes Abebe', position: 'Pharmacist', department: 'Dispensary Room', active: true },
  { id: 'ST-1005', name: 'Samuel Tesfaye', position: 'Records Officer', department: 'Card Room', active: true },
  { id: 'ST-1006', name: 'Rahel Worku', position: 'Nurse', department: 'Injection & Dressing Room', active: true },
  { id: 'ST-1007', name: 'Yonas Alem', position: 'Medical Officer', department: 'Examination Room', active: true },
  { id: 'ST-1008', name: 'Selamawit Desta', position: 'Nurse', department: 'Emergency Room', active: true },
  { id: 'ST-1009', name: 'Fikru Hailu', position: 'Laboratory Technician', department: 'Laboratory Room', active: true },
  { id: 'ST-1010', name: 'Mimi Kebede', position: 'Nurse', department: 'Card Room', active: true },
];

const seedAssignments = [
  { id: 'AS-001', staffId: 'ST-1001', shiftId: 'SH-001', department: 'Examination Room', startDate: dayOffset(-30), endDate: '', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], status: 'Active' },
  { id: 'AS-002', staffId: 'ST-1002', shiftId: 'SH-003', department: 'Emergency Room', startDate: dayOffset(-20), endDate: '', workingDays: WEEKDAYS, status: 'Active' },
  { id: 'AS-003', staffId: 'ST-1003', shiftId: 'SH-002', department: 'Laboratory Room', startDate: dayOffset(-20), endDate: '', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], status: 'Active' },
  { id: 'AS-004', staffId: 'ST-1004', shiftId: 'SH-001', department: 'Dispensary Room', startDate: dayOffset(-20), endDate: '', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], status: 'Active' },
  { id: 'AS-005', staffId: 'ST-1005', shiftId: 'SH-002', department: 'Card Room', startDate: dayOffset(-20), endDate: '', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], status: 'Active' },
  { id: 'AS-006', staffId: 'ST-1006', shiftId: 'SH-003', department: 'Injection & Dressing Room', startDate: dayOffset(-20), endDate: '', workingDays: WEEKDAYS, status: 'Active' },
  { id: 'AS-007', staffId: 'ST-1007', shiftId: 'SH-001', department: 'Examination Room', startDate: dayOffset(-20), endDate: '', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], status: 'Active' },
  { id: 'AS-008', staffId: 'ST-1008', shiftId: 'SH-002', department: 'Emergency Room', startDate: dayOffset(-20), endDate: '', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], status: 'Active' },
  { id: 'AS-009', staffId: 'ST-1009', shiftId: 'SH-003', department: 'Laboratory Room', startDate: dayOffset(-20), endDate: '', workingDays: WEEKDAYS, status: 'Active' },
];

const initialState = {
  shifts: seedShifts,
  staff: seedStaff,
  assignments: seedAssignments,
  requests: [
    { id: 'RQ-001', staffId: 'ST-1008', currentShiftId: 'SH-002', requestedShiftId: 'SH-001', requestDate: dayOffset(-1), effectiveDate: dayOffset(2), reason: 'Temporary family commitment', status: 'Pending', assignmentId: 'AS-008' },
    { id: 'RQ-002', staffId: 'ST-1009', currentShiftId: 'SH-003', requestedShiftId: 'SH-002', requestDate: dayOffset(-2), effectiveDate: dayOffset(4), reason: 'Training schedule adjustment', status: 'Pending', assignmentId: 'AS-009' },
  ],
  history: [
    { id: 'HI-001', staffId: 'ST-1001', previousShiftId: '', newShiftId: 'SH-001', previousDepartment: '', newDepartment: 'Examination Room', effectiveDate: dayOffset(-30), changedBy: 'Clinic Head', reason: 'Initial shift assignment', changeDate: dayOffset(-30) },
  ],
  requirements: {},
};

export function ShiftManagementProvider({ children }) {
  const [state, setState] = useState(initialState);

  const value = useMemo(() => ({
    ...state,
    addShift(shift) {
      setState((current) => ({ ...current, shifts: [...current.shifts, { ...shift, id: `SH-${String(Date.now()).slice(-6)}` }] }));
    },
    updateShift(shift) {
      setState((current) => ({ ...current, shifts: current.shifts.map((item) => item.id === shift.id ? shift : item) }));
    },
    upsertStaff(staffMember) {
      setState((current) => ({
        ...current,
        staff: current.staff.some((item) => item.id === staffMember.id)
          ? current.staff.map((item) => item.id === staffMember.id ? staffMember : item)
          : [...current.staff, staffMember],
      }));
    },
    addAssignment(assignment, existingId = '') {
      setState((current) => {
        const old = current.assignments.find((item) => item.id === existingId);
        const updated = { ...assignment, id: existingId || `AS-${String(Date.now()).slice(-6)}` };
        const history = {
          id: `HI-${String(Date.now()).slice(-6)}`,
          staffId: assignment.staffId,
          previousShiftId: old?.shiftId || '',
          newShiftId: assignment.shiftId,
          previousDepartment: old?.department || '',
          newDepartment: assignment.department,
          effectiveDate: assignment.startDate,
          changedBy: 'Clinic Head',
          reason: existingId ? 'Assignment updated' : 'Shift assigned',
          changeDate: dateKey(new Date()),
        };
        return {
          ...current,
          assignments: existingId
            ? current.assignments.map((item) => item.id === existingId ? updated : item)
            : [...current.assignments, updated],
          history: [history, ...current.history],
        };
      });
    },
    deactivateAssignment(id) {
      setState((current) => ({
        ...current,
        assignments: current.assignments.map((item) => item.id === id ? { ...item, status: 'Inactive', endDate: dateKey(new Date()) } : item),
      }));
    },
    decideRequest(id, decision) {
      setState((current) => {
        const request = current.requests.find((item) => item.id === id);
        if (!request || request.status !== 'Pending') return current;
        const assignment = current.assignments.find((item) => item.id === request.assignmentId);
        const approved = decision === 'Approved';
        const effectiveDate = new Date(`${request.effectiveDate}T00:00:00`);
        effectiveDate.setDate(effectiveDate.getDate() - 1);
        const previousEndDate = dateKey(effectiveDate);
        const history = {
          id: `HI-${String(Date.now()).slice(-6)}`,
          staffId: request.staffId,
          previousShiftId: assignment?.shiftId || request.currentShiftId,
          newShiftId: approved ? request.requestedShiftId : (assignment?.shiftId || request.currentShiftId),
          previousDepartment: assignment?.department || '',
          newDepartment: assignment?.department || '',
          effectiveDate: request.effectiveDate,
          changedBy: 'Clinic Head',
          reason: `${decision} shift request: ${request.reason}`,
          changeDate: dateKey(new Date()),
        };
        return {
          ...current,
          requests: current.requests.map((item) => item.id === id ? { ...item, status: decision } : item),
          assignments: approved && assignment
            ? [
              ...current.assignments.map((item) => item.id === assignment.id
                ? { ...item, endDate: previousEndDate, status: 'Inactive' }
                : item),
              {
                ...assignment,
                id: `AS-${String(Date.now()).slice(-6)}`,
                shiftId: request.requestedShiftId,
                startDate: request.effectiveDate,
                endDate: '',
                status: 'Active',
              },
            ]
            : current.assignments,
          history: [history, ...current.history],
        };
      });
    },
    setRequirement(key, amount) {
      setState((current) => ({ ...current, requirements: { ...current.requirements, [key]: amount } }));
    },
  }), [state]);

  return <ShiftManagementContext.Provider value={value}>{children}</ShiftManagementContext.Provider>;
}


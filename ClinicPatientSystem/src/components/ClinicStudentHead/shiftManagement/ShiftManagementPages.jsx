import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, Clock3,
  FileClock, Filter, Plus, Printer, Search, Users, X,
} from 'lucide-react';
import { useShiftManagement } from './useShiftManagement.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  DEPARTMENTS, WEEKDAYS, getShiftName, getShiftTime, getStaff, shiftTimesOverlap,
} from './shiftManagementData.js';

const basePath = '/clinic-head/shift-management';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50';
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
const calculateDuration = (startTime, endTime) => {
  const parse = (value) => {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(value);
    if (!match || Number(match[1]) > 12 || Number(match[1]) < 1) return null;
    return (Number(match[1]) % 12) * 60 + Number(match[2]);
  };
  const start = parse(startTime);
  const end = parse(endTime);
  if (start === null || end === null || start === end) return '';
  const minutes = (end - start + 12 * 60) % (12 * 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours ? `${hours} hour${hours === 1 ? '' : 's'}` : ''}${hours && remainingMinutes ? ' ' : ''}${remainingMinutes ? `${remainingMinutes} minutes` : ''}`;
};
const statusClass = (status) => status === 'Active' || status === 'Approved' || status === 'Fully Covered'
  ? 'bg-emerald-50 text-emerald-700'
  : status === 'Pending' || status === 'Understaffed'
    ? 'bg-amber-50 text-amber-700'
    : status === 'Overstaffed' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600';
const StatusBadge = ({ status }) => <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(status)}`}>{status}</span>;
const PageHeading = ({ title, description, action }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    {action}
  </div>
);
const TableEmpty = ({ message }) => <tr><td colSpan="12" className="px-4 py-10 text-center text-sm text-slate-500">{message}</td></tr>;
const TableWrapper = ({ children }) => <div className={`${panelClass} overflow-hidden p-0`}><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">{children}</table></div></div>;
const TableHead = ({ children }) => <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{children}</tr></thead>;
const Th = ({ children }) => <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
const Td = ({ children, className = '' }) => <td className={`border-t border-slate-100 px-4 py-3 text-slate-700 ${className}`}>{children}</td>;

function ShiftManagementTabs() {
  const tabs = [
    ['Shift Dashboard', 'dashboard'],
    ['Shift List', 'list'],
    ['Assign Staff to Shift', 'assign'],
    ['Weekly Shift Schedule', 'schedule'],
    ['Shift Change / Swap Requests', 'requests'],
    ['Shift Coverage Monitoring', 'coverage'],
    ['Shift History', 'history'],
  ];
  return (
    <nav aria-label="Staff shift management pages" className="mb-5 flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
      {tabs.map(([label, path]) => (
        <NavLink
          key={path}
          to={`${basePath}/${path}`}
          className={({ isActive }) => `inline-flex shrink-0 items-center whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition sm:text-sm ${
            isActive ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function ShiftDashboard() {
  const { shifts, staff, assignments, history, requests } = useShiftManagement();
  const activeAssignments = assignments.filter((item) => item.status === 'Active');
  const activeStaffIds = new Set(activeAssignments.map((item) => item.staffId));
  const activeStaff = staff.filter((item) => item.active);
  const cards = [
    ['Total Active Staff', activeStaff.length, Users, 'bg-blue-50 text-blue-700'],
    ['Morning Shift Staff', activeAssignments.filter((item) => item.shiftId === 'SH-001').length, CalendarDays, 'bg-amber-50 text-amber-700'],
    ['Afternoon Shift Staff', activeAssignments.filter((item) => item.shiftId === 'SH-002').length, Clock3, 'bg-sky-50 text-sky-700'],
    ['Night Shift Staff', activeAssignments.filter((item) => item.shiftId === 'SH-003').length, Activity, 'bg-indigo-50 text-indigo-700'],
    ['Unassigned Staff', activeStaff.filter((item) => !activeStaffIds.has(item.id)).length, Users, 'bg-rose-50 text-rose-700'],
  ];
  const [todayName] = useState(() => WEEKDAYS[(new Date().getDay() + 6) % 7]);
  const todayAssignments = activeAssignments.filter((assignment) => assignment.workingDays.includes(todayName));
  const activities = history.slice(0, 4);
  const upcoming = requests.filter((request) => request.status === 'Pending').slice(0, 3);
  return (
    <div>
      <PageHeading title="Shift Dashboard" description="Clinic staffing and shift activity overview." action={<Link className={buttonClass} to={`${basePath}/assign`}><Plus size={16} /> Assign Staff</Link>} />
      <p className="mb-3 text-xs text-slate-500">Sample frontend data; connect the clinic shift APIs to use live records.</p>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, Icon, colors]) => <article key={label} className={`${panelClass} flex items-center gap-3`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors}`}><Icon size={20} /></div><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div></article>)}
      </div>
      <ShiftManagementTabs />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={panelClass}>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-800">Today's Shift Schedule</h2><Link className="text-xs font-semibold text-blue-700 hover:underline" to={`${basePath}/schedule`}>Full schedule</Link></div>
          <div className="space-y-2">{todayAssignments.length ? todayAssignments.map((assignment) => {
            const member = getStaff(staff, assignment.staffId);
            const shift = shifts.find((item) => item.id === assignment.shiftId);
            return <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5"><div><p className="text-sm font-semibold text-slate-800">{member?.name || 'Unknown staff'} <span className="font-normal text-slate-500">· {assignment.department}</span></p><p className="mt-0.5 text-xs text-slate-500">{shift?.name} · {getShiftTime(shift)}</p></div><StatusBadge status={assignment.status} /></div>;
          }) : <p className="py-5 text-center text-sm text-slate-500">No staff are assigned for today.</p>}</div>
        </section>
        <section className={panelClass}>
          <h2 className="mb-3 font-bold text-slate-800">Department-wise Staff Distribution</h2>
          <div className="space-y-3">{DEPARTMENTS.map((department) => {
            const count = activeAssignments.filter((item) => item.department === department).length;
            return <div key={department}><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">{department}</span><span className="text-slate-500">{count} assigned</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, activeAssignments.length ? (count / activeAssignments.length) * 100 : 0)}%` }} /></div></div>;
          })}</div>
        </section>
        <section className={panelClass}>
          <h2 className="mb-3 font-bold text-slate-800">Shift Coverage Overview</h2>
          <div className="space-y-2">{shifts.filter((item) => item.status === 'Active').map((shift) => {
            const count = activeAssignments.filter((assignment) => assignment.shiftId === shift.id).length;
            return <div key={shift.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{shift.name}</p><p className="text-xs text-slate-500">{getShiftTime(shift)}</p></div><div className="text-right"><p className="text-sm font-bold text-slate-800">{count} assigned</p><Link className="text-[11px] font-semibold text-blue-700 hover:underline" to={`${basePath}/coverage`}>Configure required staffing</Link></div></div>;
          })}</div>
        </section>
        <section className={panelClass}>
          <h2 className="mb-3 font-bold text-slate-800">Recent Shift Activities</h2>
          <div className="space-y-3">{activities.length ? activities.map((item) => <div key={item.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0"><span className="mt-1 text-blue-600"><FileClock size={16} /></span><div><p className="text-sm font-medium text-slate-800">{getStaff(staff, item.staffId)?.name || 'Staff'} · {item.reason}</p><p className="mt-0.5 text-xs text-slate-500">{item.changeDate}</p></div></div>) : <p className="text-sm text-slate-500">No recent shift activity.</p>}</div>
          <h3 className="mb-2 mt-4 text-sm font-bold text-slate-800">Upcoming Shift Changes</h3>
          {upcoming.length ? upcoming.map((item) => <p key={item.id} className="py-1 text-xs text-slate-600">{getStaff(staff, item.staffId)?.name} · {item.effectiveDate} <StatusBadge status={item.status} /></p>) : <p className="text-sm text-slate-500">No pending shift changes.</p>}
        </section>
      </div>
    </div>
  );
}

function ShiftList() {
  const { shifts, assignments, addShift, updateShift } = useShiftManagement();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const [formShift, setFormShift] = useState(null);
  const [notice, setNotice] = useState('');
  const pageSize = 5;
  const filtered = shifts.filter((shift) => `${shift.name} ${shift.id}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'All' || shift.status === statusFilter))
    .sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey])) * (sortDirection === 'asc' ? 1 : -1));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const changeSort = (key) => { if (sortKey === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDirection('asc'); } };
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const startTime = String(form.get('startTime') || '').trim();
    const endTime = String(form.get('endTime') || '').trim();
    if (!name || !calculateDuration(startTime, endTime)) { setNotice('Enter a shift name and valid, different Ethiopian clock start and end times.'); return; }
    const workingDays = form.getAll('workingDays');
    if (!workingDays.length) { setNotice('Select at least one working day.'); return; }
    const payload = {
      ...(formShift || {}),
      name, startTime, endTime,
      breakDuration: Number(form.get('breakDuration')),
      gracePeriod: Number(form.get('gracePeriod')),
      workingDays,
      description: String(form.get('description') || ''),
      status: String(form.get('status') || 'Active'),
      duration: calculateDuration(startTime, endTime),
    };
    if (formShift?.id) updateShift(payload); else addShift(payload);
    setFormShift(null);
    setNotice('Shift saved successfully.');
  };
  const deactivate = (shift) => {
    if (window.confirm(`Deactivate ${shift.name}?`)) { updateShift({ ...shift, status: 'Inactive' }); setNotice(`${shift.name} deactivated.`); }
  };
  return (
    <div>
      <PageHeading title="Shift List" description="Create, review, and manage clinic shift definitions." action={<button className={buttonClass} type="button" onClick={() => { setNotice(''); setFormShift({}); }}><Plus size={16} /> Create New Shift</button>} />
      <ShiftManagementTabs />
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      <div className={`${panelClass} mb-4 flex flex-wrap gap-3`}>
        <label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search shifts" aria-label="Search shifts" /></label>
        <label className="flex items-center gap-2 text-xs text-slate-500"><Filter size={15} /><select className={inputClass} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by shift status"><option>All</option><option>Active</option><option>Inactive</option></select></label>
      </div>
      <TableWrapper>
        <TableHead><Th>Shift ID</Th><Th><button onClick={() => changeSort('name')}>Shift Name {sortKey === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</button></Th><Th>Start Time (Ethiopian clock)</Th><Th>End Time (Ethiopian clock)</Th><Th>Duration</Th><Th>Break</Th><Th>Grace</Th><Th>Working Days</Th><Th>Assigned</Th><Th>Status</Th><Th>Actions</Th></TableHead>
        <tbody>{pageItems.length ? pageItems.map((shift) => <tr key={shift.id} className="hover:bg-slate-50/70"><Td>{shift.id}</Td><Td className="font-semibold">{shift.name}</Td><Td>{shift.startTime}</Td><Td>{shift.endTime}</Td><Td>{shift.duration || '—'}</Td><Td>{shift.breakDuration} min</Td><Td>{shift.gracePeriod} min</Td><Td>{shift.workingDays.join(', ')}</Td><Td>{assignments.filter((item) => item.shiftId === shift.id && item.status === 'Active').length}</Td><Td><StatusBadge status={shift.status} /></Td><Td><div className="flex gap-2"><button className="text-xs font-semibold text-blue-700" onClick={() => setFormShift({ ...shift, viewOnly: true })}>View</button><button className="text-xs font-semibold text-blue-700" onClick={() => setFormShift(shift)}>Edit</button><button className="text-xs font-semibold text-rose-600" onClick={() => deactivate(shift)} disabled={shift.status !== 'Active'}>Deactivate</button></div></Td></tr>) : <TableEmpty message="No shifts match these filters." />}</tbody>
      </TableWrapper>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>{filtered.length ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}` : 'No results'}</span><div className="flex gap-2"><button className={secondaryButtonClass} disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className={secondaryButtonClass} disabled={page * pageSize >= filtered.length} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      {formShift && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={formShift.viewOnly ? 'Shift details' : 'Shift form'}><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{formShift.viewOnly ? 'Shift Details' : formShift.id ? 'Edit Shift' : 'Create New Shift'}</h2><button type="button" onClick={() => setFormShift(null)} aria-label="Close"><X size={20} /></button></div>
        <fieldset disabled={formShift.viewOnly} className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Shift Name<input name="name" required defaultValue={formShift.name || ''} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold text-slate-600">Start Time (Ethiopian clock)<input name="startTime" required defaultValue={formShift.startTime || ''} className={`${inputClass} mt-1`} placeholder="2:30" /></label><label className="text-xs font-semibold text-slate-600">End Time (Ethiopian clock)<input name="endTime" required defaultValue={formShift.endTime || ''} className={`${inputClass} mt-1`} placeholder="6:30" /></label><label className="text-xs font-semibold text-slate-600">Break Duration (minutes)<input name="breakDuration" type="number" min="0" required defaultValue={formShift.breakDuration ?? 30} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold text-slate-600">Grace Period (minutes)<input name="gracePeriod" type="number" min="0" required defaultValue={formShift.gracePeriod ?? 10} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold text-slate-600">Status<select name="status" defaultValue={formShift.status || 'Active'} className={`${inputClass} mt-1`}><option>Active</option><option>Inactive</option></select></label><div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold text-slate-600">Working Days</p><div className="flex flex-wrap gap-3">{WEEKDAYS.map((day) => <label key={day} className="flex items-center gap-1 text-xs text-slate-600"><input name="workingDays" type="checkbox" value={day} defaultChecked={(formShift.workingDays || []).includes(day)} />{day.slice(0, 3)}</label>)}</div></div><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Description<textarea name="description" rows="3" defaultValue={formShift.description || ''} className={`${inputClass} mt-1`} /></label></fieldset>
        <div className="mt-5 flex justify-end gap-2"><button type="button" className={secondaryButtonClass} onClick={() => setFormShift(null)}>Cancel</button>{!formShift.viewOnly && <button className={buttonClass} type="submit">Save Shift</button>}</div>
      </form></div>}
    </div>
  );
}

function AssignStaff() {
  const { staff, shifts, assignments, addAssignment, deactivateAssignment, upsertStaff } = useShiftManagement();
  const { token } = useAuth();
  const [eligibleStaff, setEligibleStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [staffRetry, setStaffRetry] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [editId, setEditId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selectedStaff = eligibleStaff.find((item) => item.id === selectedId);
  const editAssignment = assignments.find((item) => item.id === editId);
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    fetch('/api/roster/staff?status=All', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error('The staff service returned an unreadable response.');
        }
        if (!response.ok) throw new Error(result.message || `Unable to load staff (${response.status}).`);
        if (!result.success || !Array.isArray(result.data)) {
          throw new Error(result.message || 'The staff service returned an invalid staff list.');
        }
        return result.data
          .filter((member) => {
            const role = String(member.roleLabel || member.role || member.position || '')
              .trim()
              .toLowerCase()
              .replace(/[_-]+/g, ' ');
            const status = String(member.status || 'Active').trim().toLowerCase();
            return member._id
              && status === 'active'
              && DEPARTMENTS.includes(member.department)
              && !['student', 'admin', 'system admin', 'clinic head'].includes(role);
          })
          .map((member) => ({
            ...member,
            id: String(member._id),
            staffCode: member.employeeId || member.username || String(member._id),
            name: member.name || member.username || 'Unnamed staff member',
            position: member.roleLabel || member.role || member.position || 'Clinic staff',
            active: true,
          }));
      })
      .then((members) => {
        if (active) {
          setEligibleStaff(members);
          setStaffError('');
        }
      })
      .catch((loadError) => {
        console.error('Failed to load eligible shift staff:', loadError);
        if (active) setStaffError(loadError.message || 'Unable to load eligible staff.');
      })
      .finally(() => {
        if (active) setStaffLoading(false);
      });
    return () => { active = false; };
  }, [staffRetry, token]);
  const selectStaff = (id) => {
    setSelectedId(id);
    const existing = assignments.find((item) => item.staffId === id && item.status === 'Active');
    setEditId(existing?.id || '');
  };
  const onSubmit = (event) => {
    event.preventDefault();
    const update = event.nativeEvent.submitter?.value === 'update';
    const values = new FormData(event.currentTarget);
    const workingDays = values.getAll('workingDays');
    const assignment = {
      staffId: String(values.get('staffId')),
      shiftId: String(values.get('shiftId')),
      department: String(values.get('department')),
      startDate: String(values.get('startDate')),
      endDate: String(values.get('endDate') || ''),
      workingDays,
      status: String(values.get('status')),
    };
    if (!workingDays.length) { setError('Select at least one working day.'); return; }
    if (assignment.endDate && assignment.endDate < assignment.startDate) { setError('End date must be on or after the start date.'); return; }
    const candidateShift = shifts.find((item) => item.id === assignment.shiftId);
    const overlaps = assignments.some((item) => item.status === 'Active' && item.staffId === assignment.staffId && item.id !== (update ? editId : '') &&
      (!item.endDate || item.endDate >= assignment.startDate) && (!assignment.endDate || assignment.endDate >= item.startDate) &&
      item.workingDays.some((day) => workingDays.includes(day)) &&
      shiftTimesOverlap(shifts.find((shift) => shift.id === item.shiftId), candidateShift));
    if (overlaps) { setError('This staff member already has an overlapping assignment on one or more selected working days.'); return; }
    upsertStaff(selectedStaff);
    addAssignment(assignment, update ? editId : '');
    setNotice(update ? 'Assignment updated successfully.' : 'Staff assigned successfully.');
    setError('');
    if (!update) { setSelectedId(''); setEditId(''); event.currentTarget.reset(); }
  };
  const cancel = () => { setSelectedId(''); setEditId(''); setNotice(''); setError(''); };
  return (
    <div>
      <PageHeading title="Assign Staff to Shift" description="Assign eligible active staff and prevent overlapping shift dates." />
      <ShiftManagementTabs />
      {staffError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"><span>{staffError}</span><button type="button" className="font-semibold underline" onClick={() => { setStaffLoading(true); setStaffRetry((value) => value + 1); }}>Retry</button></div>}
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <form className={panelClass} onSubmit={(event) => onSubmit(event, Boolean(editId))}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">Select Staff<select name="staffId" className={`${inputClass} mt-1`} value={selectedId} onChange={(event) => selectStaff(event.target.value)} disabled={staffLoading || Boolean(staffError) || !eligibleStaff.length} required><option value="">{staffLoading ? 'Loading active clinic staff...' : staffError ? 'Unable to load staff' : eligibleStaff.length ? 'Choose active staff' : 'No active eligible staff found'}</option>{eligibleStaff.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.staffCode}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Staff ID<input className={`${inputClass} mt-1 bg-slate-50`} readOnly value={selectedStaff?.staffCode || ''} /></label>
          <label className="text-xs font-semibold text-slate-600">Staff Name<input className={`${inputClass} mt-1 bg-slate-50`} readOnly value={selectedStaff?.name || ''} /></label>
          <label className="text-xs font-semibold text-slate-600">Position<input className={`${inputClass} mt-1 bg-slate-50`} readOnly value={selectedStaff?.position || ''} /></label>
          <label className="text-xs font-semibold text-slate-600">Department<select name="department" className={`${inputClass} mt-1`} defaultValue={selectedStaff?.department || ''} key={selectedId} required><option value="">Choose department</option>{DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Select Shift<select name="shiftId" className={`${inputClass} mt-1`} defaultValue={editAssignment?.shiftId || ''} key={`${selectedId}-${editId}`} required><option value="">Choose shift</option>{shifts.filter((item) => item.status === 'Active').map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime} Ethiopian clock</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Start Date<input name="startDate" type="date" defaultValue={editAssignment?.startDate || ''} key={`${editId}-start`} className={`${inputClass} mt-1`} required /></label>
          <label className="text-xs font-semibold text-slate-600">End Date (optional)<input name="endDate" type="date" defaultValue={editAssignment?.endDate || ''} key={`${editId}-end`} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-semibold text-slate-600">Assignment Status<select name="status" className={`${inputClass} mt-1`} defaultValue={editAssignment?.status || 'Active'} key={`${editId}-status`}><option>Active</option><option>Inactive</option></select></label>
          <fieldset className="sm:col-span-2 lg:col-span-3"><legend className="mb-2 text-xs font-semibold text-slate-600">Working Days</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{WEEKDAYS.map((day) => <label key={day} className="flex items-center gap-1.5 text-xs text-slate-600"><input name="workingDays" type="checkbox" value={day} defaultChecked={(editAssignment?.workingDays || []).includes(day)} key={`${editId}-${day}`} />{day}</label>)}</div></fieldset>
        </div>
        <div className="mt-5 flex flex-wrap gap-2"><button type="submit" name="action" value="assign" className={buttonClass} disabled={!selectedId}>Assign Shift</button><button type="submit" name="action" value="update" className={secondaryButtonClass} disabled={!editId || !selectedId}>Update Assignment</button><button type="button" className={secondaryButtonClass} onClick={cancel}>Cancel</button></div>
      </form>
      <section className={`${panelClass} mt-4`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-800">Current Assignments</h2>
            <p className="mt-1 text-xs text-slate-500">Active staff shift assignments</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {assignments.filter((item) => item.status === 'Active').length} active
          </span>
        </div>
        {assignments.some((item) => item.status === 'Active') ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {assignments.filter((item) => item.status === 'Active').map((item) => {
              const member = getStaff(staff, item.staffId);
              const shift = shifts.find((entry) => entry.id === item.shiftId);
              return (
                <article key={item.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-slate-900">{member?.name || item.staffId}</h3>
                      <p className="mt-1 text-xs text-slate-500">{member?.position || 'Clinic staff'} · {item.department}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">{getShiftName(shifts, item.shiftId)}</p>
                    <p className="text-xs text-slate-600">{shift ? `${shift.startTime}–${shift.endTime} Ethiopian clock` : 'Shift time unavailable'}</p>
                    <p className="text-xs text-slate-600">{item.startDate}{item.endDate ? ` to ${item.endDate}` : ' onwards'}</p>
                    <p className="text-xs text-slate-500">{item.workingDays.join(', ')}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button className={`${secondaryButtonClass} flex-1`} onClick={() => selectStaff(item.staffId)} aria-label={`Edit assignment for ${member?.name || item.staffId}`}>Edit</button>
                    <button className="flex-1 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => deactivateAssignment(item.id)} aria-label={`Deactivate assignment for ${member?.name || item.staffId}`}>Deactivate</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No active assignments.</p>}
      </section>
    </div>
  );
}

function WeeklySchedule() {
  const { shifts, staff, assignments } = useShiftManagement();
  const [week, setWeek] = useState(() => {
    const date = new Date();
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [department, setDepartment] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All');
  const days = WEEKDAYS.map((name, index) => { const date = new Date(week); date.setDate(date.getDate() + index); return { name, date }; });
  const moveWeek = (amount) => setWeek((date) => { const next = new Date(date); next.setDate(next.getDate() + amount * 7); return next; });
  return (
    <div>
      <PageHeading title="Weekly Shift Schedule" description="Weekly assignment calendar. All time labels use Ethiopian clock notation." action={<button className={secondaryButtonClass} onClick={() => window.print()}><Printer size={16} /> Print Schedule</button>} />
      <ShiftManagementTabs />
      <div className={`${panelClass} mb-4 flex flex-wrap items-center gap-2`}>
        <button className={secondaryButtonClass} onClick={() => moveWeek(-1)}><ArrowLeft size={15} /> Previous Week</button><button className={secondaryButtonClass} onClick={() => { const date = new Date(); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); date.setHours(0, 0, 0, 0); setWeek(date); }}>Current Week</button><button className={secondaryButtonClass} onClick={() => moveWeek(1)}>Next Week <ArrowRight size={15} /></button>
        <span className="mx-1 text-sm font-semibold text-slate-700">{days[0].date.toLocaleDateString()} – {days[6].date.toLocaleDateString()}</span>
        <select className={`${inputClass} ml-auto w-auto`} value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter schedule by department"><option>All</option>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select>
        <select className={`${inputClass} w-auto`} value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)} aria-label="Filter schedule by shift"><option>All</option>{shifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">{days.map((day) => {
        const dayAssignments = assignments.filter((item) => item.status === 'Active' && item.workingDays.includes(day.name) && item.startDate <= dateToKey(day.date) && (!item.endDate || item.endDate >= dateToKey(day.date)) && (department === 'All' || item.department === department) && (shiftFilter === 'All' || item.shiftId === shiftFilter));
        return <section className={`${panelClass} min-h-44 p-3`} key={day.name}><h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">{day.name}<span className="ml-2 font-normal text-slate-500">{day.date.getDate()}</span></h2><div className="space-y-2">{dayAssignments.map((item) => {
          const shift = shifts.find((entry) => entry.id === item.shiftId);
          const member = getStaff(staff, item.staffId);
          return <article key={`${day.name}-${item.id}`} className="rounded-lg border border-blue-100 bg-blue-50/60 p-2"><p className="text-xs font-bold text-slate-800">{member?.name || item.staffId}</p><p className="mt-1 text-[10px] text-slate-600">{item.department}</p><p className="mt-1 text-[10px] font-semibold text-blue-800">{shift?.name}</p><p className="text-[10px] text-slate-500">{shift ? `${shift.startTime}–${shift.endTime} Ethiopian clock` : 'Time unavailable'}</p></article>;
        })}{!dayAssignments.length && <p className="py-4 text-center text-xs text-slate-400">No assignments</p>}</div></section>;
      })}</div>
    </div>
  );
}
const dateToKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function ShiftRequests() {
  const { requests, staff, shifts, assignments, decideRequest } = useShiftManagement();
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const act = (request, decision) => {
    const assignment = assignments.find((item) => item.id === request.assignmentId);
    if (decision === 'Approved' && assignment) {
      const requestedShift = shifts.find((item) => item.id === request.requestedShiftId);
      const conflict = assignments.some((item) => item.id !== assignment.id && item.staffId === request.staffId && item.status === 'Active' &&
        (!item.endDate || item.endDate >= request.effectiveDate) &&
        item.workingDays.some((day) => assignment.workingDays.includes(day)) &&
        shiftTimesOverlap(shifts.find((shift) => shift.id === item.shiftId), requestedShift));
      if (conflict) { setNotice('This request conflicts with another active assignment and cannot be approved.'); return; }
    }
    decideRequest(request.id, decision);
    setNotice(`Request ${request.id} ${decision.toLowerCase()}.`);
    setSelected(null);
  };
  return (
    <div>
      <PageHeading title="Shift Change / Swap Requests" description="Review staff requests. Assignments change only after approval." />
      <ShiftManagementTabs />
      {notice && <p role="status" className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{notice}</p>}
      <TableWrapper><TableHead><Th>Request ID</Th><Th>Staff Name</Th><Th>Current Shift</Th><Th>Requested Shift</Th><Th>Request Date</Th><Th>Effective Date</Th><Th>Reason</Th><Th>Status</Th><Th>Actions</Th></TableHead><tbody>{requests.length ? requests.map((request) => <tr key={request.id} className="hover:bg-slate-50/70"><Td>{request.id}</Td><Td className="font-semibold">{getStaff(staff, request.staffId)?.name}</Td><Td>{getShiftName(shifts, request.currentShiftId)}</Td><Td>{getShiftName(shifts, request.requestedShiftId)}</Td><Td>{request.requestDate}</Td><Td>{request.effectiveDate}</Td><Td className="max-w-48 truncate">{request.reason}</Td><Td><StatusBadge status={request.status} /></Td><Td><div className="flex gap-2"><button className="text-xs font-semibold text-blue-700" onClick={() => setSelected(request)}>View Details</button>{request.status === 'Pending' && <><button className="text-xs font-semibold text-emerald-700" onClick={() => act(request, 'Approved')}>Approve</button><button className="text-xs font-semibold text-rose-600" onClick={() => act(request, 'Rejected')}>Reject</button></>}</div></Td></tr>) : <TableEmpty message="There are no shift change requests." />}</tbody></TableWrapper>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Shift request details"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><h2 className="text-lg font-bold text-slate-900">Request {selected.id}</h2><button aria-label="Close details" onClick={() => setSelected(null)}><X size={20} /></button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{[['Staff', getStaff(staff, selected.staffId)?.name], ['Current shift', getShiftName(shifts, selected.currentShiftId)], ['Requested shift', getShiftName(shifts, selected.requestedShiftId)], ['Request date', selected.requestDate], ['Effective date', selected.effectiveDate], ['Reason', selected.reason], ['Status', selected.status]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>)}</dl><div className="mt-5 flex justify-end gap-2"><button className={secondaryButtonClass} onClick={() => setSelected(null)}>Close</button>{selected.status === 'Pending' && <><button className={buttonClass} onClick={() => act(selected, 'Approved')}>Approve</button><button className={secondaryButtonClass} onClick={() => act(selected, 'Rejected')}>Reject</button></>}</div></div></div>}
    </div>
  );
}

function ShiftCoverage() {
  const { shifts, assignments, requirements, setRequirement } = useShiftManagement();
  const getCoverage = (department, shift) => {
    const key = `${department}|${shift.id}`;
    const required = Number(requirements[key] ?? 0);
    const assigned = assignments.filter((item) => item.status === 'Active' && item.department === department && item.shiftId === shift.id).length;
    const configured = Object.prototype.hasOwnProperty.call(requirements, key);
    const status = !configured ? 'Not Configured' : assigned < required ? 'Understaffed' : assigned > required ? 'Overstaffed' : 'Fully Covered';
    return { key, required, assigned, available: Math.max(0, assigned - required), status };
  };
  return (
    <div>
      <PageHeading title="Shift Coverage Monitoring" description="Set staffing requirements by department and shift; no requirements are assumed." />
      <ShiftManagementTabs />
      <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">Required staffing starts unconfigured. Enter clinic-approved values; available staff is the surplus above that requirement.</p>
      <TableWrapper><TableHead><Th>Department</Th><Th>Shift</Th><Th>Required Staff (configurable)</Th><Th>Assigned Staff</Th><Th>Available Staff</Th><Th>Coverage Status</Th></TableHead><tbody>{DEPARTMENTS.flatMap((department) => shifts.filter((shift) => shift.status === 'Active').map((shift) => {
        const item = getCoverage(department, shift);
        return <tr key={item.key}><Td className="font-medium">{department}</Td><Td>{shift.name}<p className="mt-0.5 text-[10px] text-slate-500">{getShiftTime(shift)}</p></Td><Td><input aria-label={`Required staff for ${department} ${shift.name}`} type="number" min="0" className="w-24 rounded-md border border-slate-200 px-2 py-1.5" value={item.required} onChange={(event) => setRequirement(item.key, Number(event.target.value))} /></Td><Td>{item.assigned}</Td><Td>{item.available}</Td><Td><StatusBadge status={item.status} /></Td></tr>;
      }))}</tbody></TableWrapper>
    </div>
  );
}

function ShiftHistory() {
  const { history, staff, shifts } = useShiftManagement();
  const [query, setQuery] = useState('');
  const filtered = history.filter((entry) => `${getStaff(staff, entry.staffId)?.name || ''} ${entry.reason}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <PageHeading title="Shift History" description="Read-only audit trail of assignments, modifications, and request decisions." />
      <ShiftManagementTabs />
      <label className={`${panelClass} mb-4 flex items-center gap-2`}><Search className="text-slate-400" size={16} /><input className="w-full text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff or reason" aria-label="Search shift history" /></label>
      <TableWrapper><TableHead><Th>Staff Name</Th><Th>Previous Shift</Th><Th>New Shift</Th><Th>Previous Department</Th><Th>New Department</Th><Th>Effective Date</Th><Th>Changed By</Th><Th>Reason</Th><Th>Change Date</Th></TableHead><tbody>{filtered.length ? filtered.map((item) => <tr key={item.id}><Td className="font-semibold">{getStaff(staff, item.staffId)?.name || 'Unknown staff'}</Td><Td>{item.previousShiftId ? getShiftName(shifts, item.previousShiftId) : '—'}</Td><Td>{getShiftName(shifts, item.newShiftId)}</Td><Td>{item.previousDepartment || '—'}</Td><Td>{item.newDepartment || '—'}</Td><Td>{item.effectiveDate || '—'}</Td><Td>{item.changedBy}</Td><Td>{item.reason}</Td><Td>{item.changeDate}</Td></tr>) : <TableEmpty message="No shift history matches your search." />}</tbody></TableWrapper>
    </div>
  );
}

export {
  ShiftDashboard, ShiftList, AssignStaff, WeeklySchedule, ShiftRequests, ShiftCoverage, ShiftHistory, ShiftManagementTabs,
};

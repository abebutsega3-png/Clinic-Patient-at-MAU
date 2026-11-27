import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileClock,
  FileText,
  LoaderCircle,
  Printer,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

const pageItems = [
  { id: 'daily', label: 'Daily Attendance', icon: CalendarDays },
  { id: 'records', label: 'Check-In / Check-Out Records', icon: Clock3 },
  { id: 'corrections', label: 'Attendance Correction', icon: ShieldCheck },
  { id: 'history', label: 'Attendance History', icon: FileClock },
  { id: 'monthly-report', label: 'Monthly Attendance Report', icon: FileText },
];

const statusLabels = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  on_leave: 'On Leave',
  half_day: 'Half Day',
  early_leave: 'Early Leave',
  unrecorded: 'Not recorded',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  submitted: 'Submitted',
};

const statusTones = {
  present: 'bg-emerald-100 text-emerald-800',
  late: 'bg-amber-100 text-amber-800',
  absent: 'bg-rose-100 text-rose-800',
  on_leave: 'bg-violet-100 text-violet-800',
  half_day: 'bg-orange-100 text-orange-800',
  early_leave: 'bg-cyan-100 text-cyan-800',
  unrecorded: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  submitted: 'bg-blue-100 text-blue-800',
};

const getClinicDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Addis_Ababa',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
      timeZone: 'Africa/Addis_Ababa',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
};

const formatTime = (value) => {
  if (!value) return '—';
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(':').map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
      timeZone: 'Africa/Addis_Ababa',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
};

const formatDuration = (minutes) => {
  const value = Number(minutes) || 0;
  return value ? `${Math.floor(value / 60)}h ${value % 60}m` : '—';
};

const formatAttendanceDuration = (row) => (
  row.workingMinutes > 0
    ? formatDuration(row.workingMinutes)
    : row.checkInTime && !row.checkOutTime
      ? 'In progress'
      : '—'
);

const csvCell = (value) => {
  const text = String(value ?? '');
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

const downloadCsv = (filename, headers, rows) => {
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadExcel = async (filename, sheetName, headers, rows) => {
  const XLSX = await import('@e965/xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => row.map((value) => (
      typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    ))),
  ]);
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 0, c: headers.length - 1 },
    }),
  };
  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.min(32, Math.max(14, String(header).length + 2)),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  const blob = new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTones[status] || statusTones.unrecorded}`}>
      {statusLabels[status] || statusLabels.unrecorded}
    </span>
  );
}

function Panel({ title, icon: Icon, action, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          {Icon && <Icon size={17} className="text-blue-600" aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LoadingState() {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading attendance data…</div>;
}

function EmptyState({ children = 'No attendance records found for the selected filters.' }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center text-sm text-slate-500">{children}</div>;
}

function AttendanceTable({ rows, onView, onCorrection }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Staff ID / Name</th>
            <th className="px-4 py-3">Department / Position</th>
            <th className="px-4 py-3">Shift</th>
            <th className="px-4 py-3">Check-in</th>
            <th className="px-4 py-3">Check-out</th>
            <th className="px-4 py-3">Working hours</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row._id}-${row.date}`} className="hover:bg-slate-50/70">
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-800">{row.name || 'Unnamed staff'}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{row.employeeId || row._id}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-700">{row.department || 'Unassigned'}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{row.roleLabel || row.role || 'Staff'}</div>
              </td>
              <td className="px-4 py-3 capitalize text-slate-600">{String(row.rosterShift || '—').replace('-', ' ')}</td>
              <td className="px-4 py-3 text-slate-600">{formatTime(row.timeIn || row.checkInTime)}</td>
              <td className="px-4 py-3 text-slate-600">{formatTime(row.timeOut || row.checkOutTime)}</td>
              <td className="px-4 py-3 text-slate-600">{formatAttendanceDuration(row)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.attendanceStatus} /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => onView(row)} aria-label={`View ${row.name} attendance`} title="View details" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                  {row.attendanceId && <button type="button" onClick={() => onCorrection(row)} aria-label={`Request correction for ${row.name}`} title="Request correction" className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"><ShieldCheck size={15} /></button>}
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">No staff attendance matches these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <span>{pagination.totalRecords} records · Page {pagination.page} of {pagination.totalPages}</span>
      <div className="flex gap-2">
        <button type="button" disabled={pagination.page <= 1} onClick={() => onChange(pagination.page - 1)} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
        <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => onChange(pagination.page + 1)} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function CorrectionModal({ token, staff, initialRecord, onClose, onSubmitted }) {
  const [existingRecord, setExistingRecord] = useState(initialRecord);
  const [form, setForm] = useState({
    staffId: initialRecord?._id || '',
    date: initialRecord?.date || getClinicDate(),
    correctedCheckInTime: initialRecord?.timeIn || '',
    correctedCheckOutTime: initialRecord?.timeOut || '',
    reason: '',
  });
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!form.staffId || !form.date || initialRecord?.attendanceId) return undefined;
    let active = true;
    const fetchRecord = async () => {
      try {
        setLoadingRecord(true);
        const { data } = await axios.get(
          `/api/roster/attendance/staff/${encodeURIComponent(form.staffId)}?from=${form.date}&to=${form.date}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const record = data?.data?.attendance?.find((item) => item.date === form.date && item.attendanceId);
        if (active && record) {
          setExistingRecord(record);
          setForm((current) => ({
            ...current,
            correctedCheckInTime: record.timeIn || '',
            correctedCheckOutTime: record.timeOut || '',
          }));
        }
      } catch (fetchError) {
        if (active) setError(fetchError.response?.data?.message || 'Unable to load the existing attendance record.');
      } finally {
        if (active) setLoadingRecord(false);
      }
    };
    void fetchRecord();
    return () => { active = false; };
  }, [form.date, form.staffId, initialRecord?.attendanceId, token]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      const { data } = await axios.post('/api/roster/attendance/corrections', form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onSubmitted(data.message || 'Correction request submitted for review.');
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Unable to submit the correction request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="correction-title">
      <form onSubmit={submit} className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="correction-title" className="text-lg font-bold text-slate-900">Request attendance correction</h2><p className="mt-1 text-xs text-slate-500">This submits a review request; it does not change attendance until approved.</p></div>
          <button type="button" onClick={onClose} aria-label="Close correction form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold text-slate-600">Staff member
            <select required disabled={Boolean(initialRecord)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={form.staffId} onChange={(event) => { setExistingRecord(null); setForm((current) => ({ ...current, staffId: event.target.value, correctedCheckInTime: '', correctedCheckOutTime: '' })); }}>
              <option value="">Select staff</option>
              {staff.map((member) => <option key={member._id} value={member._id}>{member.name} · {member.employeeId || member.roleLabel || member.role}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Attendance date
            <input required disabled={Boolean(initialRecord)} type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.date} onChange={(event) => { setExistingRecord(null); setForm((current) => ({ ...current, date: event.target.value })); }} />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Corrected check-in
            <input type="time" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.correctedCheckInTime} onChange={(event) => setForm((current) => ({ ...current, correctedCheckInTime: event.target.value }))} />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Corrected check-out
            <input type="time" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.correctedCheckOutTime} onChange={(event) => setForm((current) => ({ ...current, correctedCheckOutTime: event.target.value }))} />
          </label>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Existing record: Check-in {formatTime(existingRecord?.timeIn)} · Check-out {formatTime(existingRecord?.timeOut)}
        </div>
        {loadingRecord && <p className="text-xs text-slate-500">Loading existing attendance…</p>}
        <label className="block space-y-1 text-xs font-semibold text-slate-600">Reason for correction
          <textarea required minLength="3" maxLength="1000" rows="3" className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Explain why these recorded times need correction." />
        </label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="submit" disabled={saving || loadingRecord} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for review'}</button>
        </div>
      </form>
    </div>
  );
}

function DetailsModal({ details, onClose }) {
  if (!details) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="attendance-details-title">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="attendance-details-title" className="text-lg font-bold text-slate-900">{details.staff?.name || 'Staff attendance details'}</h2><p className="mt-1 text-xs text-slate-500">{details.staff?.department || 'Unassigned'} · {details.staff?.roleLabel || details.staff?.role || 'Staff'}</p></div>
          <button type="button" onClick={onClose} aria-label="Close attendance details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Shift</th><th className="px-3 py-2">Check-in</th><th className="px-3 py-2">Check-out</th><th className="px-3 py-2">Hours</th><th className="px-3 py-2">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(details.attendance || []).map((row) => <tr key={row.date}><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2 capitalize">{row.rosterShift || '—'}</td><td className="px-3 py-2">{formatTime(row.timeIn || row.checkInTime)}</td><td className="px-3 py-2">{formatTime(row.timeOut || row.checkOutTime)}</td><td className="px-3 py-2">{formatAttendanceDuration(row)}</td><td className="px-3 py-2"><StatusBadge status={row.attendanceStatus} /></td></tr>)}
              {!details.attendance?.length && <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No attendance history available.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Total recorded working time: {formatDuration(details.totalWorkingMinutes)}</p>
      </div>
    </div>
  );
}

export default function ClinicHeadAttendance() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const routePage = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  const queryPage = searchParams.get('tab');
  const activePage = pageItems.some((item) => item.id === queryPage)
    ? queryPage
    : pageItems.some((item) => item.id === routePage) ? routePage : 'dashboard';
  const [date, setDate] = useState(getClinicDate());
  const [month, setMonth] = useState(getClinicDate().slice(0, 7));
  const [department, setDepartment] = useState('All');
  const [status, setStatus] = useState('All');
  const [correctionFilter, setCorrectionFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(() => `${getClinicDate().slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(getClinicDate());
  const [staffId, setStaffId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [dashboardRows, setDashboardRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [historyMinutes, setHistoryMinutes] = useState(0);
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionRecord, setCorrectionRecord] = useState(null);
  const [details, setDetails] = useState(null);

  const selectAttendancePage = (id) => {
    setPage(1);
    if (id === 'daily') {
      setSearch('');
      setStatus('All');
    }
    const nextParams = new URLSearchParams(searchParams);
    if (id === 'dashboard') nextParams.delete('tab');
    else nextParams.set('tab', id);
    setSearchParams(nextParams);
  };

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const query = new URLSearchParams({ date, department });
    axios.get(`/api/roster/attendance/dashboard?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => {
      if (active) setDashboard(data.data);
    }).catch((fetchError) => {
      if (active) setError(fetchError.response?.data?.message || 'Unable to load attendance summary.');
    });
    return () => { active = false; };
  }, [date, department, refreshKey, token]);

  useEffect(() => {
    if (!token) return;
    axios.get('/api/roster/staff', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setStaffDirectory(Array.isArray(data?.data) ? data.data : []))
      .catch((fetchError) => setError(fetchError.response?.data?.message || 'Unable to load staff directory.'));
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }
    let active = true;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (activePage === 'dashboard') {
          const dailyQuery = new URLSearchParams({
            date,
            department,
            search,
            page: '1',
            pageSize: '5',
          });
          const { data } = await axios.get(`/api/roster/attendance/daily?${dailyQuery}`, auth);
          if (active) {
            setDashboardRows(data.data || []);
            setDepartments(data.departments || []);
          }
        } else if (activePage === 'daily' || activePage === 'records') {
          params.set('date', date);
          params.set('department', department);
          params.set('status', status);
          params.set('search', search);
          if (activePage === 'records') params.set('recordedOnly', 'true');
          const { data } = await axios.get(`/api/roster/attendance/daily?${params}`, auth);
          if (active) {
            setRows(data.data || []);
            setPagination(data.pagination);
            setDepartments(data.departments || []);
          }
        } else if (activePage === 'corrections') {
          params.set('status', correctionFilter);
          const { data } = await axios.get(`/api/roster/attendance/corrections?${params}`, auth);
          if (active) {
            setCorrections(data.data || []);
            setPagination(data.pagination);
          }
        } else if (activePage === 'history') {
          params.set('from', fromDate);
          params.set('to', toDate);
          params.set('department', department);
          params.set('status', status);
          params.set('search', search);
          if (staffId) params.set('staffId', staffId);
          const { data } = await axios.get(`/api/roster/attendance/history?${params}`, auth);
          if (active) {
            setRows(data.data || []);
            setPagination(data.pagination);
            setHistoryMinutes(data.summary?.totalWorkingMinutes || 0);
          }
        } else if (activePage === 'monthly-report') {
          const query = new URLSearchParams({ month, department });
          const { data } = await axios.get(`/api/roster/attendance/monthly-report?${query}`, auth);
          if (active) setReportRows(data.data || []);
        }
      } catch (fetchError) {
        if (active) setError(fetchError.response?.data?.message || 'Unable to load attendance data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [activePage, date, department, status, correctionFilter, search, fromDate, toDate, staffId, month, page, pageSize, refreshKey, token]);

  const openDetails = async (row) => {
    setDetails({ staff: row, attendance: [], totalWorkingMinutes: 0 });
    try {
      const { data } = await axios.get(
        `/api/roster/attendance/staff/${encodeURIComponent(row._id)}?from=${row.date}&to=${row.date}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setDetails(data.data);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Unable to load attendance details.');
    }
  };

  const startCorrection = (row = null) => {
    setCorrectionRecord(row);
    setCorrectionOpen(true);
    setNotice('');
    setError('');
  };

  const onCorrectionSubmitted = (message) => {
    setCorrectionOpen(false);
    setCorrectionRecord(null);
    setNotice(message);
    setRefreshKey((key) => key + 1);
  };

  const decideCorrection = async (correction, decision) => {
    if (decision === 'approved' && !window.confirm('Approve this correction and apply its corrected attendance times?')) return;
    const reason = decision === 'rejected'
      ? window.prompt('Enter a reason for rejecting this correction:', '')
      : '';
    if (decision === 'rejected' && !reason?.trim()) return;
    try {
      const { data } = await axios.patch(
        `/api/roster/attendance/corrections/${correction._id}`,
        { decision, reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNotice(data.message || `Correction ${decision}.`);
      setRefreshKey((key) => key + 1);
    } catch (decisionError) {
      setError(decisionError.response?.data?.message || 'Unable to process correction.');
    }
  };

  const exportDaily = async () => {
    try {
      const auth = { headers: { Authorization: `Bearer ${token}` } };
      const query = new URLSearchParams({
        date,
        department,
        status: activePage === 'dashboard' ? 'All' : status,
        search,
        page: '1',
        pageSize: '100',
        ...(activePage === 'records' ? { recordedOnly: 'true' } : {}),
      });
      const first = await axios.get(`/api/roster/attendance/daily?${query}`, auth);
      const allRows = [...(first.data.data || [])];
      const pages = first.data.pagination?.totalPages || 1;
      for (let current = 2; current <= pages; current += 1) {
        query.set('page', String(current));
        const { data } = await axios.get(`/api/roster/attendance/daily?${query}`, auth);
        allRows.push(...(data.data || []));
      }
      await downloadExcel(`staff-attendance-${date}.xlsx`, 'Daily Attendance', [
        'Staff ID', 'Staff Name', 'Department', 'Position', 'Shift', 'Check-In', 'Check-Out', 'Working Hours', 'Status',
      ], allRows.map((row) => [
        row.employeeId || row._id, row.name, row.department, row.roleLabel || row.role, row.rosterShift,
        row.timeIn, row.timeOut, formatDuration(row.workingMinutes), statusLabels[row.attendanceStatus] || row.attendanceStatus,
      ]));
    } catch (exportError) {
      setError(exportError.response?.data?.message || 'Unable to export attendance report.');
    }
  };

  const exportMonthlyPdf = async () => {
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const pdf = new jsPDF({ orientation: 'landscape' });
      pdf.setFontSize(16);
      pdf.text('Monthly Staff Attendance Report', 14, 16);
      pdf.setFontSize(10);
      pdf.text(`Month: ${month} | Department: ${department}`, 14, 23);
      autoTable(pdf, {
        startY: 29,
        head: [['Staff ID', 'Staff Name', 'Department', 'Working Days', 'Present', 'Absent', 'Late', 'Leave', 'Working Hours', 'Attendance %']],
        body: reportRows.map((row) => [
          row.employeeId || row.staffId,
          row.name,
          row.department || 'Unassigned',
          row.totalWorkingDays,
          row.presentDays,
          row.absentDays,
          row.lateDays,
          row.leaveDays,
          row.totalWorkingHours,
          `${row.attendancePercentage}%`,
        ]),
        styles: { fontSize: 8 },
      });
      pdf.save(`staff-attendance-${month}.pdf`);
    } catch (exportError) {
      setError(exportError.message || 'Unable to export the PDF report.');
    }
  };

  const exportMonthlyExcel = async () => {
    try {
      await downloadExcel(`staff-attendance-${month}.xlsx`, 'Monthly Report', [
        'Staff ID', 'Staff Name', 'Department', 'Position', 'Total Working Days', 'Present Days', 'Absent Days', 'Late Days', 'Leave Days', 'Total Working Hours', 'Attendance Percentage',
      ], reportRows.map((row) => [
        row.employeeId || row.staffId, row.name, row.department, row.position, row.totalWorkingDays,
        row.presentDays, row.absentDays, row.lateDays, row.leaveDays, row.totalWorkingHours, `${row.attendancePercentage}%`,
      ]));
    } catch (exportError) {
      setError(exportError.message || 'Unable to export the Excel report.');
    }
  };

  const exportHistory = () => downloadCsv(`staff-attendance-history-${fromDate}-${toDate}.csv`, [
    'Date', 'Staff ID', 'Staff Name', 'Department', 'Position', 'Shift', 'Check-In', 'Check-Out', 'Working Hours', 'Status',
  ], rows.map((row) => [
    row.date, row.employeeId || row._id, row.name, row.department, row.roleLabel || row.role, row.rosterShift,
    row.timeIn, row.timeOut, formatDuration(row.workingMinutes), statusLabels[row.attendanceStatus] || row.attendanceStatus,
  ]));

  const selectedTitle = 'Staff Attendance';
  const attendanceSubmenu = (
    <nav aria-label="Staff attendance pages" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {pageItems.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => selectAttendancePage(id)}
          aria-current={id === activePage ? 'page' : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${id === activePage ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
  const departmentOptions = useMemo(() => [...new Set([
    ...departments,
    ...rows.map((row) => row.department).filter(Boolean),
    ...staffDirectory.map((staff) => staff.department).filter(Boolean),
    ...(dashboard?.departments || []).map((item) => item.department),
  ])].sort(), [departments, rows, staffDirectory, dashboard]);
  const stats = dashboard?.summary || {};
  const chartSegments = [
    { name: 'Present', value: stats.present || 0, color: '#10b981' },
    { name: 'Absent', value: stats.absent || 0, color: '#ef4444' },
    { name: 'Late', value: stats.late || 0, color: '#f59e0b' },
    { name: 'On leave', value: stats.onLeave || 0, color: '#8b5cf6' },
    {
      name: 'Other / not recorded',
      value: Math.max(0, (stats.totalStaff || 0) - (stats.present || 0) - (stats.absent || 0) - (stats.late || 0) - (stats.onLeave || 0)),
      color: '#3b82f6',
    },
  ];
  const chartTotal = chartSegments.reduce((total, item) => total + item.value, 0);
  let chartStart = 0;
  const chartStyle = chartTotal
    ? `conic-gradient(${chartSegments.map((segment) => {
      const end = chartStart + (segment.value / chartTotal) * 100;
      const value = `${segment.color} ${chartStart}% ${end}%`;
      chartStart = end;
      return value;
    }).join(', ')})`
    : 'conic-gradient(#e2e8f0 0% 100%)';

  if (!token) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Sign in with Clinic Head access to view attendance.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <CalendarDays size={30} className="shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{selectedTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">Track and manage staff attendance records</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(activePage === 'daily' || activePage === 'records') && <button type="button" onClick={() => void exportDaily()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={15} /> Export Excel</button>}
          {activePage === 'corrections' && <button type="button" onClick={() => startCorrection()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><ShieldCheck size={15} /> Request correction</button>}
          {activePage === 'monthly-report' && <>
            <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><CalendarDays size={15} /> Generate Report</button>
            <button type="button" onClick={() => void exportMonthlyExcel()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={15} /> Export Excel</button>
            <button type="button" onClick={() => void exportMonthlyPdf()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={15} /> Export PDF</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Printer size={15} /> Print</button>
          </>}
        </div>
      </div>

      {notice && <div role="status" className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
      {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total Staff', stats.totalStaff || 0, Users, 'bg-blue-50 text-blue-700'],
          ['Present Today', stats.present || 0, Check, 'bg-emerald-50 text-emerald-700'],
          ['Absent Today', stats.absent || 0, X, 'bg-rose-50 text-rose-700'],
          ['Late Today', stats.late || 0, Clock3, 'bg-amber-50 text-amber-700'],
          ['On Leave Today', stats.onLeave || 0, CalendarDays, 'bg-violet-50 text-violet-700'],
        ].map(([label, count, Icon, tone]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{label}</span><span className={`rounded-xl p-2 ${tone}`}><Icon size={18} /></span></div><p className="mt-3 text-3xl font-bold text-slate-900">{count}</p></div>)}
      </div>
      {attendanceSubmenu}

      {activePage === 'dashboard' && (
        <div className="space-y-5">
          {loading && !dashboard ? <LoadingState /> : <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <CalendarDays size={17} className="text-blue-600" aria-hidden="true" />
                  Attendance · {formatDate(date)}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label="Search staff by name or ID" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by Name or ID…" className="min-w-40 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs xl:flex-none" />
                  <select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                    <option value="All">All Departments</option>
                    {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <input aria-label="Filter attendance date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                  <button type="button" onClick={() => void exportDaily()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Download size={14} /> Export Report</button>
                </div>
              </header>
              <div className="overflow-x-auto p-3">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-blue-50 text-[10px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Staff ID</th>
                      <th className="px-3 py-3">Staff Name</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3">Shift</th>
                      <th className="px-3 py-3">Check-In</th>
                      <th className="px-3 py-3">Check-Out</th>
                      <th className="px-3 py-3">Working Hours</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading
                      ? <tr><td colSpan="10" className="px-3 py-8 text-center text-slate-500">Loading attendance records…</td></tr>
                      : dashboardRows.map((row, index) => (
                        <tr key={row._id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                          <td className="px-3 py-3 font-medium text-slate-700">{row.employeeId || row._id}</td>
                          <td className="px-3 py-3 font-semibold text-slate-800">{row.name || 'Unnamed staff'}</td>
                          <td className="px-3 py-3 text-slate-600">{row.department || 'Unassigned'}</td>
                          <td className="px-3 py-3 capitalize text-slate-600">{String(row.rosterShift || '—').replace('-', ' ')}</td>
                          <td className="px-3 py-3 text-slate-600">{formatTime(row.timeIn || row.checkInTime)}</td>
                          <td className="px-3 py-3 text-slate-600">{formatTime(row.timeOut || row.checkOutTime)}</td>
                          <td className="px-3 py-3 text-slate-600">{formatAttendanceDuration(row)}</td>
                          <td className="px-3 py-3"><StatusBadge status={row.attendanceStatus} /></td>
                          <td className="px-3 py-3 text-right">
                            <button type="button" onClick={() => void openDetails(row)} className="rounded-lg bg-blue-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800">View</button>
                          </td>
                        </tr>
                      ))}
                    {!loading && dashboardRows.length === 0 && <tr><td colSpan="10" className="px-3 py-8 text-center text-slate-500">No staff attendance matches these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Attendance Summary" icon={BarChart3}>
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: chartStyle }}>
                    <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-bold text-slate-900">{stats.totalStaff || 0}</span><span className="text-[10px] text-slate-500">Staff</span></div>
                  </div>
                  <div className="grid w-full flex-1 grid-cols-1 gap-3">
                    {chartSegments.map((segment) => <div key={segment.name} className="flex items-center gap-2 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: segment.color }} />{segment.name}<strong className="ml-auto text-slate-900">{segment.value} ({chartTotal ? Math.round((segment.value / chartTotal) * 100) : 0}%)</strong></div>)}
                  </div>
                </div>
              </Panel>
              <Panel title="Quick Actions" icon={Clock3}>
                <div className="grid gap-2">
                  <Link to="/my-attendance" className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-semibold text-white hover:bg-blue-700"><Clock3 size={15} /> Check-In / Check-Out</Link>
                  <button type="button" onClick={() => selectAttendancePage('corrections')} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-xs font-semibold text-white hover:bg-violet-700"><ShieldCheck size={15} /> Attendance Correction</button>
                  <button type="button" onClick={() => selectAttendancePage('monthly-report')} className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 text-xs font-semibold text-white hover:bg-teal-700"><BarChart3 size={15} /> Monthly Report</button>
                </div>
              </Panel>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Department-wise Attendance" icon={Users}>
                <div className="space-y-4">
                  {(dashboard?.departments || []).map((item) => {
                    const attended = item.present + item.late;
                    const percent = item.total ? Math.round((attended / item.total) * 100) : 0;
                    return <div key={item.department}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-semibold text-slate-700">{item.department}</span><span className="shrink-0 text-slate-500">{attended}/{item.total} · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div></div>;
                  })}
                  {!dashboard?.departments?.length && <EmptyState>No department attendance to display.</EmptyState>}
                </div>
              </Panel>
              <Panel title="Recent Attendance Activities" icon={Clock3}>
                <div className="divide-y divide-slate-100">
                  {(dashboard?.recentActivities || []).map((activity, index) => <div key={`${activity.staffId}-${activity.recordedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-800">{activity.name}</p><p className="text-xs text-slate-500">{activity.department || 'Unassigned'} · {activity.timeIn ? `Checked in ${formatTime(activity.timeIn)}` : 'Attendance updated'}</p></div><div className="flex items-center gap-3"><StatusBadge status={activity.status} /><span className="text-[11px] text-slate-400">{formatDateTime(activity.recordedAt)}</span></div></div>)}
                  {!dashboard?.recentActivities?.length && <EmptyState>No attendance activity has been recorded yet.</EmptyState>}
                </div>
              </Panel>
            </div>
          </>}
        </div>
      )}

      {(activePage === 'daily' || activePage === 'records') && (
        <Panel title={activePage === 'records' ? 'Check-In / Check-Out Records' : 'Daily Attendance'} icon={CalendarDays}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">Date<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">Department<select value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="All">All departments</option>{departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="All">All statuses</option>{Object.entries(statusLabels).filter(([key]) => ['present', 'late', 'absent', 'on_leave', 'half_day', 'early_leave', 'unrecorded'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500 sm:col-span-2">Search staff<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Name, staff ID, department…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700" /></label>
          </div>
          {loading ? <LoadingState /> : <div className="overflow-hidden rounded-xl border border-slate-100"><AttendanceTable rows={rows} onView={openDetails} onCorrection={startCorrection} /><Pagination pagination={pagination} onChange={setPage} /></div>}
        </Panel>
      )}

      {activePage === 'corrections' && (
        <Panel title="Correction Requests" icon={ShieldCheck} action={<select aria-label="Correction status filter" value={correctionFilter} onChange={(event) => { setCorrectionFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"><option value="All">All requests</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>}>
          {loading ? <LoadingState /> : <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Previous times</th><th className="px-4 py-3">Proposed times</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Review</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {corrections.map((item) => <tr key={item._id}><td className="px-4 py-3"><div className="font-semibold text-slate-800">{item.staff?.name || 'Staff member'}</div><div className="text-[10px] text-slate-500">{item.staff?.department || 'Unassigned'}</div></td><td className="px-4 py-3">{formatDate(item.date)}</td><td className="px-4 py-3 text-slate-600">{formatTime(item.previousValues?.timeIn)} / {formatTime(item.previousValues?.timeOut)}</td><td className="px-4 py-3 font-semibold text-slate-700">{formatTime(item.proposedValues?.timeIn)} / {formatTime(item.proposedValues?.timeOut)}</td><td className="max-w-56 px-4 py-3 text-slate-600">{item.reason}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={async () => { try { const { data } = await axios.get(`/api/roster/attendance/corrections/${item._id}`, { headers: { Authorization: `Bearer ${token}` } }); setDetails({ staff: data.data.staff, attendance: [], totalWorkingMinutes: 0, correction: data.data.correction, audit: data.data.audit }); } catch (detailError) { setError(detailError.response?.data?.message || 'Unable to load correction audit.'); } }} title="View correction and audit" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>{item.status === 'pending' && <><button type="button" onClick={() => void decideCorrection(item, 'approved')} title="Approve correction" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Check size={15} /></button><button type="button" onClick={() => void decideCorrection(item, 'rejected')} title="Reject correction" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><X size={15} /></button></>}</div></td></tr>)}
                {!corrections.length && <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">No correction requests found.</td></tr>}
              </tbody>
            </table>
            <Pagination pagination={pagination} onChange={setPage} />
          </div>}
        </Panel>
      )}

      {activePage === 'history' && (
        <Panel title="Attendance History" icon={FileClock} action={<button type="button" onClick={exportHistory} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600"><Download size={14} /> Export CSV</button>}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">From<input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">To<input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">Staff member<select value={staffId} onChange={(event) => { setStaffId(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All staff</option>{staffDirectory.map((staff) => <option key={staff._id} value={staff._id}>{staff.name} · {staff.employeeId || staff.roleLabel || staff.role}</option>)}</select></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">Department<select value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="All">All departments</option>{departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="All">All statuses</option>{Object.entries(statusLabels).filter(([key]) => ['present', 'late', 'absent', 'on_leave', 'half_day', 'early_leave', 'unrecorded'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">Search staff<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Name or staff ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          </div>
          <p className="mb-3 text-xs font-semibold text-slate-600">Total working time in the selected results: {formatDuration(historyMinutes)}</p>
          {loading ? <LoadingState /> : <div className="overflow-hidden rounded-xl border border-slate-100"><AttendanceTable rows={rows} onView={openDetails} onCorrection={startCorrection} /><Pagination pagination={pagination} onChange={setPage} /></div>}
        </Panel>
      )}

      {activePage === 'monthly-report' && (
        <Panel title="Monthly Attendance Report" icon={FileText}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs font-semibold text-slate-600">Report month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">Department<select value={department} onChange={(event) => setDepartment(event.target.value)} className="block min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="All">All departments</option>{departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          {loading ? <LoadingState /> : <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Department / Position</th><th className="px-4 py-3">Working days</th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Leave</th><th className="px-4 py-3">Working hours</th><th className="px-4 py-3">Attendance</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {reportRows.map((row) => <tr key={row.staffId}><td className="px-4 py-3"><div className="font-semibold text-slate-800">{row.name}</div><div className="text-[10px] text-slate-500">{row.employeeId || row.staffId}</div></td><td className="px-4 py-3"><div>{row.department || 'Unassigned'}</div><div className="text-[10px] text-slate-500">{row.position}</div></td><td className="px-4 py-3">{row.totalWorkingDays}</td><td className="px-4 py-3 text-emerald-700">{row.presentDays}</td><td className="px-4 py-3 text-rose-700">{row.absentDays}</td><td className="px-4 py-3 text-amber-700">{row.lateDays}</td><td className="px-4 py-3 text-violet-700">{row.leaveDays}</td><td className="px-4 py-3">{row.totalWorkingHours} h</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, row.attendancePercentage)}%` }} /></div><span className="font-semibold">{row.attendancePercentage}%</span></div></td></tr>)}
                {!reportRows.length && <tr><td colSpan="9" className="px-4 py-10 text-center text-sm text-slate-500">No active staff records for this report period.</td></tr>}
              </tbody>
            </table>
          </div>}
        </Panel>
      )}

      {activePage === 'history' && !loading && rows.length === 0 && <EmptyState />}
      {correctionOpen && <CorrectionModal token={token} staff={staffDirectory} initialRecord={correctionRecord} onClose={() => setCorrectionOpen(false)} onSubmitted={onCorrectionSubmitted} />}
      {details?.correction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="audit-title"><section className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"><header className="flex items-center justify-between"><h2 id="audit-title" className="text-lg font-bold">Correction audit · {details.staff?.name || 'Staff member'}</h2><button type="button" onClick={() => setDetails(null)} aria-label="Close audit details"><X size={18} /></button></header><p className="mt-2 text-xs text-slate-500">{formatDate(details.correction.date)} · {details.correction.reason}</p><div className="mt-4 space-y-3">{(details.audit || []).map((entry) => <article key={entry._id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-2"><StatusBadge status={entry.action} /><span className="text-[11px] text-slate-500">{formatDateTime(entry.modificationDate)}</span></div><p className="mt-2 text-xs text-slate-700">Check-in: {formatTime(entry.previousValues?.timeIn)} → {formatTime(entry.newValues?.timeIn)} · Check-out: {formatTime(entry.previousValues?.timeOut)} → {formatTime(entry.newValues?.timeOut)}</p>      <p className="mt-1 text-xs text-slate-500">Modified by: {entry.modifiedBy?.name || entry.modifiedBy?.email || 'Clinic Head'} · Reason: {entry.reason}</p><p className="mt-1 text-[11px] text-slate-500">Status: {statusLabels[entry.previousValues?.status] || entry.previousValues?.status || '—'} → {statusLabels[entry.newValues?.status] || entry.newValues?.status || statusLabels[entry.newValues?.correctionStatus] || '—'}</p></article>)}</div></section></div>}
      {details && !details.correction && <DetailsModal details={details} onClose={() => setDetails(null)} />}
    </div>
  );
}

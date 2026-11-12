import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  LogIn,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const departments = [
  'All Departments',
  'Card / Registration Room',
  'Examination Room',
  'Emergency Room',
  'Injection and Dressing Room',
  'Treatment / Care Room',
  'Laboratory',
  'Dispensary',
  'Drug Store',
];

const statusTones = {
  present: 'bg-emerald-100 text-emerald-700',
  absent: 'bg-rose-100 text-rose-700',
  late: 'bg-amber-100 text-amber-700',
  on_leave: 'bg-violet-100 text-violet-700',
  unrecorded: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  returned: 'bg-violet-100 text-violet-700',
};

const formatTime = (value) => {
  if (!value) return '—';
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

const formatDate = (value) => {
  if (!value) return 'Today';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const percent = (value, total) => (total ? ((value / total) * 100).toFixed(1) : '0.0');

function Panel({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800">
          {Icon && <Icon size={17} className="shrink-0 text-blue-600" aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </h2>
        {action && <span className="shrink-0 text-xs font-semibold text-slate-400">{action}</span>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function EmptyRow({ colSpan, children }) {
  return <tr><td colSpan={colSpan} className="px-3 py-6 text-center text-xs text-slate-500">{children}</td></tr>;
}

export default function ClinicHeadAttendance() {
  const { token } = useAuth();
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveApprovalSummary, setLeaveApprovalSummary] = useState({ pending: 0, approved: 0, rejected: 0, returned: 0, total: 0 });
  const [earlyLeaveRecords, setEarlyLeaveRecords] = useState([]);
  const [correctionRecords, setCorrectionRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!token) {
        setLoading(false);
        setError('Please sign in to view attendance.');
        return;
      }

      try {
        setLoading(true);
        setError('');
        const department = selectedDept === 'All Departments' ? 'All' : selectedDept;
        const response = await axios.get(
          `/api/roster/attendance/today?department=${encodeURIComponent(department)}&role=All`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRecords(Array.isArray(response.data?.data) ? response.data.data : []);
        setHistory(Array.isArray(response.data?.history) ? response.data.history : []);
        setLeaveRequests(Array.isArray(response.data?.leaveRequests) ? response.data.leaveRequests : []);
        setLeaveApprovalSummary(response.data?.leaveApprovalSummary || { pending: 0, approved: 0, rejected: 0, returned: 0, total: 0 });
        setEarlyLeaveRecords(Array.isArray(response.data?.earlyLeaveRecords) ? response.data.earlyLeaveRecords : []);
        setCorrectionRecords(Array.isArray(response.data?.correctionRecords) ? response.data.correctionRecords : []);
        setDate(response.data?.date || '');
      } catch (fetchError) {
        console.error('Failed to load attendance:', fetchError);
        setError(fetchError.response?.data?.message || 'Unable to load attendance data.');
      } finally {
        setLoading(false);
      }
    };

    void fetchAttendance();
  }, [selectedDept, token]);

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, on_leave: 0, unrecorded: 0 };
    records.forEach((member) => {
      const status = member.attendanceStatus || 'unrecorded';
      counts[status in counts ? status : 'unrecorded'] += 1;
    });
    return { ...counts, total: records.length };
  }, [records]);

  const lateRecords = records.filter((member) => member.attendanceStatus === 'late');
  const absenceRecords = records.filter((member) => member.attendanceStatus === 'absent');
  const verified = summary.total - summary.unrecorded;

  const cards = [
    { label: 'Present', count: summary.present, percent: percent(summary.present, summary.total), tone: 'emerald', icon: Check },
    { label: 'Absent', count: summary.absent, percent: percent(summary.absent, summary.total), tone: 'rose', icon: X },
    { label: 'Late', count: summary.late, percent: percent(summary.late, summary.total), tone: 'amber', icon: Clock3 },
    { label: 'On Leave', count: summary.on_leave, percent: percent(summary.on_leave, summary.total), tone: 'violet', icon: LogIn },
    { label: 'Not Recorded', count: summary.unrecorded, percent: percent(summary.unrecorded, summary.total), tone: 'blue', icon: AlertTriangle },
  ];

  const reports = [
    { title: 'Daily attendance', subtitle: 'Summary for today', icon: FileText },
    { title: 'Department report', subtitle: 'Attendance by department', icon: Users },
    { title: 'Late arrivals', subtitle: 'Staff marked late today', icon: Clock3 },
    { title: 'Absence report', subtitle: 'Absences and notes', icon: X },
  ];

  return (
    <div className="min-h-full bg-slate-50 p-3 sm:p-4">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <Users size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Attendance Management</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Monitor and manage staff attendance across departments</p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="Filter by department">
              {departments.map((department) => (
                <button
                  key={department}
                  type="button"
                  aria-pressed={selectedDept === department}
                  onClick={() => setSelectedDept(department)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    selectedDept === department
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {department}
                </button>
              ))}
            </div>
            <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              <CalendarDays size={15} className="text-blue-600" aria-hidden="true" />
              <span>{formatDate(date)}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Current data" />
            </div>
          </div>
        </section>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)]">
          <Panel title="Today's Attendance" icon={Users}>
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading attendance records...</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {cards.map(({ label, count, percent: value, tone, icon: Icon }) => (
                  <article key={label} className={`min-w-0 rounded-xl border p-3 ${
                    tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' :
                    tone === 'rose' ? 'border-rose-200 bg-rose-50' :
                    tone === 'amber' ? 'border-amber-200 bg-amber-50' :
                    tone === 'violet' ? 'border-violet-200 bg-violet-50' :
                    'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                        tone === 'rose' ? 'bg-rose-100 text-rose-700' :
                        tone === 'amber' ? 'bg-amber-100 text-amber-700' :
                        tone === 'violet' ? 'bg-violet-100 text-violet-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">{value}%</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold leading-none text-slate-900">{count}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-700">{label}</p>
                    <p className="mt-1 text-[10px] text-slate-500">of {summary.total} staff</p>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Attendance Verification & Approval" icon={ShieldCheck}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">Recorded</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{verified}<span className="ml-1 text-sm font-medium text-slate-400">/ {summary.total}</span></p>
                <p className="mt-1 text-[11px] text-emerald-700">{percent(verified, summary.total)}% of staff</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent(verified, summary.total)}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">Leave approvals</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{leaveApprovalSummary.approved}<span className="ml-1 text-sm font-medium text-slate-400">/ {leaveApprovalSummary.total}</span></p>
                <p className="mt-1 text-[11px] text-blue-700">{leaveApprovalSummary.pending} pending review</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent(leaveApprovalSummary.approved, leaveApprovalSummary.total)}%` }} />
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="Attendance History" icon={CalendarDays} action="Recent days">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[430px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Date</th>
                    <th className="px-2 py-2 font-semibold">Present</th>
                    <th className="px-2 py-2 font-semibold">Absent</th>
                    <th className="px-2 py-2 font-semibold">Late</th>
                    <th className="px-2 py-2 font-semibold">Leave</th>
                    <th className="px-2 py-2 font-semibold">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {history.length ? history.map((entry) => (
                    <tr key={entry.date}>
                      <td className="px-2 py-3 font-semibold">{formatDate(entry.date)}</td>
                      <td className="px-2 py-3">{entry.present}</td>
                      <td className="px-2 py-3">{entry.absent}</td>
                      <td className="px-2 py-3">{entry.late}</td>
                      <td className="px-2 py-3">{entry.onLeave}</td>
                      <td className="px-2 py-3">{entry.recorded}</td>
                    </tr>
                  )) : <EmptyRow colSpan={6}>No attendance history available.</EmptyRow>}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Late and Early Leave" icon={Clock3} action={`${lateRecords.length + earlyLeaveRecords.length} records`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">Late arrivals</p>
                <div className="divide-y divide-slate-100">
                  {lateRecords.length ? lateRecords.slice(0, 5).map((member) => (
                    <div key={member._id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{member.name}</p>
                        <p className="truncate text-[10px] text-slate-500">{member.department || '—'}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold text-amber-700">{formatTime(member.timeIn || member.checkInTime)}</span>
                    </div>
                  )) : <p className="py-3 text-xs text-slate-500">None recorded.</p>}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Early check-outs</p>
                <div className="divide-y divide-slate-100">
                  {earlyLeaveRecords.length ? earlyLeaveRecords.slice(0, 5).map((member) => (
                    <div key={member.staffId} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{member.name}</p>
                        <p className="truncate text-[10px] text-slate-500">{member.department || '—'}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-700">{formatTime(member.time)}</span>
                    </div>
                  )) : <p className="py-3 text-xs text-slate-500">None recorded.</p>}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Absence Management" icon={X} action={`${absenceRecords.length} staff`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Staff</th>
                    <th className="px-2 py-2 font-semibold">Department</th>
                    <th className="px-2 py-2 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {absenceRecords.length ? absenceRecords.slice(0, 5).map((member) => (
                    <tr key={member._id}>
                      <td className="max-w-28 truncate px-2 py-2 font-medium">{member.name}</td>
                      <td className="max-w-28 truncate px-2 py-2">{member.department || '—'}</td>
                      <td className="max-w-24 truncate px-2 py-2">{member.attendanceNote || 'Unexcused'}</td>
                    </tr>
                  )) : <EmptyRow colSpan={3}>No absences recorded.</EmptyRow>}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="Leave Requests" icon={LogIn} action={`${leaveRequests.length} latest`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Staff</th>
                    <th className="px-2 py-2 font-semibold">Leave type</th>
                    <th className="px-2 py-2 font-semibold">Dates</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {leaveRequests.length ? leaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="max-w-28 truncate px-2 py-2 font-medium">{request.staffName}</td>
                      <td className="max-w-24 truncate px-2 py-2">{request.leaveType || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{formatDate(request.startDate)}{request.endDate && request.endDate !== request.startDate ? ` – ${formatDate(request.endDate)}` : ''}</td>
                      <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTones[request.status] || 'bg-slate-100 text-slate-600'}`}>{request.status}</span></td>
                    </tr>
                  )) : <EmptyRow colSpan={4}>No staff leave requests found.</EmptyRow>}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Attendance Needs Review" icon={AlertTriangle} action={`${correctionRecords.length} staff`}>
            <div className="divide-y divide-slate-100">
              {correctionRecords.length ? correctionRecords.slice(0, 5).map((member) => (
                <div key={member.staffId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{member.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{member.department || '—'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusTones.unrecorded}`}>Not recorded</span>
                </div>
              )) : <p className="py-5 text-center text-xs text-slate-500">All attendance is recorded.</p>}
            </div>
          </Panel>

          <Panel title="Attendance Reports" icon={FileText}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {reports.map(({ title, subtitle, icon: Icon }) => (
                <div key={title} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-800">{title}</p>
                    <p className="truncate text-[10px] text-slate-500">{subtitle}</p>
                  </div>
                  <ArrowRight size={13} className="ml-auto shrink-0 text-slate-400" aria-hidden="true" />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

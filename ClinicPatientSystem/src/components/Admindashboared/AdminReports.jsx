import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileDown,
  FilterX,
  LockKeyhole,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const initialReport = {
  overview: {},
  userAnalytics: {
    byRole: [],
    byDepartment: [],
    byStatus: [],
    registrationTrend: [],
    users: [],
    loginActivity: { available: false, message: '' },
  },
  audit: { totalCount: 0, rows: [], options: { users: [], roles: [], departments: [], actions: [], modules: [] } },
  masterData: [],
  security: {
    failedLoginAttempts: { available: false, message: '' },
    unauthorizedAccess: { available: false, message: '' },
    roleAndPermissionChanges: [],
    accountStatusChanges: [],
  },
};

const dateInputValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const DEFAULT_END_DATE = dateInputValue(new Date());
const DEFAULT_START_DATE = (() => {
  const date = new Date(`${DEFAULT_END_DATE}T12:00:00`);
  date.setDate(date.getDate() - 29);
  return dateInputValue(date);
})();
const defaultStart = () => {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return dateInputValue(date);
};
const defaultEnd = () => dateInputValue(new Date());
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};
const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function LineChart({ data }) {
  const width = 640;
  const height = 205;
  const left = 32;
  const right = 10;
  const top = 14;
  const bottom = 34;
  const max = Math.max(1, ...data.map(({ count }) => count));
  const points = data.map((item, index) => {
    const x = data.length <= 1
      ? (left + width - right) / 2
      : left + (index * (width - left - right)) / (data.length - 1);
    const y = top + ((height - top - bottom) * (1 - item.count / max));
    return { ...item, x, y };
  });
  const path = points.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  const areaPath = points.length
    ? `${path} L ${points.at(-1).x} ${height - bottom} L ${points[0].x} ${height - bottom} Z`
    : '';
  const labelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);

  if (!data.length) return <p className="py-10 text-center text-xs text-slate-500">No registrations in this date range.</p>;
  return (
    <div className="w-full overflow-hidden">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-600">
        <span className="h-2 w-2 rounded-full bg-teal-700" aria-hidden="true" />
        New user registrations
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily user registration trend" className="h-52 w-full overflow-visible">
        {[0, 1, 2, 3].map((step) => {
          const y = top + ((height - top - bottom) * step / 3);
          const value = Math.round(max * (1 - step / 3));
          return (
            <g key={step}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={step === 3 ? '0' : '3 4'} />
              <text x="0" y={y + 4} fontSize="10" fill="#64748b">{value}</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#registrationArea)" />
        <defs>
          <linearGradient id="registrationArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="3.2" fill="#0f766e" stroke="white" strokeWidth="1.5">
            <title>{`${point.date}: ${point.count} new users`}</title>
          </circle>
        ))}
        {points.filter((_, index) => labelIndexes.has(index)).map((point) => (
          <text key={`label-${point.date}`} x={point.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">{point.label}</text>
        ))}
      </svg>
    </div>
  );
}

function HorizontalBars({ items, selected, onSelect, color = '#0f766e' }) {
  if (!items.length) return <p className="py-8 text-center text-xs text-slate-500">No records are available for this filter.</p>;
  const visible = items.slice(0, 8);
  const max = Math.max(1, ...visible.map(({ count }) => count));
  return (
    <div className="space-y-3">
      {visible.map(({ label, count }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(label === selected ? '' : label)}
          aria-pressed={label === selected}
          title={`Filter by ${label}`}
          className="group grid w-full grid-cols-[minmax(75px,120px)_1fr_44px] items-center gap-2 text-left"
        >
          <span className={`truncate text-xs ${label === selected ? 'font-bold text-teal-800' : 'text-slate-600'}`}>{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${Math.max(count ? 3 : 0, (count / max) * 100)}%`, backgroundColor: color }} />
          </span>
          <span className="text-right text-xs font-semibold tabular-nums text-slate-700">{formatNumber(count)}</span>
        </button>
      ))}
      {items.length > visible.length && <p className="pt-1 text-[11px] text-slate-400">Showing top {visible.length} of {items.length}. Select a bar to filter.</p>}
    </div>
  );
}

function DonutChart({ items, onSelect }) {
  const colors = ['#0f766e', '#3b82f6', '#cbd5e1'];
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const circumference = 2 * Math.PI * 43;
  const segments = items.map((item, index) => ({
    ...item,
    offset: items.slice(0, index).reduce((sum, previous) => (
      sum + (total ? (previous.count / total) * circumference : 0)
    ), 0),
    length: total ? (item.count / total) * circumference : 0,
  }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" role="img" aria-label="User account status distribution" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="43" fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {segments.map((item, index) => (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="12"
                strokeDasharray={`${item.length} ${circumference - item.length}`}
                strokeDashoffset={-item.offset}
              >
                <title>{`${item.label}: ${item.count}`}</title>
              </circle>
          ))}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-xl text-slate-900">{formatNumber(total)}</strong>
          <span className="text-[10px] text-slate-500">Accounts</span>
        </span>
      </div>
      <div className="w-full space-y-2">
        {items.map((item, index) => (
          <button key={item.label} type="button" onClick={() => onSelect(item.label)} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left hover:bg-slate-50">
            <span className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              {item.label}
            </span>
            <span className="text-xs font-semibold text-slate-800">{formatNumber(item.count)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminReports() {
  const { token } = useAuth();
  const [report, setReport] = useState(initialReport);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [userId, setUserId] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [auditPage, setAuditPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    let active = true;
    const loadReports = async () => {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({
          startDate,
          endDate,
          role,
          department,
          userId,
          module: moduleFilter,
          action: actionFilter,
          search,
        });
        const response = await fetch(`/api/admin/dashboard/reports?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result.data) {
          throw new Error(result?.message || `Unable to load reports (${response.status}).`);
        }
        if (active) setReport({ ...initialReport, ...result.data, generatedAt: result.generatedAt });
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load System Admin reports.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReports();
    return () => { active = false; };
  }, [token, startDate, endDate, role, department, userId, moduleFilter, actionFilter, search, refreshKey]);

  const auditRows = useMemo(() => {
    const rows = [...(report.audit.rows || [])];
    rows.sort((a, b) => {
      const left = sortField === 'date' ? new Date(a.date).getTime() : String(a[sortField] || '').toLocaleLowerCase();
      const right = sortField === 'date' ? new Date(b.date).getTime() : String(b[sortField] || '').toLocaleLowerCase();
      const result = left < right ? -1 : left > right ? 1 : 0;
      return sortDirection === 'asc' ? result : -result;
    });
    return rows;
  }, [report.audit.rows, sortField, sortDirection]);

  const filteredUsers = useMemo(() => (
    (report.userAnalytics.users || []).filter((user) => (
      (!userStatus || user.status === userStatus)
      && (!search || `${user.name} ${user.username} ${user.role} ${user.department}`.toLowerCase().includes(search.toLowerCase()))
    ))
  ), [report.userAnalytics.users, userStatus, search]);

  const auditPageCount = Math.max(1, Math.ceil(auditRows.length / pageSize));
  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentAuditPage = Math.min(auditPage, auditPageCount);
  const currentUserPage = Math.min(userPage, userPageCount);
  const pageAuditRows = auditRows.slice((currentAuditPage - 1) * pageSize, currentAuditPage * pageSize);
  const pageUsers = filteredUsers.slice((currentUserPage - 1) * pageSize, currentUserPage * pageSize);
  const generatedAt = report.generatedAt ? formatDate(report.generatedAt) : 'Not generated yet';

  const resetFilters = () => {
    setStartDate(defaultStart());
    setEndDate(defaultEnd());
    setRole('');
    setDepartment('');
    setUserId('');
    setModuleFilter('');
    setActionFilter('');
    setSearch('');
    setUserStatus('');
    setAuditPage(1);
    setUserPage(1);
  };

  const toggleSort = (field) => {
    setSortDirection((current) => (sortField === field && current === 'asc' ? 'desc' : 'asc'));
    setSortField(field);
  };
  const sortIcon = (field) => sortField !== field
    ? <ArrowUpDown size={13} className="text-slate-400" aria-hidden="true" />
    : sortDirection === 'asc'
      ? <ArrowUp size={13} aria-hidden="true" />
      : <ArrowDown size={13} aria-hidden="true" />;

  const exportCsv = () => {
    const rows = [
      ['System Admin Reports & Analytics'],
      ['Generated at', generatedAt],
      ['Report date range', startDate || 'Any', endDate || 'Any'],
      ['Applied filters', filterSummary || 'None'],
      ['Export limit', 'Up to 1,000 user accounts and 1,000 audit rows are loaded by this report.'],
      [],
      ['System Overview'],
      ['Metric', 'Value'],
      ['Total Users', report.overview.totalUsers ?? 0],
      ['Active Users', report.overview.activeUsers ?? 0],
      ['Inactive Users', report.overview.inactiveUsers ?? 0],
      ['Registered Patients', report.overview.registeredPatients ?? 0],
      ['Clinic Visits in Date Range', report.overview.clinicVisits ?? 0],
      ['Total Departments', report.overview.totalDepartments ?? 0],
      [],
      ['User Registrations by Day'],
      ['Date', 'New users'],
      ...(report.userAnalytics.registrationTrend || []).map(({ date, count }) => [date, count]),
      [],
      ['Users by Role'],
      ['Role', 'Users'],
      ...(report.userAnalytics.byRole || []).map(({ label, count }) => [label, count]),
      [],
      ['Users by Department'],
      ['Department', 'Users'],
      ...(report.userAnalytics.byDepartment || []).map(({ label, count }) => [label, count]),
      [],
      ['User Accounts'],
      ['Name', 'Username', 'Role', 'Department', 'Status', 'Registered', 'Last login snapshot'],
      ...filteredUsers.map(({ name, username, role: userRole, department: userDepartment, status, createdAt, lastLogin }) => [
        name, username, userRole, userDepartment, status, formatDate(createdAt), formatDate(lastLogin),
      ]),
      [],
      ['Master Data Summary'],
      ['Category', 'Total', 'Active', 'Inactive'],
      ...(report.masterData || []).map(({ label, total, active, inactive }) => [label, total, active, inactive]),
      [],
      ['System Activity & Audit'],
      ['User', 'Action', 'Module', 'Affected record / details', 'Date & time', 'Action status'],
      ...auditRows.map(({ user, action, module, record, date, status }) => [user, action, module, record, formatDate(date), status || 'Not recorded']),
      [],
      ['Recorded Security Events'],
      ['Category', 'User', 'Action', 'Details', 'Date & time'],
      ...(report.security.roleAndPermissionChanges || []).map((event) => ['Role / permission change', event.user, event.action, event.details, formatDate(event.date)]),
      ...(report.security.accountStatusChanges || []).map((event) => ['Account status change', event.user, event.action, event.details, formatDate(event.date)]),
      [],
      ['Security Event Coverage'],
      ['Event', 'Coverage', 'Count / explanation'],
      ['Failed logins', report.security.failedLoginAttempts.available ? 'Recorded events' : 'Unavailable', report.security.failedLoginAttempts.available ? report.security.failedLoginAttempts.events : report.security.failedLoginAttempts.message],
      ['Unauthorized access', report.security.unauthorizedAccess.available ? 'Recorded events' : 'Unavailable', report.security.unauthorizedAccess.available ? report.security.unauthorizedAccess.events : report.security.unauthorizedAccess.message],
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mau-system-admin-reports-${endDate || 'all-dates'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => window.print();

  const setRoleFilter = (value) => {
    setRole(value === 'Unassigned' ? '__unassigned__' : value);
    setAuditPage(1);
    setUserPage(1);
  };
  const setDepartmentFilter = (value) => {
    setDepartment(value === 'Unassigned' ? '__unassigned__' : value);
    setAuditPage(1);
    setUserPage(1);
  };
  const selectedRoleLabel = role === '__unassigned__' ? 'Unassigned' : role;
  const selectedDepartmentLabel = department === '__unassigned__' ? 'Unassigned' : department;
  const selectedAuditUser = report.audit.options.users.find((item) => item._id === userId);
  const filterSummary = [
    `Dates: ${startDate || 'Any'} to ${endDate || 'Any'}`,
    role && `Role: ${selectedRoleLabel}`,
    department && `Department: ${selectedDepartmentLabel}`,
    userId && `Audit user: ${selectedAuditUser?.name || 'Selected user'}`,
    moduleFilter && `Module: ${moduleFilter}`,
    actionFilter && `Action: ${actionFilter}`,
    search && `Search: ${search}`,
    userStatus && `Account status: ${userStatus}`,
  ].filter(Boolean).join(' · ');

  const overviewCards = [
    { label: 'Total Users', value: report.overview.totalUsers, icon: UsersRound, accent: 'bg-blue-50 text-blue-700' },
    { label: 'Active Users', value: report.overview.activeUsers, icon: CheckCircle2, accent: 'bg-teal-50 text-teal-700' },
    { label: 'Inactive Users', value: report.overview.inactiveUsers, icon: LockKeyhole, accent: 'bg-slate-100 text-slate-600' },
    { label: 'Registered Patients', value: report.overview.registeredPatients, icon: Activity, accent: 'bg-cyan-50 text-cyan-700' },
    { label: 'Clinic Visits', value: report.overview.clinicVisits, icon: CalendarDays, accent: 'bg-indigo-50 text-indigo-700' },
    { label: 'Departments', value: report.overview.totalDepartments, icon: BarChart3, accent: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
              <Link to="/admin" className="font-medium hover:text-teal-700">System Admin</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span className="text-teal-700">Reports &amp; Analytics</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports &amp; Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">Monitor system usage, user accounts, administrative activity, and master data.</p>
            <p className="mt-1 text-[11px] text-slate-400">Generated {generatedAt}</p>
            <p className="mt-1 hidden text-[11px] text-slate-600 print:block">Applied filters: {filterSummary || 'None'}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link to="/admin" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Back to Dashboard</Link>
            <button type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh Data</button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700"><Search size={15} className="text-teal-700" />Report filters</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="text-[11px] font-medium text-slate-500">From
              <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setAuditPage(1); setUserPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
            <label className="text-[11px] font-medium text-slate-500">To
              <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setAuditPage(1); setUserPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
            <label className="text-[11px] font-medium text-slate-500">Role
              <select value={role} onChange={(event) => { setRole(event.target.value); setAuditPage(1); setUserPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All roles</option>
                {report.audit.options.roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Department
              <select value={department} onChange={(event) => { setDepartment(event.target.value === 'Unassigned' ? '__unassigned__' : event.target.value); setAuditPage(1); setUserPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All departments</option>
                {report.audit.options.departments.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Audit user
              <select value={userId} onChange={(event) => { setUserId(event.target.value); setAuditPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All users</option>
                {report.audit.options.users.map((item) => <option key={item._id} value={item._id}>{item.name}{item.username ? ` (${item.username})` : ''}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Module
              <select value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setAuditPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All modules</option>
                {report.audit.options.modules.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Action
              <select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setAuditPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All actions</option>
                {report.audit.options.actions.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Search
              <span className="relative mt-1 block">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setAuditPage(1); setUserPage(1); }} placeholder="Users or audit details" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-2 text-xs text-slate-700 focus:border-teal-600 focus:outline-none" />
              </span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700"><FilterX size={14} />Reset Filters</button>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportCsv} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={14} />Export CSV</button>
              <button type="button" onClick={exportPdf} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FileDown size={14} />Export PDF</button>
              <button type="button" onClick={exportPdf} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Printer size={14} />Print Report</button>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 print:hidden">
            <span>{error}</span>
            <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="font-semibold underline">Retry</button>
          </div>
        )}

        <section aria-label="System overview" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {overviewCards.map(({ label, value, icon: Icon, accent }) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium leading-4 text-slate-500">{label}</span>
                <span className={`rounded-lg p-2 ${accent}`}><Icon size={16} aria-hidden="true" /></span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{loading ? '—' : formatNumber(value)}</p>
            </article>
          ))}
        </section>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />Loading reports from the clinic database…</span>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Report charts and tables are unavailable until the server request succeeds.
          </div>
        )}
        {!loading && !error && (
          <>
            <section className="grid gap-4 xl:grid-cols-3">
              <Panel title="User Registration Trend" subtitle={`New accounts by day · ${startDate || 'earliest'} to ${endDate || 'today'}`} className="xl:col-span-2">
                <LineChart data={report.userAnalytics.registrationTrend || []} />
              </Panel>
              <Panel title="Account Status" subtitle="Select a status to filter the user table">
                <DonutChart items={report.userAnalytics.byStatus || []} onSelect={(value) => { setUserStatus(value === userStatus ? '' : value); setUserPage(1); }} />
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Panel title="Users by Role" subtitle="Select a bar to filter reports by role">
                <HorizontalBars items={report.userAnalytics.byRole || []} selected={selectedRoleLabel} onSelect={setRoleFilter} />
              </Panel>
              <Panel title="Users by Department" subtitle="Select a bar to filter reports by department">
                <HorizontalBars items={report.userAnalytics.byDepartment || []} selected={selectedDepartmentLabel} onSelect={setDepartmentFilter} color="#2563eb" />
              </Panel>
            </section>

            <Panel title="User Accounts" subtitle={`${formatNumber(filteredUsers.length)} loaded matching accounts (up to 1,000 fetched) · Names and account metadata only; credentials are never included`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Registered</th><th className="px-3 py-3">Last login snapshot</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageUsers.length ? pageUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3"><span className="font-semibold text-slate-800">{user.name}</span><span className="mt-0.5 block text-slate-400">{user.username || '—'}</span></td>
                        <td className="px-3 py-3 text-slate-600">{user.role}</td>
                        <td className="px-3 py-3 text-slate-600">{user.department}</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : user.status === 'Inactive' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{user.status}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(user.lastLogin)}</td>
                      </tr>
                    )) : <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No user accounts match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length > pageSize && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Page {currentUserPage} of {userPageCount}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={currentUserPage <= 1} onClick={() => setUserPage(currentUserPage - 1)} className="rounded border px-2 py-1 disabled:opacity-40"><ChevronLeft size={14} /></button>
                    <button type="button" disabled={currentUserPage >= userPageCount} onClick={() => setUserPage(currentUserPage + 1)} className="rounded border px-2 py-1 disabled:opacity-40"><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="System Activity & Audit" subtitle={`${formatNumber(report.audit.totalCount ?? auditRows.length)} matching recorded events · ${formatNumber(auditRows.length)} loaded (up to 1,000) · Event status is not stored in the current audit schema`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      {[
                        ['user', 'User'],
                        ['action', 'Action'],
                        ['module', 'Module'],
                        ['record', 'Affected module / record'],
                        ['date', 'Date & time'],
                      ].map(([field, label]) => (
                        <th key={field} className="px-3 py-3">
                          <button type="button" onClick={() => toggleSort(field)} className="inline-flex items-center gap-1 hover:text-teal-700">{label}{sortIcon(field)}</button>
                        </th>
                      ))}
                      <th className="px-3 py-3">Action status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageAuditRows.length ? pageAuditRows.map((entry) => (
                      <tr key={entry.id} className="align-top hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-800">{entry.user}</td>
                        <td className="px-3 py-3"><span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-800">{entry.action.replaceAll('_', ' ')}</span></td>
                        <td className="px-3 py-3 capitalize text-slate-600">{entry.module.replaceAll('_', ' ')}</td>
                        <td className="max-w-md px-3 py-3 text-slate-600">{entry.record}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(entry.date)}</td>
                        <td className="px-3 py-3 text-slate-400">Not recorded</td>
                      </tr>
                    )) : <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No audit activity matches the selected filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              {auditRows.length > pageSize && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Page {currentAuditPage} of {auditPageCount}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={currentAuditPage <= 1} onClick={() => setAuditPage(currentAuditPage - 1)} className="rounded border px-2 py-1 disabled:opacity-40"><ChevronLeft size={14} /></button>
                    <button type="button" disabled={currentAuditPage >= auditPageCount} onClick={() => setAuditPage(currentAuditPage + 1)} className="rounded border px-2 py-1 disabled:opacity-40"><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Master Data Summary" subtitle="Counts and status from current department and master-data collections">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Category</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Active</th><th className="px-3 py-3">Inactive</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(report.masterData || []).map((item) => (
                      <tr key={item.category}><td className="px-3 py-3 font-medium text-slate-700">{item.label}</td><td className="px-3 py-3 tabular-nums text-slate-700">{formatNumber(item.total)}</td><td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{formatNumber(item.active)}</span></td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">{formatNumber(item.inactive)}</span></td></tr>
                    ))}
                    {!report.masterData?.length && <tr><td colSpan="4" className="px-3 py-8 text-center text-slate-500">No master data is available.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>

            <section className="grid gap-4 xl:grid-cols-2">
              <Panel title="Security & Access Events" subtitle="Only events actually present in the current audit log are listed">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-900"><ShieldAlert size={16} />Failed login history</div>
                    <p className="mt-2 text-xs leading-5 text-amber-900/80">{report.security.failedLoginAttempts.message}</p>
                    <p className="mt-3 text-xs text-amber-900">Current account counters: <strong>{formatNumber(report.security.failedLoginAttempts.currentAccountCounters)}</strong> · Locked accounts: <strong>{formatNumber(report.security.failedLoginAttempts.lockedAccounts)}</strong></p>
                    {report.security.failedLoginAttempts.available && <p className="mt-1 text-xs font-semibold text-amber-900">Recorded failed-login events: {formatNumber(report.security.failedLoginAttempts.events)}</p>}
                    <p className="mt-1 text-[10px] text-amber-800">Counters and lockout values are current snapshots, not historical totals.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><LockKeyhole size={16} />Unauthorized access history</div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{report.security.unauthorizedAccess.message}</p>
                    {report.security.unauthorizedAccess.available && <p className="mt-2 text-xs font-semibold text-slate-800">Recorded events: {formatNumber(report.security.unauthorizedAccess.events)}</p>}
                  </div>
                </div>
              </Panel>
              <Panel title="Recorded Account & Permission Changes" subtitle="Events from existing User Management and Roles & Permissions audit records">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Role / permission changes', report.security.roleAndPermissionChanges],
                    ['Account status changes', report.security.accountStatusChanges],
                  ].map(([title, events]) => (
                    <div key={title}>
                      <h3 className="mb-2 text-xs font-semibold text-slate-700">{title}</h3>
                      {events.length ? (
                        <ul className="max-h-44 space-y-2 overflow-y-auto">
                          {events.slice(0, 20).map((event) => <li key={event.id} className="rounded-md border border-slate-100 px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-700">{event.action.replaceAll('_', ' ')}</p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{event.details}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{event.user} · {formatDate(event.date)}</p>
                          </li>)}
                        </ul>
                      ) : <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-500">No matching recorded events.</p>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-800">
                  <CircleAlert size={14} className="mt-0.5 shrink-0" />
                  Successful login history is unavailable: the user model stores only the most recent login timestamp. Unauthorized access attempts and failed-login event history require dedicated backend security event logging.
                </div>
              </Panel>
            </section>

            {!report.userAnalytics.loginActivity.available && (
              <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
                {report.userAnalytics.loginActivity.message}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FilterX,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCog,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const initialData = {
  summary: { totalEvents: 0, securityEvents: 0, userChanges: 0, dataChanges: 0 },
  events: [],
  pagination: { page: 1, limit: 25, total: 0, pages: 0 },
  options: { users: [], roles: [], modules: [], actions: [] },
};

const dateInputValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const defaultEnd = dateInputValue(new Date());
const startDateDefault = (() => {
  const date = new Date(`${defaultEnd}T12:00:00`);
  date.setDate(date.getDate() - 29);
  return dateInputValue(date);
})();
const formatTimestamp = (value) => {
  if (!value) return '—';
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? '—' : timestamp.toLocaleString();
};
const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

const summaryCards = [
  { key: 'totalEvents', label: 'Total Audit Events', icon: ClipboardList, color: 'bg-blue-50 text-blue-700' },
  { key: 'securityEvents', label: 'Security Events', icon: ShieldCheck, color: 'bg-amber-50 text-amber-700' },
  { key: 'userChanges', label: 'User Changes', icon: UserRoundCog, color: 'bg-teal-50 text-teal-700' },
  { key: 'dataChanges', label: 'Data Changes', icon: LockKeyhole, color: 'bg-indigo-50 text-indigo-700' },
];

export default function AdminAuditLogs() {
  const { token, user } = useAuth();
  const hasAdminRole = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .filter(Boolean)
    .some((value) => value.toLowerCase() === 'admin');
  const [data, setData] = useState(initialData);
  const [startDate, setStartDate] = useState(startDateDefault);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [result, setResult] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      if (!hasAdminRole || !token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({
          startDate,
          endDate,
          search,
          userId,
          role,
          module,
          action,
          result,
          page: String(page),
          limit: '25',
          sortBy,
          sortDirection,
        });
        const response = await fetch(`/api/admin/dashboard/audit-logs?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.message || `Unable to load audit logs (${response.status}).`);
        }
        if (active) setData({ ...initialData, ...payload.data });
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load audit logs.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadEvents();
    return () => { active = false; };
  }, [token, hasAdminRole, startDate, endDate, search, userId, role, module, action, result, page, sortBy, sortDirection, refreshKey]);

  const resetFilters = () => {
    setStartDate(startDateDefault);
    setEndDate(defaultEnd);
    setSearch('');
    setSearchTerm('');
    setUserId('');
    setRole('');
    setModule('');
    setAction('');
    setResult('');
    setPage(1);
  };
  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const toggleSort = (field) => {
    if (sortBy === field) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortDirection(field === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };
  const sortIcon = (field) => sortBy !== field
    ? <ArrowUpDown size={13} className="text-slate-400" aria-hidden="true" />
    : sortDirection === 'asc'
      ? <ArrowUp size={13} aria-hidden="true" />
      : <ArrowDown size={13} aria-hidden="true" />;

  const exportCsv = () => {
    const rows = [
      ['MAU Clinic System Admin Audit Log'],
      ['Exported at', new Date().toLocaleString()],
      ['Date range', `${startDate || 'Any'} to ${endDate || 'Any'}`],
      ['Filters', [
        search && `Search: ${search}`,
        userId && `Actor: ${data.options.users.find((user) => user.id === userId)?.name || 'Selected user'}`,
        role && `Role: ${role}`,
        module && `Module: ${module}`,
        action && `Action: ${action}`,
        result && `Result: ${result}`,
      ].filter(Boolean).join(' · ') || 'None'],
      ['Export scope', `Current page (${data.events.length} events of ${data.pagination.total} matching events)`],
      [],
      ['Timestamp', 'Actor / User', 'Role', 'Action', 'Affected module', 'Record reference', 'Details', 'Result', 'IP address'],
      ...data.events.map((event) => [
        formatTimestamp(event.timestamp),
        event.actor,
        event.role,
        event.action,
        event.module,
        event.recordReference,
        event.details,
        event.result,
        event.ipAddress,
      ]),
    ];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mau-audit-log-${endDate || 'all-dates'}-page-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const pageCount = Math.max(1, data.pagination.pages || 1);
  const firstRow = data.pagination.total ? ((page - 1) * data.pagination.limit) + 1 : 0;
  const lastRow = Math.min(page * data.pagination.limit, data.pagination.total);

  if (!hasAdminRole || !token) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
              <Link to="/admin" className="font-medium hover:text-teal-700">System Admin</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span className="text-teal-700">Audit Logs</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Logs</h1>
            <p className="mt-1 text-sm text-slate-500">Review recorded authentication, access-control, user, and reference-data events.</p>
            <p className="mt-1 text-[11px] text-slate-400">Audit records are append-only from this interface; event details never include submitted passwords.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Back to Dashboard</Link>
            <button type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh
            </button>
          </div>
        </header>

        <section aria-label="Audit event summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map(({ key, label, icon: Icon, color }) => (
            <article key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <span className={`rounded-lg p-2 ${color}`}><Icon size={16} aria-hidden="true" /></span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{loading || error ? '—' : new Intl.NumberFormat().format(data.summary[key] || 0)}</p>
              <p className="mt-1 text-[10px] text-slate-400">Based on the selected filters</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Search size={15} className="text-teal-700" />Search and filter audit events
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="text-[11px] font-medium text-slate-500">From
              <input type="date" value={startDate} max={endDate || undefined} onChange={updateFilter(setStartDate)} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
            <label className="text-[11px] font-medium text-slate-500">To
              <input type="date" value={endDate} min={startDate || undefined} onChange={updateFilter(setEndDate)} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
            <label className="text-[11px] font-medium text-slate-500">Actor / user
              <select value={userId} onChange={updateFilter(setUserId)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All actors</option>
                {data.options.users.map((user) => <option key={user.id || user.name} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Role
              <select value={role} onChange={updateFilter(setRole)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All roles</option>
                {data.options.roles.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Module
              <select value={module} onChange={updateFilter(setModule)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All modules</option>
                {data.options.modules.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Action
              <select value={action} onChange={updateFilter(setAction)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All actions</option>
                {data.options.actions.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Result
              <select value={result} onChange={updateFilter(setResult)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700">
                <option value="">All results</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Search
              <span className="relative mt-1 block">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" aria-hidden="true" />
                <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Actor, record, IP…" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-2 text-xs text-slate-700 focus:border-teal-600 focus:outline-none" />
              </span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700"><FilterX size={14} />Reset filters</button>
            <button type="button" onClick={exportCsv} disabled={loading || !data.events.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Download size={14} />Export current page CSV
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="font-semibold underline">Retry</button>
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recorded Events</h2>
              <p className="mt-1 text-xs text-slate-500">{loading ? 'Loading events…' : `${new Intl.NumberFormat().format(data.pagination.total)} matching events`}</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} />Sorted by {sortBy === 'createdAt' ? 'timestamp' : sortBy} ({sortDirection})</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    ['createdAt', 'Timestamp'],
                    ['userName', 'Actor / user'],
                    ['userRole', 'Role'],
                    ['action', 'Action'],
                    ['entityType', 'Affected module'],
                  ].map(([field, label]) => (
                    <th key={field} className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort(field)} className="inline-flex items-center gap-1 hover:text-teal-700">{label}{sortIcon(field)}</button>
                    </th>
                  ))}
                  <th className="px-3 py-3">Affected record</th>
                  <th className="px-3 py-3">Result</th>
                  <th className="px-3 py-3">IP address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />Loading audit events…</span></td></tr>
                ) : data.events.length ? data.events.map((event) => (
                  <tr key={event.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatTimestamp(event.timestamp)}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{event.actor}{event.details && <span className="mt-1 block max-w-xs font-normal text-slate-400">{event.details}</span>}</td>
                    <td className="px-3 py-3 text-slate-600">{event.role}</td>
                    <td className="px-3 py-3"><span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-800">{event.action.replaceAll('_', ' ')}</span></td>
                    <td className="px-3 py-3 capitalize text-slate-600">{event.module.replaceAll('_', ' ')}</td>
                    <td className="px-3 py-3 font-mono text-[10px] text-slate-500">{event.recordReference}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${event.result === 'failure' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{event.result === 'failure' ? 'Failure' : 'Success'}</span></td>
                    <td className="px-3 py-3 font-mono text-slate-500">{event.ipAddress}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-500">{error ? 'Audit events are unavailable until the server request succeeds.' : 'No audit events match the selected filters.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            <span>{firstRow}–{lastRow} of {new Intl.NumberFormat().format(data.pagination.total)} events</span>
            <div className="flex items-center gap-3">
              <span>Page {Math.min(page, pageCount)} of {pageCount}</span>
              <button type="button" aria-label="Previous page" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-slate-300 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
              <button type="button" aria-label="Next page" disabled={loading || page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded border border-slate-300 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={15} /></button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

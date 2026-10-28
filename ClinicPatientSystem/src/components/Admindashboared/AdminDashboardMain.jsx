import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const initialDashboardData = {
  summary: { totalUsers: 0, activeUsers: 0, totalDepartments: 0, securityAlerts: 0, securityAlertPeriodDays: 30 },
  departments: [],
  userRoleStats: [],
  recentActivities: [],
};
const initialHealth = {
  api: { status: 'loading' },
  database: { status: 'loading' },
  application: { status: 'loading' },
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const initialsFor = (name) => (name || 'Admin')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0].toUpperCase())
  .join('');

function Panel({ title, description, icon: Icon, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-2.5">
          {Icon && <span className="mt-0.5 rounded-lg bg-teal-50 p-2 text-teal-700"><Icon size={16} aria-hidden="true" /></span>}
          <div>
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StatusIndicator({ status }) {
  const labels = {
    connected: 'Connected',
    available: 'Operational',
    unavailable: 'Unavailable',
    loading: 'Checking',
    error: 'Check failed',
  };
  const color = status === 'connected' || status === 'available'
    ? 'bg-emerald-500'
    : status === 'loading'
      ? 'bg-amber-400'
      : 'bg-rose-500';
  const textColor = status === 'connected' || status === 'available'
    ? 'text-emerald-700'
    : status === 'loading'
      ? 'text-amber-700'
      : 'text-rose-700';
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${textColor}`}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {labels[status] || 'Unknown'}
    </span>
  );
}

export default function AdminDashboardMain() {
  const { token, user } = useAuth();
  const isAdmin = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .some((role) => typeof role === 'string' && role.toLowerCase() === 'admin');
  const [dashboard, setDashboard] = useState(initialDashboardData);
  const [health, setHealth] = useState(initialHealth);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState('');
  const [healthError, setHealthError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    if (!token) {
      setError('Sign in with a System Admin account to load dashboard data.');
      setHealthError('System health is available only to authorized administrators.');
      setLoading(false);
      setHealthLoading(false);
      return;
    }

    setLoading(true);
    setHealthLoading(true);
    setError('');
    setHealthError('');
    const headers = { Authorization: `Bearer ${token}` };
    const [dashboardResult, healthResult] = await Promise.allSettled([
      fetch('/api/admin/dashboard/overview', { headers }),
      fetch('/api/admin/dashboard/system-settings/health', { headers }),
    ]);

    if (dashboardResult.status === 'fulfilled') {
      try {
        const response = dashboardResult.value;
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.message || `Dashboard request failed (${response.status}).`);
        }
        setDashboard({
          ...initialDashboardData,
          ...payload.data,
          summary: { ...initialDashboardData.summary, ...payload.data.summary },
          departments: Array.isArray(payload.data.departments) ? payload.data.departments : [],
          userRoleStats: Array.isArray(payload.data.userRoleStats) ? payload.data.userRoleStats : [],
          recentActivities: Array.isArray(payload.data.recentActivities) ? payload.data.recentActivities : [],
        });
      } catch (loadError) {
        setError(loadError.message || 'Unable to load dashboard data.');
      }
    } else {
      setError(dashboardResult.reason?.message || 'Unable to connect to the dashboard API.');
    }
    setLoading(false);

    if (healthResult.status === 'fulfilled') {
      try {
        const response = healthResult.value;
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.message || `System health request failed (${response.status}).`);
        }
        setHealth(payload.data);
      } catch (loadError) {
        setHealth(initialHealth);
        setHealthError(loadError.message || 'Unable to check system status.');
      }
    } else {
      setHealth(initialHealth);
      setHealthError(healthResult.reason?.message || 'Unable to check system status.');
    }
    setHealthLoading(false);
  }, [token]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await loadData();
    };
    void run();
    return () => { active = false; };
  }, [loadData, refreshKey]);

  const [currentDate] = useState(() => new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date()));

  const maxRoleCount = Math.max(1, ...dashboard.userRoleStats.map((item) => item.total || 0));
  const summaryCards = [
    { label: 'Total Users', value: dashboard.summary.totalUsers, icon: UsersRound, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Active Users', value: dashboard.summary.activeUsers, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total Departments', value: dashboard.summary.totalDepartments, icon: Building2, tone: 'bg-teal-50 text-teal-700' },
    { label: 'Security Alerts · 30 days', value: dashboard.summary.securityAlerts, icon: ShieldAlert, tone: 'bg-amber-50 text-amber-700' },
  ];

  if (!token || !isAdmin) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-xs text-slate-500">System Admin / Dashboard</div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back, System Administrator</h1>
            <p className="mt-1 text-sm text-slate-500">{currentDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/notifications" aria-label="Notifications" title="Notifications" className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 hover:text-teal-700">
              <Bell size={17} aria-hidden="true" />
            </Link>
            <Link to="/admin/profile" aria-label="Administrator profile" title={user?.name || 'Administrator profile'} className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
              {initialsFor(user?.name)}
            </Link>
            <button type="button" disabled={loading || healthLoading} onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={14} className={loading || healthLoading ? 'animate-spin' : ''} aria-hidden="true" />Refresh
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="font-semibold underline underline-offset-2">Retry</button>
          </div>
        )}

        <section aria-label="System summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon, tone }) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <span className={`rounded-lg p-2 ${tone}`}><Icon size={16} aria-hidden="true" /></span>
              </div>
              {loading ? <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100" /> : error ? (
                <p className="mt-3 text-sm font-medium text-slate-400">Unavailable</p>
              ) : (
                <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{new Intl.NumberFormat().format(value || 0)}</p>
              )}
            </article>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Panel title="System Status" description="Live checks from the authenticated backend." icon={Activity}>
            {healthError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{healthError}</p>}
            <div className="divide-y divide-slate-100">
              {[
                ['Backend / API', health.api?.status || (healthError ? 'error' : 'loading')],
                ['Database', health.database?.status || (healthError ? 'error' : 'loading')],
                ['Application', health.application?.status || (healthError ? 'error' : 'loading')],
              ].map(([label, status]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  {healthLoading ? <span className="h-5 w-24 animate-pulse rounded bg-slate-100" /> : <StatusIndicator status={status} />}
                </div>
              ))}
            </div>
            {!healthLoading && health.application?.version && health.application.version !== 'unknown' && (
              <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">Application version {health.application.version}</p>
            )}
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
              <Database size={14} className="mt-0.5 shrink-0" />
              Backup status is not shown because backup and restore are not implemented.
            </p>
          </Panel>

          <Panel
            title="User Statistics"
            description="Active and inactive accounts grouped by role."
            icon={UsersRound}
            action={<Link to="/admin/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">Detailed reports<ChevronRight size={14} /></Link>}
          >
            {loading ? (
              <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-slate-100" />)}</div>
            ) : error ? (
              <p className="py-6 text-center text-sm text-slate-500">Statistics are unavailable until the dashboard data loads.</p>
            ) : dashboard.userRoleStats.length ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-600" />Active</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />Inactive</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />On Leave</span>
                </div>
                <div className="space-y-3">
                  {dashboard.userRoleStats.map((item) => (
                    <div key={item.role} className="grid grid-cols-[minmax(90px,130px)_minmax(0,1fr)_36px] items-center gap-3">
                      <span className="truncate text-xs font-medium text-slate-700" title={item.role}>{item.role === 'Admin' ? 'System Admin' : item.role}</span>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${item.role}: ${item.active} active, ${item.inactive} inactive, ${item.onLeave} on leave`}>
                        <span className="bg-teal-600" style={{ width: `${(item.active / maxRoleCount) * 100}%` }} />
                        <span className="bg-slate-300" style={{ width: `${(item.inactive / maxRoleCount) * 100}%` }} />
                        <span className="bg-amber-400" style={{ width: `${(item.onLeave / maxRoleCount) * 100}%` }} />
                      </div>
                      <span className="text-right text-xs font-semibold tabular-nums text-slate-600">{item.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="py-6 text-center text-sm text-slate-500">No user records are available.</p>}
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Panel
            title="Recent Admin Activity"
            description="Latest events recorded in the system audit log."
            icon={FileText}
            action={<Link to="/admin/audit-logs" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">View audit log<ChevronRight size={14} /></Link>}
          >
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-slate-100" />)}</div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-slate-500">Activity is unavailable until dashboard data loads.</p>
            ) : dashboard.recentActivities.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Action / actor</th>
                      <th className="px-3 py-2.5">Module</th>
                      <th className="px-3 py-2.5">Result</th>
                      <th className="px-3 py-2.5">Date &amp; time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboard.recentActivities.map((event) => (
                      <tr key={event.id} className="align-top hover:bg-slate-50">
                        <td className="max-w-[240px] px-3 py-3">
                          <span className="block font-semibold text-slate-800">{(event.action || 'Activity recorded').replaceAll('_', ' ')}</span>
                          <span className="mt-1 block truncate text-slate-500">{event.actor} · {event.role}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{event.module}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${event.result === 'failure' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{event.result}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(event.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-8 text-center text-sm text-slate-500">No audit activity has been recorded yet.</p>}
          </Panel>

          <Panel title="Department Overview" description="Departments and active assigned staff from current records." icon={Building2}>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-slate-100" />)}</div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-slate-500">Department information is unavailable.</p>
            ) : dashboard.departments.length ? (
              <div className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto">
                {dashboard.departments.map((department) => (
                  <div key={department.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{department.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{department.code || 'No code'} · {department.activeStaffCount} active staff</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${department.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{department.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-sm text-slate-500">No departments are configured.</p>}
          </Panel>
        </div>

        <Panel title="Quick Actions" description="Go directly to existing administrative tools." icon={ArrowRight}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Add New User', detail: 'Open user management', to: '/admin/users', icon: UserPlus },
              { label: 'View All Users', detail: 'Search and manage accounts', to: '/admin/users', icon: UsersRound },
              { label: 'View Audit Logs', detail: 'Review recorded activity', to: '/admin/audit-logs', icon: FileText },
              { label: 'Manage Master Data', detail: 'Maintain shared reference data', to: '/admin/master-data', icon: Database },
            ].map(({ label, detail, to, icon: Icon }) => (
              <Link key={label} to={to} className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5 transition hover:border-teal-300 hover:bg-teal-50/50">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="rounded-lg bg-slate-100 p-2 text-slate-600 group-hover:bg-white group-hover:text-teal-700"><Icon size={16} aria-hidden="true" /></span>
                  <span className="min-w-0"><span className="block text-xs font-semibold text-slate-800">{label}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{detail}</span></span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-slate-400 group-hover:text-teal-700" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </Panel>

        {dashboard.summary.securityAlerts > 0 && !loading && !error && (
          <Link to="/admin/audit-logs" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100/70">
            <span className="flex items-center gap-2"><AlertTriangle size={16} />{dashboard.summary.securityAlerts} security event(s) recorded in the last {dashboard.summary.securityAlertPeriodDays} days.</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">Review<ChevronRight size={14} /></span>
          </Link>
        )}
      </div>
    </main>
  );
}

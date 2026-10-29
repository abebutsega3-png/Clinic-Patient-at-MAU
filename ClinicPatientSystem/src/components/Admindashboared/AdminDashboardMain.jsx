import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
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
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

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

export default function AdminDashboardMain() {
  const { token, user } = useAuth();
  const isAdmin = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .some((role) => typeof role === 'string' && role.toLowerCase() === 'admin');
  const [dashboard, setDashboard] = useState(initialDashboardData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    if (!token) {
      setError('Sign in with a System Admin account to load dashboard data.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const headers = { Authorization: `Bearer ${token}` };
    const [dashboardResult] = await Promise.allSettled([
      fetch('/api/admin/dashboard/overview', { headers }),
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()));

  const activeStaffCount = dashboard.userRoleStats
    .filter((item) => item.role !== 'Admin')
    .reduce((total, item) => total + item.active, 0);
  const activeDepartmentCount = dashboard.departments
    .filter((department) => department.status === 'Active').length;
  const summaryCards = [
    { label: 'Total Users', value: dashboard.summary.totalUsers, detail: 'All registered accounts', icon: UsersRound, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Active Users', value: dashboard.summary.activeUsers, detail: 'Currently active accounts', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Inactive Users', value: dashboard.summary.totalUsers - dashboard.summary.activeUsers, detail: 'Inactive accounts', icon: UsersRound, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Active Staff', value: activeStaffCount, detail: 'Active non-admin accounts', icon: UserPlus, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Total Departments', value: dashboard.summary.totalDepartments, detail: 'Configured departments', icon: Building2, tone: 'bg-cyan-50 text-cyan-700' },
    { label: 'Active Departments', value: activeDepartmentCount, detail: 'Currently operational', icon: Building2, tone: 'bg-teal-50 text-teal-700' },
    { label: 'Security Alerts · 30 days', value: dashboard.summary.securityAlerts, detail: 'Events requiring review', icon: ShieldAlert, tone: 'bg-rose-50 text-rose-700' },
    { label: 'User Roles', value: dashboard.userRoleStats.length, detail: 'Roles with registered users', icon: ShieldAlert, tone: 'bg-indigo-50 text-indigo-700' },
  ];

  if (!token || !isAdmin) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">System Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {currentDate}
            </span>
            <button type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="font-semibold underline underline-offset-2">Retry</button>
          </div>
        )}

        <section aria-label="System summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, detail, icon: Icon, tone }) => (
            <article key={label} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <span className={`rounded-lg p-2 ${tone}`}><Icon size={16} aria-hidden="true" /></span>
              </div>
              {loading ? <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100" /> : error ? (
                <p className="mt-3 text-sm font-medium text-slate-400">Unavailable</p>
              ) : (
                <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{new Intl.NumberFormat().format(value || 0)}</p>
              )}
              <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
            </article>
          ))}
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
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
                <div className="divide-y divide-slate-100">
                  {dashboard.userRoleStats.map((item) => (
                    <div key={item.role} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <UsersRound size={15} className="shrink-0 text-teal-600" aria-hidden="true" />
                        <span className="truncate text-xs font-medium text-slate-700" title={item.role}>{item.role === 'Admin' ? 'System Admins' : item.role}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                        {item.total}
                        <span className="ml-2 font-normal text-emerald-600">{item.active} active</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="py-6 text-center text-sm text-slate-500">No user records are available.</p>}
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

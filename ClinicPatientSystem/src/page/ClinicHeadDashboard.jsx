import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  Clock3,
  Lightbulb,
  Pill,
  RefreshCw,
  Siren,
  Users
} from 'lucide-react';
import { useAuth } from '../components/context/AuthContext.jsx';
import { fetchMyNotifications, markNotificationRead } from '../utile/clinicheadapprovalApi.jsx';

const getErrorMessage = async (response) => {
  const result = await response.json().catch(() => ({}));
  return `${response.status}: ${result.message || 'Request failed.'}`;
};

const formatTimeAgo = (date, now) => {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 'Time unavailable';
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  return `${Math.floor(elapsedHours / 24)} day ago`;
};

const ClinicHeadDashboard = () => {
  const { token, user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyCertificateId, setBusyCertificateId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const clinicHeadName = profileName || user?.name || user?.username || '';

  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        const result = await response.json();
        if (!result.success || !result.data) throw new Error(result.message || 'Unable to load account name.');
        if (active) {
          const name = result.data.name || result.data.username || '';
          setProfileName(name);
          updateUser(result.data);
          setProfileError('');
        }
      } catch (loadError) {
        console.error('Failed to load Clinic Head name:', loadError);
        if (active) setProfileError('Unable to load your account name.');
      }
    };

    void loadProfile();
    return () => { active = false; };
  }, [token, updateUser]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/dashboard/clinic-head', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Unable to load dashboard data.');
        if (active) {
          setDashboard(result);
          setError('');
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to connect to the server.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    return () => { active = false; };
  }, [token, refreshKey]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchMyNotifications(token)
      .then((result) => {
        if (active) {
          const now = Date.now();
          setNotifications(Array.isArray(result.data)
            ? result.data.slice(0, 5).map((notification) => ({
              ...notification,
              timeAgo: formatTimeAgo(notification.createdAt, now)
            }))
            : []);
          setNotificationsError('');
        }
      })
      .catch((notificationLoadError) => {
        console.error('Failed to load dashboard notifications:', notificationLoadError);
        if (active) setNotificationsError(notificationLoadError.response?.data?.message || 'Unable to load notifications.');
      });
    return () => { active = false; };
  }, [token, refreshKey]);

  const viewNotification = async (notification) => {
    if (!notification.synthetic && !notification.readAt) {
      try {
        await markNotificationRead(notification._id, token);
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
        )));
      } catch (readError) {
        console.error('Failed to mark dashboard notification as read:', readError);
        setNotificationsError(readError.response?.data?.message || 'Unable to mark this notification as read.');
      }
    }
    const targetPath = notification.targetPath;
    if (typeof targetPath === 'string' && targetPath.startsWith('/clinic-head/')) {
      navigate(targetPath);
      return;
    }
    if (notification.request) navigate('/clinic-head/approvals');
    else if (/inventory|stock|expiry/i.test(`${notification.title} ${notification.message}`)) navigate('/clinic-head/inventory');
    else if (/staff|attendance|no-show|late/i.test(`${notification.title} ${notification.message}`)) navigate('/clinic-head/staff');
    else navigate('/clinic-head/reports');
  };

  const handleApproval = async (request, status) => {
    setBusyCertificateId(request._id);
    setError('');
    try {
      const response = await fetch(`/api/dashboard/approve-cert/${request._id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, recordType: request.recordType })
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      setRefreshKey((current) => current + 1);
    } catch (approvalError) {
      setError(approvalError.message || 'Unable to update this approval.');
    } finally {
      setBusyCertificateId('');
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Sign in required</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with a Clinic Head account to load dashboard data.</p>
        <Link to="/login" className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
      </div>
    );
  }

  if (loading && !dashboard) return <div className="p-8 text-center text-slate-500">Loading clinic dashboard...</div>;

  if (!dashboard) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Dashboard data unavailable</h1>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            if (/401|403|token/i.test(error)) {
              logout();
              navigate('/login');
            } else {
              setRefreshKey((current) => current + 1);
            }
          }}
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {/401|403|token/i.test(error) ? 'Sign in again' : 'Retry'}
        </button>
      </div>
    );
  }

  const { metrics = {}, monthWeekFlow = [], previousMonthWeekFlow = [], departmentPatientFlow = [], pendingApprovalsList = [] } = dashboard;
  const { lowStock = [], nearExpiry = [], nearExpiryCount = nearExpiry.length, lateStaff = [], outbreakNotice, diagnosisRecords = 0 } = dashboard.alerts || {};
  const attendance = metrics.attendanceSummary || {};
  const attendanceTotal = (attendance.present || 0) + (attendance.late || 0) + (attendance.absent || 0);
  const totalDepartmentVisits = departmentPatientFlow.reduce((total, { count }) => total + count, 0);
  const maxMonthWeekFlow = Math.max(1, ...monthWeekFlow.map(({ count }) => count), ...previousMonthWeekFlow.map(({ count }) => count));
  const getMonthWeekPoints = (weeks = []) => weeks.map(({ count }, index) => {
    const x = weeks.length > 1 ? 14 + (index * 80) / (weeks.length - 1) : 54;
    const y = 88 - ((count / maxMonthWeekFlow) * 66);
    return `${x},${y}`;
  }).join(' ');
  const monthWeekPoints = getMonthWeekPoints(monthWeekFlow);
  const previousMonthWeekPoints = getMonthWeekPoints(previousMonthWeekFlow);
  let departmentSliceEnd = 0;
  const departmentSlices = departmentPatientFlow.map(({ count }, index) => {
    const start = departmentSliceEnd;
    departmentSliceEnd += totalDepartmentVisits ? (count / totalDepartmentVisits) * 100 : 0;
    return `${['#1677f2', '#ef4444', '#16a34a', '#f59e0b', '#8b5cf6'][index % 5]} ${start}% ${departmentSliceEnd}%`;
  });
  const purchaseRequests = pendingApprovalsList.filter((request) => (
    request.recordType === 'approval' && request.type === 'Purchase Request'
  ));
  const dashboardNotifications = [
    ...(!notifications.some(({ title, message }) => /expiry|expir/i.test(`${title} ${message}`))
      ? nearExpiry.slice(0, 1).map((item) => ({
        _id: `expiry-${item._id}`,
        synthetic: true,
        title: item.expired ? 'Medicine Expired' : 'Medicine Near Expiry',
        message: `${item.itemName} ${item.expired ? 'has expired' : 'will expire soon'}.`,
        targetPath: '/clinic-head/inventory',
        timeAgo: 'Action needed'
      }))
      : []),
    ...(!notifications.some(({ title, message }) => /low.stock|stock.alert/i.test(`${title} ${message}`))
      ? lowStock.slice(0, 1).map((item) => ({
        _id: `stock-${item._id}`,
        synthetic: true,
        title: 'Low Stock Alert',
        message: `${item.itemName} is below its reorder level (${item.quantity} ${item.unit || 'items'} remaining).`,
        targetPath: '/clinic-head/inventory',
        timeAgo: 'Action needed'
      }))
      : []),
    ...(!notifications.some(({ title, message }) => /staff.*late|late.*staff/i.test(`${title} ${message}`)) && attendance.late
      ? [{
        _id: 'staff-late-summary',
        synthetic: true,
        title: 'Staff Late',
        message: `${lateStaff[0]?.name || `${attendance.late} staff member${attendance.late === 1 ? '' : 's'}`} ${lateStaff[0]?.name ? `(${lateStaff[0].role || 'staff'}) is` : 'recorded'} late today.`,
        targetPath: '/clinic-head/staff',
        timeAgo: 'Today'
      }]
      : []),
    ...notifications
  ].slice(0, 3);
  const staffOnDutyLabel = `${metrics.staffOnDuty || '0/0'}`;
  const lateStaffCount = attendance.late || 0;
  const trendLabel = metrics.monthlyVisitChange == null
    ? 'Monthly trend unavailable'
    : `${metrics.monthlyVisitChange >= 0 ? '+' : ''}${metrics.monthlyVisitChange}% vs last month`;
  const summaryCards = [
    { title: "Today's Patients", value: metrics.todayTotalPatients ?? 0, caption: trendLabel, icon: Users, color: 'from-blue-700 to-blue-500' },
    { title: 'Pending Approvals', value: metrics.pendingApprovalsCount ?? 0, caption: `${metrics.pendingPurchaseApprovalCount ?? purchaseRequests.length} purchase requests`, icon: Clock3, color: 'from-green-700 to-green-500' },
    { title: 'Low Stock Items', value: metrics.criticalStockItems ?? lowStock.length, caption: `${nearExpiryCount} near expiry / expired`, icon: Pill, color: 'from-amber-600 to-orange-500' },
    { title: 'Staff On Duty / Late', value: `${staffOnDutyLabel} / ${lateStaffCount}`, caption: attendanceTotal ? `${attendance.present || 0} present · ${attendance.absent || 0} absent` : 'Attendance not recorded', icon: Users, color: 'from-violet-700 to-violet-500' }
  ];
  const insightMessage = outbreakNotice
    ? `${outbreakNotice.diagnosis} cases increased ${outbreakNotice.increasePercent}% over the previous week. Review staffing and supplies.`
    : lowStock.length
      ? `${lowStock.length} inventory item${lowStock.length === 1 ? '' : 's'} ${lowStock.length === 1 ? 'is' : 'are'} at or below reorder level. Review replenishment needs.`
      : nearExpiryCount
        ? `${nearExpiryCount} inventory item${nearExpiryCount === 1 ? ' is' : 's are'} expired or nearing expiry. Review them before further use.`
        : metrics.monthlyVisitChange > 0
          ? `Patient visits are up ${metrics.monthlyVisitChange}% compared with last month. Consider staffing for peak clinic hours.`
          : lateStaffCount
            ? `${lateStaffCount} staff member${lateStaffCount === 1 ? '' : 's'} recorded late today. Review attendance and shift coverage.`
            : diagnosisRecords
              ? 'No significant diagnosis increase or low-stock alerts are currently recorded.'
              : 'Insights will appear as clinic visits and inventory activity are recorded.';

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-6">
      <header className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center text-blue-700">
              <BarChart3 size={30} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight text-blue-900 sm:text-xl">Clinic Head Dashboard</h1>
              <p className="mt-0.5 text-xs text-blue-800">Monitor clinic operations and take informed decisions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900 shadow-sm">
              <CalendarDays size={15} className="text-blue-700" />
              <span>This Month</span>
              <ChevronDown size={14} className="text-blue-700" />
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-50"
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {profileError && <p role="status" className="text-xs text-amber-700">{profileError}</p>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}

      <section aria-label="Today's clinic metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ title, value, caption, icon: Icon, color }) => (
          <article key={title} className={`group relative isolate flex min-h-20 items-center gap-3 overflow-hidden rounded-lg bg-gradient-to-r ${color} px-4 py-3 text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
            <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
              <Icon size={25} />
            </div>
            <div className="relative z-10 min-w-0">
              <p className="text-[11px] font-semibold text-white/90">{title}</p>
              <p className="mt-0.5 text-2xl font-extrabold leading-tight tracking-tight text-white">{value}</p>
              <p className="mt-0.5 truncate text-[10px] text-white/85">{caption}</p>
            </div>
            <div className="pointer-events-none absolute -bottom-8 -right-5 h-20 w-20 rounded-full bg-white/10 transition-transform group-hover:scale-125" />
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-4">
          <header className="flex items-center justify-between bg-gradient-to-r from-blue-800 to-blue-700 px-5 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <BarChart3 size={19} />
              <div><h2 className="text-sm font-bold">Patient Flow Trend</h2><p className="mt-0.5 text-[11px] text-blue-100">Monthly visits by week</p></div>
            </div>
            <Link to="/clinic-head/reports" className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/10 sm:inline-flex">Details <ArrowRight size={14} /></Link>
          </header>
          <div className="p-4">
            {monthWeekFlow.some(({ count }) => count > 0) || previousMonthWeekFlow.some(({ count }) => count > 0) ? (
              <>
                <div className="mb-1 flex justify-center gap-4 text-[10px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-blue-600" />This Month</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-slate-400" />Last Month</span>
                </div>
                <svg viewBox="0 0 100 100" role="img" aria-label="Patient visit trend compared with last month by week" className="h-36 w-full">
                  {[22, 44, 66, 88].map((y, index) => (
                    <g key={y}>
                      <line x1="13" x2="96" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.7" />
                      <text x="0" y={y + 1.5} fill="#64748b" fontSize="3.5">{Math.round((maxMonthWeekFlow * (3 - index)) / 3)}</text>
                    </g>
                  ))}
                  {previousMonthWeekPoints && <polyline points={previousMonthWeekPoints} fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" />}
                  <polyline points={monthWeekPoints} fill="none" stroke="#1677f2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  {previousMonthWeekFlow.map(({ week, count }, index) => {
                    const x = previousMonthWeekFlow.length > 1 ? 14 + (index * 80) / (previousMonthWeekFlow.length - 1) : 54;
                    const y = 88 - ((count / maxMonthWeekFlow) * 66);
                    return <circle key={`previous-${week}`} cx={x} cy={y} r="1.8" fill="#94a3b8"><title>{`Last month ${week}: ${count} visits`}</title></circle>;
                  })}
                  {monthWeekFlow.map(({ week, count }, index) => {
                    const x = monthWeekFlow.length > 1 ? 14 + (index * 80) / (monthWeekFlow.length - 1) : 54;
                    const y = 88 - ((count / maxMonthWeekFlow) * 66);
                    return (
                      <g key={week}>
                        <circle cx={x} cy={y} r="2.3" fill="#1677f2"><title>{`This month ${week}: ${count} visits`}</title></circle>
                        <text x={x} y={Math.max(15, y - 4)} textAnchor="middle" fill="#1e3a8a" fontSize="3.7" fontWeight="600">{count.toLocaleString()}</text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex justify-between px-1 text-[10px] font-medium text-slate-600">
                  {monthWeekFlow.map(({ week }) => <span key={week}>{week}</span>)}
                </div>
              </>
            ) : <p className="rounded-lg bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">No visits recorded this month.</p>}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-3">
          <header className="flex items-center gap-3 bg-gradient-to-r from-blue-800 to-blue-700 px-5 py-3.5 text-white">
            <Users size={19} />
            <div><h2 className="text-sm font-bold">Department Breakdown</h2><p className="mt-0.5 text-[11px] text-blue-100">Visits this month</p></div>
          </header>
          <div className="flex min-h-52 flex-col items-center justify-center gap-4 p-4 sm:flex-row">
            <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: totalDepartmentVisits ? `conic-gradient(${departmentSlices.join(', ')})` : '#e2e8f0' }}>
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-xl font-extrabold text-slate-800">{totalDepartmentVisits.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500">Total Visits</span>
              </div>
            </div>
            <ul className="w-full space-y-2 text-[11px]">
              {departmentPatientFlow.length ? departmentPatientFlow.slice(0, 5).map(({ department, count }, index) => (
                <li key={department} className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ['#1677f2', '#ef4444', '#16a34a', '#f59e0b', '#8b5cf6'][index % 5] }} /><span className="truncate">{department}</span></span>
                  <span className="font-semibold">{totalDepartmentVisits ? Math.round((count / totalDepartmentVisits) * 100) : 0}%</span>
                </li>
              )) : <li className="text-center text-slate-500">No department visits this month.</li>}
            </ul>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm xl:col-span-5">
          <header className="flex items-center justify-between bg-gradient-to-r from-rose-600 to-red-500 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2"><Bell size={18} /><div><h2 className="text-sm font-bold">Notifications & Action Center</h2><p className="text-[10px] text-rose-100">Important clinic alerts</p></div></div>
            <Link to="/clinic-head/approvals" className="inline-flex items-center gap-1 text-[11px] font-semibold text-white hover:underline">View All <ArrowRight size={13} /></Link>
          </header>
          <div className="divide-y divide-slate-100">
            {notificationsError && <p role="alert" className="px-4 py-2 text-[11px] text-rose-700">{notificationsError}</p>}
            {dashboardNotifications.length ? dashboardNotifications.map((notification) => (
              <div key={notification._id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${/expiry|expired|late/i.test(notification.title) ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}><AlertTriangle size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{notification.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">{notification.message}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <time className="text-[9px] text-slate-400">{notification.timeAgo || 'Just now'}</time>
                  <button type="button" onClick={() => void viewNotification(notification)} className="rounded-md border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">View</button>
                </div>
              </div>
            )) : (
              <p className="px-4 py-9 text-center text-xs text-slate-500">{notificationsError ? 'Notifications unavailable.' : 'No active notifications.'}</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <header className="flex items-center justify-between bg-gradient-to-r from-blue-950 to-blue-800 px-4 py-3 text-white">
            <div className="flex items-center gap-2"><Pill size={18} /><h2 className="text-sm font-bold">Quick Approvals – Purchase Requests</h2></div>
            <Link to="/clinic-head/approvals?type=purchase" className="inline-flex items-center gap-1 text-[11px] font-semibold text-white hover:underline">View All <ArrowRight size={13} /></Link>
          </header>
          {purchaseRequests.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-600"><tr>
                  <th className="px-3 py-2 font-semibold">Request</th><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Amount (ETB)</th><th className="px-3 py-2 font-semibold">Requested By</th><th className="px-3 py-2 text-right font-semibold">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseRequests.slice(0, 3).map((request) => (
                    <tr key={request._id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-semibold text-slate-700">{request.requestNumber || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700">{request.itemName || request.details}</td>
                      <td className="px-3 py-2.5 text-slate-700">{Number(request.amount || 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-slate-700">{request.applicant}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" disabled={busyCertificateId === request._id} onClick={() => void handleApproval(request, 'approved')} className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                          <button type="button" disabled={busyCertificateId === request._id} onClick={() => void handleApproval(request, 'rejected')} className="rounded-md bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-600 disabled:opacity-50">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="px-4 py-8 text-center text-xs text-slate-500">No pending purchase requests.</p>}
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-5">
          <header className="flex items-center gap-2 bg-gradient-to-r from-cyan-700 to-teal-600 px-4 py-3 text-white">
            <Activity size={18} /><h2 className="text-sm font-bold">Clinic Summary</h2>
          </header>
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: 'Total Visits', value: metrics.currentMonthVisits ?? 0, icon: Users },
              { label: 'Avg. Wait Time', value: metrics.averageWaitMinutes == null ? '—' : `${metrics.averageWaitMinutes} min`, icon: Clock3 },
              { label: 'In Treatment', value: metrics.patientsInTreatment ?? 0, icon: Activity },
              { label: 'Emergency', value: metrics.emergencyVisitCount ?? 0, icon: Siren }
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center px-2 py-4 text-center">
                <Icon size={20} className="mb-2 text-blue-600" />
                <p className="text-[10px] font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Lightbulb size={19} /></span>
          <div>
            <p className="text-xs font-bold text-blue-950">Smart Clinic Insight</p>
            <p className="mt-0.5 text-xs text-slate-700">{insightMessage}</p>
          </div>
        </div>
        <Link to="/clinic-head/reports" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-3.5 py-2 text-[11px] font-bold text-blue-800 shadow-sm transition hover:bg-blue-100">
          <BarChart3 size={15} /> View Detailed Report
        </Link>
      </section>

      <p className="text-right text-[10px] text-slate-400">Welcome, {clinicHeadName || 'Clinic Head'} · Data is based on recorded clinic activity.</p>
    </div>
  );
};

export default ClinicHeadDashboard;

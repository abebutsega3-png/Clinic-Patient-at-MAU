import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Megaphone,
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

const formatClinicDate = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Addis_Ababa',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
};

const getClinicDateKey = (date) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const ClinicHeadDashboard = () => {
  const { token, user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsError, setAnnouncementsError] = useState('');
  const [reportAnalytics, setReportAnalytics] = useState(null);
  const [clinicReports, setClinicReports] = useState([]);
  const [reportDataError, setReportDataError] = useState('');
  const [reportDataLoading, setReportDataLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const clinicHeadName = profileName || user?.name || user?.username || '';

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: 'Bearer ' + token }
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
    if (!token) return undefined;
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/dashboard/clinic-head', {
          headers: { Authorization: 'Bearer ' + token }
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
    if (!token) return undefined;
    let active = true;
    fetch('/api/announcements', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !Array.isArray(result.data)) {
          throw new Error(result?.message || `Unable to load announcements (${response.status}).`);
        }
        if (active) {
          setAnnouncements(result.data.slice(0, 3));
          setAnnouncementsError('');
        }
      })
      .catch((announcementError) => {
        console.error('Failed to load dashboard announcements:', announcementError);
        if (active) setAnnouncementsError(announcementError.message || 'Unable to load announcements.');
      });
    return () => { active = false; };
  }, [token, refreshKey]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const dateKey = getClinicDateKey(new Date());
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`/api/reports/analytics?startDate=${dateKey}&endDate=${dateKey}&department=All`, { headers }),
      fetch('/api/reports/clinic-head-reports', { headers })
    ])
      .then(async ([analyticsResponse, reportsResponse]) => {
        if (!analyticsResponse.ok) throw new Error(await getErrorMessage(analyticsResponse));
        if (!reportsResponse.ok) throw new Error(await getErrorMessage(reportsResponse));
        const [analyticsResult, reportsResult] = await Promise.all([
          analyticsResponse.json(),
          reportsResponse.json()
        ]);
        if (!analyticsResult.success) {
          throw new Error(analyticsResult.message || 'Unable to load clinic report metrics.');
        }
        if (!reportsResult.success || !Array.isArray(reportsResult.data)) {
          throw new Error(reportsResult.message || 'Unable to load Clinic Head reports.');
        }
        if (active) {
          setReportAnalytics(analyticsResult);
          setClinicReports(reportsResult.data);
          setReportDataError('');
        }
      })
      .catch((reportLoadError) => {
        console.error('Failed to load dashboard report metrics:', reportLoadError);
        if (active) setReportDataError(reportLoadError.message || 'Unable to load report metrics.');
      })
      .finally(() => {
        if (active) setReportDataLoading(false);
      });

    return () => { active = false; };
  }, [token, refreshKey]);

  useEffect(() => {
    if (!token) return undefined;
    const refreshDashboard = () => {
      setReportDataLoading(true);
      setReportDataError('');
      setRefreshKey((current) => current + 1);
    };
    const socket = io({ auth: { token } });
    socket.on('staff-attendance-updated', refreshDashboard);
    socket.on('clinic:announcement-updated', refreshDashboard);
    return () => {
      socket.off('staff-attendance-updated', refreshDashboard);
      socket.off('clinic:announcement-updated', refreshDashboard);
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    fetchMyNotifications(token)
      .then((result) => {
        if (!active) return;
        const now = Date.now();
        setNotifications(Array.isArray(result.data)
          ? result.data.slice(0, 5).map((notification) => ({
            ...notification,
            timeAgo: formatTimeAgo(notification.createdAt, now)
          }))
          : []);
        setNotificationsError('');
      })
      .catch((notificationLoadError) => {
        console.error('Failed to load dashboard notifications:', notificationLoadError);
        if (active) {
          setNotificationsError(notificationLoadError.response?.data?.message || 'Unable to load notifications.');
        }
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

  if (!token) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Sign in required</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with a Clinic Head account to load dashboard data.</p>
        <Link to="/login" className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
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
          className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
        >
          {/401|403|token/i.test(error) ? 'Sign in again' : 'Retry'}
        </button>
      </div>
    );
  }

  const { metrics = {}, patientFlow = [], visitStatusCounts = {}, departmentPatientFlow = [], recentActivity = [] } = dashboard;
  const { lowStock = [], nearExpiry = [], lateStaff = [] } = dashboard.alerts || {};
  const attendance = metrics.attendanceSummary || {};
  const attendanceTotal = (attendance.present || 0) + (attendance.late || 0) + (attendance.absent || 0);
  const activeAlerts = [
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
  const staffOnDutyLabel = metrics.staffOnDuty || '0/0';
  const flowStages = [
    { label: 'Registration', count: visitStatusCounts.Registered || 0, icon: FileText, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Waiting', count: (visitStatusCounts.Waiting || 0) + (visitStatusCounts.Called || 0), icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
    {
      label: 'In Service',
      count: ['In Service', 'Routed', 'Sent to Examination'].reduce((total, status) => total + (visitStatusCounts[status] || 0), 0),
      icon: Activity,
      tone: 'bg-cyan-50 text-cyan-700'
    },
    { label: 'Completed', count: visitStatusCounts.Completed || 0, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' }
  ];
  const queueStages = flowStages.slice(1);
  const reportSummary = reportAnalytics?.summary || {};
  const approvedDepartmentSummary = reportAnalytics?.approvedDepartmentSummary || {};
  const currentInventory = reportAnalytics?.currentInventory || {};
  const referralSummary = reportAnalytics?.referrals || {};
  const departmentRows = reportAnalytics?.departmentPerformance || [];
  const incidentReports = reportAnalytics?.incidentReports || [];
  const completionRate = approvedDepartmentSummary.patientsServed > 0
    && approvedDepartmentSummary.completedServices != null
    ? Math.round((approvedDepartmentSummary.completedServices / approvedDepartmentSummary.patientsServed) * 100)
    : null;
  const actionPlans = clinicReports.flatMap((report) => (report.actionPlans || [])
    .filter((plan) => !['completed', 'closed'].includes(plan.status))
    .map((plan) => ({ ...plan, reportTitle: report.title })))
    .sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate));
  const attendancePresent = attendance.present || 0;
  const attendanceLate = attendance.late || 0;
  const attendanceAbsent = attendance.absent || 0;
  const presentAngle = attendanceTotal ? (attendancePresent / attendanceTotal) * 360 : 0;
  const lateAngle = attendanceTotal ? (attendanceLate / attendanceTotal) * 360 : 0;
  const attendanceRingStyle = {
    background: attendanceTotal
      ? `conic-gradient(#10b981 0deg ${presentAngle}deg, #f59e0b ${presentAngle}deg ${presentAngle + lateAngle}deg, #f43f5e ${presentAngle + lateAngle}deg 360deg)`
      : '#e2e8f0'
  };
  const chartHeight = 160;
  const chartPadding = 20;
  const maxDailyVisits = Math.max(1, ...patientFlow.map(({ count }) => count));
  const patientFlowPoints = patientFlow.map(({ day, count }, index) => ({
    day,
    count,
    x: patientFlow.length === 1 ? 320 : chartPadding + (index * (640 - chartPadding * 2)) / (patientFlow.length - 1),
    y: chartHeight - chartPadding - ((count / maxDailyVisits) * (chartHeight - chartPadding * 2))
  }));
  const patientFlowLine = patientFlowPoints.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  const summaryCards = [
    { title: 'Total Patients Today', value: metrics.todayTotalPatients ?? 0, caption: 'Visits recorded today', icon: Users, tone: 'bg-blue-50 text-blue-700' },
    { title: 'Average Wait Time', value: metrics.averageWaitMinutes == null ? '—' : `${metrics.averageWaitMinutes} min`, caption: 'From recorded queue visits', icon: Clock3, tone: 'bg-emerald-50 text-emerald-700' },
    { title: 'Department Performance', value: completionRate == null ? (reportDataLoading ? '…' : 'N/R') : `${completionRate}%`, caption: 'Completed / served in approved reports', icon: BarChart3, tone: 'bg-violet-50 text-violet-700' },
    { title: 'Staff On Duty', value: staffOnDutyLabel, caption: attendanceTotal ? `${attendancePresent} present · ${attendanceLate} late` : 'Duty records for today', icon: ClipboardList, tone: 'bg-orange-50 text-orange-600' },
    { title: 'Medicine Stock Status', value: reportDataLoading ? '…' : reportAnalytics ? `${currentInventory.lowStockCount ?? 0} low stock` : 'N/R', caption: reportAnalytics ? `${currentInventory.outOfStockCount ?? 0} out of stock` : 'Inventory not recorded', icon: Pill, tone: 'bg-cyan-50 text-cyan-700' },
    { title: 'Incident Reports', value: reportDataLoading ? '…' : reportAnalytics ? incidentReports.length : 'N/R', caption: `${reportSummary.criticalIssues ?? '—'} critical issues reported`, icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700' }
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 border-t-4 border-t-blue-700 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><BarChart3 size={22} /></span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">Clinic Head Dashboard</h1>
            <p className="mt-0.5 text-xs text-slate-500">Overview of today&apos;s clinic operations and key activities</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            <CalendarDays size={15} className="text-blue-700" />
            {new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'Africa/Addis_Ababa' }).format(currentDate)}
          </span>
          <button
            type="button"
            onClick={() => {
              setReportDataLoading(true);
              setReportDataError('');
              setRefreshKey((current) => current + 1);
            }}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {profileError && <p role="status" className="text-xs text-amber-700">{profileError}</p>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}

      <section aria-label="Today's clinic metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {summaryCards.map(({ title, value, caption, icon: Icon, tone }) => (
          <article key={title} className={`flex min-h-20 items-center gap-3 rounded-xl border border-white/80 px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.split(' ')[0]}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 ${tone.split(' ')[1]}`}><Icon size={20} /></span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold text-slate-600">{title}</p>
              <p className="mt-0.5 truncate text-xl font-extrabold leading-tight text-slate-900">{value}</p>
              <p className="mt-0.5 truncate text-[9px] text-slate-500">{caption}</p>
            </div>
          </article>
        ))}
      </section>

      {reportDataError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Some report, stock, or referral panels could not be loaded: {reportDataError}</p>}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-5">
          <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2"><Activity size={15} className="text-blue-700" /><div><h2 className="text-xs font-bold text-slate-900">Patient Flow</h2><p className="text-[9px] text-slate-500">Visits recorded this week</p></div></div>
            <Link to="/clinic-head/patients" className="text-[9px] font-semibold text-blue-700 hover:underline">View Details →</Link>
          </header>
          <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <div className="min-w-0">
              {patientFlowPoints.length ? (
                <>
                  <svg viewBox={`0 0 640 ${chartHeight}`} role="img" aria-label="Daily patient visits this week" className="h-32 w-full">
                    {[0, 1, 2, 3].map((index) => {
                      const y = chartPadding + (index * (chartHeight - chartPadding * 2)) / 3;
                      return <line key={index} x1={chartPadding} x2={640 - chartPadding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />;
                    })}
                    <path d={patientFlowLine} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                    {patientFlowPoints.map(({ day, count, x, y }) => <circle key={day} cx={x} cy={y} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="3"><title>{`${day}: ${count} visits`}</title></circle>)}
                  </svg>
                  <div className="flex justify-between px-1 text-[8px] text-slate-500">{patientFlowPoints.map(({ day }) => <span key={day}>{day}</span>)}</div>
                </>
              ) : <p className="py-12 text-center text-[10px] text-slate-500">No patient visits recorded this week.</p>}
            </div>
            <dl className="grid grid-cols-2 content-center gap-2 border-l border-slate-100 pl-2 sm:grid-cols-1">
              <div><dt className="text-[9px] text-slate-500">Today</dt><dd className="text-sm font-bold text-slate-900">{metrics.todayTotalPatients ?? 0}</dd></div>
              <div><dt className="text-[9px] text-slate-500">Waiting</dt><dd className="text-sm font-bold text-amber-700">{queueStages[0].count}</dd></div>
              <div><dt className="text-[9px] text-slate-500">In service</dt><dd className="text-sm font-bold text-blue-700">{metrics.patientsInTreatment ?? 0}</dd></div>
            </dl>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-4">
          <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2"><Users size={15} className="text-blue-700" /><div><h2 className="text-xs font-bold text-slate-900">Department Performance</h2><p className="text-[9px] text-slate-500">Approved reports and today&apos;s patient flow</p></div></div>
            <Link to="/clinic-head/reports" className="text-[9px] font-semibold text-blue-700 hover:underline">View Details →</Link>
          </header>
          <div className="max-h-52 overflow-y-auto p-2">
            <table className="w-full table-fixed text-left text-[9px]">
              <thead className="border-b bg-slate-50 text-slate-500"><tr><th className="w-[36%] p-1.5">Department</th><th className="w-[18%] p-1.5">Patients</th><th className="w-[20%] p-1.5">Completed</th><th className="w-[26%] p-1.5">Performance</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {departmentRows.slice(0, 8).map((row) => {
                  const rate = row.patientsServed > 0 && row.completedServices != null
                    ? Math.min(100, Math.round((row.completedServices / row.patientsServed) * 100))
                    : null;
                  return (
                    <tr key={row.department}>
                      <td className="truncate p-1.5 font-medium text-slate-700" title={row.department}>{row.department}</td>
                      <td className="p-1.5">{row.patientsRegistered ?? '—'}</td>
                      <td className="p-1.5">{row.completedServices ?? '—'}</td>
                      <td className="p-1.5">
                        {rate == null ? <span className="text-slate-400">N/R</span> : <div className="flex items-center gap-1"><span className="w-7">{rate}%</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} /></span></div>}
                      </td>
                    </tr>
                  );
                })}
                {!departmentRows.length && <tr><td colSpan="4" className="p-5 text-center text-slate-400">{reportDataLoading ? 'Loading department data…' : reportDataError ? 'Department data unavailable.' : 'No department data is available for today.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm xl:col-span-3">
          <header className="flex items-center justify-between border-b border-rose-100 bg-rose-50/60 px-3 py-2.5">
            <div className="flex items-center gap-2"><Siren size={15} className="text-rose-600" /><h2 className="text-xs font-bold text-slate-900">Critical Alerts</h2></div>
            <Link to="/clinic-head/approvals" className="text-[9px] font-semibold text-blue-700 hover:underline">View All →</Link>
          </header>
          <div className="space-y-1.5 p-2.5">
            <div className="flex items-center justify-between rounded-md bg-rose-50 px-2 py-1.5 text-[9px]"><span className="font-medium text-slate-700">Unresolved emergencies</span><strong className="text-rose-700">{metrics.emergencyVisitCount ?? 0}</strong></div>
            {activeAlerts.slice(0, 3).map((notification) => (
              <button key={notification._id} type="button" onClick={() => void viewNotification(notification)} className="flex w-full items-start gap-2 rounded-md border border-slate-100 px-2 py-1.5 text-left hover:bg-slate-50">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-rose-500" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold text-slate-800">{notification.title}</span><span className="block truncate text-[8px] text-slate-500">{notification.message}</span></span>
                <span className="shrink-0 text-[8px] text-slate-400">{notification.timeAgo || 'Now'}</span>
              </button>
            ))}
            {incidentReports.slice(0, 2).map((incident, index) => (
              <Link key={`${incident.department}-${incident.reportDate}-${index}`} to="/clinic-head/reports" className="flex items-start gap-2 rounded-md border border-slate-100 px-2 py-1.5 hover:bg-slate-50">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" /><span className="min-w-0"><span className="block truncate text-[9px] font-semibold text-slate-800">{incident.department}: {incident.title}</span><span className="block truncate text-[8px] text-slate-500">{incident.problems || incident.supplies || 'Incident reported'}</span></span>
              </Link>
            ))}
            {notificationsError && <p role="alert" className="text-[9px] text-rose-700">{notificationsError}</p>}
            {!activeAlerts.length && !incidentReports.length && !metrics.emergencyVisitCount && !notificationsError && <p className="py-5 text-center text-[9px] text-slate-500">No active alerts reported.</p>}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-4">
          <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2"><Clock3 size={15} className="text-blue-700" /><h2 className="text-xs font-bold text-slate-900">Queue Monitoring</h2></div>
            <Link to="/clinic-head/patients" className="text-[9px] font-semibold text-blue-700 hover:underline">View Details →</Link>
          </header>
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between rounded-md bg-blue-50 px-2.5 py-2 text-[9px]"><span className="text-slate-600">Average wait time</span><strong className="text-blue-800">{metrics.averageWaitMinutes == null ? 'Not recorded' : `${metrics.averageWaitMinutes} min`}</strong></div>
            <table className="w-full text-left text-[9px]">
              <thead className="text-slate-500"><tr><th className="py-1">Current status</th><th className="py-1 text-right">Patients</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {queueStages.map(({ label, count }) => <tr key={label}><td className="py-1.5 text-slate-700">{label}</td><td className="py-1.5 text-right font-semibold text-slate-900">{count}</td></tr>)}
              </tbody>
            </table>
            <p className="mt-2 text-[8px] text-slate-400">Individual queue details are available in Patient Flow and Records.</p>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-3">
          <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2"><ClipboardList size={15} className="text-emerald-700" /><h2 className="text-xs font-bold text-slate-900">Attendance Status</h2></div>
            <Link to="/clinic-head/attendance" className="text-[9px] font-semibold text-blue-700 hover:underline">Details →</Link>
          </header>
          <div className="flex items-center justify-center gap-4 p-3">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={attendanceRingStyle} role="img" aria-label={`Attendance status: ${attendancePresent} present, ${attendanceLate} late, ${attendanceAbsent} absent`}>
              <div className="flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center rounded-full bg-white"><strong className="text-sm text-slate-900">{attendanceTotal ? `${Math.round((attendancePresent / attendanceTotal) * 100)}%` : 'N/R'}</strong><span className="text-[8px] text-slate-500">present</span></div>
            </div>
            <dl className="space-y-2 text-[9px]">
              {[['Present', attendancePresent, 'bg-emerald-500'], ['Late', attendanceLate, 'bg-amber-500'], ['Absent', attendanceAbsent, 'bg-rose-500']].map(([label, value, color]) => <div key={label} className="flex min-w-20 items-center justify-between gap-3"><dt className="flex items-center gap-1.5 text-slate-600"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</dt><dd className="font-bold text-slate-900">{value}</dd></div>)}
              {!attendanceTotal && <p className="max-w-28 text-[8px] text-slate-400">No attendance records for today.</p>}
            </dl>
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-[8px] text-slate-500">Based on attendance records saved for today.</p>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-3">
          <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2"><FileText size={15} className="text-blue-700" /><h2 className="text-xs font-bold text-slate-900">Reports &amp; Review</h2></div>
            <Link to="/clinic-head/reports" className="text-[9px] font-semibold text-blue-700 hover:underline">View All →</Link>
          </header>
          <div className="divide-y divide-slate-100 px-2">
            {reportDataLoading ? <p className="py-5 text-center text-[9px] text-slate-500">Loading reports…</p> : clinicReports.slice(0, 4).map((report) => (
              <Link key={report._id} to="/clinic-head/reports" className="flex items-start gap-2 py-2 hover:bg-slate-50">
                <FileText size={12} className="mt-0.5 shrink-0 text-blue-600" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold text-slate-800">{report.title}</span><span className="block truncate text-[8px] text-slate-500">{report.reportType} · {formatClinicDate(report.periodEnd)}</span></span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold capitalize ${report.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : report.status === 'returned' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{report.status?.replace('_', ' ') || 'Draft'}</span>
              </Link>
            ))}
            {!reportDataLoading && !clinicReports.length && <p className="py-5 text-center text-[9px] text-slate-500">{reportDataError ? 'Clinic Head reports are unavailable.' : 'No Clinic Head reports generated yet.'}</p>}
          </div>
          <Link to="/clinic-head/approvals" className="mx-2 mb-2 flex justify-between rounded-md bg-blue-50 px-2 py-1.5 text-[9px] font-semibold text-blue-800"><span>Pending approvals</span><span>{metrics.pendingApprovalsCount ?? 0}</span></Link>
        </article>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1">
          <article className="overflow-hidden rounded-xl border border-cyan-100 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-cyan-100 bg-cyan-50/60 px-3 py-2.5"><div className="flex items-center gap-1.5"><Pill size={14} className="text-cyan-700" /><h2 className="text-[10px] font-bold text-slate-900">Medicine &amp; Inventory</h2></div><Link to="/clinic-head/inventory" className="text-[8px] font-semibold text-blue-700">Details →</Link></header>
            <dl className="grid grid-cols-2 gap-2 p-2 text-[9px]">
              {[['Total items', currentInventory.itemCount ?? '—'], ['Low stock', currentInventory.lowStockCount ?? '—'], ['Out of stock', currentInventory.outOfStockCount ?? '—'], ['Near expiry', currentInventory.expiringBatchCount ?? '—']].map(([label, value]) => <div key={label} className="rounded bg-slate-50 p-1.5"><dt className="text-slate-500">{label}</dt><dd className="font-bold text-slate-900">{reportDataLoading ? '…' : value}</dd></div>)}
            </dl>
          </article>
          <article className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-violet-100 bg-violet-50/60 px-3 py-2.5"><div className="flex items-center gap-1.5"><ArrowRight size={14} className="text-violet-700" /><h2 className="text-[10px] font-bold text-slate-900">Referrals</h2></div><Link to="/clinic-head/reports" className="text-[8px] font-semibold text-blue-700">View All →</Link></header>
            <div className="grid grid-cols-2 gap-2 p-2 text-center">
              <div className="rounded bg-slate-50 p-1.5"><p className="text-[8px] text-slate-500">Today</p><p className="text-sm font-bold text-slate-900">{reportDataLoading ? '…' : reportAnalytics ? referralSummary.total ?? 0 : 'N/R'}</p></div>
              <div className="rounded bg-rose-50 p-1.5"><p className="text-[8px] text-slate-500">Urgent</p><p className="text-sm font-bold text-rose-700">{reportDataLoading ? '…' : reportAnalytics ? referralSummary.urgent ?? 0 : 'N/R'}</p></div>
            </div>
            <p className="px-2 pb-2 text-[8px] text-slate-500">{referralSummary.approvalRequests?.pending ?? 0} pending approval</p>
          </article>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
          <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-blue-700" /><div><h2 className="text-xs font-bold text-slate-900">Action Plans</h2><p className="text-[9px] text-slate-500">Follow up assigned clinic actions</p></div></div>
          <Link to="/clinic-head/reports" className="text-[9px] font-semibold text-blue-700 hover:underline">View All →</Link>
        </header>
        {reportDataLoading ? <p className="p-4 text-center text-[9px] text-slate-500">Loading action plans…</p> : actionPlans.length ? (
          <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 xl:grid-cols-4">
            {actionPlans.slice(0, 4).map((plan) => (
              <article key={plan._id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                <p className="truncate text-[9px] font-semibold text-slate-800" title={plan.issue}>{plan.issue}</p>
                <p className="mt-1 truncate text-[8px] text-slate-500">{plan.responsiblePerson} · {plan.reportTitle}</p>
                <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[8px] text-slate-500">Due {formatClinicDate(plan.dueDate)}</span><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${plan.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{plan.status?.replace('_', ' ') || 'open'}</span></div>
              </article>
            ))}
          </div>
        ) : <p className="p-4 text-center text-[9px] text-slate-500">{reportDataError ? 'Unable to load action plans.' : 'No open action plans in the generated reports.'}</p>}
      </section>

      <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-blue-800">Additional dashboard details</summary>
        <div className="space-y-4 border-t border-slate-100 p-3">
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Activity size={17} /></span>
              <div><h2 className="text-xs font-bold text-slate-900">Patient Flow Overview</h2><p className="mt-0.5 text-[10px] text-slate-500">Today&apos;s visits by current status</p></div>
            </div>
            <Link to="/clinic-head/reports" className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:underline">Today&apos;s Flow <ArrowRight size={12} /></Link>
          </header>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            {flowStages.map(({ label, count, icon: Icon, tone }, index) => (
              <div key={label} className="relative flex min-h-24 flex-col items-center justify-center rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-3 text-center">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tone}`}><Icon size={17} /></span>
                <span className="mt-2 text-[10px] font-medium text-slate-600">{label}</span>
                <span className="text-base font-bold text-slate-900">{count}</span>
                {index < flowStages.length - 1 && <ArrowRight size={13} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-slate-400 sm:block" />}
              </div>
            ))}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm xl:col-span-3">
          <header className="flex items-center justify-between border-b border-rose-100 bg-rose-50/70 px-4 py-3">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700"><Siren size={16} /></span><div><h2 className="text-xs font-bold text-slate-900">Emergency Alerts</h2><p className="text-[10px] text-slate-500">Cases needing attention</p></div></div>
            <Link to="/clinic-head/reports" className="text-[10px] font-semibold text-blue-700 hover:underline">View Report</Link>
          </header>
          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2">
              <span className="text-[10px] font-medium text-slate-700">Unresolved emergencies</span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{metrics.emergencyVisitCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
              <span className="text-[10px] font-medium text-slate-700">Hospital referrals today</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{metrics.hospitalReferralCount ?? 0}</span>
            </div>
            {activeAlerts.slice(0, 2).map((notification) => (
              <button key={notification._id} type="button" onClick={() => void viewNotification(notification)} className="flex w-full items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <span className="min-w-0"><span className="block truncate text-[10px] font-semibold text-slate-800">{notification.title}</span><span className="block truncate text-[9px] text-slate-500">{notification.message}</span></span>
              </button>
            ))}
            {notificationsError && <p role="alert" className="text-[10px] text-rose-700">{notificationsError}</p>}
            {!activeAlerts.length && !notificationsError && <p className="px-2 py-3 text-center text-[10px] text-slate-500">No active alerts.</p>}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><ArrowRight size={16} /></span>
            <h2 className="text-xs font-bold text-slate-900">Quick Actions</h2>
          </header>
          <nav aria-label="Quick actions" className="divide-y divide-slate-100 px-3">
            {[
              { label: 'Patient Flow Report', to: '/clinic-head/reports', icon: Users },
              { label: 'Staff Duty Roster', to: '/clinic-head/staff', icon: ClipboardList },
              { label: 'Inventory & Stock', to: '/clinic-head/inventory', icon: Pill },
              { label: 'Publish Announcement', to: '/clinic-head/announcements', icon: Megaphone },
            ].map(({ label, to, icon: Icon }) => (
              <Link key={label} to={to} className="flex items-center gap-2 py-2.5 text-[10px] font-medium text-slate-700 hover:text-blue-700">
                <Icon size={14} className="shrink-0 text-blue-700" /><span className="min-w-0 flex-1 truncate">{label}</span><ArrowRight size={12} className="text-blue-600" />
              </Link>
            ))}
          </nav>
          <Link to="/clinic-head/approvals" className="mx-3 mb-3 mt-1 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-800 hover:bg-blue-100">
            <span>Pending approvals</span><span>{metrics.pendingApprovalsCount ?? 0}</span>
          </Link>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-4">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Users size={16} /></span><div><h2 className="text-xs font-bold text-slate-900">Department Activity</h2><p className="text-[10px] text-slate-500">Patient visits this month</p></div></div>
            <Link to="/clinic-head/reports" className="text-[10px] font-semibold text-blue-700 hover:underline">Details</Link>
          </header>
          <div className="space-y-3 p-4">
            {departmentPatientFlow.length ? departmentPatientFlow.slice(0, 5).map(({ department, count }) => {
              const maxCount = Math.max(1, ...departmentPatientFlow.map((item) => item.count));
              return (
                <div key={department}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate text-slate-700">{department}</span><span className="font-semibold text-slate-800">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(3, (count / maxCount) * 100)}%` }} /></div>
                </div>
              );
            }) : <p className="py-8 text-center text-[10px] text-slate-500">No department visits recorded this month.</p>}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-4">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><ClipboardList size={16} /></span><div><h2 className="text-xs font-bold text-slate-900">Staff on Duty</h2><p className="text-[10px] text-slate-500">Today&apos;s attendance overview</p></div></div>
            <span className="text-[10px] text-slate-500">Total Staff: {staffOnDutyLabel.split('/')[1] || 0}</span>
          </header>
          <div className="grid grid-cols-3 gap-2 p-4">
            {[
              { label: 'Present', value: attendance.present || 0, tone: 'bg-emerald-50 text-emerald-700' },
              { label: 'Late', value: attendance.late || 0, tone: 'bg-amber-50 text-amber-700' },
              { label: 'Absent', value: attendance.absent || 0, tone: 'bg-rose-50 text-rose-700' }
            ].map(({ label, value, tone }) => (
              <div key={label} className="rounded-lg border border-slate-100 px-2 py-3 text-center">
                <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${tone}`}>{value}</span>
                <p className="mt-1.5 text-[10px] text-slate-600">{label}</p>
              </div>
            ))}
          </div>
          <Link to="/clinic-head/staff" className="mx-4 mb-4 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:underline">Manage staff <ArrowRight size={12} /></Link>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-4">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><Clock3 size={16} /></span><h2 className="text-xs font-bold text-slate-900">Recent Activities</h2></div>
            <Link to="/clinic-head/reports" className="text-[10px] font-semibold text-blue-700 hover:underline">View All</Link>
          </header>
          <div className="divide-y divide-slate-100">
            {recentActivity.length ? recentActivity.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-800">{item.type}</p>
                  <p className="mt-0.5 line-clamp-2 text-[9px] text-slate-500">{item.description}</p>
                </div>
                <time className="shrink-0 text-[9px] text-slate-400">{formatTimeAgo(item.createdAt, currentDate.getTime())}</time>
              </div>
            )) : <p className="px-4 py-8 text-center text-[10px] text-slate-500">No recent activity recorded.</p>}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><BarChart3 size={16} /></span><div><h2 className="text-xs font-bold text-slate-900">Patient Visits This Week</h2><p className="text-[10px] text-slate-500">Daily visit totals · Average wait today: {metrics.averageWaitMinutes == null ? '—' : `${metrics.averageWaitMinutes} min`}</p></div></div>
            <Link to="/clinic-head/reports" className="text-[10px] font-semibold text-blue-700 hover:underline">Reports</Link>
          </header>
          <div className="flex h-40 items-end justify-around gap-2 px-4 pb-3 pt-5">
            {patientFlow.map(({ day, count }) => (
              <div key={day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[9px] font-semibold text-slate-600">{count}</span>
                <div className="flex h-24 w-full max-w-8 items-end overflow-hidden rounded-t-md bg-blue-50">
                  <div className="w-full rounded-t-md bg-blue-600" style={{ height: `${Math.max(count ? 8 : 0, (count / maxDailyVisits) * 100)}%` }} />
                </div>
                <span className="text-[9px] text-slate-500">{day}</span>
              </div>
            ))}
            {!patientFlow.length && <p className="self-center text-[10px] text-slate-500">No patient visits recorded this week.</p>}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-5">
          <header className="flex items-center justify-between border-b border-slate-100 bg-blue-50/60 px-4 py-3">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><Megaphone size={16} /></span><div><h2 className="text-xs font-bold text-slate-900">Announcements & Notifications</h2><p className="text-[10px] text-slate-500">Updates for clinic staff</p></div></div>
            <Link to="/clinic-head/announcements" className="text-[10px] font-semibold text-blue-700 hover:underline">View All</Link>
          </header>
          {announcementsError && <p role="alert" className="px-4 py-2 text-[10px] text-rose-700">{announcementsError}</p>}
          <div className="divide-y divide-slate-100">
            {announcements.length ? announcements.map((announcement) => (
              <Link key={announcement.id} to="/clinic-head/announcements" className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${announcement.priority === 'urgent' ? 'bg-rose-500' : announcement.priority === 'important' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-slate-800">{announcement.title}</span><span className="mt-0.5 line-clamp-1 block text-[9px] text-slate-500">{announcement.message}</span></span>
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium capitalize text-blue-700">{announcement.priority || 'general'}</span>
              </Link>
            )) : !announcementsError && <p className="px-4 py-5 text-center text-[10px] text-slate-500">No announcements available.</p>}
            {notifications.slice(0, 1).map((notification) => (
              <button key={notification._id} type="button" onClick={() => void viewNotification(notification)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50">
                <Bell size={13} className="shrink-0 text-blue-600" /><span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700">{notification.title}</span><span className="shrink-0 text-[9px] text-slate-400">{notification.timeAgo || 'Just now'}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

        </div>
      </details>
      <p className="text-right text-[10px] text-slate-400">Welcome, {clinicHeadName || 'Clinic Head'} · Data is based on recorded clinic activity.</p>
    </div>
  );
};

export default ClinicHeadDashboard;

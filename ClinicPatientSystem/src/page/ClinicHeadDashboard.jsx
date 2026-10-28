import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ClinicHeadSummary from '../components/ClinicStudentHead/ClinicHeadSummary.jsx';
import { Activity, AlertTriangle, Calendar, CheckCircle2, FileText, History, Link2, Pill, UserPlus, BarChart3, XCircle } from 'lucide-react';
import { useAuth } from '../components/context/AuthContext.jsx';

const getErrorMessage = async (response) => {
  const result = await response.json().catch(() => ({}));
  return `${response.status}: ${result.message || 'Request failed.'}`;
};

const formatRequestDate = (date) => {
  if (!date) return 'Date unavailable';
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? 'Date unavailable' : parsedDate.toLocaleString();
};

const formatActivityTime = (date) => {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat('en', {
      timeZone: 'Africa/Addis_Ababa',
      hour: '2-digit',
      minute: '2-digit'
    }).format(parsedDate);
};

const ClinicHeadDashboard = () => {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyCertificateId, setBusyCertificateId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [today] = useState(() => new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date()));

  useEffect(() => {
    if (!token) return;

    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/dashboard/clinic-head', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || 'Unable to load dashboard data.');
        }
        setDashboard(result);
        setError('');
      } catch (loadError) {
        setError(loadError.message || 'Unable to connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [token, refreshKey]);

  const handleApproval = async (certificateId, status, recordType) => {
    setBusyCertificateId(certificateId);
    setError('');
    try {
      const response = await fetch(`/api/dashboard/approve-cert/${certificateId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, recordType })
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
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
        <Link to="/login" className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading clinic dashboard...</div>;
  }

  if (!dashboard) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Dashboard data unavailable</h1>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
        {!token && (
          <Link to="/login" className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        )}
        {token && (
          <button
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
        )}
      </div>
    );
  }

  const { metrics, pendingApprovalsList = [], patientFlow = [], recentActivity = [] } = dashboard;
  const {
    lowStock = [],
    inventoryItemCount = 0,
    outbreakNotice,
    diagnosisRecords = 0
  } = dashboard.alerts || {};
  const maxFlow = Math.max(1, ...patientFlow.map(({ count }) => count));
  const weeklyVisitCount = patientFlow.reduce((total, { count }) => total + count, 0);

  return (
    <div className="space-y-5 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clinic Head Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of today&apos;s clinic activities and key information · Welcome, {user?.name || 'Clinic Head'}.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          <Calendar size={16} className="text-teal-600" />
          <span>{today}</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <ClinicHeadSummary
        summaryData={{
          todaysPatients: metrics.todayTotalPatients,
          staffOnDuty: metrics.staffOnDuty,
          staffBreakdown: metrics.staffBreakdown,
          pendingApprovals: metrics.pendingApprovalsCount,
          pendingApprovalsBreakdown: metrics.pendingApprovalsBreakdown,
          emergencyCases: metrics.emergencyCases,
          emergencyVisitCount: metrics.emergencyVisitCount,
          hospitalReferralCount: metrics.hospitalReferralCount
        }}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section id="approvals" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={19} className="text-slate-700" />
              <h2 className="text-base font-bold text-slate-800">Quick Approvals</h2>
            </div>
            <span className="text-xs font-semibold text-blue-600">{metrics.pendingApprovalsCount} pending</span>
          </div>

          {pendingApprovalsList.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500/60" />
              No requests are waiting for approval.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 font-semibold text-slate-500">
                    <th className="p-2">Type</th>
                    <th className="p-2">Applicant / Details</th>
                    <th className="p-2">Request Date</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingApprovalsList.slice(0, 5).map((certificate) => (
                    <tr key={certificate._id} className="hover:bg-slate-50">
                      <td className="p-2">
                        <p className="font-semibold text-slate-800">{certificate.type}</p>
                      </td>
                      <td className="p-2">
                        <p className="font-semibold text-slate-800">{certificate.applicant}</p>
                        <p className="text-[11px] text-slate-500">{certificate.details}</p>
                      </td>
                      <td className="p-2 text-slate-500">{formatRequestDate(certificate.requestDate)}</td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={busyCertificateId === certificate._id}
                            onClick={() => handleApproval(certificate._id, 'approved', certificate.recordType)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            disabled={busyCertificateId === certificate._id}
                            onClick={() => handleApproval(certificate._id, 'rejected', certificate.recordType)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section id="patient-flow" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={19} className="text-slate-700" />
              <h2 className="text-base font-bold text-slate-800">Patient Flow (Weekly)</h2>
            </div>
            <span className="text-xs text-slate-500">Clinic visits per day</span>
          </div>
          {weeklyVisitCount > 0 ? (
            <div className="flex h-56 items-end justify-between gap-2 border-b border-slate-200 px-2 pt-6">
              {patientFlow.map(({ day, date, count }) => (
                <div key={date || day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-[10px] font-semibold text-slate-600">{count}</span>
                  <div className="w-full max-w-12 rounded-t bg-blue-600 transition-all" style={{ height: `${Math.max(3, (count / maxFlow) * 78)}%` }} />
                  <span className="mt-2 text-[10px] font-medium text-slate-600">{day}</span>
                  <span className="text-[9px] text-slate-400">{date?.slice(5)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
              <Activity size={24} className="mb-2 text-slate-400" />
              No clinic visits have been recorded this week.
            </div>
          )}
        </section>
      </div>

      <section id="alerts" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={19} className="text-amber-600" />
            <h2 className="text-base font-bold text-slate-800">Alerts & Notifications</h2>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Pill size={16} className="text-amber-700" />
              <h3 className="text-sm font-bold text-amber-900">Low Stock Warning</h3>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-xs text-slate-600">
                {inventoryItemCount ? 'No inventory items are below their reorder levels.' : 'No inventory items have been recorded.'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {lowStock.map((item) => (
                  <li key={item._id} className="flex items-center justify-between gap-3 text-xs text-amber-950">
                    <span className="font-semibold">{item.itemName}</span>
                    <span>{item.quantity} {item.unit} · reorder at {item.reorderLevel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Activity size={16} className="text-rose-700" />
              <h3 className="text-sm font-bold text-rose-900">Disease Trend Alert</h3>
            </div>
            {outbreakNotice ? (
              <div className="text-xs text-rose-900">
                <p className="font-semibold">Increase detected for {outbreakNotice.diagnosis}.</p>
                <p className="mt-1">
                  {outbreakNotice.recentCases} cases in the last 7 days, up {outbreakNotice.increasePercent}% from the previous 7 days.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                {diagnosisRecords
                  ? 'No significant increase detected in the last 14 days of recorded diagnoses.'
                  : 'No diagnosis records are available for outbreak analysis.'}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={19} className="text-slate-700" />
              <h2 className="text-base font-bold text-slate-800">Recent Activities</h2>
            </div>
            <span className="text-xs text-slate-500">Latest clinic records</span>
          </div>
          {recentActivity.length ? (
            <ul className="divide-y divide-slate-100">
              {recentActivity.map((activity) => (
                <li key={activity.id} className="flex items-start justify-between gap-3 py-2.5 text-xs">
                  <div className="flex min-w-0 items-start gap-2">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700">{activity.type}</p>
                      <p className="mt-0.5 text-slate-500">{activity.description}</p>
                    </div>
                  </div>
                  <time className="shrink-0 text-slate-400">{formatActivityTime(activity.createdAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No recent clinic activity is available.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Link2 size={18} className="text-slate-700" />
          <h2 className="text-base font-bold text-slate-800">Quick Links</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <a href="#approvals" className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs font-semibold text-blue-800 transition hover:bg-blue-100">
            <CheckCircle2 size={17} /> Review approvals
          </a>
          <a href="#patient-flow" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100">
            <BarChart3 size={17} /> View patient flow
          </a>
          <a href="#alerts" className="flex items-center gap-2 rounded-lg bg-violet-50 p-3 text-xs font-semibold text-violet-800 transition hover:bg-violet-100">
            <UserPlus size={17} /> View clinic alerts
          </a>
        </div>
      </section>
    </div>
  );
};

export default ClinicHeadDashboard;

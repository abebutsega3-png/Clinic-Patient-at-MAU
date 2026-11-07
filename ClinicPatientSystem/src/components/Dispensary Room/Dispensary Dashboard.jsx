import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  Clock3,
  Package,
  Pill,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const EmployeeAttendanceCard = () => {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  const loadAttendance = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/attendance/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(data.data);
      setAttendanceError('');
    } catch (loadError) {
      console.error('Failed to load dashboard attendance:', loadError);
      setAttendanceError(loadError.response?.data?.message || 'Unable to load attendance.');
    } finally {
      setLoadingAttendance(false);
    }
  }, [token]);

  useEffect(() => {
    void Promise.resolve().then(loadAttendance);
    const timer = window.setInterval(loadAttendance, 30000);
    const socket = io({ auth: { token } });
    socket.on('staff-attendance-updated', loadAttendance);
    return () => {
      window.clearInterval(timer);
      socket.off('staff-attendance-updated', loadAttendance);
      socket.disconnect();
    };
  }, [loadAttendance, token]);

  const present = summary?.present || 0;
  const absent = summary?.absent || 0;
  const unreported = summary?.unreported || 0;
  const percentage = summary?.percentage || 0;
  const absentPercentage = summary?.total ? (absent / summary.total) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={18} className="text-blue-700" aria-hidden="true" />
          <h2 className="font-bold text-slate-900">Employee Attendance</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live
        </span>
      </header>

      <div className="p-3">
        {loadingAttendance && !summary ? (
          <p className="py-12 text-center text-xs text-slate-500">Loading attendance…</p>
        ) : attendanceError && !summary ? (
          <div className="space-y-3 py-5 text-center">
            <p role="alert" className="text-xs text-rose-700">{attendanceError}</p>
            <button type="button" onClick={() => void loadAttendance()} className="text-xs font-semibold text-blue-700 hover:underline">Try again</button>
          </div>
        ) : (
          <>
            <div
              role="img"
              aria-label={`${percentage}% attendance: ${present} present, ${absent} absent`}
              className="mx-auto flex h-28 w-28 items-center justify-center rounded-full"
              style={{
                background: summary?.total
                  ? `conic-gradient(#10b981 0% ${percentage}%, #f43f5e ${percentage}% ${Math.min(percentage + absentPercentage, 100)}%, #e2e8f0 ${Math.min(percentage + absentPercentage, 100)}% 100%)`
                  : 'conic-gradient(#e2e8f0 0% 100%)'
              }}
            >
              <div className="flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full bg-white">
                <span className="text-xl font-extrabold leading-tight text-slate-900">{loadingAttendance ? '—' : `${percentage}%`}</span>
                <span className="text-[10px] font-semibold text-slate-600">Present</span>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Present</span>
                <strong className="text-slate-800">{present}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-semibold text-rose-600"><span className="h-2 w-2 rounded-full bg-rose-500" />Absent</span>
                <strong className="text-slate-800">{absent}</strong>
              </div>
              {unreported > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Not yet reported</span>
                  <strong>{unreported}</strong>
                </div>
              )}
            </div>

            {attendanceError && <p role="alert" className="mt-2 text-center text-[10px] text-rose-700">{attendanceError}</p>}
            <Link to="/dispensary/attendance" className="mx-auto mt-3 flex w-fit items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-700">
              View Details <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
};

const emptyDashboard = {
  summary: {},
  queueAvailable: false,
  pendingQueue: [],
  pendingPrescriptions: [],
  alerts: { lowStockItems: [], expiryItems: [] },
  weeklyTrend: [],
  topDispensed: [],
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const metricStyles = [
  'border-blue-700 bg-gradient-to-br from-blue-600 to-blue-700 text-white',
  'border-emerald-700 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
  'border-orange-600 bg-gradient-to-br from-orange-500 to-amber-500 text-white',
  'border-violet-700 bg-gradient-to-br from-violet-600 to-violet-700 text-white',
];

const DispensaryDashboard = ({ showAllPrescriptions = false }) => {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [todayLabel] = useState(() => new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date()));
  const [priceInputs, setPriceInputs] = useState({});
  const [processingVisitId, setProcessingVisitId] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch('/api/dispensary/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result.data) {
        throw new Error(result?.message || `Unable to load dispensary data (${response.status}).`);
      }
      setDashboard(result.data);
      setError('');
      setPriceInputs((current) => Object.fromEntries((result.data.pendingPrescriptions || []).flatMap((visit) => visit.prescriptions.map((item) => [
        item.id,
        current[item.id] || {
          birr: String(Math.floor((item.priceCents || 0) / 100)),
          cent: String((item.priceCents || 0) % 100).padStart(2, '0'),
        },
      ]))));
    } catch (loadError) {
      console.error('Failed to load dispensary dashboard:', loadError);
      setError(loadError.message || 'Unable to load dispensary dashboard.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
    const timer = window.setInterval(loadDashboard, 30000);
    const socket = io({ auth: { token } });
    socket.on('clinic:prescription-updated', loadDashboard);
    socket.on('clinic:inventory-updated', loadDashboard);
    socket.on('clinic:queue-updated', loadDashboard);
    return () => {
      window.clearInterval(timer);
      socket.off('clinic:prescription-updated', loadDashboard);
      socket.off('clinic:inventory-updated', loadDashboard);
      socket.off('clinic:queue-updated', loadDashboard);
      socket.disconnect();
    };
  }, [loadDashboard, refreshKey, token]);

  const refreshDashboard = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const updatePrescription = async (visit, status) => {
    const prices = visit.prescriptions.map((item) => {
      const value = priceInputs[item.id] || { birr: '0', cent: '0' };
      return {
        id: item.id,
        priceCents: Number(value.birr) * 100 + Number(value.cent),
      };
    });
    if (visit.prescriptions.some((item) => {
      const value = priceInputs[item.id] || { birr: '0', cent: '0' };
      return !/^\d+$/.test(value.birr) || !/^\d{1,2}$/.test(value.cent) || Number(value.cent) > 99;
    })) {
      setError('Enter whole Birr and Cent values (Cent must be between 0 and 99) for every medicine.');
      return;
    }
    setProcessingVisitId(visit.visitId);
    setError('');
    try {
      const response = await fetch(`/api/dispensary/prescriptions/${encodeURIComponent(visit.visitId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, prices }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to update prescription (${response.status}).`);
      }
      await loadDashboard();
    } catch (updateError) {
      console.error('Failed to process prescription:', updateError);
      setError(updateError.message || 'Unable to process prescription.');
    } finally {
      setProcessingVisitId('');
    }
  };

  const pendingPrescriptionCount = dashboard.summary.pendingDispenseCount ?? dashboard.pendingPrescriptions?.length ?? 0;
  const metrics = useMemo(() => [
    {
      label: "Today's Pharmacy Queue",
      value: dashboard.summary.todayQueueCount,
      icon: Pill,
      description: 'Patients routed to the pharmacy today',
    },
    {
      label: 'Pending Dispense',
      value: pendingPrescriptionCount,
      icon: Clock3,
      description: 'Prescriptions awaiting pharmacy processing',
    },
    {
      label: 'Low Stock Items',
      value: dashboard.summary.lowStockCount,
      icon: Package,
      description: 'At or below configured reorder level',
    },
    {
      label: 'Expiring Soon',
      value: dashboard.summary.expiringSoonCount,
      icon: AlertTriangle,
      description: 'Expired or within the expiry warning period',
    },
  ], [dashboard.summary, pendingPrescriptionCount]);

  const trendMaximum = Math.max(...dashboard.weeklyTrend.map((day) => day.quantityDispensed || 0), 1);
  const totalDispensedThisWeek = dashboard.weeklyTrend.reduce((sum, day) => sum + (day.quantityDispensed || 0), 0);
  const trendPoints = dashboard.weeklyTrend.map((day, index) => ({
    ...day,
    x: dashboard.weeklyTrend.length > 1 ? 12 + (index * 276) / (dashboard.weeklyTrend.length - 1) : 150,
    y: 112 - ((day.quantityDispensed || 0) / trendMaximum) * 92,
  }));
  const trendPath = trendPoints.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-5 py-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm"><Pill size={22} aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Pharmacy operations</p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Dispensary Dashboard</h1>
              <p className="mt-0.5 text-xs text-slate-500">Monitor pharmacy operations, stock, and dispensing activity.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <CalendarDays size={16} className="text-blue-700" aria-hidden="true" />{todayLabel}
          </span>
          <button type="button" onClick={refreshDashboard} disabled={loading} aria-label="Refresh dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={refreshDashboard} className="font-semibold underline">Try again</button>
        </div>
      )}

      <section aria-label="Pharmacy daily summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, description }, index) => (
          <article key={label} className={`rounded-xl border p-4 shadow-sm ${metricStyles[index]}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white/90">{label}</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight text-white">
                  {loading ? <span className="inline-block h-9 w-12 animate-pulse rounded bg-white/25" /> : value ?? '—'}
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white"><Icon size={24} aria-hidden="true" /></span>
            </div>
            <p className="mt-2 text-[11px] text-white/80">{description}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-800 to-blue-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} aria-hidden="true" />
              <h2 className="font-bold">Pending Prescriptions Queue</h2>
            </div>
            <Link to={showAllPrescriptions ? '/dispensary' : '/dispensary/pending-orders'} className="inline-flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white">
            {showAllPrescriptions ? 'Dashboard' : 'View all'} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {!dashboard.queueAvailable ? (
            <p className="p-5 text-sm text-slate-600">Prescription processing is available to pharmacist accounts.</p>
          ) : dashboard.pendingPrescriptions.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No prescriptions are waiting for pharmacy processing.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-3">Patient name &amp; MRN</th>
                    <th scope="col" className="px-3 py-3">Prescriber</th>
                    <th scope="col" className="px-3 py-3">Medicines, quantity &amp; price</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(showAllPrescriptions ? dashboard.pendingPrescriptions : dashboard.pendingPrescriptions.slice(0, 5)).map((visit) => {
                    const hasStockForAll = visit.prescriptions.every((item) => (
                      Number(item.stock?.quantity) > 0
                      && /^\d+(?:\.\d+)?$/.test(String(item.quantity || '').trim())
                      && Number(item.quantity) <= Number(item.stock.quantity)
                    ));
                    const validPrices = visit.prescriptions.every((item) => {
                      const value = priceInputs[item.id] || { birr: '0', cent: '00' };
                      return /^\d+$/.test(value.birr)
                        && /^\d{1,2}$/.test(value.cent)
                        && Number(value.cent) <= 99;
                    });
                    const cents = visit.prescriptions.reduce((sum, item) => {
                      const value = priceInputs[item.id] || { birr: '0', cent: '0' };
                      return sum + (Number(value.birr) * 100) + Number(value.cent);
                    }, 0);
                    const hasDocumentedAllergies = visit.allergies?.some((allergy) => (
                      typeof allergy === 'string'
                      && allergy.trim()
                      && !/^(nka|no known allergies)$/i.test(allergy.trim())
                    ));
                    const allergyVerified = Boolean(
                      visit.allergyReviewed
                      && visit.allergyVerification === (hasDocumentedAllergies ? 'known-allergies' : 'nka'),
                    );
                    return (
                      <tr key={visit.visitId} className="align-top hover:bg-slate-50/70">
                        <td className="min-w-[180px] px-3 py-3">
                          <p className="font-semibold text-slate-800">{visit.patientName}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">MRN: {visit.cardNumber}</p>
                          <p className="text-[10px] text-slate-400">{visit.visitNumber || visit.visitId} · {formatDate(visit.visitDate)}</p>
                          {hasDocumentedAllergies ? (
                            <p role="alert" className="mt-1 flex items-start gap-1 text-[10px] font-semibold text-rose-700">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                              Allergies: {visit.allergies.filter((allergy) => !/^(nka|no known allergies)$/i.test(allergy.trim())).join(', ')}
                            </p>
                          ) : (
                            <p role="status" className={`mt-1 text-[10px] font-semibold ${allergyVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {allergyVerified ? 'NKA verified' : 'Allergy verification required'}
                            </p>
                          )}
                        </td>
                        <td className="min-w-[110px] px-3 py-3 font-medium text-slate-700">
                          {visit.prescriber?.name || '—'}
                        </td>
                        <td className="min-w-[300px] px-3 py-3">
                          <ul className="space-y-3">
                            {visit.prescriptions.map((item) => (
                              <li key={item.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                <p className="font-semibold text-slate-800">{item.medicine} {item.strength} {item.form}</p>
                                <p className="text-[10px] text-slate-500">{[item.dose, item.frequency, item.duration, item.instructions].filter(Boolean).join(' · ') || 'No usage instructions recorded'}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="text-[10px] text-slate-600">
                                    Qty: {[item.quantity, item.quantityUnit].filter(Boolean).join(' ') || 'Not specified'}
                                  </span>
                                  <span className={`text-[10px] font-semibold ${item.stock?.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {item.stock?.quantity > 0
                                      ? `Stock: ${item.stock.quantity} ${item.stock.unit || ''}`
                                      : item.stock?.status === 'not_listed' ? 'Not listed in inventory' : 'Out of stock'}
                                  </span>
                                  <label className="flex items-center gap-1 text-[10px] text-slate-600">
                                    Price
                                    <input
                                      aria-label={`${item.medicine} price in Birr`}
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={priceInputs[item.id]?.birr ?? '0'}
                                      onChange={(event) => setPriceInputs((current) => ({ ...current, [item.id]: { ...current[item.id], birr: event.target.value } }))}
                                      className="w-14 rounded border border-slate-300 px-1.5 py-1 text-xs"
                                    />
                                    Birr
                                    <input
                                      aria-label={`${item.medicine} price in cents`}
                                      type="number"
                                      min="0"
                                      max="99"
                                      step="1"
                                      value={priceInputs[item.id]?.cent ?? '00'}
                                      onChange={(event) => setPriceInputs((current) => ({ ...current, [item.id]: { ...current[item.id], cent: event.target.value } }))}
                                      className="w-12 rounded border border-slate-300 px-1.5 py-1 text-xs"
                                    />
                                    Cent
                                  </label>
                                </div>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-right text-[11px] font-bold text-slate-700">
                            Total: {Math.floor(cents / 100)} Birr {String(cents % 100).padStart(2, '0')} Cent
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">{visit.status}</span>
                        </td>
                        <td className="min-w-[120px] px-3 py-3">
                          <div className="flex flex-col items-start gap-2">
                            <Link
                              to="/dispensary/pending-orders"
                              className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              disabled={processingVisitId === visit.visitId || !hasStockForAll || !validPrices || !allergyVerified}
                              onClick={() => void updatePrescription(visit, 'Dispensed')}
                              title={!allergyVerified ? 'Save allergy verification from the prescription details before dispensing.' : ''}
                              className="rounded-md bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {processingVisitId === visit.visitId ? 'Saving…' : 'Dispense'}
                            </button>
                            <button
                              type="button"
                              disabled={processingVisitId === visit.visitId}
                              onClick={() => void updatePrescription(visit, 'Cancelled')}
                              className="font-medium text-rose-700 hover:underline disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <EmployeeAttendanceCard />

        <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-rose-700 to-red-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2"><AlertTriangle size={18} aria-hidden="true" /><h2 className="font-bold">Alerts &amp; Notifications</h2></div>
            <Link to="/dispensary/low-stock" className="inline-flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white">View all <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <div className="space-y-2 p-3">
            <div>
              {dashboard.alerts.lowStockItems.length ? (
                <ul className="space-y-1.5">
                  {dashboard.alerts.lowStockItems.map((item) => (
                    <li key={item.itemName} className="flex items-start gap-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px]">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1"><strong className="block text-slate-800">Low stock warning</strong><span className="text-slate-600">{item.itemName} · Remaining: {item.quantity} {item.unit}</span></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">No low-stock items.</p>}
            </div>
            <div>
              {dashboard.alerts.expiryItems.length ? (
                <ul className="space-y-1.5">
                  {dashboard.alerts.expiryItems.map((item) => (
                    <li key={`${item.itemName}-${item.expiryDate}`} className="flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px]">
                      <Clock3 size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1"><strong className="block text-slate-800">{item.status}</strong><span className="text-slate-600">{item.itemName} · {formatDate(item.expiryDate)}</span></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">No expired or soon-to-expire items.</p>}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_220px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Daily Dispensing Trend</h2>
              <p className="mt-1 text-[11px] text-slate-500">Units issued each day · last 7 days</p>
            </div>
            <TrendingUp size={18} className="text-teal-700" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2"><p className="text-xl font-bold text-slate-900">{loading ? '—' : totalDispensedThisWeek}</p><p className="text-[11px] text-slate-500">units this week</p></div>
          <svg viewBox="0 0 300 145" role="img" aria-label="Daily medicine units dispensed over the last seven days" className="mt-2 h-36 w-full overflow-visible">
            {[20, 50, 80, 110].map((y) => <g key={y}><line x1="12" y1={y} x2="288" y2={y} stroke="#e2e8f0" strokeDasharray="3 4" /><text x="0" y={y + 3} fontSize="8" fill="#64748b">{Math.round(((112 - y) / 92) * trendMaximum)}</text></g>)}
            {trendPoints.length > 1 && <path d={trendPath} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {trendPoints.map((point) => (
              <g key={point.date}>
                <circle cx={point.x} cy={point.y} r="3.5" fill="#0284c7" />
                <text x={point.x} y={Math.max(12, point.y - 8)} textAnchor="middle" fontSize="8" fill="#334155">{point.quantityDispensed}</text>
                <text x={point.x} y="135" textAnchor="middle" fontSize="8" fill="#64748b">{new Date(`${point.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</text>
              </g>
            ))}
            {!trendPoints.length && <text x="150" y="70" textAnchor="middle" fontSize="11" fill="#64748b">{loading ? 'Loading activity…' : 'No dispensing activity recorded'}</text>}
          </svg>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Most Dispensed Medicines</h2>
              <p className="mt-1 text-[11px] text-slate-500">Recorded issue quantity · last 7 days</p>
            </div>
            <Pill size={18} className="text-emerald-700" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-3">
            {dashboard.topDispensed.map((item) => {
              const maximum = Math.max(...dashboard.topDispensed.map((medicine) => medicine.quantityDispensed || 0), 1);
              return (
                <div key={item.name} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2">
                  <span className="truncate text-[11px] font-medium text-slate-700">{item.name}</span>
                  <div className="h-2.5 overflow-hidden rounded-r-full bg-slate-100">
                    <div className="h-full rounded-r-full bg-gradient-to-r from-blue-500 to-blue-700" style={{ width: `${Math.max(3, (item.quantityDispensed / maximum) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{item.quantityDispensed}</span>
                </div>
              );
            })}
            {!dashboard.topDispensed.length && !loading && <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No medicine issue logs recorded in the last 7 days.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-orange-100 bg-orange-50/70 p-4 shadow-sm">
          <h2 className="font-bold text-slate-900">Quick Actions</h2>
          <p className="mt-1 text-[11px] text-slate-500">Open a pharmacy workspace.</p>
          <div className="mt-4 space-y-2">
            <Link to="/dispensary/dispense" className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-xs font-semibold text-blue-800 shadow-sm hover:bg-blue-50"><Pill size={15} aria-hidden="true" />New Dispense</Link>
            <Link to="/dispensary/stock" className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-xs font-semibold text-blue-800 shadow-sm hover:bg-blue-50"><Package size={15} aria-hidden="true" />Manage Stock</Link>
            <Link to="/dispensary/reports/daily" className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-xs font-semibold text-blue-800 shadow-sm hover:bg-blue-50"><ClipboardList size={15} aria-hidden="true" />View Reports</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DispensaryDashboard;

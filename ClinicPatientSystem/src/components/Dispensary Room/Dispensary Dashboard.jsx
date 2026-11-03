import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock3,
  Package,
  Pill,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

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
    return () => window.clearInterval(timer);
  }, [loadDashboard, refreshKey]);

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

  const pendingPrescriptionCount = dashboard.pendingPrescriptions?.length ?? dashboard.summary.pendingDispenseCount;
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
            <>
              <div className="divide-y divide-slate-100">
                {(showAllPrescriptions ? dashboard.pendingPrescriptions : dashboard.pendingPrescriptions.slice(0, 5)).map((visit) => (
                  <article key={visit.visitId} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{visit.patientName} · MRN: {visit.cardNumber}</p>
                        <p className="text-[11px] text-slate-500">{visit.studentId ? `Student ID: ${visit.studentId} · ` : ''}{visit.visitNumber || visit.visitId} · {formatDate(visit.visitDate)} · {visit.diagnosis || 'No diagnosis recorded'}</p>
                        {visit.allergies?.length > 0 && (
                          <p role="alert" className="mt-1 flex items-start gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                            Allergies: {visit.allergies.join(', ')}
                          </p>
                        )}
                        {!visit.allergies?.length && (
                          <p role="status" className="mt-1 text-[11px] font-semibold text-amber-700">Allergy status not recorded — verify with the patient.</p>
                        )}
                        {visit.prescriber?.name && <p className="text-[11px] text-slate-500">Prescriber: {visit.prescriber.name}</p>}
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">{visit.status}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px] text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Medicine &amp; instructions</th><th className="p-2">Quantity / Stock</th><th className="p-2">Price (Birr / Cent)</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {visit.prescriptions.map((item) => (
                            <tr key={item.id}>
                              <td className="p-2 font-medium">
                                {item.medicine} {item.strength} {item.form}
                                <span className="block font-normal text-slate-500">{[item.dose, item.frequency, item.duration, item.instructions].filter(Boolean).join(' · ') || 'No usage instructions recorded'}</span>
                              </td>
                              <td className="p-2">
                                <span className="block">{[item.quantity, item.quantityUnit].filter(Boolean).join(' ') || 'Quantity not specified'}</span>
                                <span className={`block text-[11px] font-semibold ${item.stock?.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {item.stock?.quantity > 0
                                    ? `In stock: ${item.stock.quantity} ${item.stock.unit || ''}`
                                    : item.stock?.status === 'not_listed' ? 'Not listed in inventory' : 'Out of stock'}
                                </span>
                                {item.stock?.batches?.length > 0 && <span className="block text-[10px] text-slate-500">Soonest expiry: {formatDate(item.stock.batches.slice().sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0].expiryDate)}</span>}
                              </td>
                              <td className="p-2"><div className="flex items-center gap-1"><input aria-label={`${item.medicine} price in Birr`} type="number" min="0" step="1" value={priceInputs[item.id]?.birr ?? '0'} onChange={(event) => setPriceInputs((current) => ({ ...current, [item.id]: { ...current[item.id], birr: event.target.value } }))} className="w-20 rounded border border-slate-300 px-2 py-1" /><span>Birr</span><input aria-label={`${item.medicine} price in cents`} type="number" min="0" max="99" step="1" value={priceInputs[item.id]?.cent ?? '00'} onChange={(event) => setPriceInputs((current) => ({ ...current, [item.id]: { ...current[item.id], cent: event.target.value } }))} className="w-16 rounded border border-slate-300 px-2 py-1" /><span>Cent</span></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-right text-xs font-bold text-slate-700">
                      Total: {(() => {
                        const cents = visit.prescriptions.reduce((sum, item) => {
                          const value = priceInputs[item.id] || { birr: '0', cent: '0' };
                          return sum + (Number(value.birr) * 100) + Number(value.cent);
                        }, 0);
                        return `${Math.floor(cents / 100)} Birr ${String(cents % 100).padStart(2, '0')} Cent`;
                      })()}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" disabled={processingVisitId === visit.visitId} onClick={() => void updatePrescription(visit, 'Cancelled')} className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancel</button>
                      <button type="button" disabled={processingVisitId === visit.visitId || visit.prescriptions.some((item) => !item.stock?.quantity || !/^\d+(?:\.\d+)?$/.test(String(item.quantity || '').trim()) || Number(item.quantity) > item.stock.quantity)} onClick={() => void updatePrescription(visit, 'Dispensed')} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{processingVisitId === visit.visitId ? 'Saving…' : 'Dispense all medicines'}</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

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

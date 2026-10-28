import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Clock3, Download, FileText, Printer, RefreshCw, Send, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const categories = ['Student', 'Staff', 'Other Authorized Patient'];
const visitTypes = ['New Visit', 'Follow-up Visit', 'Emergency Visit'];
const todayInClinic = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Addis_Ababa',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const clinicDateOffset = (date, offset) => {
  const updated = new Date(`${date}T12:00:00+03:00`);
  updated.setUTCDate(updated.getUTCDate() + offset);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(updated);
};

const responseError = async (response) => {
  const result = await response.json().catch(() => ({}));
  return result.message || `Request failed (${response.status}).`;
};

const escapeCsv = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

function getPresetRange(preset) {
  const today = todayInClinic();
  if (preset === 'today') return [today, today];
  if (preset === 'week') {
    const weekday = new Date(`${today}T12:00:00+03:00`).getUTCDay();
    return [clinicDateOffset(today, -((weekday + 6) % 7)), today];
  }
  if (preset === 'month') return [`${today.slice(0, 7)}-01`, today];
  return ['', ''];
}

function MetricCard({ title, value, description, icon: Icon, tone }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value ?? '—'}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <span className={`rounded-xl p-3 ${tone}`}><Icon size={20} aria-hidden="true" /></span>
      </div>
    </article>
  );
}

export default function CardRoomReports() {
  const { token } = useAuth();
  const [preset, setPreset] = useState('month');
  const [startDate, setStartDate] = useState(() => getPresetRange('month')[0]);
  const [endDate, setEndDate] = useState(() => getPresetRange('month')[1]);
  const [patientCategory, setPatientCategory] = useState('');
  const [visitType, setVisitType] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    let active = true;
    const loadReport = async () => {
      if (!startDate || !endDate || startDate > endDate) {
        setReport(null);
        setLoading(false);
        setError('Choose a valid start and end date for the report.');
        return;
      }
      setLoading(true);
      setError('');
      setNotice('');
      setReport(null);
      try {
        const params = new URLSearchParams({ startDate, endDate });
        if (patientCategory) params.set('patientCategory', patientCategory);
        if (visitType) params.set('visitType', visitType);
        const response = await fetch(`/api/card-room/reports?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await responseError(response));
        const result = await response.json();
        if (!result.success || !result.data) throw new Error(result.message || 'The report response was incomplete.');
        if (active) setReport(result.data);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load Card Room reports.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReport();
    return () => { active = false; };
  }, [token, startDate, endDate, patientCategory, visitType]);

  const updateDate = (setter) => (event) => {
    setPreset('custom');
    setter(event.target.value);
  };

  const changePreset = (value) => {
    setPreset(value);
    const [start, end] = getPresetRange(value);
    setStartDate(start);
    setEndDate(end);
  };

  const exportCsv = async () => {
    setExportingCsv(true);
    setError('');
    try {
      const lines = [
        ['MAU Clinic · Card Room Report'],
        ['Period', `${startDate} to ${endDate}`],
        ['Patients registered', summary.registrations ?? 0],
        ['New visits', summary.newVisits ?? 0],
        ['Repeat / follow-up visits', summary.repeatVisits ?? 0],
        ['Emergency visits', summary.emergencyVisits ?? 0],
        ['Total visits', summary.visits ?? 0],
        ['Average wait to service (minutes)', summary.averageWaitingMinutes ?? 'Insufficient timestamp data'],
        ['Visits included in average wait', summary.measuredWaitingVisits ?? 0],
        ['Peak hour', summary.peakHour || 'No visits recorded'],
        [],
        ['Department breakdown'],
        ['Department', 'Visits'],
        ...(report?.departmentBreakdown || []).map((item) => [item.department, item.count]),
        [],
        ['Patient category breakdown'],
        ['Patient category', 'Patients'],
        ...(report?.patientCategories || []).map((item) => [item.category, item.count]),
        [],
        ['Visit type breakdown'],
        ['Visit type', 'Visits'],
        ...(report?.visitTypes || []).map((item) => [item.visitType, item.count]),
        [],
        ['Hourly breakdown (Africa/Addis_Ababa)'],
        ['Hour', 'Visits'],
        ...(report?.hourlyBreakdown || []).map((item) => [item.hour, item.count]),
        [],
        ['Privacy', 'Aggregated statistics only; patient identifiers and clinical details are excluded.'],
      ];
      const csv = `\uFEFF${lines.map((line) => line.map(escapeCsv).join(',')).join('\r\n')}`;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `card-room-report-${startDate}-${endDate}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message || 'Unable to export the report.');
    } finally {
      setExportingCsv(false);
    }
  };

  const exportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    setError('');
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const pdf = new jsPDF({ orientation: 'landscape' });
      pdf.setFontSize(16);
      pdf.text('MAU Clinic · Card Room Report', 14, 16);
      pdf.setFontSize(10);
      pdf.text(`Period: ${startDate} to ${endDate}`, 14, 23);
      pdf.text(`Registered: ${summary.registrations ?? 0} | New visits: ${summary.newVisits ?? 0} | Follow-up: ${summary.repeatVisits ?? 0} | Emergency: ${summary.emergencyVisits ?? 0}`, 14, 29);
      pdf.text(`Total visits: ${summary.visits ?? 0} | Average wait to service: ${summary.averageWaitingMinutes == null ? 'Insufficient data' : `${summary.averageWaitingMinutes} minutes (${summary.measuredWaitingVisits} measured)`} | Peak hour: ${summary.peakHour || 'No visits recorded'}`, 14, 35);
      autoTable(pdf, {
        startY: 41,
        head: [['Department', 'Visits']],
        body: (report.departmentBreakdown || []).map((item) => [item.department, item.count]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [15, 118, 110] },
      });
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [['Patient category', 'Patients']],
        body: (report.patientCategories || []).map((item) => [item.category, item.count]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [15, 118, 110] },
      });
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [['Visit type', 'Visits']],
        body: (report.visitTypes || []).map((item) => [item.visitType, item.count]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [15, 118, 110] },
      });
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 6,
        head: [['Hour (Africa/Addis_Ababa)', 'Visits']],
        body: (report.hourlyBreakdown || []).map((item) => [item.hour, item.count]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [15, 118, 110] },
      });
      pdf.setFontSize(8);
      pdf.text('Privacy: Aggregate statistics only. Patient identifiers and clinical details are excluded.', 14, pdf.lastAutoTable.finalY + 8);
      pdf.save(`card-room-report-${startDate}-${endDate}.pdf`);
    } catch (exportError) {
      setError(exportError.message || 'Unable to create the PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const submitToHead = async () => {
    if (!report || !startDate || !endDate) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/card-room/reports/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          summary: {
            ...report.summary,
            departmentBreakdown: report.departmentBreakdown,
            patientCategories: report.patientCategories,
            visitTypes: report.visitTypes,
            hourlyBreakdown: report.hourlyBreakdown,
            privacy: report.privacy,
          },
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Report submission was not confirmed.');
      setNotice([result.message, result.warning].filter(Boolean).join(' '));
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit the report.');
    } finally {
      setSubmitting(false);
    }
  };

  const summary = report?.summary || {};

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .card-reports-print, .card-reports-print * { visibility: visible !important; }
          .card-reports-print { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 18px; }
          .reports-no-print { display: none !important; }
        }
      `}</style>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">MAU Clinic · Card Room</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Card Room Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Patient registrations, follow-up visits, and department routing.</p>
        </div>
        <div className="reports-no-print flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Printer size={16} /> Print</button>
          <button type="button" onClick={() => void exportPdf()} disabled={!report || loading || exportingPdf} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><FileText size={16} />{exportingPdf ? 'Creating PDF…' : 'Export PDF'}</button>
          <button type="button" onClick={() => void exportCsv()} disabled={!report || loading || exportingCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download size={16} />{exportingCsv ? 'Exporting…' : 'Export CSV (Excel compatible)'}</button>
          <button type="button" onClick={() => void submitToHead()} disabled={!report || loading || submitting} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} />{submitting ? 'Submitting…' : 'Submit to Student Head'}</button>
        </div>
      </header>

      <section className="reports-no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-semibold text-slate-500">Report period
            <select value={preset} onChange={(event) => changePreset(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800">
              <option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom range</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">From
            <input type="date" value={startDate} max={endDate || undefined} onChange={updateDate(setStartDate)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800" />
          </label>
          <label className="text-xs font-semibold text-slate-500">To
            <input type="date" value={endDate} min={startDate || undefined} max={todayInClinic()} onChange={updateDate(setEndDate)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800" />
          </label>
          <label className="text-xs font-semibold text-slate-500">Patient category
            <select value={patientCategory} onChange={(event) => setPatientCategory(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
              <option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Visit type
            <select value={visitType} onChange={(event) => setVisitType(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
              <option value="">All visit types</option>{visitTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <div className="card-reports-print space-y-6">
        <section aria-label="Report summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="Patients Registered" value={loading ? '…' : report ? summary.registrations ?? 0 : '—'} description="New patient records in the selected period" icon={Users} tone="bg-sky-50 text-sky-700" />
          <MetricCard title="New vs Follow-up Visits" value={loading ? '…' : report ? `${summary.newVisits ?? 0} / ${summary.repeatVisits ?? 0}` : '—'} description="New visits / follow-up visits" icon={RefreshCw} tone="bg-amber-50 text-amber-700" />
          <MetricCard title="Emergency Visits" value={loading ? '…' : report ? summary.emergencyVisits ?? 0 : '—'} description="Emergency visits in the selected period" icon={AlertTriangle} tone="bg-rose-50 text-rose-700" />
          <MetricCard title="Average Wait to Service" value={loading ? '…' : report ? summary.averageWaitingMinutes == null ? 'Insufficient data' : `${summary.averageWaitingMinutes} min` : '—'} description={report ? `Based on ${summary.measuredWaitingVisits ?? 0} recorded service starts; older records without timestamps are excluded.` : 'From arrival until service starts'} icon={Clock3} tone="bg-violet-50 text-violet-700" />
          <MetricCard title="Peak Hour" value={loading ? '…' : report ? summary.peakHour || 'No visits' : '—'} description={report ? `${summary.peakHourVisits ?? 0} visits during this hour` : 'Busiest arrival hour'} icon={BarChart3} tone="bg-orange-50 text-orange-700" />
          <MetricCard title="Total Visits" value={loading ? '…' : report ? summary.visits ?? 0 : '—'} description="All registered visits in the selected period" icon={Send} tone="bg-teal-50 text-teal-700" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {[
            { title: 'Department Breakdown', rows: report?.departmentBreakdown || [], name: 'department' },
            { title: 'Visit Type Breakdown', rows: report?.visitTypes || [], name: 'visitType' },
            { title: 'Patient Category Breakdown', rows: report?.patientCategories || [], name: 'category' },
            { title: 'Peak Hours (Africa/Addis_Ababa)', rows: report?.hourlyBreakdown || [], name: 'hour' },
          ].map(({ title, rows: items, name }) => (
            <article key={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-xs text-slate-500">{startDate} to {endDate}</p>
              </header>
              {loading ? <p className="p-5 text-sm text-slate-500">Loading aggregate statistics…</p>
                : items.length ? (
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const label = item[name] || 'Unspecified';
                      const total = items.reduce((sum, entry) => sum + entry.count, 0);
                      const percentage = total ? Math.round((item.count / total) * 1000) / 10 : 0;
                      return (
                        <div key={label} className="px-5 py-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-slate-700">{label}</span>
                            <span className="font-semibold text-slate-900">{item.count} <span className="font-normal text-slate-500">({percentage}%)</span></span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(percentage, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="p-5 text-sm text-slate-500">No data is available for this period and the selected filters. Try a different date range or clear a filter.</p>}
            </article>
          ))}
          <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900 lg:col-span-2">
            <h2 className="font-semibold">Data privacy</h2>
            <p className="mt-1">{report?.privacy || 'Reports and exports show aggregate statistics only. Patient identifiers and clinical details are excluded.'}</p>
          </aside>
        </section>
      </div>
    </div>
  );
}

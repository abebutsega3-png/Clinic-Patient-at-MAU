import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const API_URL = '/api/examination/reports';
const tabs = ['All', 'Outpatient', 'Inpatient', 'Referral Log Book'];
const emptyData = {
  outpatientRecords: [],
  inpatientRecords: [],
  referralRecords: [],
  summary: { outpatient: 0, inpatient: 0, referralLogBook: 0 },
};

const columns = {
  Outpatient: [
    ['date', 'Date'],
    ['mrn', 'MRN'],
    ['patientName', 'Patient Name'],
    ['ageSex', 'Age / Sex'],
    ['diagnosisNotes', 'Diagnosis / Notes'],
    ['status', 'Status'],
  ],
  Inpatient: [
    ['admissionDate', 'Admission Date'],
    ['mrn', 'MRN'],
    ['patientName', 'Patient Name'],
    ['ageSex', 'Age / Sex'],
    ['wardOrStatus', 'Ward / Admission Status'],
    ['diagnosisNotes', 'Diagnosis / Notes'],
  ],
  'Referral Log Book': [
    ['date', 'Referral Date'],
    ['mrn', 'MRN'],
    ['patientName', 'Patient Name'],
    ['referredTo', 'Referred To'],
    ['reasonSummary', 'Reason / Summary'],
    ['status', 'Status'],
  ],
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

function ReportTable({ title, type, rows }) {
  const fields = columns[type];
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{rows.length} records</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>{fields.map(([, label]) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row, index) => (
              <tr key={`${row.mrn}-${row.date || row.admissionDate || index}`} className="align-top hover:bg-slate-50">
                {fields.map(([key]) => (
                  <td key={key} className="max-w-64 px-3 py-3">
                    {key === 'date' || key === 'admissionDate' ? formatDate(row[key]) : row[key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={fields.length} className="p-8 text-center text-slate-500">No {title.toLowerCase()} records match the selected filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ExaminationReports() {
  const { token, expireSession } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({
    outpatientRecords: [],
    inpatientRecords: [],
    referralRecords: [],
    summary: { outpatient: 0, inpatient: 0, referralLogBook: 0 },
  });
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const dateRangeError = (Boolean(startDate) !== Boolean(endDate)
    || (Boolean(startDate) && startDate > endDate))
    ? 'Choose both a start and end date, and make sure the start date is not later.'
    : '';
  const reportData = dateRangeError ? emptyData : data;
  const isLoading = loading && Boolean(token) && !dateRangeError;

  useEffect(() => {
    if (!token) return undefined;
    if (dateRangeError) return undefined;

    const controller = new AbortController();
    const loadReports = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ startDate, endDate, search });
        const response = await fetch(`${API_URL}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (response.status === 401) expireSession();
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Unable to load examination reports (${response.status}).`);
        }
        setData({
          outpatientRecords: Array.isArray(result.data?.outpatientRecords) ? result.data.outpatientRecords : [],
          inpatientRecords: Array.isArray(result.data?.inpatientRecords) ? result.data.inpatientRecords : [],
          referralRecords: Array.isArray(result.data?.referralRecords) ? result.data.referralRecords : [],
          summary: {
            outpatient: Number(result.data?.summary?.outpatient) || 0,
            inpatient: Number(result.data?.summary?.inpatient) || 0,
            referralLogBook: Number(result.data?.summary?.referralLogBook) || 0,
          },
        });
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load examination reports.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadReports();
    return () => controller.abort();
  }, [startDate, endDate, search, token, expireSession, dateRangeError]);

  const activeReportRows = useMemo(() => {
    if (activeTab === 'Outpatient') return reportData.outpatientRecords;
    if (activeTab === 'Inpatient') return reportData.inpatientRecords;
    if (activeTab === 'Referral Log Book') return reportData.referralRecords;
    return [
      ...reportData.outpatientRecords.map((record) => ({ ...record, reportCategory: 'Outpatient' })),
      ...reportData.inpatientRecords.map((record) => ({ ...record, reportCategory: 'Inpatient' })),
      ...reportData.referralRecords.map((record) => ({ ...record, reportCategory: 'Referral Log Book' })),
    ];
  }, [activeTab, reportData]);

  const exportCsv = () => {
    const rows = activeReportRows;
    if (!rows.length) return;
    const fields = activeTab === 'All'
      ? ['reportCategory', 'mrn', 'patientName', 'ageSex', 'date', 'admissionDate', 'diagnosisNotes', 'wardOrStatus', 'referredTo', 'reasonSummary', 'status']
      : columns[activeTab].map(([key]) => key);
    const csv = [
      fields.join(','),
      ...rows.map((row) => fields.map((field) => `"${String(row[field] || '').replaceAll('"', '""')}"`).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `examination-${activeTab.toLowerCase().replaceAll(' ', '-')}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendToClinicHead = async () => {
    if (!token) {
      setError('Sign in to send this report to the Clinic Head.');
      return;
    }
    if (dateRangeError) {
      setError(dateRangeError);
      return;
    }
    setSending(true);
    setError('');
    setSendResult(null);
    try {
      const response = await fetch(`${API_URL}/send-to-clinic-head`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportType: activeTab, startDate, endDate, search }),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 401) expireSession();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to send report (${response.status}).`);
      }
      setSendResult({
        message: result.warning || `${result.message} Status: ${result.data?.status || 'SENT'}.`,
        status: result.data?.status || 'SENT',
      });
    } catch (sendError) {
      setError(sendError.message || 'Unable to send report to the Clinic Head.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-4 text-slate-900">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Examination Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live records from completed examinations: Admit is counted as inpatient; referrals appear in the Referral Log Book.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={exportCsv} disabled={!activeReportRows.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download size={15} /> Export CSV
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Printer size={15} /> Print
          </button>
          <button type="button" onClick={() => void sendToClinicHead()} disabled={sending || loading || Boolean(dateRangeError)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            <Send size={15} /> {sending ? 'Sending…' : 'Send to Clinic Head'}
          </button>
        </div>
      </header>

      {(error || dateRangeError) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error || dateRangeError}</p>}
      {sendResult && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{sendResult.message} {sendResult.status === 'SENT' && <a className="ml-1 font-semibold underline" href="/clinic-head/department-reports">View in Clinic Head reports</a>}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Outpatients', reportData.summary.outpatient],
          ['Inpatients', reportData.summary.inpatient],
          ['Referral Log Book', reportData.summary.referralLogBook],
        ].map(([label, count]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{count ?? 0}</p>
          </article>
        ))}
      </div>

      <form onSubmit={(event) => event.preventDefault()} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr] print:hidden">
        <label className="text-xs font-semibold text-slate-600">Start date
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">End date
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Search MRN, patient name, or diagnosis
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports…" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </form>

      <div className="flex flex-wrap gap-2 print:hidden" role="tablist" aria-label="Examination report type">
        {tabs.map((tab) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Loading examination reports…</p>
      ) : activeTab === 'All' ? (
        <div className="space-y-4">
          <ReportTable type="Outpatient" title="Outpatient Report" rows={reportData.outpatientRecords} />
          <ReportTable type="Inpatient" title="Inpatient Report" rows={reportData.inpatientRecords} />
          <ReportTable type="Referral Log Book" title="Referral Log Book" rows={reportData.referralRecords} />
        </div>
      ) : (
        <ReportTable
          type={activeTab}
          title={activeTab === 'Referral Log Book' ? activeTab : `${activeTab} Report`}
          rows={activeReportRows}
        />
      )}
    </section>
  );
}

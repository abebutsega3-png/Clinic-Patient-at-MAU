import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Filter,
  MessageSquare,
  Printer,
  RotateCcw,
  RefreshCw,
  Share2,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const getClinicDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getDefaultFilters = () => {
  const endDate = getClinicDate();
  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 7);
  return {
    department: 'All',
    reportType: 'All',
    status: 'All',
    submittedBy: 'All',
    startDate: start.toISOString().slice(0, 10),
    endDate,
  };
};

const formatDate = (value, options = {}) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
      timeZone: 'Africa/Addis_Ababa',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...options,
    }).format(date);
};

const statusDetails = {
  draft: { label: 'Draft', classes: 'bg-slate-100 text-slate-700' },
  submitted: { label: 'Submitted', classes: 'bg-sky-100 text-sky-800' },
  under_review: { label: 'Under Review', classes: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-800' },
  returned: { label: 'Returned', classes: 'bg-orange-100 text-orange-800' },
  rejected: { label: 'Rejected', classes: 'bg-rose-100 text-rose-800' },
  new: { label: 'Needs Review', classes: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Reviewed', classes: 'bg-emerald-100 text-emerald-800' },
};

const getStatusDetails = (status) => statusDetails[status] || {
  label: status || 'Unknown',
  classes: 'bg-slate-100 text-slate-700',
};

const getReportContent = (content) => {
  if (!content) return 'No report details were provided.';
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
};

function SummaryCard({ title, value, caption, icon: Icon, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
  };
  return (
    <article className={`min-w-0 rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="truncate text-[10px] font-semibold opacity-70">{caption}</span>
      </div>
      <p className="mt-2 text-2xl font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-600">{title}</p>
    </article>
  );
}

export default function ClinicHeadDepartmentReports() {
  const { token } = useAuth();
  const [draftFilters, setDraftFilters] = useState(getDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(getDefaultFilters);
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [reportTypes, setReportTypes] = useState([]);
  const [submitters, setSubmitters] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    needsReview: 0,
    reviewed: 0,
    departmentsReporting: 0,
    reportTypes: 0,
    approved: 0,
    returned: 0,
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [filterError, setFilterError] = useState('');

  const query = useMemo(() => new URLSearchParams(appliedFilters).toString(), [appliedFilters]);

  const fetchReports = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError('Please sign in to view department reports.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`/api/reports/department-reports?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const entries = Array.isArray(data.data) ? data.data : [];
      setReports(entries);
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setReportTypes(Array.isArray(data.reportTypes) ? data.reportTypes : []);
      setSubmitters(Array.isArray(data.submitters) ? data.submitters : []);
      setComparison(Array.isArray(data.comparison) ? data.comparison : []);
      setSummary(data.summary || {
        total: entries.length,
        needsReview: entries.filter((report) => report.status === 'new').length,
        reviewed: entries.filter((report) => report.status === 'reviewed').length,
        approved: entries.filter((report) => report.status === 'approved').length,
        returned: entries.filter((report) => report.status === 'returned').length,
        departmentsReporting: new Set(entries.map((report) => report.department)).size,
        reportTypes: new Set(entries.map((report) => report.reportType)).size,
      });
      setSelectedReport((current) => entries.find((report) => report._id === current?._id) || entries[0] || null);
    } catch (loadError) {
      console.error('Failed to load department reports:', loadError);
      setError(loadError.response?.data?.message || 'Unable to load department reports.');
      setReports([]);
      setSelectedReport(null);
    } finally {
      setLoading(false);
    }
  }, [query, token]);

  useEffect(() => {
    void Promise.resolve().then(fetchReports);
  }, [fetchReports]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io({ auth: { token } });
    socket.on('clinic:department-report-submitted', () => void fetchReports());
    socket.on('clinic:department-report-updated', () => void fetchReports());
    return () => socket.disconnect();
  }, [fetchReports, token]);

  const updateDraft = (key, value) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    if (!draftFilters.startDate || !draftFilters.endDate || draftFilters.startDate > draftFilters.endDate) {
      setFilterError('Choose a valid date range.');
      return;
    }
    setFilterError('');
    setAppliedFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    const defaults = getDefaultFilters();
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setFilterError('');
  };

  const reviewAction = async (action) => {
    if (!selectedReport) return;
    if (['returned', 'rejected'].includes(action) && !reviewComment.trim()) {
      setError('Add a comment explaining why the report is being returned or rejected.');
      return;
    }
    setSavingReview(true);
    setError('');
    setActionMessage('');
    try {
      const { data } = await axios.patch(
        `/api/reports/department-reports/${selectedReport._id}/review`,
        { action, comment: reviewComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedReport(data.data);
      setReviewComment('');
      setActionMessage(data.warning || (action === 'commented' ? 'Comment added to report.' : `Report ${action.replace('_', ' ')}.`));
      await fetchReports();
    } catch (reviewError) {
      console.error('Failed to review department report:', reviewError);
      setError(reviewError.response?.data?.message || 'Unable to update the report review status.');
    } finally {
      setSavingReview(false);
    }
  };

  const downloadExcelCsv = () => {
    const escapeCell = (value) => {
      const text = String(value ?? '');
      const safeText = /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    };
    const columns = [
      ['Department', (report) => report.department],
      ['Report type', (report) => report.reportType],
      ['Title', (report) => report.title],
      ['Report date', (report) => report.reportDate || report.submittedAt],
      ['Submitted by', (report) => report.submittedBy?.name || report.submittedBy?.username],
      ['Status', (report) => statusDetails[report.status]?.label || report.status],
      ['Patients served', (report) => report.patientsServed],
      ['Completed services', (report) => report.completedServices],
      ['Staff present', (report) => report.staffPresent],
      ['Staff absent', (report) => report.staffAbsent],
      ['Pending cases', (report) => report.pendingCases],
      ['Problems/incidents', (report) => report.problemsIncidents],
      ['Medicine/supply status', (report) => report.medicineSupplyStatus],
      ['Additional notes', (report) => report.additionalNotes],
    ];
    const content = [
      columns.map(([label]) => escapeCell(label)).join(','),
      ...reports.map((report) => columns.map(([, value]) => escapeCell(value(report))).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'department-reports.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!reports.length) return;
    setExportingPdf(true);
    setError('');
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const pdf = new jsPDF({ orientation: 'landscape' });
      pdf.setFontSize(16);
      pdf.text('MAU Clinic · Department Reports', 14, 16);
      pdf.setFontSize(10);
      pdf.text(`Period: ${appliedFilters.startDate} to ${appliedFilters.endDate} · ${reports.length} reports shown`, 14, 23);
      autoTable(pdf, {
        startY: 29,
        head: [['Department', 'Report / Type', 'Report date', 'Submitted by', 'Status', 'Patients', 'Services', 'Present', 'Absent', 'Pending']],
        body: reports.map((report) => [
          report.department,
          `${report.title} / ${report.reportType}`,
          formatDate(report.reportDate || report.submittedAt),
          report.submittedBy?.name || report.submittedBy?.username || '—',
          statusDetails[report.status]?.label || report.status,
          report.patientsServed ?? '—',
          report.completedServices ?? '—',
          report.staffPresent ?? '—',
          report.staffAbsent ?? '—',
          report.pendingCases ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175] },
      });
      pdf.save('department-reports.pdf');
    } catch (exportError) {
      console.error('Failed to generate department report PDF:', exportError);
      setError(exportError.message || 'Unable to download the PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const shareSelectedReport = async () => {
    if (!selectedReport) return;
    const text = `${selectedReport.department}: ${selectedReport.title} (${statusDetails[selectedReport.status]?.label || selectedReport.status})`;
    try {
      if (navigator.share) await navigator.share({ title: selectedReport.title, text });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw new Error('Sharing is not supported in this browser.');
      setActionMessage('Report details shared.');
    } catch (shareError) {
      if (shareError.name === 'AbortError') return;
      console.error('Failed to share department report:', shareError);
      setError(shareError.message || 'Unable to share report details.');
    }
  };

  const status = selectedReport ? getStatusDetails(selectedReport.status) : null;

  return (
    <div className="min-h-full bg-slate-50 p-3 sm:p-4">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              <FileText size={20} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Department Reports</h1>
              <p className="text-xs text-slate-500 sm:text-sm">Monitor and review department reports across the clinic</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={downloadExcelCsv} disabled={!reports.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <FileText size={14} aria-hidden="true" /> Export Excel (CSV)
            </button>
            <button type="button" onClick={() => void downloadPdf()} disabled={!reports.length || exportingPdf} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <FileText size={14} aria-hidden="true" /> {exportingPdf ? 'Creating PDF…' : 'Download PDF'}
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Printer size={14} aria-hidden="true" /> Print / Save PDF
            </button>
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              <CalendarDays size={15} className="text-blue-600" aria-hidden="true" />
              {formatDate(getClinicDate())}
            </div>
          </div>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard title="Reports Received" value={summary.total} caption="In selected period" icon={ClipboardList} tone="blue" />
          <SummaryCard title="Needs Review" value={summary.needsReview} caption="Awaiting review" icon={Clock3} tone="amber" />
          <SummaryCard title="Approved" value={summary.approved} caption="Final approval" icon={Check} tone="emerald" />
          <SummaryCard title="Returned" value={summary.returned} caption="Needs correction" icon={RotateCcw} tone="rose" />
          <SummaryCard title="Departments Reporting" value={summary.departmentsReporting} caption="In selected results" icon={Building2} tone="violet" />
          <SummaryCard title="Report Types" value={summary.reportTypes} caption="In selected results" icon={BarChart3} tone="rose" />
        </div>

        <form onSubmit={applyFilters} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_1fr_auto_auto] xl:items-end">
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">
              <span>Department</span>
              <select value={draftFilters.department} onChange={(event) => updateDraft('department', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="All">All Departments</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">
              <span>Report Type</span>
              <select value={draftFilters.reportType} onChange={(event) => updateDraft('reportType', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="All">All Report Types</option>
                {reportTypes.map((reportType) => <option key={reportType} value={reportType}>{reportType}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">
              <span>Start Date</span>
              <input type="date" value={draftFilters.startDate} onChange={(event) => updateDraft('startDate', event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">
              <span>End Date</span>
              <input type="date" value={draftFilters.endDate} onChange={(event) => updateDraft('endDate', event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">
              <span>Status</span>
              <select value={draftFilters.status} onChange={(event) => updateDraft('status', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="All">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
                <option value="new">Needs Review</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </label>
            <label className="space-y-1 text-[11px] font-semibold text-slate-500">
              <span>Submitted By</span>
              <select value={draftFilters.submittedBy} onChange={(event) => updateDraft('submittedBy', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="All">All Submitters</option>
                {submitters.map((submitter) => <option key={submitter._id} value={submitter._id}>{submitter.name}</option>)}
              </select>
            </label>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700">
              <Filter size={14} aria-hidden="true" />
              Apply Filters
            </button>
            <button type="button" onClick={resetFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              <RefreshCw size={14} aria-hidden="true" />
              Reset
            </button>
          </div>
          {filterError && <p role="alert" className="mt-2 text-xs text-rose-600">{filterError}</p>}
        </form>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Department Reports</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">{summary.total} reports match the selected filters</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">{reports.length} shown</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Department</th>
                    <th className="px-3 py-3 font-semibold">Report Type / Title</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Submitted By</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading department reports…</td></tr>
                  ) : reports.length ? reports.map((report) => {
                    const reportStatus = getStatusDetails(report.status);
                    return (
                      <tr key={report._id} className={`transition hover:bg-blue-50/50 ${selectedReport?._id === report._id ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-3 font-semibold text-slate-800">{report.department}</td>
                        <td className="max-w-64 px-3 py-3">
                          <p className="font-semibold text-slate-700">{report.reportType}</p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">{report.title}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{formatDate(report.reportDate || report.submittedAt)}</td>
                        <td className="px-3 py-3">{report.submittedBy?.name || report.submittedBy?.username || '—'}</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${reportStatus.classes}`}>{reportStatus.label}</span></td>
                        <td className="px-3 py-3 text-right">
                          <button type="button" onClick={() => setSelectedReport(report)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-blue-700 hover:bg-blue-50">
                            <Eye size={13} aria-hidden="true" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">No department reports match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-[10px] text-slate-500">
              <span>Showing up to 200 most recent reports</span>
              <button type="button" onClick={() => void fetchReports()} disabled={loading} className="inline-flex items-center gap-1 font-semibold text-blue-700 disabled:opacity-50">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
              </button>
            </footer>
          </section>

          <aside className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-4 py-3">
                {selectedReport ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Report Review · {selectedReport.department}</p>
                        <h2 className="mt-1 truncate text-sm font-bold text-slate-900">{selectedReport.title}</h2>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${status.classes}`}>{status.label}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{selectedReport.reportType} · {formatDate(selectedReport.submittedAt)}</p>
                  </>
                ) : (
                  <h2 className="text-sm font-bold text-slate-800">Report Review</h2>
                )}
              </header>
              {selectedReport ? (
                <div className="space-y-3 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-blue-50 p-2.5">
                      <p className="text-[10px] font-semibold text-blue-700">Department</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-800">{selectedReport.department}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2.5">
                      <p className="text-[10px] font-semibold text-emerald-700">Submitted By</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-800">{selectedReport.submittedBy?.name || selectedReport.submittedBy?.username || '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Patients served', selectedReport.patientsServed],
                      ['Completed services', selectedReport.completedServices],
                      ['Staff present', selectedReport.staffPresent],
                      ['Staff absent', selectedReport.staffAbsent],
                      ['Pending cases', selectedReport.pendingCases],
                      ['Period', `${selectedReport.periodType || '—'} · ${formatDate(selectedReport.periodStart || selectedReport.reportDate)}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-[10px] font-semibold text-slate-500">{label}</p>
                        <p className="mt-1 text-xs font-bold text-slate-800">{value ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                  {[
                    ['Problems / incidents', selectedReport.problemsIncidents],
                    ['Medicine / supply status', selectedReport.medicineSupplyStatus],
                    ['Additional notes', selectedReport.additionalNotes],
                    ['Legacy report details', selectedReport.content],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label}>
                      <h3 className="mb-1 text-[11px] font-bold text-slate-700">{label}</h3>
                      <div className="max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-slate-700">{label === 'Legacy report details' ? getReportContent(value) : value}</pre>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] font-semibold text-slate-500">Review status</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status.classes}`}>{status.label}</span>
                      <span className="text-[10px] text-slate-500">{selectedReport.reviewedAt ? `Reviewed ${formatDate(selectedReport.reviewedAt)}` : 'Awaiting review'}</span>
                    </div>
                  </div>
                  {selectedReport.reviewHistory?.length > 0 && (
                    <div className="rounded-lg border border-slate-200 p-3">
                      <h3 className="mb-2 text-[11px] font-bold text-slate-700">Comments and review history</h3>
                      <div className="max-h-40 space-y-2 overflow-auto">
                        {selectedReport.reviewHistory.slice().reverse().map((entry, index) => (
                          <div key={`${entry._id || entry.actedAt}-${index}`} className="border-l-2 border-blue-200 pl-2">
                            <p className="text-[10px] font-semibold capitalize text-slate-600">{entry.action.replaceAll('_', ' ')} · {entry.actorName || entry.actorId?.name || 'Clinic staff'} · {formatDate(entry.actedAt)}</p>
                            {entry.comment && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{entry.comment}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Review comment
                    <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={2000} className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Add feedback or explain corrections required." />
                  </label>
                  {actionMessage && <p role="status" className="text-xs font-medium text-emerald-700">{actionMessage}</p>}
                  <div className="flex flex-wrap gap-2">
                    {['submitted', 'new'].includes(selectedReport.status) && (
                      <button type="button" onClick={() => void reviewAction('under_review')} disabled={savingReview} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">
                        <Eye size={14} aria-hidden="true" /> Start Review
                      </button>
                    )}
                    {selectedReport.status === 'under_review' && (
                      <>
                        <button type="button" onClick={() => void reviewAction('approved')} disabled={savingReview} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                          <Check size={14} aria-hidden="true" /> Approve
                        </button>
                        <button type="button" onClick={() => void reviewAction('returned')} disabled={savingReview} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-700 disabled:opacity-50">
                          <RotateCcw size={14} aria-hidden="true" /> Return
                        </button>
                        <button type="button" onClick={() => void reviewAction('rejected')} disabled={savingReview} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50">
                          <XCircle size={14} aria-hidden="true" /> Reject
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => void reviewAction('commented')} disabled={savingReview || !reviewComment.trim()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      <MessageSquare size={14} aria-hidden="true" /> Add Comment
                    </button>
                    <button type="button" onClick={() => void shareSelectedReport()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <Share2 size={14} aria-hidden="true" /> Share
                    </button>
                    <Link to="/clinic-head/reports" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <BarChart3 size={14} aria-hidden="true" /> Analytics
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <FileText size={24} className="mx-auto text-slate-300" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold text-slate-700">{loading ? 'Loading reports…' : 'Select a report to review.'}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Choose a row in the table to see its details.</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800"><Users size={15} className="text-blue-600" aria-hidden="true" /> Review Summary</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-amber-50 p-2.5"><p className="text-[10px] text-amber-700">Awaiting review</p><p className="mt-1 font-bold text-slate-900">{summary.needsReview}</p></div>
                <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-[10px] text-emerald-700">Approved</p><p className="mt-1 font-bold text-slate-900">{summary.approved}</p></div>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-slate-500">Department metrics are self-reported and are not automatically reconciled against attendance or patient records.</p>
              <Link to="/clinic-head/reports" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline">
                Open full clinic analytics <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800"><BarChart3 size={15} className="text-blue-600" aria-hidden="true" /> Department Comparison</h2>
              <p className="mt-1 text-[10px] text-slate-500">Aggregated department-submitted totals for the selected date range.</p>
              <div className="mt-3 space-y-2">
                {comparison.length ? comparison.map((row) => (
                  <div key={row._id} className="rounded-lg bg-slate-50 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-slate-700">{row._id}</span>
                      <span className="text-[10px] text-slate-500">{row.reports} reports</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-600">
                      Patients {row.patientsServed} · Services {row.completedServices} · Pending {row.pendingCases} · Absent {row.staffAbsent}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">Supply alerts {row.supplyIssueReports} · Incident reports {row.incidentReports}</p>
                  </div>
                )) : <p className="rounded-lg bg-slate-50 p-3 text-center text-[10px] text-slate-500">No submitted metrics in this date range.</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

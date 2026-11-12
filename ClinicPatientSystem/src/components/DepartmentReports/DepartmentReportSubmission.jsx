import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { ArrowLeft, ClipboardList, FileText, RefreshCw, Send, Save } from 'lucide-react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const reportTypes = [
  'Daily Department Report',
  'Weekly Department Report',
  'Monthly Department Report',
  'Patient Service Report',
  'Staff Performance Report',
  'Department Attendance Report',
  'Medicine Consumption Report',
  'Inventory Report',
  'Incident Report',
  'Referral Report',
  'Card Room Report',
];

const getClinicDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const emptyForm = () => ({
  reportType: reportTypes[0],
  periodType: 'daily',
  reportDate: getClinicDate(),
  periodStart: '',
  periodEnd: '',
  title: 'Daily Department Report',
  patientsServed: '0',
  completedServices: '0',
  staffPresent: '0',
  staffAbsent: '0',
  pendingCases: '0',
  problemsIncidents: '',
  medicineSupplyStatus: '',
  additionalNotes: '',
});

const dateValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const statusDetails = {
  draft: ['Draft', 'bg-slate-100 text-slate-700'],
  submitted: ['Submitted', 'bg-sky-100 text-sky-800'],
  under_review: ['Under Review', 'bg-amber-100 text-amber-800'],
  approved: ['Approved', 'bg-emerald-100 text-emerald-800'],
  returned: ['Returned for Correction', 'bg-orange-100 text-orange-800'],
  rejected: ['Rejected', 'bg-rose-100 text-rose-800'],
  new: ['Submitted', 'bg-sky-100 text-sky-800'],
  reviewed: ['Reviewed', 'bg-emerald-100 text-emerald-800'],
};

const formFromReport = (report) => ({
  reportType: report.reportType || reportTypes[0],
  periodType: report.periodType || 'daily',
  reportDate: dateValue(report.reportDate),
  periodStart: dateValue(report.periodStart),
  periodEnd: dateValue(report.periodEnd),
  title: report.title || '',
  patientsServed: String(report.patientsServed ?? 0),
  completedServices: String(report.completedServices ?? 0),
  staffPresent: String(report.staffPresent ?? 0),
  staffAbsent: String(report.staffAbsent ?? 0),
  pendingCases: String(report.pendingCases ?? 0),
  problemsIncidents: report.problemsIncidents || '',
  medicineSupplyStatus: report.medicineSupplyStatus || '',
  additionalNotes: report.additionalNotes || '',
});

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100';
const labelClass = 'block text-xs font-semibold text-slate-600';

export default function DepartmentReportSubmission() {
  const { user, token } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(emptyForm);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedReport = useMemo(
    () => reports.find((report) => report._id === selectedId) || null,
    [reports, selectedId]
  );
  const canEdit = selectedReport
    && String(selectedReport.submittedBy?._id || selectedReport.submittedBy) === String(user?._id)
    && ['draft', 'returned'].includes(selectedReport.status);
  const isReadOnly = Boolean(selectedReport && !canEdit);

  const loadReports = useCallback(async (preferredId = '') => {
    if (!token) return;
    try {
      const { data } = await axios.get('/api/reports/department-reports/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const entries = Array.isArray(data.data) ? data.data : [];
      setReports(entries);
      const requestedId = preferredId || searchParams.get('reportId');
      const selected = entries.find((report) => report._id === requestedId)
        || entries.find((report) => report._id === selectedId)
        || null;
      if (selected) {
        setSelectedId(selected._id);
        setForm(formFromReport(selected));
      } else {
        setSelectedId('');
      }
      setError('');
    } catch (loadError) {
      console.error('Failed to load department submissions:', loadError);
      setError(loadError.response?.data?.message || 'Unable to load department submissions.');
    } finally {
      setLoading(false);
    }
  }, [searchParams, selectedId, token]);

  useEffect(() => {
    void loadReports();
  }, [loadReports, refreshKey]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io({ auth: { token } });
    socket.on('clinic:department-report-updated', () => setRefreshKey((key) => key + 1));
    return () => socket.disconnect();
  }, [token]);

  if (!user || !token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectReport = (report) => {
    setSelectedId(report._id);
    setForm(formFromReport(report));
    setError('');
    setNotice('');
  };

  const startNewReport = () => {
    setSelectedId('');
    setForm(emptyForm());
    setError('');
    setNotice('');
  };

  const saveReport = async (event, status) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = { ...form, status };
    try {
      const response = canEdit
        ? await axios.patch(`/api/reports/department-reports/${selectedId}/resubmit`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
        : await axios.post('/api/reports/department-reports', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      const savedReport = response.data.data;
      setSelectedId(savedReport._id);
      setForm(formFromReport(savedReport));
      setNotice(response.data.warning || (status === 'draft' ? 'Draft saved.' : 'Report submitted for Clinic Head review.'));
      await loadReports(savedReport._id);
    } catch (saveError) {
      console.error('Failed to save department report:', saveError);
      setError(saveError.response?.data?.message || 'Unable to save department report.');
    } finally {
      setSaving(false);
    }
  };

  const departmentLabel = user.department || 'Department not assigned';

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white">
              <FileText size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{departmentLabel}</p>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Department Reports</h1>
              <p className="text-sm text-slate-500">Submit reports and respond to Clinic Head feedback.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <ArrowLeft size={16} aria-hidden="true" /> Home
            </Link>
            <button type="button" onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
            </button>
          </div>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        {!user.department && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Your account is not assigned to a department. Ask an administrator to update your profile before submitting reports.</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
          <form onSubmit={(event) => saveReport(event, 'submitted')} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedId ? 'Update report' : 'Submit a report'}</h2>
                <p className="mt-1 text-xs text-slate-500">A submitted report is sent to the Clinic Head for review.</p>
              </div>
              {selectedReport && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusDetails[selectedReport.status]?.[1] || 'bg-slate-100 text-slate-700'}`}>
                  {statusDetails[selectedReport.status]?.[0] || selectedReport.status}
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Report type
                <select disabled={isReadOnly} className={inputClass} value={form.reportType} onChange={(event) => updateForm('reportType', event.target.value)}>
                  {reportTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  {!reportTypes.includes(form.reportType) && <option value={form.reportType}>{form.reportType}</option>}
                </select>
              </label>
              <label className={labelClass}>
                Reporting period
                <select disabled={isReadOnly} className={inputClass} value={form.periodType} onChange={(event) => updateForm('periodType', event.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className={labelClass}>
                Report date
                <input disabled={isReadOnly} className={inputClass} type="date" value={form.reportDate} onChange={(event) => updateForm('reportDate', event.target.value)} required />
              </label>
              <label className={labelClass}>
                Report title
                <input disabled={isReadOnly} className={inputClass} maxLength={180} value={form.title} onChange={(event) => updateForm('title', event.target.value)} required />
              </label>
              <label className={labelClass}>
                Period start (optional)
                <input disabled={isReadOnly} className={inputClass} type="date" value={form.periodStart} onChange={(event) => updateForm('periodStart', event.target.value)} />
              </label>
              <label className={labelClass}>
                Period end (optional)
                <input disabled={isReadOnly} className={inputClass} type="date" value={form.periodEnd} onChange={(event) => updateForm('periodEnd', event.target.value)} />
              </label>
            </div>

            <section>
              <h3 className="mb-3 text-sm font-bold text-slate-800">Department activity</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['patientsServed', 'Patients served'],
                  ['completedServices', 'Completed services'],
                  ['staffPresent', 'Staff present'],
                  ['staffAbsent', 'Staff absent'],
                  ['pendingCases', 'Pending cases'],
                ].map(([key, label]) => (
                  <label key={key} className={labelClass}>
                    {label}
                    <input disabled={isReadOnly} className={inputClass} type="number" min="0" max="1000000" step="1" value={form[key]} onChange={(event) => updateForm(key, event.target.value)} />
                  </label>
                ))}
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Problems or incidents
                <textarea disabled={isReadOnly} className={`${inputClass} min-h-24 resize-y`} maxLength={5000} value={form.problemsIncidents} onChange={(event) => updateForm('problemsIncidents', event.target.value)} placeholder="Describe incidents or operational problems." />
              </label>
              <label className={labelClass}>
                Medicine and supply status
                <textarea disabled={isReadOnly} className={`${inputClass} min-h-24 resize-y`} maxLength={3000} value={form.medicineSupplyStatus} onChange={(event) => updateForm('medicineSupplyStatus', event.target.value)} placeholder="Note available supplies, shortages, or urgent needs." />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Additional notes
                <textarea disabled={isReadOnly} className={`${inputClass} min-h-24 resize-y`} maxLength={5000} value={form.additionalNotes} onChange={(event) => updateForm('additionalNotes', event.target.value)} placeholder="Add relevant context or follow-up details." />
              </label>
            </div>

            {selectedReport?.reviewHistory?.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-800">Review history</h3>
                <div className="mt-3 space-y-3">
                  {selectedReport.reviewHistory.slice().reverse().map((entry, index) => (
                    <div key={`${entry._id || entry.actedAt}-${index}`} className="border-l-2 border-teal-300 pl-3">
                      <p className="text-xs font-semibold capitalize text-slate-700">{entry.action.replaceAll('_', ' ')} · {entry.actorName || entry.actorId?.name || 'Clinic staff'}</p>
                      {entry.comment && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{entry.comment}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={startNewReport} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                New report
              </button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={(event) => saveReport(event, 'draft')} disabled={saving || !user.department || isReadOnly} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <Save size={16} aria-hidden="true" /> Save draft
                </button>
                <button type="submit" disabled={saving || !user.department || isReadOnly} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Send size={16} aria-hidden="true" /> {saving ? 'Saving…' : canEdit ? 'Resubmit report' : 'Submit report'}
                </button>
              </div>
            </div>
          </form>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">Department submissions</h2>
                  <p className="text-xs text-slate-500">Latest reports for {departmentLabel}.</p>
                </div>
                <ClipboardList size={20} className="text-teal-700" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-2">
                {loading && <p className="py-4 text-center text-sm text-slate-500">Loading reports…</p>}
                {!loading && reports.length === 0 && <p className="rounded-lg bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">No department reports yet.</p>}
                {reports.map((report) => {
                  const [label, tone] = statusDetails[report.status] || [report.status, 'bg-slate-100 text-slate-700'];
                  return (
                    <button
                      type="button"
                      key={report._id}
                      onClick={() => selectReport(report)}
                      className={`w-full rounded-xl border p-3 text-left transition hover:border-teal-300 ${selectedId === report._id ? 'border-teal-400 bg-teal-50/60' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-800">{report.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${tone}`}>{label}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{report.reportType} · {dateValue(report.reportDate) || dateValue(report.submittedAt)}</p>
                      <p className="mt-2 text-[11px] text-slate-500">Submitted by {report.submittedBy?.name || report.submittedBy?.username || 'Department staff'}</p>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
              <h3 className="font-bold">Workflow</h3>
              <p className="mt-1">Save a draft, submit it for review, then use the review notes here to correct and resubmit returned reports. Clinic Head decisions and comments are recorded in the report history.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

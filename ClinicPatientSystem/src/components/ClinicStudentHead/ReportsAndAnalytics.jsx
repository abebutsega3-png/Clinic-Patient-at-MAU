import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Activity, AlertTriangle, BarChart3, Clock3, Download,
  FileBarChart, FileText, Pill, Printer, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const emptyAnalytics = {
  summary: {
    totalPatients: 0,
    avgWaitTime: null,
    emergencyPatients: 0,
    totalMedicinesDispensed: null,
    attendance: { present: 0, late: 0, absent: 0, approvedLeaveRequests: 0 },
    requisitions: {
      pending: 0,
      approved: 0,
      rejected: 0,
      returned: 0,
      pendingEstimatedCost: 0,
      approvedEstimatedCost: 0,
      averageApprovalHours: null
    }
  },
  patientTrends: [],
  topDiseases: [],
  departmentWorkload: [],
  medicineUsage: [],
  staffPerformance: [],
  currentInventory: {
    itemCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    expiredBatchCount: 0,
    expiringBatchCount: 0,
    expiryByMonth: []
  },
  inventoryNote: '',
  departments: []
};

const dateKey = (date) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getPresetRange = (preset) => {
  const end = new Date();
  const endKey = dateKey(end);
  const start = new Date(`${endKey}T00:00:00Z`);
  if (preset === 'today') return [endKey, endKey];
  if (preset === 'week') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  } else if (preset === 'month') {
    start.setUTCDate(1);
  } else if (preset === 'year') {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
  }
  return [start.toISOString().slice(0, 10), endKey];
};

const escapeCsv = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

const parseReportContent = (content) => {
  try {
    const parsed = JSON.parse(content || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const BarList = ({ rows, nameKey, valueKey, emptyText = 'No recorded data for this range.' }) => {
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);
  if (!rows.length) return <p className="py-12 text-center text-sm text-slate-400">{emptyText}</p>;
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row._id}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-700">{row[nameKey] || 'Not recorded'}</span>
            <span className="shrink-0 font-semibold text-slate-600">{Number(row[valueKey]) || 0}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(2, (Number(row[valueKey]) / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const PatientTrend = ({ rows, interval }) => {
  if (!rows.length) return <p className="py-12 text-center text-sm text-slate-400">No patient visits were recorded for this range.</p>;

  const width = 640;
  const height = 210;
  const padding = 28;
  const max = Math.max(...rows.map((row) => row.count), 1);
  const points = rows.map((row, index) => ({
    ...row,
    x: rows.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (rows.length - 1),
    y: height - padding - ((row.count / max) * (height - padding * 2))
  }));
  const line = points.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
  const shownLabels = points.length > 7
    ? points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0)
    : points;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Patient visits by date" className="h-56 min-w-[520px] w-full">
        {[0, 1, 2, 3].map((index) => {
          const y = padding + (index * (height - padding * 2)) / 3;
          return <line key={index} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />;
        })}
        <path d={line} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => <circle key={point._id} cx={point.x} cy={point.y} r="4" fill="#0d9488" />)}
        {shownLabels.map((point) => (
          <text key={point._id} x={point.x} y={height - 5} textAnchor="middle" fontSize="10" fill="#64748b">{interval === 'month' ? point._id : point._id.slice(5)}</text>
        ))}
      </svg>
    </div>
  );
};

const ReportsAndAnalytics = () => {
  const { token } = useAuth();
  const [preset, setPreset] = useState('month');
  const [startDate, setStartDate] = useState(() => getPresetRange('month')[0]);
  const [endDate, setEndDate] = useState(() => getPresetRange('month')[1]);
  const [department, setDepartment] = useState('All');
  const [activeTab, setActiveTab] = useState('analytics');
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const [actionError, setActionError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const authConfig = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const query = useMemo(() => {
    const params = new URLSearchParams({ department });
    if (startDate && endDate) {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    }
    return params.toString();
  }, [department, endDate, startDate]);

  const fetchData = useCallback(async () => {
    if ((startDate && !endDate) || (!startDate && endDate) || (startDate && endDate && startDate > endDate)) {
      setError('Choose both dates and ensure the start date is not after the end date.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setReportError('');
    try {
      const [analyticsResponse, reportsResponse] = await Promise.all([
        axios.get(`/api/reports/analytics?${query}`, authConfig),
        axios.get(`/api/reports/department-reports?${query}`, authConfig)
      ]);
      setAnalytics({
        ...emptyAnalytics,
        ...analyticsResponse.data,
        summary: {
          ...emptyAnalytics.summary,
          ...analyticsResponse.data.summary,
          attendance: { ...emptyAnalytics.summary.attendance, ...analyticsResponse.data.summary.attendance },
          requisitions: { ...emptyAnalytics.summary.requisitions, ...analyticsResponse.data.summary.requisitions }
        },
        currentInventory: { ...emptyAnalytics.currentInventory, ...analyticsResponse.data.currentInventory }
      });
      setReports(Array.isArray(reportsResponse.data.data) ? reportsResponse.data.data : []);
    } catch (loadError) {
      console.error('Failed to load reports and analytics:', loadError);
      const message = loadError.response?.data?.message || 'Unable to load reports and analytics.';
      setError(message);
      setReportError(message);
    } finally {
      setLoading(false);
    }
  }, [authConfig, query, startDate, endDate]);

  useEffect(() => {
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io({ auth: { token } });
    socket.on('clinic:department-report-submitted', () => void fetchData());
    return () => socket.disconnect();
  }, [fetchData, token]);

  const changePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') {
      const [start, end] = getPresetRange(value);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const exportCsv = () => {
    setExportError('');
    const lines = [
      ['Reports & Analytics', `Period: ${startDate || 'All'} to ${endDate || 'All'}`, `Department: ${department}`],
      [],
      ['Summary', 'Value'],
      ['Total visits', analytics.summary.totalPatients],
      ['Average wait (minutes)', analytics.summary.avgWaitTime ?? 'Not recorded'],
      ['Emergency patients', analytics.summary.emergencyPatients],
      ['Medicines dispensed', analytics.summary.totalMedicinesDispensed ?? 'Not recorded'],
      ['Present records', analytics.summary.attendance.present],
      ['Late records', analytics.summary.attendance.late],
      ['Absent records', analytics.summary.attendance.absent],
      ['Approved leave requests', analytics.summary.attendance.approvedLeaveRequests],
      ['Pending purchase requests', analytics.summary.requisitions.pending],
      ['Approved purchase requests', analytics.summary.requisitions.approved],
      ['Rejected purchase requests', analytics.summary.requisitions.rejected],
      ['Returned purchase requests', analytics.summary.requisitions.returned],
      ['Pending estimated procurement cost (ETB)', analytics.summary.requisitions.pendingEstimatedCost],
      ['Approved estimated procurement cost (ETB)', analytics.summary.requisitions.approvedEstimatedCost],
      ['Average requisition approval hours', analytics.summary.requisitions.averageApprovalHours ?? 'Not recorded'],
      [],
      ['Current inventory snapshot', 'Value'],
      ['Inventory items', analytics.currentInventory.itemCount],
      ['Low stock items', analytics.currentInventory.lowStockCount],
      ['Out of stock items', analytics.currentInventory.outOfStockCount],
      ['Expired batches', analytics.currentInventory.expiredBatchCount],
      ['Near-expiry batches', analytics.currentInventory.expiringBatchCount],
      ['Inventory data limitation', analytics.inventoryNote],
      [],
      ['Patient flow', analytics.trendInterval === 'month' ? 'Month' : 'Date', 'Visits'],
      ...analytics.patientTrends.map((row) => ['', row._id, row.count]),
      [],
      ['Common diseases', 'Diagnosis', 'Cases'],
      ...analytics.topDiseases.map((row) => ['', row._id, row.count]),
      [],
      ['Department workload', 'Department', 'Patients', 'Average wait (minutes)'],
      ...analytics.departmentWorkload.map((row) => ['', row._id, row.patientCount, Math.round(row.avgWaitMinutes || 0)]),
      [],
      ['Medicine usage', 'Medicine', 'Quantity', 'Dispenses'],
      ...analytics.medicineUsage.map((row) => ['', row._id, row.quantityDispensed, row.timesDispensed]),
      [],
      ['Staff performance', 'Staff', 'Role', 'Department', 'Patients served', 'Days attended', 'Avg patients per attended day'],
      ...analytics.staffPerformance.map((staff) => ['', staff.name, staff.role, staff.department, staff.patientsServed, staff.attendedDays, staff.averagePatientsPerAttendedDay ?? 'Not recorded']),
      [],
      ['Department reports', 'Department', 'Title', 'Submitted by', 'Submitted', 'Status'],
      ...reports.map((report) => ['', report.department, report.title, report.submittedBy?.name || report.submittedBy?.username || '', report.submittedAt, report.status])
    ];
    const csv = `\uFEFF${lines.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `clinic-report-${startDate || 'all'}-${endDate || 'dates'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    setExportError('');
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const pdf = new jsPDF({ orientation: 'landscape' });
      pdf.setFontSize(16);
      pdf.text('Clinic Reports & Analytics', 14, 16);
      pdf.setFontSize(10);
      pdf.text(`Period: ${startDate || 'All'} to ${endDate || 'All'} | Department: ${department}`, 14, 23);
      pdf.text(
        `Total visits: ${analytics.summary.totalPatients} | Emergency visits: ${analytics.summary.emergencyPatients} | Medicines dispensed: ${analytics.summary.totalMedicinesDispensed ?? 'Not recorded'} | Average wait: ${analytics.summary.avgWaitTime == null ? 'Not recorded' : `${analytics.summary.avgWaitTime} min`}`,
        14,
        29,
      );
      const tables = [
        ['Staff attendance', ['Status', 'Records'], [
          ['Present', analytics.summary.attendance.present],
          ['Late', analytics.summary.attendance.late],
          ['Absent', analytics.summary.attendance.absent],
          ['Approved leave requests', analytics.summary.attendance.approvedLeaveRequests]
        ]],
        ['Purchase requisitions', ['Metric', 'Value'], [
          ['Pending', analytics.summary.requisitions.pending],
          ['Approved', analytics.summary.requisitions.approved],
          ['Rejected', analytics.summary.requisitions.rejected],
          ['Returned', analytics.summary.requisitions.returned],
          ['Pending estimated cost (ETB)', analytics.summary.requisitions.pendingEstimatedCost],
          ['Approved estimated cost (ETB)', analytics.summary.requisitions.approvedEstimatedCost],
          ['Average approval time (hours)', analytics.summary.requisitions.averageApprovalHours ?? 'Not recorded']
        ]],
        ['Current inventory snapshot', ['Metric', 'Value'], [
          ['Inventory items', analytics.currentInventory.itemCount],
          ['Low stock items', analytics.currentInventory.lowStockCount],
          ['Out of stock items', analytics.currentInventory.outOfStockCount],
          ['Expired batches', analytics.currentInventory.expiredBatchCount],
          ['Near-expiry batches', analytics.currentInventory.expiringBatchCount],
          ['Limitation', analytics.inventoryNote]
        ]],
        ['Near-expiry batches by month', ['Month', 'Batches'], analytics.currentInventory.expiryByMonth.map((row) => [row._id, row.count])],
        ['Patient flow', [analytics.trendInterval === 'month' ? 'Month' : 'Date', 'Visits'], analytics.patientTrends.map((row) => [row._id, row.count])],
        ['Common diagnoses', ['Diagnosis', 'Cases'], analytics.topDiseases.map((row) => [row._id, row.count])],
        ['Department workload', ['Department', 'Patients', 'Average wait (minutes)'], analytics.departmentWorkload.map((row) => [row._id, row.patientCount, row.avgWaitMinutes == null ? 'Not recorded' : Math.round(row.avgWaitMinutes)])],
        ['Medicine usage', ['Medicine', 'Quantity dispensed', 'Dispenses'], analytics.medicineUsage.map((row) => [row._id, row.quantityDispensed, row.timesDispensed])],
        ['Staff performance', ['Staff', 'Role', 'Department', 'Patients served', 'Days attended', 'Avg patients per attended day'], analytics.staffPerformance.map((staff) => [staff.name, staff.role, staff.department, staff.patientsServed, staff.attendedDays, staff.averagePatientsPerAttendedDay ?? 'Not recorded'])],
        ['Submitted department reports', ['Department', 'Title', 'Submitted by', 'Submitted', 'Status'], reports.map((report) => [report.department, report.title, report.submittedBy?.name || report.submittedBy?.username || '', new Date(report.submittedAt).toLocaleString(), report.status])],
      ];
      let cursorY = 36;
      for (const [title, headers, rows] of tables) {
        if (cursorY > pdf.internal.pageSize.getHeight() - 35) {
          pdf.addPage();
          cursorY = 16;
        }
        pdf.setFontSize(11);
        pdf.text(title, 14, cursorY);
        autoTable(pdf, {
          startY: cursorY + 3,
          head: [headers],
          body: rows.length ? rows : [headers.map((_, index) => index === 0 ? 'No recorded data for this range.' : '')],
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [15, 118, 110] },
          margin: { left: 14, right: 14 },
        });
        cursorY = pdf.lastAutoTable.finalY + 8;
      }
      if (cursorY > pdf.internal.pageSize.getHeight() - 12) {
        pdf.addPage();
        cursorY = 16;
      }
      pdf.setFontSize(8);
      pdf.text('Report contains aggregated clinic statistics and staff performance. Patient identifiers are excluded.', 14, cursorY);
      pdf.save(`clinic-report-${startDate || 'all'}-${endDate || 'dates'}.pdf`);
    } catch (pdfError) {
      console.error('Failed to export Clinic Head report as PDF:', pdfError);
      setExportError('Unable to create the PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const markReviewed = async (report) => {
    setActionError('');
    try {
      const { data } = await axios.patch(`/api/reports/department-reports/${report._id}/review`, {}, authConfig);
      setReports((current) => current.map((entry) => entry._id === report._id ? data.data : entry));
      setSelectedReport(data.data);
    } catch (updateError) {
      console.error('Failed to mark department report reviewed:', updateError);
      setActionError(updateError.response?.data?.message || 'Could not update the report review status.');
    }
  };

  const exportSubmittedReportCsv = (report) => {
    const details = parseReportContent(report.content);
    if (report.reportType !== 'Card Room Report' || !details) {
      setActionError('This report does not contain exportable aggregate Card Room data.');
      return;
    }
    const rows = [
      ['Card Room Report'],
      ['Reporting period', `${details.period?.startDate || ''} to ${details.period?.endDate || ''}`],
      ['Submitted by', report.submittedBy?.name || report.submittedBy?.username || ''],
      ['Submitted at', report.submittedAt || ''],
      [],
      ['Metric', 'Value'],
      ...Object.entries(details.metrics || {}),
      [],
      ['Department breakdown'],
      ['Department', 'Visits'],
      ...(details.departmentBreakdown || []).map((row) => [row.department, row.count]),
      [],
      ['Patient category breakdown'],
      ['Category', 'Patients'],
      ...(details.patientCategories || []).map((row) => [row.category, row.count]),
      [],
      ['Visit type breakdown'],
      ['Visit type', 'Visits'],
      ...(details.visitTypes || []).map((row) => [row.visitType, row.count]),
      [],
      ['Peak hours (Africa/Addis_Ababa)'],
      ['Hour', 'Visits'],
      ...(details.hourlyBreakdown || []).map((row) => [row.hour, row.count]),
      [],
      ['Privacy', 'Aggregated statistics only; patient identifiers and clinical details are excluded.'],
    ];
    const content = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `card-room-submitted-report-${details.period?.startDate || 'report'}-${details.period?.endDate || ''}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportSubmittedReportPdf = async (report) => {
    const details = parseReportContent(report.content);
    if (report.reportType !== 'Card Room Report' || !details) {
      setActionError('This report does not contain exportable aggregate Card Room data.');
      return;
    }
    setActionError('');
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const pdf = new jsPDF({ orientation: 'landscape' });
      pdf.setFontSize(16);
      pdf.text('Card Room Submitted Report', 14, 16);
      pdf.setFontSize(10);
      pdf.text(`Period: ${details.period?.startDate || ''} to ${details.period?.endDate || ''}`, 14, 23);
      pdf.text(`Submitted by: ${report.submittedBy?.name || report.submittedBy?.username || 'Card Room staff'}`, 14, 29);
      autoTable(pdf, {
        startY: 35,
        head: [['Metric', 'Value']],
        body: Object.entries(details.metrics || {}).map(([label, value]) => [label.replaceAll(/([A-Z])/g, ' $1'), value ?? '—']),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 118, 110] },
      });
      const tables = [
        ['Department', 'Visits', details.departmentBreakdown || [], 'department'],
        ['Patient category', 'Patients', details.patientCategories || [], 'category'],
        ['Visit type', 'Visits', details.visitTypes || [], 'visitType'],
        ['Hour (Africa/Addis_Ababa)', 'Visits', details.hourlyBreakdown || [], 'hour'],
      ];
      for (const [label, countLabel, rows, key] of tables) {
        autoTable(pdf, {
          startY: pdf.lastAutoTable.finalY + 5,
          head: [[label, countLabel]],
          body: rows.map((row) => [row[key], row.count]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [15, 118, 110] },
        });
      }
      pdf.setFontSize(8);
      pdf.text('Privacy: Aggregate statistics only. Patient identifiers and clinical details are excluded.', 14, pdf.lastAutoTable.finalY + 7);
      pdf.save(`card-room-submitted-report-${details.period?.startDate || 'report'}-${details.period?.endDate || ''}.pdf`);
    } catch (exportError) {
      console.error('Failed to export submitted Card Room report:', exportError);
      setActionError('Unable to export the submitted report.');
    }
  };

  const summaryCards = [
    { label: 'Total visits', value: analytics.summary.totalPatients, icon: Users, color: 'teal' },
    { label: 'Average wait time', value: analytics.summary.avgWaitTime == null ? 'Not recorded' : `${analytics.summary.avgWaitTime} min`, icon: Clock3, color: 'blue' },
    { label: 'Emergency patients', value: analytics.summary.emergencyPatients, icon: AlertTriangle, color: 'rose' },
    { label: 'Medicines dispensed', value: analytics.summary.totalMedicinesDispensed, icon: Pill, color: 'purple' }
  ];
  const cardColors = {
    teal: { card: 'from-blue-600 to-blue-500', icon: 'bg-white/15 text-white' },
    blue: { card: 'from-emerald-600 to-green-500', icon: 'bg-white/15 text-white' },
    rose: { card: 'from-rose-600 to-red-500', icon: 'bg-white/15 text-white' },
    purple: { card: 'from-violet-600 to-purple-500', icon: 'bg-white/15 text-white' }
  };

  return (
    <div className="min-h-screen space-y-4 bg-blue-50/60 p-3 sm:p-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-blue-900"><FileBarChart className="text-blue-700" /> Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Review aggregate visit volume, service workload, staff attendance, inventory alerts and procurement activity.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={() => setActiveTab((current) => current === 'analytics' ? 'department-reports' : 'analytics')} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50">
            <FileText size={15} /> {activeTab === 'analytics' ? 'Department Reports' : 'Back to Analytics'}
          </button>
          <button type="button" onClick={exportCsv} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <Download size={15} /> Export Excel (CSV)
          </button>
          <button type="button" onClick={() => void exportPdf()} disabled={loading || exportingPdf} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            <FileText size={15} /> {exportingPdf ? 'Creating PDF…' : 'Save PDF'}
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">
            <Printer size={15} /> Print
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {[
              ['today', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
              ['year', 'Last 12 months']
            ].map(([value, label]) => <button key={value} type="button" onClick={() => changePreset(value)} aria-pressed={preset === value} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${preset === value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'}`}>{label}</button>)}
            <button type="button" onClick={() => setPreset('custom')} aria-pressed={preset === 'custom'} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${preset === 'custom' ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'}`}>Custom range</button>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>From:</span><span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2"><input aria-label="Report start date" type="date" value={startDate} onChange={(event) => { setPreset('custom'); setStartDate(event.target.value); }} /></span>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>To:</span><span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2"><input aria-label="Report end date" type="date" value={endDate} onChange={(event) => { setPreset('custom'); setEndDate(event.target.value); }} /></span>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Department:</span>
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="block min-w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <option value="All">All departments</option>
              {analytics.departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
        </div>
      </section>

      {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}<button type="button" onClick={() => void fetchData()} className="font-semibold underline">Retry</button></div>}
      {exportError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{exportError}</p>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className={`flex items-center justify-between rounded-xl bg-gradient-to-r ${cardColors[color].card} p-4 text-white shadow-sm`}>
            <div><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-2xl font-bold">{loading ? '—' : value}</p></div>
            <span className={`rounded-xl p-2.5 ${cardColors[color].icon}`}><Icon size={23} /></span>
          </article>
        ))}
      </section>

      {activeTab === 'analytics' && <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-2 text-sm font-bold text-white"><Users size={16} /> Staff Attendance Summary</h2>
          <div className="p-3">
          {loading ? <p className="py-6 text-center text-sm text-slate-400">Loading attendance…</p> : (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Present', analytics.summary.attendance.present, 'text-emerald-700'],
                ['Late', analytics.summary.attendance.late, 'text-amber-700'],
                ['Absent', analytics.summary.attendance.absent, 'text-rose-700'],
                ['Approved leave requests', analytics.summary.attendance.approvedLeaveRequests, 'text-sky-700']
              ].map(([label, value, color]) => <div key={label} className="rounded-lg border-r border-blue-100 bg-white p-2 text-center last:border-0"><dt className="text-[11px] font-semibold text-slate-600">{label}</dt><dd className={`mt-1 text-lg font-bold ${color}`}>{value}</dd></div>)}
            </dl>
          )}
          <p className="mt-2 border-t border-blue-100 pt-2 text-[11px] text-slate-500">Saved attendance records and approved leave requests in this period; not expected roster totals.</p>
          </div>
        </article>
        <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-2">
          <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-2 text-sm font-bold text-white"><FileText size={16} /> Requisition History</h2>
          <div className="p-3">
          {loading ? <p className="py-6 text-center text-sm text-slate-400">Loading requisitions…</p> : (
            <>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  ['Pending', analytics.summary.requisitions.pending, 'text-amber-700'],
                  ['Approved', analytics.summary.requisitions.approved, 'text-emerald-700'],
                  ['Rejected', analytics.summary.requisitions.rejected, 'text-rose-700'],
                  ['Returned', analytics.summary.requisitions.returned, 'text-slate-700']
                ].map(([label, value, color]) => <div key={label} className="border-r border-blue-100 p-2 text-center last:border-0"><dt className="text-[11px] font-semibold text-slate-600">{label}</dt><dd className={`mt-1 text-lg font-bold ${color}`}>{value}</dd></div>)}
              </dl>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-blue-100 px-2 pt-2 text-[11px] text-slate-700">
                <p>Average approval time: <strong>{analytics.summary.requisitions.averageApprovalHours == null ? 'Not recorded' : `${analytics.summary.requisitions.averageApprovalHours} hours`}</strong></p>
                <p>Estimated costs: <strong>{analytics.summary.requisitions.pendingEstimatedCost.toLocaleString()} ETB pending</strong> · <strong>{analytics.summary.requisitions.approvedEstimatedCost.toLocaleString()} ETB approved</strong></p>
              </div>
            </>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Request status counts and approval times are based on requests submitted during this period.</p>
          </div>
        </article>
        <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-2 text-sm font-bold text-white"><Pill size={16} /> Current Inventory &amp; Expiry Outlook</h2>
          <div className="p-3">
          {loading ? <p className="py-6 text-center text-sm text-slate-400">Loading stock snapshot…</p> : (
            <>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Low stock', analytics.currentInventory.lowStockCount, 'text-amber-700'],
                  ['Out of stock', analytics.currentInventory.outOfStockCount, 'text-rose-700'],
                  ['Expired batches', analytics.currentInventory.expiredBatchCount, 'text-rose-700'],
                  ['Near expiry', analytics.currentInventory.expiringBatchCount, 'text-orange-700']
                ].map(([label, value, color]) => <div key={label} className="border-r border-blue-100 p-2 text-center last:border-0"><dt className="text-[11px] font-semibold text-slate-600">{label}</dt><dd className={`mt-1 text-lg font-bold ${color}`}>{value}</dd></div>)}
              </dl>
              {analytics.currentInventory.expiryByMonth.length > 0 && <div className="mt-4"><h3 className="mb-3 text-xs font-semibold text-slate-600">Current batches expiring soon by month</h3><BarList rows={analytics.currentInventory.expiryByMonth} nameKey="_id" valueKey="count" /></div>}
              <p className="mt-2 text-[11px] text-slate-500">{analytics.inventoryNote}</p>
            </>
          )}
          </div>
        </article>
        <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-2">
          <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-2 text-sm font-bold text-white"><BarChart3 size={16} /> Analytics – Department Reports</h2>
          <div className="grid gap-3 p-3 md:grid-cols-3">
            <section className="rounded-lg border border-slate-100 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-900"><Activity size={14} /> Patient Flow</h3>
              {loading ? <p className="py-8 text-center text-xs text-slate-400">Loading visits…</p> : <PatientTrend rows={analytics.patientTrends} interval={analytics.trendInterval} />}
            </section>
            <section className="rounded-lg border border-slate-100 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-900"><Activity size={14} /> Common Diagnoses</h3>
              {loading ? <p className="py-8 text-center text-xs text-slate-400">Loading diagnoses…</p> : <BarList rows={analytics.topDiseases} nameKey="_id" valueKey="count" />}
            </section>
            <section className="rounded-lg border border-slate-100 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-900"><Users size={14} /> Department Workload</h3>
              {loading ? <p className="py-8 text-center text-xs text-slate-400">Loading departments…</p> : <BarList rows={analytics.departmentWorkload} nameKey="_id" valueKey="patientCount" />}
            </section>
          </div>
        </article>
      </section>}

      {activeTab === 'analytics' ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-2 text-sm font-bold text-white"><Clock3 size={16} /> Department Average Wait Time</h2>
            {loading ? <p className="py-12 text-center text-sm text-slate-400">Loading department data…</p> : (
              <div className="overflow-x-auto p-2"><table className="w-full text-left text-xs"><thead className="border-b bg-blue-50 text-[11px] uppercase text-blue-900"><tr><th className="p-2">Department</th><th className="p-2">Patients</th><th className="p-2">Average wait</th></tr></thead><tbody className="divide-y divide-slate-100">{analytics.departmentWorkload.length ? analytics.departmentWorkload.map((row) => <tr key={row._id}><td className="p-2 font-semibold">{row._id}</td><td className="p-2">{row.patientCount}</td><td className="p-2">{row.avgWaitMinutes == null ? 'Not recorded' : `${Math.round(row.avgWaitMinutes)} min`}</td></tr>) : <tr><td colSpan="3" className="p-4 text-center text-slate-500">No department visit data recorded.</td></tr>}</tbody></table></div>
            )}
          </article>
          <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-2">
            <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-2 text-sm font-bold text-white"><Users size={16} /> Staff Performance</h2>
            {loading ? <p className="py-12 text-center text-sm text-slate-400">Loading staff performance…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-blue-50 text-[11px] uppercase text-blue-900"><tr><th className="p-2">Staff member</th><th className="p-2">Role</th><th className="p-2">Department</th><th className="p-2">Patients served</th><th className="p-2">Days attended</th><th className="p-2">Avg patients / attended day</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.staffPerformance.length ? analytics.staffPerformance.map((staff) => (
                      <tr key={staff.staffId}><td className="p-2 font-semibold">{staff.name}</td><td className="p-2">{staff.role}</td><td className="p-2">{staff.department}</td><td className="p-2">{staff.patientsServed}</td><td className="p-2">{staff.attendedDays}</td><td className="p-2">{staff.averagePatientsPerAttendedDay == null ? 'Not recorded' : staff.averagePatientsPerAttendedDay}</td></tr>
                    )) : <tr><td colSpan="6" className="p-6 text-center text-slate-400">No staff directory records are available for this department.</td></tr>}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">Patient counts include visits assigned to a staff member. Attendance days count Present and Late records. Average workload is patients served divided by recorded attended days.</p>
              </div>
            )}
          </article>
          <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-3">
            <h2 className="flex items-center gap-2 bg-gradient-to-r from-blue-950 to-blue-800 px-3 py-2 text-sm font-bold text-white"><Pill size={16} /> Medicine Usage &amp; Consumption</h2>
            <div className="grid gap-4 p-3 md:grid-cols-2">
              {loading ? <p className="py-6 text-center text-sm text-slate-400">Loading medicine data…</p> : <BarList rows={analytics.medicineUsage} nameKey="_id" valueKey="quantityDispensed" />}
              <p className="self-center text-xs text-slate-500">Top medicines dispensed in the selected date range. Consumption counts come from recorded dispensing logs.</p>
            </div>
          </article>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h2 className="flex items-center gap-2 font-bold text-slate-800"><FileText size={18} className="text-teal-600" /> Department reports</h2><p className="mt-1 text-xs text-slate-500">Review reports submitted by clinic departments.</p></div>
          {reportError && <p role="alert" className="text-sm text-rose-600">{reportError}</p>}
          {actionError && <p role="alert" className="text-sm text-rose-600">{actionError}</p>}
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Department</th><th className="p-3">Title</th><th className="p-3">Submitted by</th><th className="p-3">Submitted</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan="6" className="p-8 text-center text-slate-400">Loading department reports…</td></tr>
              : reports.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-slate-400">No department reports have been submitted for this date range.</td></tr>
                : reports.map((report) => {
                  const isCardRoomReport = report.reportType === 'Card Room Report';
                  const reportStatus = report.status === 'reviewed' ? (isCardRoomReport ? 'Acknowledged' : 'Reviewed') : (isCardRoomReport ? 'Pending Review' : 'New');
                  return <tr key={report._id}><td className="p-3 font-medium">{report.department}</td><td className="p-3">{report.title}</td><td className="p-3">{report.submittedBy?.name || report.submittedBy?.username || '—'}</td><td className="p-3">{new Date(report.submittedAt).toLocaleDateString()}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${report.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{reportStatus}</span></td><td className="space-x-3 p-3"><button type="button" onClick={() => setSelectedReport(report)} className="font-semibold text-teal-700 hover:underline">View</button>{report.status !== 'reviewed' && <button type="button" onClick={() => void markReviewed(report)} className="font-semibold text-slate-600 hover:underline">{isCardRoomReport ? 'Acknowledge' : 'Mark as reviewed'}</button>}</td></tr>;
                })}
          </tbody></table></div>
        </section>
      )}

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedReport(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="department-report-title" className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-teal-700">{selectedReport.department}</p><h2 id="department-report-title" className="mt-1 text-xl font-bold text-slate-800">{selectedReport.title}</h2></div><button type="button" onClick={() => setSelectedReport(null)} className="text-sm font-semibold text-slate-500">Close</button></div>
            <p className="text-xs text-slate-500">Submitted by {selectedReport.submittedBy?.name || selectedReport.submittedBy?.username || 'department staff'} · {new Date(selectedReport.submittedAt).toLocaleString()}</p>
            {actionError && <p role="alert" className="text-sm text-rose-600">{actionError}</p>}
            {selectedReport.reportType === 'Card Room Report' && parseReportContent(selectedReport.content) ? (() => {
              const details = parseReportContent(selectedReport.content);
              return <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm">
                <p className="font-medium text-slate-700">Reporting period: {details.period?.startDate} to {details.period?.endDate}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(details.metrics || {}).map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label.replaceAll(/([A-Z])/g, ' $1')}</p><p className="mt-1 font-semibold text-slate-900">{value ?? '—'}</p></div>)}
                </div>
                {[
                  ['Department breakdown', details.departmentBreakdown || [], 'department'],
                  ['Patient categories', details.patientCategories || [], 'category'],
                  ['Visit types', details.visitTypes || [], 'visitType'],
                  ['Peak hours (Africa/Addis_Ababa)', details.hourlyBreakdown || [], 'hour'],
                ].map(([title, rows, label]) => <div key={title}><h3 className="font-semibold text-slate-800">{title}</h3><div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-100">{rows.length ? rows.map((row) => <div key={row[label]} className="flex justify-between gap-3 px-3 py-2"><span>{row[label]}</span><span className="font-medium">{row.count}</span></div>) : <p className="px-3 py-2 text-slate-500">No data</p>}</div></div>)}
                <p className="text-xs text-slate-500">{details.note}</p>
              </div>;
            })() : <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedReport.content || 'No report details were provided.'}</p>}
            {selectedReport.reportType === 'Card Room Report' && <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => exportSubmittedReportCsv(selectedReport)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><Download size={16} /> Export CSV</button>
              <button type="button" onClick={() => void exportSubmittedReportPdf(selectedReport)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><FileText size={16} /> Export PDF</button>
            </div>}
            {selectedReport.status !== 'reviewed' && <button type="button" onClick={() => void markReviewed(selectedReport)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white">{selectedReport.reportType === 'Card Room Report' ? 'Acknowledge report' : 'Mark as reviewed'}</button>}
          </section>
        </div>
      )}
    </div>
  );
};

export default ReportsAndAnalytics;

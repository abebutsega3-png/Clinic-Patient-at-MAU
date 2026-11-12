import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Activity, AlertTriangle, BarChart3, CalendarClock, CheckCircle, Clock3, Download,
  FileBarChart, FileText, MessageSquare, Pill, Plus, Printer, RotateCcw,
  Send, Users, XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const emptyAnalytics = {
  summary: {
    totalPatients: 0,
    completedServices: 0,
    pendingCases: 0,
    totalStaff: 0,
    departmentsReported: 0,
    approvedDepartmentReports: 0,
    criticalIssues: 0,
    pendingDecisions: 0,
    avgWaitTime: null,
    emergencyPatients: 0,
    totalMedicinesDispensed: null,
    attendance: { present: 0, late: 0, absent: 0, approvedLeaveRequests: 0, overtime: null },
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
  departmentPerformance: [],
  approvedDepartmentSummary: {
    reports: 0,
    patientsServed: 0,
    completedServices: 0,
    pendingCases: 0,
    staffPresent: 0,
    staffAbsent: 0,
    incidentReports: 0,
    criticalIssues: 0,
    note: ''
  },
  incidentReports: [],
  referrals: {
    total: 0,
    urgent: 0,
    byDepartment: [],
    details: [],
    approvalRequests: { pending: 0, approved: 0, rejected: 0, returned: 0 },
    outcomeTracking: ''
  },
  currentInventory: {
    itemCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    expiredBatchCount: 0,
    expiringBatchCount: 0,
    expiryByMonth: []
  },
  inventoryMovements: {
    receivedTransactions: 0,
    receivedQuantity: 0,
    issuedTransactions: 0,
    issuedQuantity: 0
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

const formatClinicDate = (date) => {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
      timeZone: 'Africa/Addis_Ababa',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(parsed);
};

const clinicReportStatus = {
  draft: ['Draft', 'bg-slate-100 text-slate-700'],
  submitted: ['Submitted', 'bg-sky-100 text-sky-800'],
  under_review: ['Under Review', 'bg-amber-100 text-amber-800'],
  approved: ['Approved', 'bg-emerald-100 text-emerald-800'],
  returned: ['Returned', 'bg-orange-100 text-orange-800'],
  closed: ['Closed', 'bg-slate-200 text-slate-800']
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
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Patient visits by date" className="h-auto w-full">
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

const DepartmentPerformanceChart = ({ rows }) => {
  const max = Math.max(...rows.flatMap((row) => [row.completedServices || 0, row.pendingCases || 0]), 1);
  if (!rows.length) return <p className="py-12 text-center text-sm text-slate-400">No department performance data for this range.</p>;

  return (
    <div className="p-3">
      <div className="mb-2 flex justify-end gap-3 text-[9px] text-slate-500">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-blue-600" />Completed</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-cyan-400" />Pending</span>
      </div>
      <div className="flex h-40 items-stretch justify-between gap-1 border-b border-l border-slate-200 px-1">
        {rows.map((row) => (
          <div key={row.department} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={row.department}>
            <div className="flex h-32 w-full items-end justify-center gap-1">
              <span aria-label={`${row.department}: ${row.completedServices ?? 'not reported'} completed`} className="w-2.5 rounded-t bg-blue-600" style={{ height: `${row.completedServices == null ? 0 : Math.max(3, (row.completedServices / max) * 100)}%` }} />
              <span aria-label={`${row.department}: ${row.pendingCases ?? 'not reported'} pending`} className="w-2.5 rounded-t bg-cyan-400" style={{ height: `${row.pendingCases == null ? 0 : Math.max(3, (row.pendingCases / max) * 100)}%` }} />
            </div>
            <span className="mt-1 w-full truncate text-center text-[8px] text-slate-500">{row.department.replace(' Room', '').replace(' / Registration', '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReportsAndAnalytics = () => {
  const { token } = useAuth();
  const [preset, setPreset] = useState('today');
  const [startDate, setStartDate] = useState(() => getPresetRange('today')[0]);
  const [endDate, setEndDate] = useState(() => getPresetRange('today')[1]);
  const [todayDateKey] = useState(() => dateKey(new Date()));
  const [department, setDepartment] = useState('All');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [clinicReportType, setClinicReportType] = useState('daily');
  const [reviewComment, setReviewComment] = useState('');
  const [actionPlan, setActionPlan] = useState({
    issue: '',
    solution: '',
    responsiblePerson: '',
    dueDate: '',
    priority: 'normal'
  });
  const [loading, setLoading] = useState(true);
  const [savingClinicReport, setSavingClinicReport] = useState(false);
  const [savingActionPlan, setSavingActionPlan] = useState(false);
  const [error, setError] = useState('');
  const [managementError, setManagementError] = useState('');
  const [managementNotice, setManagementNotice] = useState('');
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
    setManagementError('');
    try {
      const [analyticsResponse, reportsResponse] = await Promise.all([
        axios.get(`/api/reports/analytics?${query}`, authConfig),
        axios.get(`/api/reports/clinic-head-reports?${query}`, authConfig)
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
        currentInventory: { ...emptyAnalytics.currentInventory, ...analyticsResponse.data.currentInventory },
        inventoryMovements: { ...emptyAnalytics.inventoryMovements, ...analyticsResponse.data.inventoryMovements },
        approvedDepartmentSummary: {
          ...emptyAnalytics.approvedDepartmentSummary,
          ...analyticsResponse.data.approvedDepartmentSummary
        },
        referrals: {
          ...emptyAnalytics.referrals,
          ...analyticsResponse.data.referrals,
          approvalRequests: {
            ...emptyAnalytics.referrals.approvalRequests,
            ...analyticsResponse.data.referrals?.approvalRequests
          }
        }
      });
      setReports(Array.isArray(reportsResponse.data.data) ? reportsResponse.data.data : []);
    } catch (loadError) {
      console.error('Failed to load reports and analytics:', loadError);
      const message = loadError.response?.data?.message || 'Unable to load reports and analytics.';
      setError(message);
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
    socket.on('clinic:department-report-updated', () => void fetchData());
    socket.on('clinic:clinic-head-report-updated', () => void fetchData());
    return () => socket.disconnect();
  }, [fetchData, token]);

  const changePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') {
      const [start, end] = getPresetRange(value);
      setStartDate(start);
      setEndDate(end);
      setClinicReportType(['today', 'week', 'month'].includes(value) ? { today: 'daily', week: 'weekly', month: 'monthly' }[value] : 'custom');
    } else {
      setClinicReportType('custom');
    }
  };

  const exportCsv = () => {
    setExportError('');
    const lines = [
      ['Clinic Head Report', `Period: ${startDate || 'All'} to ${endDate || 'All'}`, `Department: ${department}`],
      [],
      ['Summary', 'Value'],
      ['Patients registered', analytics.summary.totalPatients],
      ['Completed services', analytics.summary.completedServices],
      ['Pending queue cases', analytics.summary.pendingCases],
      ['Total active staff in directory', analytics.summary.totalStaff],
      ['Departments with approved reports', analytics.summary.departmentsReported],
      ['Approved department reports', analytics.summary.approvedDepartmentReports],
      ['Critical issues in approved reports', analytics.summary.criticalIssues],
      ['Pending decisions', analytics.summary.pendingDecisions],
      ['Average wait (minutes)', analytics.summary.avgWaitTime ?? 'Not recorded'],
      ['Emergency patients', analytics.summary.emergencyPatients],
      ['Medicines dispensed', analytics.summary.totalMedicinesDispensed ?? 'Not recorded'],
      ['Present records', analytics.summary.attendance.present],
      ['Late records', analytics.summary.attendance.late],
      ['Absent records', analytics.summary.attendance.absent],
      ['Approved leave requests', analytics.summary.attendance.approvedLeaveRequests],
      ['Overtime', 'Not recorded by the attendance system'],
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
      ['Model 19 stock receipt transactions', analytics.inventoryMovements.receivedTransactions],
      ['Model 19 quantity received', analytics.inventoryMovements.receivedQuantity],
      ['Model 22 stock issue transactions', analytics.inventoryMovements.issuedTransactions],
      ['Model 22 quantity issued', analytics.inventoryMovements.issuedQuantity],
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
      ['Approved department performance', 'Department', 'Patients served', 'Completed services', 'Pending cases', 'Staff present', 'Staff absent', 'Report status'],
      ...analytics.departmentPerformance.map((row) => ['', row.department, row.patientsServed ?? 'Not reported', row.completedServices ?? 'Not reported', row.pendingCases ?? 'Not reported', row.staffPresent ?? 'Not reported', row.staffAbsent ?? 'Not reported', row.departmentStatus]),
      [],
      ['Medicine usage', 'Medicine', 'Quantity', 'Dispenses'],
      ...analytics.medicineUsage.map((row) => ['', row._id, row.quantityDispensed, row.timesDispensed]),
      [],
      ['Staff performance', 'Staff', 'Role', 'Department', 'Patients served', 'Days attended', 'Avg patients per attended day'],
      ...analytics.staffPerformance.map((staff) => ['', staff.name, staff.role, staff.department, staff.patientsServed, staff.attendedDays, staff.averagePatientsPerAttendedDay ?? 'Not recorded']),
      [],
      ['Referral summary', 'Destination department', 'Referrals', 'Urgent referrals'],
      ...analytics.referrals.byDepartment.map((row) => ['', row._id, row.referrals, row.urgent]),
      ['Referral outcome note', analytics.referrals.outcomeTracking],
      ['Referral details', 'Source department', 'Destination', 'Reason', 'Count', 'Urgent'],
      ...analytics.referrals.details.map((row) => ['', row._id.source, row._id.destination, row._id.reason, row.count, row.urgent]),
      [],
      ['Incidents from approved department reports', 'Department', 'Title', 'Date', 'Reported by', 'Issue', 'Supply status'],
      ...analytics.incidentReports.map((incident) => ['', incident.department, incident.title, incident.reportDate, incident.submittedBy, incident.problems, incident.supplies]),
      [],
      ['Generated Clinic Head reports', 'Title', 'Type', 'Period start', 'Period end', 'Status'],
      ...reports.map((report) => ['', report.title, report.reportType, report.periodStart, report.periodEnd, report.status])
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
      pdf.text('Clinic Head Report & Analytics', 14, 16);
      pdf.setFontSize(10);
      pdf.text(`Period: ${startDate || 'All'} to ${endDate || 'All'} | Department: ${department}`, 14, 23);
      pdf.text(
        `Patients: ${analytics.summary.totalPatients} | Completed: ${analytics.summary.completedServices} | Pending cases: ${analytics.summary.pendingCases} | Critical issues: ${analytics.summary.criticalIssues} | Pending decisions: ${analytics.summary.pendingDecisions}`,
        14,
        29,
      );
      const tables = [
        ['Clinic dashboard', ['Metric', 'Value'], [
          ['Total staff directory records', analytics.summary.totalStaff],
          ['Departments reporting (approved)', analytics.summary.departmentsReported],
          ['Approved department reports', analytics.summary.approvedDepartmentReports],
          ['Average wait (minutes)', analytics.summary.avgWaitTime ?? 'Not recorded'],
          ['Emergency patients', analytics.summary.emergencyPatients],
          ['Medicines dispensed', analytics.summary.totalMedicinesDispensed ?? 'Not recorded']
        ]],
        ['Staff attendance', ['Status', 'Records'], [
          ['Present', analytics.summary.attendance.present],
          ['Late', analytics.summary.attendance.late],
          ['Absent', analytics.summary.attendance.absent],
          ['Approved leave requests', analytics.summary.attendance.approvedLeaveRequests],
          ['Overtime', 'Not recorded by the attendance system']
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
          ['Model 19 receipts (transactions / quantity)', `${analytics.inventoryMovements.receivedTransactions} / ${analytics.inventoryMovements.receivedQuantity}`],
          ['Model 22 issues (transactions / quantity)', `${analytics.inventoryMovements.issuedTransactions} / ${analytics.inventoryMovements.issuedQuantity}`],
          ['Limitation', analytics.inventoryNote]
        ]],
        ['Near-expiry batches by month', ['Month', 'Batches'], analytics.currentInventory.expiryByMonth.map((row) => [row._id, row.count])],
        ['Patient flow', [analytics.trendInterval === 'month' ? 'Month' : 'Date', 'Visits'], analytics.patientTrends.map((row) => [row._id, row.count])],
        ['Common diagnoses', ['Diagnosis', 'Cases'], analytics.topDiseases.map((row) => [row._id, row.count])],
        ['Department performance (approved submissions)', ['Department', 'Patients registered', 'Patients served', 'Services', 'Pending', 'Present', 'Absent', 'Status'], analytics.departmentPerformance.map((row) => [row.department, row.patientsRegistered, row.patientsServed ?? 'Not reported', row.completedServices ?? 'Not reported', row.pendingCases ?? 'Not reported', row.staffPresent ?? 'Not reported', row.staffAbsent ?? 'Not reported', row.departmentStatus])],
        ['Medicine usage', ['Medicine', 'Quantity dispensed', 'Dispenses'], analytics.medicineUsage.map((row) => [row._id, row.quantityDispensed, row.timesDispensed])],
        ['Staff performance', ['Staff', 'Role', 'Department', 'Patients served', 'Days attended', 'Avg patients per attended day'], analytics.staffPerformance.map((staff) => [staff.name, staff.role, staff.department, staff.patientsServed, staff.attendedDays, staff.averagePatientsPerAttendedDay ?? 'Not recorded'])],
        ['Referrals by destination', ['Destination', 'Count', 'Urgent'], analytics.referrals.byDepartment.map((row) => [row._id, row.referrals, row.urgent])],
        ['Referral details', ['Source department', 'Destination', 'Reason', 'Count', 'Urgent'], analytics.referrals.details.map((row) => [row._id.source, row._id.destination, row._id.reason, row.count, row.urgent])],
        ['Incidents from approved department reports', ['Department', 'Title', 'Date', 'Issue', 'Supply status'], analytics.incidentReports.map((incident) => [incident.department, incident.title, new Date(incident.reportDate).toLocaleDateString(), incident.problems, incident.supplies])],
        ['Saved Clinic Head reports', ['Title', 'Type', 'Period start', 'Period end', 'Status'], reports.map((report) => [report.title, report.reportType, new Date(report.periodStart).toLocaleDateString(), new Date(report.periodEnd).toLocaleDateString(), report.status])],
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

  const clinicReportSnapshot = () => ({
    summary: analytics.summary,
    patientTrends: analytics.patientTrends,
    topDiseases: analytics.topDiseases,
    departmentPerformance: analytics.departmentPerformance,
    staffPerformance: analytics.staffPerformance,
    medicineUsage: analytics.medicineUsage,
    currentInventory: analytics.currentInventory,
    inventoryMovements: analytics.inventoryMovements,
    approvedDepartmentSummary: analytics.approvedDepartmentSummary,
    incidentReports: analytics.incidentReports,
    referrals: analytics.referrals
  });

  const generateClinicReport = async () => {
    setSavingClinicReport(true);
    setManagementError('');
    setManagementNotice('');
    try {
      const { data } = await axios.post('/api/reports/clinic-head-reports', {
        reportType: clinicReportType,
        startDate,
        endDate,
        snapshot: clinicReportSnapshot()
      }, authConfig);
      setReports((current) => [data.data, ...current.filter((report) => report._id !== data.data._id)]);
      setSelectedReport(data.data);
      setReviewComment('');
      setActiveTab('management-review');
      setManagementNotice('Clinic report generated as a draft from the selected period.');
    } catch (generateError) {
      console.error('Failed to generate Clinic Head report:', generateError);
      setManagementError(generateError.response?.data?.message || 'Unable to generate the clinic report.');
    } finally {
      setSavingClinicReport(false);
    }
  };

  const reviewClinicReport = async (action) => {
    if (!selectedReport) return;
    if (action === 'returned' && !reviewComment.trim()) {
      setManagementError('Add a comment explaining why the report is being returned.');
      return;
    }
    setManagementError('');
    try {
      const { data } = await axios.patch(
        `/api/reports/clinic-head-reports/${selectedReport._id}/review`,
        { action, comment: reviewComment },
        authConfig
      );
      setSelectedReport(data.data);
      setReports((current) => current.map((report) => report._id === data.data._id ? data.data : report));
      setReviewComment('');
      setManagementNotice(`Clinic report ${action.replace('_', ' ')}.`);
    } catch (reviewError) {
      console.error('Failed to update Clinic Head report:', reviewError);
      setManagementError(reviewError.response?.data?.message || 'Unable to update the clinic report.');
    }
  };

  const addActionPlan = async (event) => {
    event.preventDefault();
    if (!selectedReport) return;
    setSavingActionPlan(true);
    setManagementError('');
    try {
      const { data } = await axios.post(
        `/api/reports/clinic-head-reports/${selectedReport._id}/actions`,
        actionPlan,
        authConfig
      );
      setSelectedReport(data.data);
      setReports((current) => current.map((report) => report._id === data.data._id ? data.data : report));
      setActionPlan({ issue: '', solution: '', responsiblePerson: '', dueDate: '', priority: 'normal' });
      setManagementNotice('Action plan assigned.');
    } catch (saveError) {
      console.error('Failed to assign action plan:', saveError);
      setManagementError(saveError.response?.data?.message || 'Unable to assign the action plan.');
    } finally {
      setSavingActionPlan(false);
    }
  };

  const updateActionPlan = async (actionId, status) => {
    if (!selectedReport) return;
    setManagementError('');
    try {
      const { data } = await axios.patch(
        `/api/reports/clinic-head-reports/${selectedReport._id}/actions/${actionId}`,
        { status },
        authConfig
      );
      setSelectedReport(data.data);
      setReports((current) => current.map((report) => report._id === data.data._id ? data.data : report));
    } catch (updateError) {
      console.error('Failed to update action plan:', updateError);
      setManagementError(updateError.response?.data?.message || 'Unable to update action plan status.');
    }
  };

  const summaryCards = [
    { label: preset === 'today' ? 'Patients today' : 'Patients registered', value: analytics.summary.totalPatients, icon: Users, color: 'teal' },
    { label: 'Completed services', value: analytics.summary.completedServices, icon: CheckCircle, color: 'blue' },
    { label: 'Pending cases', value: analytics.summary.pendingCases, icon: Clock3, color: 'rose' },
    { label: 'Staff present records', value: analytics.summary.attendance.present, icon: Users, color: 'purple' },
    { label: 'Departments reported', value: analytics.summary.departmentsReported, icon: FileText, color: 'teal' },
    { label: 'Critical issues', value: analytics.summary.criticalIssues, icon: AlertTriangle, color: 'rose' },
    { label: 'Pending decisions', value: analytics.summary.pendingDecisions, icon: CalendarClock, color: 'blue' }
  ];
  const cardColors = {
    teal: { card: 'border-cyan-100 bg-cyan-50/70', icon: 'bg-white text-cyan-700', value: 'text-cyan-900' },
    blue: { card: 'border-blue-100 bg-blue-50/70', icon: 'bg-white text-blue-700', value: 'text-blue-900' },
    rose: { card: 'border-rose-100 bg-rose-50/70', icon: 'bg-white text-rose-700', value: 'text-rose-900' },
    purple: { card: 'border-violet-100 bg-violet-50/70', icon: 'bg-white text-violet-700', value: 'text-violet-900' }
  };
  const reportStatusSummary = [
    { status: 'approved', count: reports.filter((report) => report.status === 'approved').length },
    { status: 'under_review', count: reports.filter((report) => report.status === 'under_review').length },
    { status: 'returned', count: reports.filter((report) => report.status === 'returned').length },
    { status: 'critical', count: analytics.summary.criticalIssues }
  ];
  const openActionPlanCount = reports.reduce((total, report) => (
    total + (report.actionPlans || []).filter((item) => !['completed', 'closed'].includes(item.status)).length
  ), 0);

  return (
    <div className="min-h-screen space-y-3 bg-slate-50 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-blue-950"><FileBarChart className="text-blue-700" size={20} /> Clinic Head Report</h1>
          <p className="mt-0.5 text-xs text-slate-500">Overview of clinic performance, operations and key insights</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm print:hidden">
          {[
            ['today', 'Daily'],
            ['week', 'Weekly'],
            ['month', 'Monthly']
          ].map(([value, label]) => <button key={value} type="button" onClick={() => changePreset(value)} aria-pressed={preset === value} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${preset === value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50'}`}>{label}</button>)}
        </div>
        <details className="relative z-30 print:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-blue-50">Filters &amp; actions</summary>
          <div className="absolute right-0 top-full mt-2 w-[92vw] max-w-2xl rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {[
              ['year', 'Last 12 months']
            ].map(([value, label]) => <button key={value} type="button" onClick={() => changePreset(value)} aria-pressed={preset === value} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${preset === value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'}`}>{label}</button>)}
            <button type="button" onClick={() => changePreset('custom')} aria-pressed={preset === 'custom'} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${preset === 'custom' ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'}`}>Custom range</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-600">
            <label className="flex items-center gap-1"><span>From</span><input aria-label="Report start date" type="date" value={startDate} onChange={(event) => { setPreset('custom'); setClinicReportType('custom'); setStartDate(event.target.value); }} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5" /></label>
            <label className="flex items-center gap-1"><span>To</span><input aria-label="Report end date" type="date" value={endDate} onChange={(event) => { setPreset('custom'); setClinicReportType('custom'); setEndDate(event.target.value); }} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5" /></label>
            <label className="flex items-center gap-1"><span>Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)} className="min-w-32 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"><option value="All">All departments</option>{analytics.departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2 print:hidden">
          <button type="button" onClick={() => setActiveTab((current) => current === 'dashboard' ? 'management-review' : 'dashboard')} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-50">
            <FileText size={13} /> {activeTab === 'dashboard' ? 'Management Review' : 'Report Dashboard'}
          </button>
          <Link to="/clinic-head/department-reports" className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-50">
            <Users size={13} /> Department Reports
          </Link>
          <button type="button" onClick={() => void generateClinicReport()} disabled={loading || savingClinicReport} aria-label="Generate Clinic Report" className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            <Plus size={13} /> {savingClinicReport ? 'Generating…' : 'Generate Report'}
          </button>
          <button type="button" onClick={exportCsv} disabled={loading} aria-label="Export Excel CSV" className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <Download size={13} /> Excel
          </button>
          <button type="button" onClick={() => void exportPdf()} disabled={loading || exportingPdf} aria-label="Save PDF" className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            <FileText size={13} /> {exportingPdf ? 'PDF…' : 'PDF'}
          </button>
          <button type="button" onClick={() => window.print()} aria-label="Print report" className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-800">
            <Printer size={13} /> Print
          </button>
        </div>
          </div>
        </details>
      </header>

      {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}<button type="button" onClick={() => void fetchData()} className="font-semibold underline">Retry</button></div>}
      {exportError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{exportError}</p>}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border border-l-4 px-3 py-2.5 shadow-sm ${cardColors[color].card}`}>
            <div className="min-w-0"><p className="truncate text-[10px] font-semibold text-slate-600">{label}</p><p className={`mt-1 text-xl font-bold ${cardColors[color].value}`}>{loading ? '—' : value}</p></div>
            <span className={`shrink-0 rounded-lg p-2 ${cardColors[color].icon}`}><Icon size={17} /></span>
          </article>
        ))}
      </section>

      {activeTab === 'dashboard' && <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><Clock3 size={15} className="text-blue-600" /> Department Performance Summary</h2>
          {loading ? <p className="py-10 text-center text-xs text-slate-400">Loading departments…</p> : (
            <div className="max-h-64 overflow-y-auto p-2">
              <table className="w-full table-fixed text-left text-[9px]">
                <thead className="border-b bg-slate-50 uppercase text-slate-500"><tr><th className="w-[25%] p-1.5">Department</th><th className="w-[17%] p-1.5">Patients</th><th className="w-[14%] p-1.5">Completed</th><th className="w-[12%] p-1.5">Pending</th><th className="w-[14%] p-1.5">Rate</th><th className="w-[18%] p-1.5">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.departmentPerformance.length ? analytics.departmentPerformance.map((row) => (
                    <tr key={row.department}>
                      <td className="break-words p-1.5 font-semibold text-slate-700">{row.department}</td>
                      <td className="p-1.5">{row.patientsServed ?? '—'}</td>
                      <td className="p-1.5">{row.completedServices ?? '—'}</td>
                      <td className="p-1.5">{row.pendingCases ?? '—'}</td>
                      <td className="p-1.5">{row.patientsServed > 0 && row.completedServices != null ? `${Math.round((row.completedServices / row.patientsServed) * 100)}%` : '—'}</td>
                      <td className="p-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${row.approvedReports ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.approvedReports ? 'Approved' : 'No report'}</span></td>
                    </tr>
                  )) : <tr><td colSpan="6" className="p-5 text-center text-slate-400">No department data available.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><BarChart3 size={15} className="text-blue-600" /> Patient Service Summary</h2>
          <div className="grid grid-cols-3 gap-2 p-3">
            {[
              ['Patients', analytics.summary.totalPatients, 'text-blue-800'],
              ['Completed', analytics.summary.completedServices, 'text-emerald-700'],
              ['Pending', analytics.summary.pendingCases, 'text-amber-700']
            ].map(([label, value, tone]) => <div key={label} className="rounded-lg bg-slate-50 p-2 text-center"><p className="text-[9px] font-medium text-slate-500">{label}</p><p className={`mt-0.5 text-base font-bold ${tone}`}>{loading ? '—' : value}</p></div>)}
          </div>
          <div className="px-2 pb-2">
            <h3 className="px-2 text-[10px] font-semibold text-slate-600">Patient service trend</h3>
            {loading ? <p className="py-6 text-center text-xs text-slate-400">Loading patient visits…</p> : <PatientTrend rows={analytics.patientTrends} interval={analytics.trendInterval} />}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><Activity size={15} className="text-blue-600" /> Department Performance</h2>
          {loading ? <p className="py-8 text-center text-xs text-slate-400">Loading department performance…</p> : <DepartmentPerformanceChart rows={analytics.departmentPerformance} />}
        </article>
      </section>}

      {activeTab === 'dashboard' && <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-3 py-2 text-xs font-bold text-blue-950"><Users size={14} className="text-blue-600" /> Staff &amp; Attendance</h2>
          <div className="grid grid-cols-2 gap-2 p-3">
            {[
              ['Total staff', analytics.summary.totalStaff, 'text-blue-800'],
              ['Present', analytics.summary.attendance.present, 'text-emerald-700'],
              ['Absent', analytics.summary.attendance.absent, 'text-rose-700'],
              ['Late', analytics.summary.attendance.late, 'text-amber-700'],
              ['On leave', analytics.summary.attendance.approvedLeaveRequests, 'text-violet-700'],
              ['Overtime', 'N/R', 'text-slate-500']
            ].map(([label, value, tone]) => <div key={label} className="rounded-md bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">{label}</p><p className={`text-xs font-bold ${tone}`}>{loading ? '—' : value}</p></div>)}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-bold text-emerald-950"><Pill size={14} className="text-emerald-600" /> Medicine &amp; Inventory</h2>
          <div className="grid grid-cols-2 gap-2 p-3">
            {[
              ['Low stock', analytics.currentInventory.lowStockCount, 'text-amber-700'],
              ['Out of stock', analytics.currentInventory.outOfStockCount, 'text-rose-700'],
              ['Pending requests', analytics.summary.requisitions.pending, 'text-orange-700'],
              ['Dispensed', analytics.summary.totalMedicinesDispensed ?? 'N/R', 'text-emerald-700'],
              ['Stock received', analytics.inventoryMovements.receivedQuantity, 'text-blue-700'],
              ['Stock issued', analytics.inventoryMovements.issuedQuantity, 'text-violet-700']
            ].map(([label, value, tone]) => <div key={label} className="rounded-md bg-slate-50 px-2 py-1.5"><p className="text-[9px] text-slate-500">{label}</p><p className={`text-xs font-bold ${tone}`}>{loading ? '—' : value}</p></div>)}
          </div>
          <p className="px-3 pb-2 text-[9px] text-slate-500">Dispensed totals show N/R when no dispensing logs were recorded.</p>
        </article>

        <article className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-2 text-xs font-bold text-violet-950"><Activity size={14} className="text-violet-600" /> Referral Summary</h2>
          <div className="flex gap-2 p-3">
            <div className="flex-1 rounded-md bg-blue-50 p-2 text-center"><p className="text-[9px] text-slate-500">Total</p><p className="text-lg font-bold text-blue-800">{loading ? '—' : analytics.referrals.total}</p></div>
            <div className="flex-1 rounded-md bg-rose-50 p-2 text-center"><p className="text-[9px] text-slate-500">Urgent</p><p className="text-lg font-bold text-rose-700">{loading ? '—' : analytics.referrals.urgent}</p></div>
          </div>
          <div className="space-y-1 px-3 pb-3">
            {analytics.referrals.byDepartment.slice(0, 3).map((row) => <p key={row._id} className="flex justify-between gap-2 text-[9px] text-slate-600"><span className="truncate">{row._id}</span><strong>{row.referrals}</strong></p>)}
            <p className="border-t border-slate-100 pt-1 text-[9px] text-slate-500">{analytics.referrals.approvalRequests.pending} pending · {analytics.referrals.approvalRequests.approved} approved</p>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-rose-100 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-rose-100 bg-rose-50/70 px-3 py-2 text-xs font-bold text-rose-950"><AlertTriangle size={14} className="text-rose-600" /> Incidents &amp; Problems</h2>
          <div className="p-3">
            <p className="text-2xl font-bold text-rose-700">{loading ? '—' : analytics.incidentReports.length}</p>
            <p className="text-[9px] text-slate-500">Issues in approved department reports</p>
            {analytics.incidentReports.slice(0, 2).map((incident, index) => <div key={`${incident.department}-${incident.reportDate}-${index}`} className="mt-2 border-t border-slate-100 pt-1.5">
              <p className="truncate text-[9px] font-semibold text-slate-700">{incident.department} · {incident.title}</p>
              <p className="truncate text-[9px] text-slate-500">{incident.problems || incident.supplies || 'Issue details not reported'}</p>
            </div>)}
            {!analytics.incidentReports.length && <p className="mt-2 text-[9px] text-slate-500">No incidents reported.</p>}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
          <header className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/70 px-3 py-2">
            <h2 className="flex items-center gap-2 text-xs font-bold text-amber-950"><FileText size={14} className="text-amber-600" /> Management Review</h2>
            <button type="button" onClick={() => setActiveTab('management-review')} className="text-[9px] font-semibold text-blue-700 hover:underline">Open</button>
          </header>
          <div className="grid grid-cols-2 gap-2 p-3">
            {reportStatusSummary.map(({ status, count }) => <div key={status} className={`rounded-md px-2 py-1.5 ${status === 'approved' ? 'bg-emerald-50' : status === 'critical' ? 'bg-rose-50' : 'bg-amber-50'}`}>
              <p className="text-[9px] capitalize text-slate-500">{status.replace('_', ' ')}</p><p className="text-sm font-bold text-slate-800">{count}</p>
            </div>)}
            <div className="col-span-2 flex items-center justify-between rounded-md bg-blue-50 px-2 py-1.5 text-[9px]">
              <span className="text-blue-800">Open action plans</span><strong className="text-blue-950">{openActionPlanCount}</strong>
            </div>
          </div>
        </article>
      </section>}

      {activeTab === 'dashboard' && <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-blue-800">Attendance, requisition &amp; expiry details</summary>
        <section className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 md:grid-cols-3">
        <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><Users size={15} className="text-blue-600" /> Staff &amp; Attendance Summary</h2>
          <div className="p-3">
          {loading ? <p className="py-6 text-center text-sm text-slate-400">Loading attendance…</p> : (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Total staff directory records', analytics.summary.totalStaff, 'text-blue-700'],
                ['Present', analytics.summary.attendance.present, 'text-emerald-700'],
                ['Late', analytics.summary.attendance.late, 'text-amber-700'],
                ['Absent', analytics.summary.attendance.absent, 'text-rose-700'],
                ['Approved leave requests', analytics.summary.attendance.approvedLeaveRequests, 'text-sky-700'],
                ['Overtime', 'Not recorded', 'text-slate-500']
              ].map(([label, value, color]) => <div key={label} className="rounded-lg border-r border-blue-100 bg-white p-2 text-center last:border-0"><dt className="text-[11px] font-semibold text-slate-600">{label}</dt><dd className={`mt-1 text-lg font-bold ${color}`}>{value}</dd></div>)}
            </dl>
          )}
          <p className="mt-2 border-t border-blue-100 pt-2 text-[11px] text-slate-500">Saved attendance records and approved leave requests in this period; not expected roster totals.</p>
          </div>
        </article>
        <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-2">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><FileText size={15} className="text-blue-600" /> Medicine &amp; Inventory Requests</h2>
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
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><Pill size={15} className="text-blue-600" /> Current Inventory &amp; Expiry</h2>
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
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-center">
                <div><dt className="text-[10px] text-slate-500">Stock received (Model 19)</dt><dd className="text-sm font-bold text-emerald-700">{analytics.inventoryMovements.receivedQuantity}</dd></div>
                <div><dt className="text-[10px] text-slate-500">Stock issued (Model 22)</dt><dd className="text-sm font-bold text-blue-700">{analytics.inventoryMovements.issuedQuantity}</dd></div>
              </dl>
              <p className="mt-2 text-[11px] text-slate-500">{analytics.inventoryNote}</p>
            </>
          )}
          </div>
        </article>
        </section>
      </details>}

      {activeTab === 'dashboard' ? (
        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-blue-800">Staff performance, medicine use &amp; referral details</summary>
          <section className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 md:grid-cols-3 xl:grid-cols-12">
          <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-3 xl:col-span-12">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><Users size={15} className="text-blue-600" /> Staff Performance</h2>
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
          <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-3 xl:col-span-4">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><Pill size={15} className="text-blue-600" /> Medicine Usage &amp; Consumption</h2>
            <div className="grid gap-4 p-3 md:grid-cols-2">
              {loading ? <p className="py-6 text-center text-sm text-slate-400">Loading medicine data…</p> : <BarList rows={analytics.medicineUsage} nameKey="_id" valueKey="quantityDispensed" />}
              <p className="self-center text-xs text-slate-500">Top medicines dispensed in the selected date range. Consumption counts come from recorded dispensing logs.</p>
            </div>
          </article>
          <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm xl:col-span-4">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><Activity size={15} className="text-blue-600" /> Referral Summary</h2>
            <div className="p-3">
              <dl className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-blue-50 p-3"><dt className="text-[11px] text-slate-600">Patient referrals</dt><dd className="mt-1 text-xl font-bold text-blue-800">{analytics.referrals.total}</dd></div>
                <div className="rounded-lg bg-rose-50 p-3"><dt className="text-[11px] text-slate-600">Urgent</dt><dd className="mt-1 text-xl font-bold text-rose-700">{analytics.referrals.urgent}</dd></div>
              </dl>
              <div className="mt-3 space-y-1">
                {analytics.referrals.byDepartment.map((row) => <p key={row._id} className="flex justify-between gap-2 text-xs text-slate-600"><span className="truncate">{row._id}</span><strong>{row.referrals}</strong></p>)}
                {!analytics.referrals.byDepartment.length && <p className="text-center text-xs text-slate-400">No referrals recorded for this range.</p>}
              </div>
              {analytics.referrals.details.length > 0 && <div className="mt-3 max-h-36 space-y-2 overflow-y-auto border-t border-slate-100 pt-2">
                <h3 className="text-[10px] font-bold uppercase text-slate-500">Referral source and reason</h3>
                {analytics.referrals.details.map((row, index) => <div key={`${row._id.source}-${row._id.destination}-${index}`} className="text-[10px] text-slate-600">
                  <p className="font-semibold">{row._id.source} → {row._id.destination} · {row.count}</p>
                  <p className="truncate">{row._id.reason}</p>
                </div>)}
              </div>}
              <p className="mt-2 text-[10px] text-slate-500">Referral approval requests: {analytics.referrals.approvalRequests.pending} pending · {analytics.referrals.approvalRequests.approved} approved · {analytics.referrals.approvalRequests.rejected} rejected · {analytics.referrals.approvalRequests.returned} returned</p>
              <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-500">{analytics.referrals.outcomeTracking}</p>
            </div>
          </article>
          <article className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm md:col-span-2 xl:col-span-4">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-blue-950"><AlertTriangle size={15} className="text-rose-600" /> Incident &amp; Problem Report</h2>
            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto p-3">
              {analytics.incidentReports.length ? analytics.incidentReports.map((incident, index) => (
                <article key={`${incident.department}-${incident.reportDate}-${index}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">{incident.department} · {incident.title}</p>
                    <span className="text-[10px] text-slate-500">{new Date(incident.reportDate).toLocaleDateString()}</span>
                  </div>
                  {incident.problems && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{incident.problems}</p>}
                  {incident.supplies && <p className="mt-1 text-xs text-amber-800">Supply: {incident.supplies}</p>}
                  <p className="mt-1 text-[10px] text-slate-500">Submitted by {incident.submittedBy} · from an approved department report</p>
                </article>
              )) : <p className="py-8 text-center text-sm text-slate-400">No incidents or supply alerts were reported in approved department reports for this period.</p>}
            </div>
          </article>
          </section>
        </details>
      ) : (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-800"><FileText size={18} className="text-teal-600" /> Clinic Report Management Review</h2>
              <p className="mt-1 text-xs text-slate-500">Generated clinic-wide snapshots are separate from Department Reports and include approved department submissions only.</p>
            </div>
            <p className="text-xs text-slate-500">{reports.length} saved report{reports.length === 1 ? '' : 's'}</p>
          </header>
          {managementError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{managementError}</p>}
          {managementNotice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{managementNotice}</p>}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr><th className="p-3">Clinic report</th><th className="p-3">Period</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan="3" className="p-8 text-center text-slate-400">Loading clinic reports…</td></tr>
                    : reports.length === 0 ? <tr><td colSpan="3" className="p-8 text-center text-slate-400">No clinic report snapshots saved for this period. Choose a period above and generate one.</td></tr>
                      : reports.map((report) => {
                        const [label, tone] = clinicReportStatus[report.status] || [report.status, 'bg-slate-100 text-slate-700'];
                        return (
                          <tr key={report._id} className={`cursor-pointer hover:bg-blue-50 ${selectedReport?._id === report._id ? 'bg-blue-50' : ''}`} onClick={() => { setSelectedReport(report); setReviewComment(''); }}>
                            <td className="p-3"><p className="font-semibold text-slate-800">{report.title}</p><p className="mt-1 capitalize text-[10px] text-slate-500">{report.reportType} · Generated {formatClinicDate(report.createdAt)}</p></td>
                            <td className="whitespace-nowrap p-3">{formatClinicDate(report.periodStart)} – {formatClinicDate(report.periodEnd)}</td>
                            <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{label}</span></td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {selectedReport ? (
              <article className="space-y-4 rounded-xl border border-slate-200 p-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Management Review · {selectedReport.reportType} clinic report</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{selectedReport.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{formatClinicDate(selectedReport.periodStart)} – {formatClinicDate(selectedReport.periodEnd)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${clinicReportStatus[selectedReport.status]?.[1] || 'bg-slate-100 text-slate-700'}`}>{clinicReportStatus[selectedReport.status]?.[0] || selectedReport.status}</span>
                </header>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    ['Patients', selectedReport.snapshot?.summary?.totalPatients],
                    ['Completed', selectedReport.snapshot?.summary?.completedServices],
                    ['Pending', selectedReport.snapshot?.summary?.pendingCases],
                    ['Departments reporting', selectedReport.snapshot?.summary?.departmentsReported],
                    ['Critical issues', selectedReport.snapshot?.summary?.criticalIssues],
                    ['Pending decisions', selectedReport.snapshot?.summary?.pendingDecisions],
                  ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2"><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-900">{value ?? '—'}</dd></div>)}
                </dl>

                <section className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-800">Management comments and decisions</h4>
                  <div className="max-h-32 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-3">
                    {(selectedReport.reviewHistory || []).slice().reverse().map((entry, index) => (
                      <div key={`${entry._id || entry.actedAt}-${index}`} className="border-l-2 border-teal-300 pl-2">
                        <p className="text-[10px] font-semibold capitalize text-slate-600">{entry.action.replaceAll('_', ' ')} · {entry.actorName || entry.actorId?.name || 'Clinic Head'} · {formatClinicDate(entry.actedAt)}</p>
                        {entry.comment && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{entry.comment}</p>}
                      </div>
                    ))}
                  </div>
                  {selectedReport.status !== 'closed' && (
                    <label className="block text-xs font-semibold text-slate-600">
                      Comment or return reason
                      <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={2000} className="mt-1 min-h-16 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-teal-500" />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {['draft', 'returned'].includes(selectedReport.status) && <button type="button" onClick={() => void reviewClinicReport('submitted')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white"><Send size={14} /> Submit for review</button>}
                    {selectedReport.status === 'submitted' && <button type="button" onClick={() => void reviewClinicReport('under_review')} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"><FileText size={14} /> Start review</button>}
                    {selectedReport.status === 'under_review' && (
                      <>
                        <button type="button" onClick={() => void reviewClinicReport('approved')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"><CheckCircle size={14} /> Approve</button>
                        <button type="button" onClick={() => void reviewClinicReport('returned')} disabled={!reviewComment.trim()} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><RotateCcw size={14} /> Return for correction</button>
                      </>
                    )}
                    {selectedReport.status === 'approved' && <button type="button" onClick={() => void reviewClinicReport('closed')} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white"><XCircle size={14} /> Close report</button>}
                    {selectedReport.status !== 'closed' && <button type="button" onClick={() => void reviewClinicReport('commented')} disabled={!reviewComment.trim()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><MessageSquare size={14} /> Add comment</button>}
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Action Plan</h4>
                    <p className="text-[10px] text-slate-500">Assign an issue, solution, owner, priority, and due date.</p>
                  </div>
                  {selectedReport.status !== 'closed' && (
                    <form onSubmit={addActionPlan} className="grid gap-2 sm:grid-cols-2">
                      <input required maxLength={500} value={actionPlan.issue} onChange={(event) => setActionPlan((current) => ({ ...current, issue: event.target.value }))} placeholder="Issue" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                      <input required maxLength={120} value={actionPlan.responsiblePerson} onChange={(event) => setActionPlan((current) => ({ ...current, responsiblePerson: event.target.value }))} placeholder="Responsible person" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                      <input maxLength={2000} value={actionPlan.solution} onChange={(event) => setActionPlan((current) => ({ ...current, solution: event.target.value }))} placeholder="Proposed solution" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                      <div className="flex gap-2">
                        <input required type="date" value={actionPlan.dueDate} onChange={(event) => setActionPlan((current) => ({ ...current, dueDate: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                        <select value={actionPlan.priority} onChange={(event) => setActionPlan((current) => ({ ...current, priority: event.target.value }))} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
                          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                        </select>
                      </div>
                      <button type="submit" disabled={savingActionPlan} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2"><Plus size={14} /> {savingActionPlan ? 'Assigning…' : 'Assign Action'}</button>
                    </form>
                  )}
                  <div className="space-y-2">
                    {(selectedReport.actionPlans || []).map((item) => {
                      const overdue = !['completed', 'closed'].includes(item.status) && dateKey(new Date(item.dueDate)) < todayDateKey;
                      return (
                        <article key={item._id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div><p className="text-xs font-bold text-slate-800">{item.issue}</p><p className="mt-1 text-[10px] text-slate-600">{item.solution || 'No solution specified'} · Owner: {item.responsiblePerson}</p></div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.priority === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{item.priority}</span>
                              {overdue && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800">Overdue</span>}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                            <span>Due {formatClinicDate(item.dueDate)}</span>
                            <select aria-label={`Update status for ${item.issue}`} value={item.status} disabled={selectedReport.status === 'closed'} onChange={(event) => void updateActionPlan(item._id, event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-[10px] disabled:opacity-50">
                              <option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="closed">Closed</option>
                            </select>
                          </div>
                        </article>
                      );
                    })}
                    {!selectedReport.actionPlans?.length && <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400">No actions assigned to this report yet.</p>}
                  </div>
                </section>
              </article>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <FileText size={28} className="text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">Select a generated clinic report</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">Generate a daily, weekly, monthly, or custom-range report using the clinic-wide dashboard data.</p>
              </div>
            )}
          </div>
          <p className="text-[10px] leading-4 text-slate-500">Department totals in generated snapshots come from approved reports. Referral completion outcomes and overtime are not recorded by the current system.</p>
        </section>
      )}
    </div>
  );
};

export default ReportsAndAnalytics;

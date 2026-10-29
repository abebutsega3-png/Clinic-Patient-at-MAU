import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  History,
  Package,
  Plus,
  Search,
  Stethoscope,
  X,
  XCircle
} from 'lucide-react';
import {
  bulkApproveRequests,
  createApprovalRequest,
  fetchApprovalRequestDetails,
  fetchApprovalRequests,
  updatePurchaseRequestPriority,
  updateRequestStatus
} from '../../utile/clinicheadapprovalApi.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const tabs = [
  { id: 'leave_request', label: 'Leave Requests', icon: CalendarDays },
  { id: 'purchase_request', label: 'Purchase Requests', icon: Package },
  { id: 'referral', label: 'Referral Requests', icon: Stethoscope },
  { id: 'medical_certificate', label: 'Medical Certificates', icon: FileCheck2 }
];

const statuses = ['pending', 'approved', 'rejected', 'returned'];

const formatDate = (date) => {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};

const formatDateTime = (date) => {
  if (!date) return 'Time unavailable';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Time unavailable' : parsed.toLocaleString();
};

const formatMoney = (value) => (
  Number.isFinite(Number(value)) ? `${Number(value).toLocaleString()} ETB` : '—'
);

const getInitialRequestForm = () => ({
  applicantName: '',
  applicantId: '',
  applicantRole: 'student',
  department: '',
  reason: '',
  priority: 'normal',
  leaveType: 'annual',
  startDate: '',
  endDate: '',
  totalDays: '',
  balanceAtRequest: '',
  departmentCoverage: '',
  purchaseCategory: 'Medicine',
  purchaseUnit: 'units',
  requestedByDoctor: '',
  itemName: '',
  quantity: '',
  estimatedCost: '',
  currentStock: '',
  monthlyUsage: '',
  targetHospital: '',
  diagnosis: '',
  urgency: 'normal',
  clinicalSummary: '',
  testResults: '',
  referralReason: '',
  certificateType: 'sick_leave',
  prescribedDays: '',
  restStartDate: '',
  restEndDate: '',
  academicPurpose: '',
  clinicalAdvice: '',
  attachmentUrl: ''
});

const getRequestType = (request) => (
  request.requestType === 'staff_leave' ? 'leave_request' : request.requestType
);

const getApplicant = (request) => request.applicantName || request.referral?.patientName || 'Unknown';
const getApplicantId = (request) => request.applicantId || request.referral?.patientId || '—';

const escapeHtml = (value) => String(value ?? '—')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const openPrintableDocument = (request, type) => {
  const isReferral = type === 'referral';
  const title = isReferral ? 'Patient Referral Letter' : 'Medical Certificate';
  const patientName = isReferral
    ? request.referral?.patientName || getApplicant(request)
    : getApplicant(request);
  const patientId = isReferral
    ? request.referral?.patientId || getApplicantId(request)
    : getApplicantId(request);
  const fields = isReferral
    ? [
      ['Referred to', request.targetHospital],
      ['Referring department', request.department],
      ['Diagnosis', request.referral?.diagnosis],
      ['Urgency', request.referral?.urgency || request.priority],
      ['Referral reason', request.referral?.referralReason || request.reason],
      ['Clinical summary', request.referral?.clinicalSummary],
      ['Test results', request.referral?.testResults],
      ['Referring doctor', request.requestedByDoctor],
      ['Electronically approved by', request.approvedBy],
      ['Approved on', formatDateTime(request.approvedAt)]
    ]
    : [
      ['Certificate type', request.certificate?.certificateType || 'Medical certificate'],
      ['Rest period', request.certificate?.restStartDate || request.certificate?.restEndDate
        ? `${formatDate(request.certificate?.restStartDate)} – ${formatDate(request.certificate?.restEndDate)}`
        : request.certificate?.prescribedDays
          ? `${request.certificate.prescribedDays} day(s)`
          : request.duration],
      ['Diagnosis / medical reason', request.reason],
      ['Academic purpose', request.certificate?.academicPurpose],
      ['Dietary and rest instructions', request.certificate?.clinicalAdvice],
      ['Issuing doctor', request.requestedByDoctor],
      ['Electronically approved by', request.approvedBy],
      ['Approved on', formatDateTime(request.approvedAt)]
    ];
  const content = fields.map(([label, value]) => (
    `<section><strong>${escapeHtml(label)}</strong><p>${escapeHtml(value)}</p></section>`
  )).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font:16px Arial,sans-serif;color:#1e293b;margin:48px;line-height:1.5}h1{color:#1f5882}header{border-bottom:2px solid #1f5882;margin-bottom:24px;padding-bottom:12px}section{margin:18px 0}section p{margin:4px 0;white-space:pre-wrap}.print{background:#1f5882;color:white;border:0;padding:10px 18px;border-radius:6px;cursor:pointer}@media print{.print{display:none}body{margin:20mm}}</style></head>
    <body><header><h1>${title}</h1><p>Clinic Management System · ${escapeHtml(formatDate(new Date()))}</p></header>
    <section><strong>Patient</strong><p>${escapeHtml(patientName)} (${escapeHtml(patientId)})</p></section>
    ${content}<p style="margin-top:64px">Authorized signature: ____________________</p>
    <button class="print" onclick="window.print()">Print / Save as PDF</button></body></html>`;
  const documentUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(documentUrl, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60000);
};

const ApprovalsAndRequests = () => {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('leave_request');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0, urgentRequests: 0 });
  const [departments, setDepartments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState('');
  const [comment, setComment] = useState('');
  const [approvedQuantity, setApprovedQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(getInitialRequestForm);
  const deepLinkedRequestId = searchParams.get('requestId') || '';
  const deepLinkedRecordSource = searchParams.get('recordSource') || 'approval';

  useEffect(() => {
    if (!deepLinkedRequestId || !token) return undefined;
    let active = true;
    fetchApprovalRequestDetails(deepLinkedRequestId, token, deepLinkedRecordSource)
      .then((result) => {
        if (active) setDetails(result.data);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error('Failed to open linked approval request:', loadError);
        setError(loadError.response?.data?.message || 'Unable to load the linked request details.');
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deepLinkedRequestId, deepLinkedRecordSource, token]);

  useEffect(() => {
    let active = true;
    fetchApprovalRequests({
      status: filterStatus,
      type: activeTab,
      search,
      department,
      startDate,
      endDate
    }, token)
      .then((result) => {
        if (!active) return;
        setRequests(Array.isArray(result.data) ? result.data : []);
        setSummary(result.summary || { pending: 0, approvedToday: 0, rejectedToday: 0, urgentRequests: 0 });
        setDepartments(Array.isArray(result.departments) ? result.departments : []);
        setSelectedIds([]);
        setError('');
      })
      .catch((loadError) => {
        if (!active) return;
        console.error('Failed to load approval requests:', loadError);
        setError(loadError.response?.data?.message || 'Unable to load approval requests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, filterStatus, search, department, startDate, endDate, refreshKey, token]);

  const visibleBulkIds = useMemo(
    () => requests
      .filter((request) => (
        request.status === 'pending'
        && request.priority !== 'urgent'
        && getRequestType(request) !== 'medical_certificate'
      ))
      .map((request) => ({ _id: request._id, recordSource: request.recordSource })),
    [requests]
  );

  const openDetails = async (request) => {
    setDetailsLoading(true);
    setDetails(null);
    try {
      const result = await fetchApprovalRequestDetails(request._id, token, request.recordSource);
      setDetails(result.data);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Unable to load request details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const openReview = (request, action) => {
    setReviewRequest(request);
    setReviewAction(action);
    setComment('');
    setApprovedQuantity(String(request.purchase?.quantity ?? ''));
  };

  const submitDecision = async () => {
    if (reviewAction !== 'approved' && !comment.trim()) {
      setError('A reason is required when rejecting or returning a request.');
      return;
    }
    if (reviewAction === 'approved' && getRequestType(reviewRequest) === 'purchase_request') {
      const quantity = Number(approvedQuantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > reviewRequest.purchase.quantity) {
        setError(`Enter an approved quantity between 1 and ${reviewRequest.purchase.quantity}.`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await updateRequestStatus(
        reviewRequest._id,
        reviewAction,
        comment,
        token,
        reviewRequest.recordSource,
        reviewAction === 'approved' && getRequestType(reviewRequest) === 'purchase_request'
          ? Number(approvedQuantity)
          : undefined
      );
      setReviewRequest(null);
      setComment('');
      setApprovedQuantity('');
      setRefreshKey((current) => current + 1);
      if (details?.request?._id === reviewRequest._id) await openDetails(reviewRequest);
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Unable to save this decision.');
    } finally {
      setSaving(false);
    }
  };

  const markPriority = async (request, priority) => {
    setSaving(true);
    setError('');
    try {
      await updatePurchaseRequestPriority(request._id, priority, token);
      setRefreshKey((current) => current + 1);
    } catch (priorityError) {
      setError(priorityError.response?.data?.message || 'Unable to update purchase request priority.');
    } finally {
      setSaving(false);
    }
  };

  const approveSelected = async () => {
    const selectedNormalRequests = selectedIds.filter((selected) => visibleBulkIds.some(
      (request) => request._id === selected._id && request.recordSource === selected.recordSource
    ));
    if (!selectedNormalRequests.length) return;
    setSaving(true);
    setError('');
    try {
      const result = await bulkApproveRequests(selectedNormalRequests, token);
      setRefreshKey((current) => current + 1);
      if (result.approvedCount !== selectedNormalRequests.length) {
        setError(`${result.approvedCount} of ${selectedNormalRequests.length} selected requests were approved.`);
      } else if (result.notificationWarningCount > 0) {
        setError(`${result.notificationWarningCount} request(s) were approved, but their notifications could not be created.`);
      }
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Unable to bulk approve selected requests.');
    } finally {
      setSaving(false);
    }
  };

  const submitNewRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = requestForm;
    const payload = {
      requestType: activeTab,
      reason: activeTab === 'referral'
        ? (form.reason.trim() || form.referralReason.trim())
        : form.reason.trim(),
      department: form.department.trim() || user?.department || '',
      priority: activeTab === 'referral' ? form.urgency : form.priority,
      applicantName: form.applicantName.trim(),
      applicantId: form.applicantId.trim(),
      applicantRole: activeTab === 'leave_request' ? 'staff' : form.applicantRole
    };

    if (activeTab === 'leave_request') {
      payload.leave = {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        totalDays: Number(form.totalDays),
        balanceAtRequest: form.balanceAtRequest === '' ? null : Number(form.balanceAtRequest),
        departmentCoverage: form.departmentCoverage.trim()
      };
    } else if (activeTab === 'purchase_request') {
      payload.purchase = {
        requesterDepartment: payload.department,
        itemName: form.itemName.trim(),
        category: form.purchaseCategory,
        unit: form.purchaseUnit.trim() || 'units',
        requesterRole: user?.activeRole || user?.role || 'Clinic Head',
        quantity: Number(form.quantity),
        estimatedCost: Number(form.estimatedCost),
        currentStock: form.currentStock === '' ? null : Number(form.currentStock),
        monthlyUsage: form.monthlyUsage === '' ? null : Number(form.monthlyUsage)
      };
    } else if (activeTab === 'referral') {
      payload.applicantName = form.applicantName.trim();
      payload.applicantId = form.applicantId.trim();
      payload.targetHospital = form.targetHospital.trim();
      payload.requestedByDoctor = form.requestedByDoctor.trim();
      payload.referral = {
        patientName: form.applicantName.trim(),
        patientId: form.applicantId.trim(),
        diagnosis: form.diagnosis.trim(),
        urgency: form.urgency,
        clinicalSummary: form.clinicalSummary.trim(),
        testResults: form.testResults.trim(),
        referralReason: form.referralReason.trim()
      };
    } else if (activeTab === 'medical_certificate') {
      payload.applicantName = form.applicantName.trim();
      payload.applicantId = form.applicantId.trim();
      payload.requestedByDoctor = form.requestedByDoctor.trim();
      payload.attachmentUrl = form.attachmentUrl.trim();
      payload.certificate = {
        certificateType: form.certificateType,
        prescribedDays: Number(form.prescribedDays),
        restStartDate: form.restStartDate || null,
        restEndDate: form.restEndDate || null,
        academicPurpose: form.academicPurpose.trim(),
        clinicalAdvice: form.clinicalAdvice.trim()
      };
    }

    try {
      if (activeTab === 'medical_certificate'
        && Boolean(form.restStartDate) !== Boolean(form.restEndDate)) {
        setError('Enter both rest period dates, or leave both blank.');
        return;
      }
      if (activeTab === 'medical_certificate'
        && form.restStartDate && form.restEndDate
        && form.restEndDate < form.restStartDate) {
        setError('The rest period end date must be on or after the start date.');
        return;
      }
      await createApprovalRequest(payload, token);
      setRequestFormOpen(false);
      setRequestForm(getInitialRequestForm());
      setFilterStatus('pending');
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Unable to submit this request.');
    } finally {
      setSaving(false);
    }
  };

  const updateFormField = (field, value) => {
    setRequestForm((current) => ({ ...current, [field]: value }));
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => current.some((selected) => selected._id === id._id && selected.recordSource === id.recordSource)
      ? current.filter((selected) => selected._id !== id._id || selected.recordSource !== id.recordSource)
      : [...current, id]);
  };

  const renderCells = (request) => {
    const type = getRequestType(request);
    if (type === 'leave_request') {
      return (
        <>
          <td>{getApplicant(request)}<small>{getApplicantId(request)}</small></td>
          <td>{request.staffRole || (request.applicantRole === 'student' ? 'Student' : 'Staff role not recorded')} / {request.department || '—'}</td>
          <td>{request.leave?.leaveType || 'Leave'}</td>
          <td>{formatDate(request.leave?.startDate)} – {formatDate(request.leave?.endDate)}<small>{request.leave?.totalDays || 0} day(s)</small></td>
          <td>{request.reason}</td>
        </>
      );
    }
    if (type === 'purchase_request') {
      return (
        <>
          <td>{request.purchase?.requesterDepartment || request.department || '—'}</td>
          <td>{getApplicant(request)}<small>{request.purchase?.requesterRole || 'Staff'} · {request.requestNumber || request._id.slice(-7)}</small></td>
          <td>{request.purchase?.itemName || '—'}<small>{request.purchase?.category || 'Other'}</small></td>
          <td>{request.status === 'approved' && request.purchase?.approvedQuantity != null
            ? `${request.purchase.approvedQuantity} / ${request.purchase.quantity}`
            : request.purchase?.quantity ?? '—'}<small>{request.purchase?.unit || 'units'}</small></td>
          <td>{formatMoney(request.purchase?.estimatedCost)}</td>
          <td>{formatDate(request.createdAt)}<small>{request.reason}</small></td>
        </>
      );
    }
    if (type === 'referral') {
      return (
        <>
          <td>{request.referral?.patientName || getApplicant(request)}<small>{request.referral?.patientId || getApplicantId(request)}</small></td>
          <td>{request.department || '—'}<small>{request.requestedByDoctor || 'Referring doctor not recorded'}</small></td>
          <td>{request.targetHospital || '—'}</td>
          <td>{request.referral?.referralReason || request.reason || '—'}<small>{request.referral?.diagnosis || 'Diagnosis not recorded'}{request.referral?.clinicalSummary ? ` · ${request.referral.clinicalSummary}` : ''}</small></td>
          <td>{request.referral?.urgency || request.priority || 'Normal'}</td>
        </>
      );
    }
    if (type === 'medical_certificate') {
      const restPeriod = request.certificate?.restStartDate || request.certificate?.restEndDate
        ? `${formatDate(request.certificate?.restStartDate)} – ${formatDate(request.certificate?.restEndDate)}`
        : request.certificate?.prescribedDays
          ? `${request.certificate.prescribedDays} day(s)`
          : request.duration || 'Not recorded';
      return (
        <>
          <td>{getApplicant(request)}<small>{getApplicantId(request)}</small></td>
          <td>{request.reason || 'Not recorded'}</td>
          <td>{restPeriod}</td>
          <td>{request.certificate?.academicPurpose || 'Not recorded'}</td>
          <td>{request.certificate?.clinicalAdvice || 'Not recorded'}</td>
        </>
      );
    }
    return (
      <>
        <td>{getApplicant(request)}<small>{getApplicantId(request)}</small></td>
        <td>{request.certificate?.certificateType || 'Medical certificate'}</td>
        <td>{request.certificate?.prescribedDays ?? '—'}</td>
        <td>{request.requestedByDoctor || '—'}</td>
        <td>{request.reason}</td>
      </>
    );
  };

  const headersByTab = {
    leave_request: ['Applicant', 'Role / Department', 'Leave type', 'Dates / Duration', 'Reason'],
    purchase_request: ['Department', 'Requester / Request ID', 'Item / Category', 'Qty requested / approved', 'Est. cost', 'Submitted / Reason'],
    referral: ['Patient / ID', 'Department / Referring doctor', 'Destination hospital', 'Clinical reason / diagnosis', 'Urgency'],
    medical_certificate: ['Student / ID', 'Diagnosis / medical reason', 'Rest period', 'Academic purpose', 'Dietary / rest instructions']
  };

  return (
    <div className="space-y-5 bg-slate-50 p-4 sm:p-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              <ClipboardList className="text-teal-600" size={24} /> Approvals &amp; Requests
            </h1>
            <p className="mt-1 text-sm text-slate-500">Review requests, record decisions, and track the approval history.</p>
          </div>
          <button
            onClick={() => {
              setRequestForm({
                ...getInitialRequestForm(),
                applicantRole: activeTab === 'leave_request' || activeTab === 'purchase_request' ? 'staff' : 'student',
                department: user?.department || '',
                requestedByDoctor: user?.name || ''
              });
              setError('');
              setRequestFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
          >
            <Plus size={16} /> New {tabs.find((tab) => tab.id === activeTab)?.label.replace(/ Requests?$/, '').replace(/s$/, '')} Request
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Pending', value: summary.pending, icon: Clock3, color: 'text-amber-700 bg-amber-50' },
          { label: 'Approved today', value: summary.approvedToday, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Rejected today', value: summary.rejectedToday, icon: XCircle, color: 'text-rose-700 bg-rose-50' },
          { label: 'Urgent requests', value: summary.urgentRequests, icon: AlertCircle, color: 'text-orange-700 bg-orange-50' }
        ].map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className={`rounded-lg p-2 ${color}`}><Icon size={19} /></span>
            <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-800">{value}</p></div>
          </article>
        ))}
      </section>

      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200" aria-label="Request categories">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${
              activeTab === id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
        <label className="relative xl:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requester name or ID" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
        </label>
        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
        </select>
        <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">All departments</option>
          {departments.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-500">{activeTab === 'leave_request' ? 'Leave from' : 'From'}
          <input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700" />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-500">{activeTab === 'leave_request' ? 'Leave to' : 'To'}
          <input aria-label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700" />
        </label>
      </section>

      {filterStatus === 'pending' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={visibleBulkIds.length > 0 && visibleBulkIds.every((request) => selectedIds.some((selected) => selected._id === request._id && selected.recordSource === request.recordSource))}
              onChange={(event) => setSelectedIds(event.target.checked ? visibleBulkIds : [])}
              disabled={!visibleBulkIds.length}
            />
            Select routine requests ({selectedIds.length})
          </label>
          <button onClick={approveSelected} disabled={saving || !selectedIds.length} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            Approve selected
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-slate-500">
            <AlertCircle size={28} className="text-slate-300" />
            <p className="font-semibold">No {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} match these filters.</p>
            <p>Submit a request with the button above, or change the status and filters to find existing requests.</p>
          </div>
        ) : (
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                {filterStatus === 'pending' && <th className="p-3">Select</th>}
                {headersByTab[activeTab].map((header) => <th key={header} className="p-3">{header}</th>)}
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => (
                <tr key={`${request.recordSource}-${request._id}`} className="align-top hover:bg-slate-50/70">
                  {filterStatus === 'pending' && (
                    <td className="p-3">
                      {request.status === 'pending'
                        && request.priority !== 'urgent'
                        && getRequestType(request) !== 'medical_certificate' && (
                        <input
                          aria-label={`Select ${getApplicant(request)}`}
                          type="checkbox"
                          checked={selectedIds.some((selected) => selected._id === request._id && selected.recordSource === request.recordSource)}
                          onChange={() => toggleSelected({ _id: request._id, recordSource: request.recordSource })}
                        />
                      )}
                    </td>
                  )}
                  {renderCells(request)}
                  <td className="p-3"><span className={`rounded-full px-2 py-1 font-semibold ${request.priority === 'urgent' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'}`}>{request.priority || 'normal'}</span></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 font-semibold ${
                    request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      request.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                        request.status === 'returned' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'
                  }`}>{request.status}</span></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDetails(request)}
                        className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700"
                      >
                        {getRequestType(request) === 'leave_request' || getRequestType(request) === 'referral' || getRequestType(request) === 'medical_certificate' ? 'View Details' : 'Details'}
                      </button>
                      {getRequestType(request) !== 'leave_request' && request.status === 'pending' && (
                        <>
                          {getRequestType(request) === 'purchase_request' && request.priority !== 'urgent' && (
                            <button onClick={() => void markPriority(request, 'urgent')} disabled={saving} className="rounded-md bg-orange-600 px-2 py-1 font-semibold text-white disabled:opacity-50">Mark urgent</button>
                          )}
                          {getRequestType(request) === 'purchase_request' && request.priority === 'urgent' && (
                            <button onClick={() => void markPriority(request, 'normal')} disabled={saving} className="rounded-md border border-orange-200 px-2 py-1 font-semibold text-orange-800 disabled:opacity-50">Clear urgent</button>
                          )}
                          <button onClick={() => openReview(request, 'approved')} className="rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white">Approve</button>
                          <button onClick={() => openReview(request, 'returned')} className="rounded-md bg-violet-600 px-2 py-1 font-semibold text-white">Return</button>
                          <button onClick={() => openReview(request, 'rejected')} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white">Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(details || detailsLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Request details">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {getRequestType(details?.request || {}) === 'medical_certificate' ? 'Medical certificate details & audit history' : 'Request details & audit history'}
              </h2>
              <button onClick={() => setDetails(null)} aria-label="Close details"><X size={20} /></button>
            </div>
            {detailsLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading request details...</p> : details && (
              <RequestDetails details={details} onReview={openReview} />
            )}
          </div>
        </div>
      )}

      {reviewRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Record approval decision">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{reviewAction === 'approved' ? 'Approve request' : reviewAction === 'rejected' ? 'Reject request' : 'Return for correction'}</h2>
              <button onClick={() => setReviewRequest(null)} aria-label="Close decision dialog"><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-600">{getApplicant(reviewRequest)} · {reviewRequest.requestNumber || reviewRequest._id}</p>
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {reviewAction === 'approved' && getRequestType(reviewRequest) === 'purchase_request' && (
              <label className="block text-sm font-medium text-slate-700">
                Approve quantity (requested: {reviewRequest.purchase?.quantity} {reviewRequest.purchase?.unit || 'units'})
                <input
                  type="number"
                  required
                  min="1"
                  max={reviewRequest.purchase?.quantity}
                  step="1"
                  value={approvedQuantity}
                  onChange={(event) => setApprovedQuantity(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Comment {reviewAction === 'approved' ? '(optional)' : '(required)'}
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm" placeholder={reviewAction === 'approved' ? 'Add an optional note...' : 'Explain what needs to change or why this is rejected...'} />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReviewRequest(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
              <button onClick={submitDecision} disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Confirm decision'}</button>
            </div>
          </div>
        </div>
      )}

      {requestFormOpen && (
        <RequestForm
          requestType={activeTab}
          value={requestForm}
          onChange={updateFormField}
          onClose={() => setRequestFormOpen(false)}
          onSubmit={submitNewRequest}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
};

const RequestForm = ({ requestType, value, onChange, onClose, onSubmit, saving, error }) => {
  const textField = (field, label, { required = false, type = 'text', min, step } = {}) => (
    <label className="block text-xs font-semibold text-slate-700">
      {label}{required ? ' *' : ''}
      <input
        type={type}
        required={required}
        min={min}
        step={step}
        value={value[field]}
        onChange={(event) => onChange(field, event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
  const textArea = (field, label, { required = false, rows = 3 } = {}) => (
    <label className="block text-xs font-semibold text-slate-700">
      {label}{required ? ' *' : ''}
      <textarea
        required={required}
        rows={rows}
        value={value[field]}
        onChange={(event) => onChange(field, event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
      />
    </label>
  );
  const selectField = (field, label, options) => (
    <label className="block text-xs font-semibold text-slate-700">
      {label}
      <select
        value={value[field]}
        onChange={(event) => onChange(field, event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );

  const typeLabel = tabs.find((tab) => tab.id === requestType)?.label || 'Request';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={`Submit ${typeLabel}`}>
      <form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Submit {typeLabel}</h2>
            <p className="text-xs text-slate-500">Required fields are marked with an asterisk.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close request form"><X size={20} /></button>
        </div>

        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          {(requestType === 'leave_request' || requestType === 'purchase_request') && (
            <>
              {textField('applicantName', requestType === 'leave_request' ? 'Staff name' : 'Requester name', { required: requestType === 'leave_request' })}
              {textField('applicantId', requestType === 'leave_request' ? 'Staff ID' : 'Requester ID', { required: requestType === 'leave_request' })}
              {requestType === 'leave_request' && selectField('applicantRole', 'Requester type', [['staff', 'Staff']])}
            </>
          )}

          {requestType === 'leave_request' && (
            <>
              {textField('department', 'Department', { required: true })}
              {selectField('leaveType', 'Leave type', [
                ['annual', 'Annual'], ['sick', 'Sick'], ['maternity', 'Maternity'],
                ['paternity', 'Paternity'], ['bereavement', 'Bereavement'], ['unpaid', 'Unpaid'], ['other', 'Other']
              ])}
              {textField('startDate', 'Start date', { required: true, type: 'date' })}
              {textField('endDate', 'End date', { required: true, type: 'date' })}
              {textField('totalDays', 'Total days', { required: true, type: 'number', min: 1, step: 1 })}
              {textField('balanceAtRequest', 'Remaining leave balance (days)', { type: 'number', min: 0, step: 0.5 })}
              {textArea('departmentCoverage', 'Department coverage plan', { rows: 2 })}
            </>
          )}

          {requestType === 'purchase_request' && (
            <>
              {textField('department', 'Requesting department', { required: true })}
              {textField('itemName', 'Item name', { required: true })}
              {selectField('purchaseCategory', 'Item category', [
                ['Medicine', 'Medicine'], ['Medical supplies', 'Medical supplies'],
                ['Medical equipment', 'Medical equipment'], ['Laboratory supplies', 'Laboratory supplies'],
                ['Office and registration supplies', 'Office and registration supplies'], ['Other', 'Other']
              ])}
              {textField('quantity', 'Quantity', { required: true, type: 'number', min: 1, step: 1 })}
              {textField('purchaseUnit', 'Unit (boxes, kits, packs...)', { required: true })}
              {textField('estimatedCost', 'Estimated total cost (ETB)', { required: true, type: 'number', min: 0, step: 0.01 })}
              {textField('currentStock', 'Current stock level', { type: 'number', min: 0, step: 1 })}
              {textField('monthlyUsage', 'Usage in the last month', { type: 'number', min: 0, step: 1 })}
            </>
          )}

          {requestType === 'referral' && (
            <>
              {textField('applicantName', 'Patient name', { required: true })}
              {textField('applicantId', 'Patient ID', { required: true })}
              {textField('targetHospital', 'Referral hospital', { required: true })}
              {textField('requestedByDoctor', 'Referring doctor', { required: true })}
              {textField('diagnosis', 'Diagnosis', { required: true })}
              {selectField('urgency', 'Urgency', [['normal', 'Normal'], ['urgent', 'Urgent']])}
              {textArea('clinicalSummary', 'Clinical summary')}
              {textArea('testResults', 'Tests and results')}
              {textArea('referralReason', 'Referral reason', { required: true })}
            </>
          )}

          {requestType === 'medical_certificate' && (
            <>
              {textField('applicantName', 'Patient name', { required: true })}
              {textField('applicantId', 'Patient ID', { required: true })}
              {selectField('applicantRole', 'Patient type', [['student', 'Student'], ['staff', 'Staff']])}
              {selectField('certificateType', 'Certificate type', [['sick_leave', 'Sick leave'], ['fitness', 'Fitness'], ['other', 'Other']])}
              {textField('prescribedDays', 'Prescribed rest days', { type: 'number', min: 0, step: 1 })}
              {textField('restStartDate', 'Rest period start date', { type: 'date' })}
              {textField('restEndDate', 'Rest period end date', { type: 'date', min: value.restStartDate || undefined })}
              {textField('requestedByDoctor', 'Issuing doctor', { required: true })}
              {textField('attachmentUrl', 'Supporting document URL')}
              {textArea('academicPurpose', 'Academic purpose (e.g. make-up exam or class absence)')}
              {textArea('clinicalAdvice', 'Dietary and rest instructions')}
            </>
          )}

          {requestType !== 'medical_certificate' && requestType !== 'referral' && (
            <label className="block text-xs font-semibold text-slate-700">
              Priority
              <select value={value.priority} onChange={(event) => onChange('priority', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          )}
        </div>

        {textArea('reason', requestType === 'referral'
          ? 'Additional request notes'
          : requestType === 'medical_certificate' ? 'Diagnosis / medical reason' : 'Reason for request', { required: requestType !== 'referral' })}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
};

const RequestDetails = ({ details, onReview }) => {
  const { request, departmentConflicts = [], currentStock, staffRole, staffCoverage } = details;
  const type = getRequestType(request);
  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <Detail label="Request ID" value={request.requestNumber || request._id} />
        <Detail label="Status" value={request.status} />
        <Detail label="Applicant" value={`${getApplicant(request)} (${getApplicantId(request)})`} />
        {type === 'leave_request' && <Detail label="Staff role" value={staffRole || request.staffRole || 'Staff role not recorded'} />}
        <Detail label="Department" value={request.department || request.purchase?.requesterDepartment || '—'} />
        <Detail label="Reason" value={request.reason || '—'} />
        <Detail label="Priority" value={request.priority || 'normal'} />
      </div>

      {type === 'leave_request' && (
        <section className="space-y-2">
          <h3 className="font-bold text-slate-800">Leave details</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Detail label="Leave type" value={request.leave?.leaveType || '—'} />
            <Detail label="Dates" value={`${formatDate(request.leave?.startDate)} – ${formatDate(request.leave?.endDate)}`} />
            <Detail label="Total days" value={request.leave?.totalDays ?? '—'} />
            <Detail label="Balance at request" value={request.leave?.balanceAtRequest ?? 'Not provided'} />
            <Detail label="Department coverage" value={request.leave?.departmentCoverage || '—'} />
          </div>
          {staffCoverage && (
            <div className={`rounded-lg border p-3 ${
              staffCoverage.overlappingLeaveRequests > 0
                ? 'border-amber-200 bg-amber-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}>
              <h4 className="font-semibold text-slate-800">Staff coverage check · {staffCoverage.role}</h4>
              {staffCoverage.staffDirectoryAvailable ? (
                <p className="mt-1 text-xs text-slate-700">
                  {staffCoverage.activeStaff} active staff in this role and department;{' '}
                  {staffCoverage.plannedLeaveCount} planned leave(s), including this request;{' '}
                  approximately {staffCoverage.estimatedAvailableStaff} staff member(s) remain available.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-700">
                  Staff directory coverage is unavailable for this department or role. Confirm the roster before deciding.
                </p>
              )}
              {staffCoverage.overlappingLeaveRequests > 0 && (
                <p className="mt-1 text-xs font-medium text-amber-800">
                  Review overlapping requests and confirm shift coverage before approving.
                </p>
              )}
            </div>
          )}
          <p className="font-semibold text-slate-700">Overlapping staff leave in this department</p>
          {departmentConflicts.length ? (
            <ul className="list-inside list-disc text-xs text-slate-600">
              {departmentConflicts.map((conflict) => <li key={conflict._id}>{conflict.applicantName} · {formatDate(conflict.leave?.startDate)}–{formatDate(conflict.leave?.endDate)} ({conflict.status})</li>)}
            </ul>
          ) : <p className="text-xs text-slate-500">No overlapping leave requests found.</p>}
          {request.attachmentUrl && <a className="text-teal-700 underline" href={request.attachmentUrl} target="_blank" rel="noreferrer">Open supporting document</a>}
        </section>
      )}

      {type === 'purchase_request' && (
        <section className="space-y-2">
          <h3 className="font-bold text-slate-800">Purchase and stock details</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Detail label="Requesting department" value={request.purchase?.requesterDepartment || request.department || '—'} />
            <Detail label="Requested by" value={`${getApplicant(request)} · ${request.purchase?.requesterRole || 'Staff'}`} />
            <Detail label="Item" value={request.purchase?.itemName || '—'} />
            <Detail label="Category" value={request.purchase?.category || 'Other'} />
            <Detail label="Requested quantity" value={`${request.purchase?.quantity ?? '—'} ${request.purchase?.unit || 'units'}`} />
            <Detail label="Approved quantity" value={request.purchase?.approvedQuantity == null ? 'Not decided' : `${request.purchase.approvedQuantity} ${request.purchase?.unit || 'units'}`} />
            <Detail label="Estimated cost" value={formatMoney(request.purchase?.estimatedCost)} />
            <Detail label="Live clinic inventory stock" value={currentStock ? `${currentStock.quantity} ${currentStock.unit}` : 'No matching inventory item'} />
            <Detail label="Department-reported current stock" value={request.purchase?.currentStock ?? 'Not recorded'} />
            <Detail label="Usage in last month" value={request.purchase?.monthlyUsage ?? 'Not recorded'} />
            <Detail label="Approval / delivery status" value={`${request.status} / ${(request.fulfillmentStatus || 'awaiting_approval').replaceAll('_', ' ')}`} />
          </div>
          <h4 className="text-xs font-semibold text-slate-700">Purchase history provided with request</h4>
          {request.purchase?.purchaseHistory?.length ? (
            <ul className="space-y-1 text-xs text-slate-600">
              {request.purchase.purchaseHistory.map((item, index) => <li key={`${item.date}-${index}`}>{formatDate(item.date)} · {item.quantity} units · {formatMoney(item.cost)} · {item.supplier || 'Supplier unavailable'}</li>)}
            </ul>
          ) : <p className="text-xs text-slate-500">No purchase history was attached to this request.</p>}
        </section>
      )}

      {type === 'referral' && (
        <section className="space-y-2">
          <h3 className="font-bold text-slate-800">Referral information</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Detail label="Patient" value={`${request.referral?.patientName || getApplicant(request)} (${request.referral?.patientId || getApplicantId(request)})`} />
            <Detail label="Hospital" value={request.targetHospital || '—'} />
            <Detail label="Referring department" value={request.department || '—'} />
            <Detail label="Diagnosis" value={request.referral?.diagnosis || '—'} />
            <Detail label="Referring doctor" value={request.requestedByDoctor || '—'} />
            <Detail label="Urgency" value={request.referral?.urgency || request.priority || 'normal'} />
            <Detail label="Referral reason" value={request.referral?.referralReason || request.reason || '—'} />
          </div>
          <Detail label="Clinical summary" value={request.referral?.clinicalSummary || 'Not provided'} />
          <Detail label="Test results" value={request.referral?.testResults || 'Not provided'} />
          {request.status === 'approved' && (
            <>
              <p className="text-xs font-medium text-emerald-700">
                Approved by {request.approvedBy || 'Clinic Head'}{request.approvedAt ? ` on ${formatDate(request.approvedAt)}` : ''}.
              </p>
              <button onClick={() => openPrintableDocument(request, 'referral')} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">
              Preview / print referral letter
              </button>
            </>
          )}
        </section>
      )}

      {type === 'medical_certificate' && (
        <section className="space-y-2">
          <h3 className="font-bold text-slate-800">Medical certificate</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Detail label="Student / patient" value={`${getApplicant(request)} (${getApplicantId(request)})`} />
            <Detail label="Certificate type" value={request.certificate?.certificateType || 'Medical certificate'} />
            <Detail label="Diagnosis / medical reason" value={request.reason || 'Not recorded'} />
            <Detail
              label="Rest period"
              value={request.certificate?.restStartDate || request.certificate?.restEndDate
                ? `${formatDate(request.certificate?.restStartDate)} – ${formatDate(request.certificate?.restEndDate)}`
                : request.certificate?.prescribedDays
                  ? `${request.certificate.prescribedDays} day(s); dates not recorded`
                  : request.duration || 'Not recorded'}
            />
            <Detail label="Academic purpose" value={request.certificate?.academicPurpose || 'Not recorded'} />
            <Detail label="Issuing doctor" value={request.requestedByDoctor || 'Not recorded'} />
          </div>
          <Detail label="Dietary and rest instructions" value={request.certificate?.clinicalAdvice || 'Not recorded'} />
          {request.status === 'approved' && (
            <p className="text-xs font-medium text-emerald-700">
              Digitally approved by {request.approvedBy || 'Clinic Head'}{request.approvedAt ? ` on ${formatDate(request.approvedAt)}` : ''}.
            </p>
          )}
          {request.status === 'approved' && (
            <>
              <p className="text-xs font-medium text-emerald-700">
                Approved by {request.approvedBy || 'Clinic Head'}{request.approvedAt ? ` on ${formatDate(request.approvedAt)}` : ''}.
              </p>
              <button onClick={() => openPrintableDocument(request, 'certificate')} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">
                Preview / print approved certificate
              </button>
            </>
          )}
          {request.attachmentUrl && <a className="text-teal-700 underline" href={request.attachmentUrl} target="_blank" rel="noreferrer">Open supporting document</a>}
        </section>
      )}

      <section className="space-y-2 border-t border-slate-200 pt-4">
        <h3 className="flex items-center gap-2 font-bold text-slate-800"><History size={16} /> Decision audit log</h3>
        {request.decisionHistory?.length ? (
          <ol className="space-y-2">
            {request.decisionHistory.map((entry, index) => (
              <li key={`${entry._id || entry.actedAt}-${index}`} className="rounded-lg bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-slate-700">{entry.action} · {entry.actorName} · {formatDateTime(entry.actedAt)}</p>
                {entry.comment && <p className="mt-1 text-slate-600">{entry.comment}</p>}
              </li>
            ))}
          </ol>
        ) : <p className="text-xs text-slate-500">No decision history recorded.</p>}
      </section>

      {request.status === 'pending' && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <button onClick={() => onReview(request, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Check size={14} className="mr-1 inline" />{type === 'purchase_request' ? 'Approve / adjust quantity' : type === 'medical_certificate' ? 'Approve certificate' : 'Approve'}</button>
          <button onClick={() => onReview(request, 'returned')} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white">{type === 'medical_certificate' ? 'Return certificate' : 'Return for correction'}</button>
          <button onClick={() => onReview(request, 'rejected')} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"><XCircle size={14} className="mr-1 inline" />{type === 'medical_certificate' ? 'Reject certificate' : 'Reject'}</button>
        </div>
      )}
    </div>
  );
};

const Detail = ({ label, value }) => (
  <div><p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p><p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{value}</p></div>
);

export default ApprovalsAndRequests;

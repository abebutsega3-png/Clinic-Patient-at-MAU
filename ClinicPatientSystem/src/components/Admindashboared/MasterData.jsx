import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpDown,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Eye,
  FlaskConical,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const categoryOptions = [
  { value: 'department', label: 'Departments / Units', group: 'Clinic setup' },
  { value: 'job_title', label: 'Staff Job Titles', group: 'Staff reference' },
  { value: 'service', label: 'Clinic Services', group: 'Clinic services' },
  { value: 'patient_category', label: 'Patient Categories', group: 'Patient flow' },
  { value: 'visit_type', label: 'Visit Types', group: 'Patient flow' },
  { value: 'priority', label: 'Queue Priorities', group: 'Queue configuration' },
  { value: 'queue_prefix', label: 'Queue Prefixes', group: 'Queue configuration' },
  { value: 'queue_status', label: 'Queue Statuses', group: 'Queue configuration' },
  { value: 'medicine', label: 'Medicine Catalog', group: 'Clinical catalogs' },
  { value: 'lab_test', label: 'Laboratory Test Catalog', group: 'Clinical catalogs' },
  { value: 'unit', label: 'Units of Measurement', group: 'Clinical catalogs' },
  { value: 'campus_location', label: 'Campus / Location', group: 'General reference' },
  { value: 'academic_department', label: 'Academic Departments', group: 'General reference' },
  { value: 'referral_reason', label: 'Referral Reasons', group: 'General reference' },
  { value: 'cancellation_reason', label: 'Cancellation Reasons', group: 'General reference' },
  { value: 'reference_status', label: 'Reference Statuses', group: 'General reference' },
];

const baseFields = [
  { name: 'code', label: 'Code', required: true, placeholder: 'e.g. EXAM-002' },
  { name: 'name', label: 'Name', required: true, placeholder: 'Enter a clear name' },
  { name: 'description', label: 'Description', type: 'textarea' },
];

const categoryFields = {
  department: [
    ...baseFields.slice(0, 2),
    baseFields[2],
    { name: 'location', label: 'Location / Room' },
  ],
  job_title: [
    ...baseFields,
    { name: 'departmentId', label: 'Assigned Department', type: 'department' },
  ],
  service: [
    ...baseFields,
    { name: 'departmentId', label: 'Responsible Department', type: 'department', required: true },
    { name: 'durationMinutes', label: 'Estimated Duration (minutes)', type: 'number', required: true, min: 1, max: 1440 },
  ],
  patient_category: baseFields,
  visit_type: baseFields,
  priority: baseFields,
  queue_prefix: baseFields,
  queue_status: baseFields,
  medicine: [
    ...baseFields,
    { name: 'strength', label: 'Strength', required: true },
    { name: 'dosageForm', label: 'Dosage Form', required: true },
    { name: 'unit', label: 'Catalog Unit', type: 'unit', required: true },
  ],
  lab_test: [
    ...baseFields,
    { name: 'departmentId', label: 'Responsible Department', type: 'department', required: true },
  ],
  unit: baseFields,
  campus_location: [...baseFields, { name: 'location', label: 'Location Details' }],
  academic_department: [...baseFields, { name: 'location', label: 'Campus / Location' }],
  referral_reason: baseFields,
  cancellation_reason: baseFields,
  reference_status: baseFields,
};

const categoryFieldLabels = {
  department: { code: 'Department Code', name: 'Department Name' },
  job_title: { code: 'Job Title Code', name: 'Job Title' },
  service: { code: 'Service Code', name: 'Service Name' },
  patient_category: { code: 'Category Code', name: 'Patient Category' },
  visit_type: { code: 'Visit Type Code', name: 'Visit Type' },
  priority: { code: 'Priority Code', name: 'Priority' },
  queue_prefix: { code: 'Prefix Code', name: 'Queue Prefix' },
  queue_status: { code: 'Status Code', name: 'Queue Status' },
  medicine: { code: 'Item Code', name: 'Medicine Name' },
  lab_test: { code: 'Test Code', name: 'Test Name' },
  unit: { code: 'Unit Code', name: 'Unit Name' },
  campus_location: { code: 'Location Code', name: 'Campus / Location' },
  academic_department: { code: 'Academic Department Code', name: 'Academic Department' },
  referral_reason: { code: 'Reason Code', name: 'Referral Reason' },
  cancellation_reason: { code: 'Reason Code', name: 'Cancellation Reason' },
  reference_status: { code: 'Status Code', name: 'Reference Status' },
};

const emptyForm = {
  category: 'department',
  code: '',
  name: '',
  description: '',
  departmentId: '',
  durationMinutes: '',
  strength: '',
  dosageForm: '',
  unit: '',
  location: '',
  status: 'Active',
};

const formatDate = (date) => {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
};

export default function MasterData() {
  const { token } = useAuth();
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [unitOptions, setUnitOptions] = useState([]);
  const [summary, setSummary] = useState({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const pageSize = 12;

  useEffect(() => {
    let active = true;
    const loadMasterData = async () => {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({ search, category, status });
        const response = await fetch(`/api/master-data?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Unable to load master data (${response.status}).`);
        }
        if (active) {
          setRecords(Array.isArray(result.data) ? result.data : []);
          setSummary(result.summary || {});
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load master data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMasterData();
    return () => { active = false; };
  }, [token, search, category, status, refreshKey]);

  useEffect(() => {
    let active = true;
    const loadDepartments = async () => {
      try {
        const response = await fetch('/api/departments?status=Active', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Unable to load departments (${response.status}).`);
        }
        if (active) setDepartments(Array.isArray(result.data) ? result.data : []);
        const unitResponse = await fetch('/api/master-data/catalog/unit', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const unitResult = await unitResponse.json().catch(() => null);
        if (!unitResponse.ok || !unitResult?.success) {
          throw new Error(unitResult?.message || `Unable to load measurement units (${unitResponse.status}).`);
        }
        if (active) setUnitOptions(Array.isArray(unitResult.data) ? unitResult.data : []);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load departments.');
      }
    };
    void loadDepartments();
    return () => { active = false; };
  }, [token, refreshKey]);

  useEffect(() => {
    if (dialog !== 'view' || !selectedRecord?._id) return undefined;
    let active = true;
    const loadAudit = async () => {
      setAuditLoading(true);
      try {
        const type = selectedRecord.recordType === 'department' ? 'department' : 'master_data';
        const response = await fetch(`/api/master-data/${selectedRecord._id}/audit?entityType=${type}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Unable to load audit history (${response.status}).`);
        }
        if (active) setAuditHistory(Array.isArray(result.data) ? result.data : []);
      } catch (loadError) {
        if (active) setFormError(loadError.message || 'Unable to load audit history.');
      } finally {
        if (active) setAuditLoading(false);
      }
    };
    void loadAudit();
    return () => { active = false; };
  }, [dialog, selectedRecord, token]);

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const visibleRecords = useMemo(() => (
    records.slice((page - 1) * pageSize, page * pageSize)
  ), [records, page]);
  const formFields = (categoryFields[form.category] || baseFields).map((field) => ({
    ...field,
    ...(categoryFieldLabels[form.category]?.[field.name]
      ? { label: categoryFieldLabels[form.category][field.name] }
      : {}),
  }));

  const categoryLabel = (value) => (
    categoryOptions.find((item) => item.value === value)?.label || value || '—'
  );

  const openCreate = () => {
    setSelectedRecord(null);
    setForm({ ...emptyForm, category: category === 'all' ? 'department' : category });
    setFormError('');
    setDialog('create');
  };

  const openEdit = (record) => {
    setSelectedRecord(record);
    setForm({
      ...emptyForm,
      category: record.category || 'department',
      code: record.code || '',
      name: record.name || '',
      description: record.description || '',
      departmentId: record.departmentId?._id || record.departmentId || '',
      durationMinutes: record.durationMinutes ?? '',
      strength: record.strength || '',
      dosageForm: record.dosageForm || '',
      unit: record.unit || '',
      location: record.location || '',
      status: record.status || 'Active',
    });
    setFormError('');
    setDialog('edit');
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    const isDepartment = form.category === 'department';
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      durationMinutes: form.durationMinutes === '' ? '' : Number(form.durationMinutes),
    };
    try {
      const isEdit = dialog === 'edit';
      const url = isDepartment
        ? (isEdit ? `/api/departments/${selectedRecord._id}` : '/api/departments')
        : (isEdit ? `/api/master-data/${selectedRecord._id}` : '/api/master-data');
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to save record (${response.status}).`);
      }
      setDialog('');
      setNotice(result.message || (isEdit ? 'Record updated.' : 'Record created.'));
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setFormError(saveError.message || 'Unable to save record.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (record) => {
    const nextStatus = record.status === 'Active' ? 'Inactive' : 'Active';
    const confirmation = nextStatus === 'Inactive'
      ? `Deactivate "${record.name}"? Existing visits or reports will keep their historical references, but this record should no longer be selected for new work.`
      : `Activate "${record.name}" for use in new work?`;
    if (!window.confirm(confirmation)) return;
    setError('');
    setNotice('');
    try {
      const endpoint = record.recordType === 'department'
        ? `/api/departments/${record._id}/status`
        : `/api/master-data/${record._id}/status`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to change status (${response.status}).`);
      }
      setNotice(result.message || `Record ${nextStatus.toLowerCase()}.`);
      setRefreshKey((current) => current + 1);
    } catch (statusError) {
      setError(statusError.message || 'Unable to change record status.');
    }
  };

  const openView = (record) => {
    setSelectedRecord(record);
    setAuditHistory([]);
    setFormError('');
    setDialog('view');
  };

  const getSecondary = (record) => {
    const details = [];
    if (record.departmentName) details.push(record.departmentName);
    if (record.location) details.push(record.location);
    if (record.durationMinutes) details.push(`${record.durationMinutes} min`);
    if (record.strength) details.push(record.strength);
    if (record.dosageForm) details.push(record.dosageForm);
    if (record.unit) details.push(record.unit);
    return details.join(' · ') || record.description || '—';
  };

  return (
    <section className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>System Admin</span><ChevronRight size={14} aria-hidden="true" />
            <span className="text-teal-700">Master Data</span>
          </div>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Master Data</h1>
              <p className="mt-1 text-sm text-slate-500">Manage the clinic&apos;s shared reference data.</p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
            >
              <Plus size={17} aria-hidden="true" /> Add New
            </button>
          </div>
        </div>

        {notice && (
          <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="flex items-center gap-2"><CheckCircle2 size={17} aria-hidden="true" />{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss success message"><X size={16} /></button>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss error message"><X size={16} /></button>
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
          {[
            { label: 'Departments', value: summary.departments ?? 0, icon: Building2, color: 'text-blue-700 bg-blue-50' },
            { label: 'Staff Job Titles', value: summary.jobTitles ?? 0, icon: UsersRound, color: 'text-violet-700 bg-violet-50' },
            { label: 'Clinic Services', value: summary.services ?? 0, icon: ShieldCheck, color: 'text-teal-700 bg-teal-50' },
            { label: 'Patient Categories', value: summary.patientCategories ?? 0, icon: BookOpen, color: 'text-amber-700 bg-amber-50' },
            { label: 'Active Records', value: summary.activeRecords ?? 0, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <span className={`rounded-lg p-2 ${color}`}><Icon size={17} aria-hidden="true" /></span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{loading ? '—' : value}</p>
            </article>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(220px,280px)_minmax(150px,190px)]">
              <label className="relative block">
                <span className="sr-only">Search master data</span>
                <Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, code, description..."
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label>
                <span className="sr-only">Filter by category</span>
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="all">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{loading ? 'Loading records…' : `${records.length} ${records.length === 1 ? 'record' : 'records'} found`}</span>
              <span className="inline-flex items-center gap-1"><Archive size={14} aria-hidden="true" /> Deactivation preserves existing references.</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reference record</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Assignment / Details</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="7" className="px-4 py-14 text-center text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />Loading master data…</span>
                  </td></tr>
                ) : error ? (
                  <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-rose-700">Master data could not be loaded.</td></tr>
                ) : visibleRecords.length === 0 ? (
                  <tr><td colSpan="7" className="px-4 py-14 text-center">
                    <Database size={28} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />
                    <p className="font-semibold text-slate-700">No reference records found</p>
                    <p className="mt-1 text-xs text-slate-500">Adjust your search or filters, or add a new record.</p>
                  </td></tr>
                ) : visibleRecords.map((record) => (
                  <tr key={`${record.recordType}-${record._id}`} className="transition hover:bg-slate-50/80">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{record.name}</div>
                      <div className="mt-0.5 max-w-sm truncate text-xs text-slate-500">{record.description || 'No description'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{categoryLabel(record.category)}</td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{record.code || '—'}</span>
                    </td>
                    <td className="max-w-[260px] px-4 py-3.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        {record.category === 'department' ? <MapPin size={13} className="shrink-0 text-slate-400" /> : record.category === 'lab_test' ? <FlaskConical size={13} className="shrink-0 text-slate-400" /> : <Clock3 size={13} className="shrink-0 text-slate-400" />}
                        <span className="truncate">{getSecondary(record)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${record.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {record.status || 'Active'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">{formatDate(record.updatedAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openView(record)} title="View details and audit history" aria-label={`View ${record.name}`} className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Eye size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={() => openEdit(record)} title="Edit record" aria-label={`Edit ${record.name}`} className="rounded-md p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"><Pencil size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={() => void changeStatus(record)} title={record.status === 'Active' ? 'Deactivate record' : 'Activate record'} aria-label={`${record.status === 'Active' ? 'Deactivate' : 'Activate'} ${record.name}`} className={`rounded-md p-2 ${record.status === 'Active' ? 'text-slate-500 hover:bg-rose-50 hover:text-rose-700' : 'text-emerald-700 hover:bg-emerald-50'}`}>
                          {record.status === 'Active' ? <Archive size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && records.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
              <span>Page {page} of {totalPages} · {records.length} records</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} />Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {dialog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) setDialog('');
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="master-data-dialog-title" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <h2 id="master-data-dialog-title" className="text-lg font-bold text-slate-900">
                    {dialog === 'view' ? 'Reference Record Details' : dialog === 'edit' ? 'Edit Reference Record' : 'Add Reference Record'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">{dialog === 'view' ? 'Review this record and its change history.' : 'Shared reference data for authorized clinic workflows.'}</p>
                </div>
                <button type="button" disabled={saving} onClick={() => setDialog('')} aria-label="Close dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={19} /></button>
              </div>

              {dialog === 'view' && selectedRecord ? (
                <div className="space-y-5 p-5 sm:p-6">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['Category', categoryLabel(selectedRecord.category)],
                      ['Status', selectedRecord.status || 'Active'],
                      ['Name', selectedRecord.name],
                      ['Code', selectedRecord.code || '—'],
                      ['Description', selectedRecord.description || '—'],
                      ['Department / Unit', selectedRecord.departmentName || '—'],
                      ['Location', selectedRecord.location || '—'],
                      ['Estimated duration', selectedRecord.durationMinutes ? `${selectedRecord.durationMinutes} minutes` : '—'],
                      ['Strength', selectedRecord.strength || '—'],
                      ['Dosage form', selectedRecord.dosageForm || '—'],
                      ['Catalog unit', selectedRecord.unit || '—'],
                      ['Last updated', formatDate(selectedRecord.updatedAt)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0 rounded-lg bg-slate-50 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                        <dd className="mt-1 break-words text-sm text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="mb-3 text-sm font-bold text-slate-800">Audit History</h3>
                    {formError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</p>}
                    {auditLoading ? <p className="text-xs text-slate-500">Loading audit history…</p> : auditHistory.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">No audit entries are available for this record yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {auditHistory.map((entry) => (
                          <article key={entry._id} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-slate-800">{entry.action.replaceAll('_', ' ')}</span>
                              <time className="text-[11px] text-slate-500">{formatDate(entry.createdAt)}</time>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">Changed by {entry.userName || 'Administrator'}</p>
                            {entry.changes?.length > 0 && (
                              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {entry.changes.map((change, index) => (
                                  <li key={`${change.field}-${index}`}><span className="font-semibold">{change.field}:</span> {change.from || '—'} <ArrowUpDown size={11} className="inline text-slate-400" aria-hidden="true" /> {change.to || '—'}</li>
                                ))}
                              </ul>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => openEdit(selectedRecord)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"><Pencil size={15} />Edit record</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitForm}>
                  <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                    <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                      Category <span className="text-rose-600">*</span>
                      <select
                        required
                        disabled={dialog === 'edit'}
                        value={form.category}
                        onChange={(event) => setForm((current) => ({ ...emptyForm, ...current, category: event.target.value }))}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                      >
                        {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    {formFields.map((field) => (
                      <label key={field.name} className={`block text-sm font-medium text-slate-700 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                        {field.label}{field.required && <span className="text-rose-600"> *</span>}
                        {field.type === 'textarea' ? (
                          <textarea
                            rows="3"
                            required={field.required}
                            maxLength="1000"
                            value={form[field.name] || ''}
                            onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                            className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          />
                        ) : field.type === 'department' ? (
                          <select
                            required={field.required}
                            value={form.departmentId}
                            onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          >
                            <option value="">Select active department / unit</option>
                            {departments.map((department) => <option key={department._id} value={department._id}>{department.name} ({department.code})</option>)}
                          </select>
                        ) : field.type === 'unit' ? (
                          <select
                            required={field.required}
                            value={form.unit}
                            onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          >
                            <option value="">Select catalog unit</option>
                            {unitOptions.map((unit) => <option key={unit._id} value={unit.name}>{unit.name}</option>)}
                          </select>
                        ) : (
                          <input
                            required={field.required}
                            type={field.type || 'text'}
                            min={field.min}
                            max={field.max}
                            step={field.type === 'number' ? '1' : undefined}
                            maxLength={field.type === 'number' ? undefined : '120'}
                            placeholder={field.placeholder}
                            value={form[field.name] ?? ''}
                            onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          />
                        )}
                      </label>
                    ))}
                    <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                      Status <span className="text-rose-600">*</span>
                      <select required value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                        <option value="Active">Active</option><option value="Inactive">Inactive</option>
                      </select>
                    </label>
                    {form.category === 'medicine' && (
                      <p className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
                        Catalog information only. Patient-specific prescriptions and clinical dosing decisions belong in the clinical workflow.
                      </p>
                    )}
                    {form.category === 'queue_status' && (
                      <p className="sm:col-span-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
                        This configures supported status values only. Daily patient queues are managed by authorized clinic staff.
                      </p>
                    )}
                    {formError && <p role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{formError}</p>}
                  </div>
                  <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <button type="button" disabled={saving} onClick={() => setDialog('')} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={saving || (['service', 'lab_test'].includes(form.category) && departments.length === 0)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                      {saving ? 'Saving…' : dialog === 'edit' ? 'Save Changes' : 'Create Record'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

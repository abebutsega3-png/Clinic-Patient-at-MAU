import { useEffect, useRef, useState } from 'react';
import { FileText, Pencil, Printer, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 15;
const tabs = ['Patient Information', 'Visit History', 'Clinical Records'];
const categories = ['Student', 'Staff', 'Other Authorized Patient'];

const displayDate = (value, includeTime = false) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Africa/Addis_Ababa',
  }).format(date);
};

const dateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const errorMessage = async (response) => {
  const body = await response.json().catch(() => ({}));
  return body.message || `Request failed (${response.status}).`;
};

function InfoGrid({ entries }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || 'Not recorded'}</dd>
        </div>
      ))}
    </dl>
  );
}

function PatientEditDialog({ patient, token, onClose, onSaved }) {
  const [maxBirthDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    fullName: patient.fullName || '',
    sex: patient.sex || '',
    dateOfBirth: dateInputValue(patient.dateOfBirth),
    phoneNumber: patient.phoneNumber || '',
    patientCategory: patient.patientCategory || '',
    governmentIdNumber: patient.governmentIdNumber || '',
    universityIdNumber: patient.universityIdNumber || '',
    academicDepartment: patient.academicDepartment || '',
    region: patient.region || '',
    woreda: patient.woreda || '',
    kebele: patient.kebele || '',
    dormBlock: patient.dormBlock || '',
    houseNumber: patient.houseNumber || '',
    emergencyContactName: patient.emergencyContactName || '',
    emergencyContactPhone: patient.emergencyContactPhone || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/card-room/patients/${encodeURIComponent(patient.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json();
      if (!result.success || !result.data) throw new Error(result.message || 'Patient update was not confirmed.');
      onSaved(result.data, result.message || 'Patient information updated.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to update patient information.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100';
  const textField = (name, label, props = {}) => (
    <label key={name} className="text-sm font-medium text-slate-700">
      {label}<input name={name} value={form[name]} onChange={setField} className={inputClass} {...props} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <form role="dialog" aria-modal="true" aria-labelledby="records-edit-title" onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">MRN · {patient.patientId}</p>
            <h2 id="records-edit-title" className="mt-1 text-xl font-bold text-slate-900">Edit patient information</h2>
            <p className="mt-1 text-sm text-slate-500">Only demographics are updated. Existing visits and clinical history are unchanged.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close edit form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {textField('fullName', 'Full name *', { required: true, minLength: 2, maxLength: 120 })}
          <label className="text-sm font-medium text-slate-700">Sex
            <select name="sex" value={form.sex} onChange={setField} className={inputClass}><option value="">Not specified</option><option>Male</option><option>Female</option><option>Other</option></select>
          </label>
          {textField('dateOfBirth', 'Date of birth', { type: 'date', max: maxBirthDate })}
          {textField('phoneNumber', 'Phone number', { type: 'tel', maxLength: 30 })}
          <label className="text-sm font-medium text-slate-700">Patient category *
            <select name="patientCategory" required value={form.patientCategory} onChange={setField} className={inputClass}>
              <option value="">Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          {textField('universityIdNumber', 'University ID', { maxLength: 80 })}
          {textField('governmentIdNumber', 'Government ID', { maxLength: 80 })}
          {textField('academicDepartment', 'Department / Faculty', { maxLength: 120 })}
          {textField('region', 'Region', { maxLength: 100 })}
          {textField('woreda', 'Woreda / Subcity', { maxLength: 100 })}
          {textField('kebele', 'Kebele', { maxLength: 100 })}
          {textField('dormBlock', 'Dorm block / room', { maxLength: 80 })}
          {textField('houseNumber', 'House number', { maxLength: 40 })}
          {textField('emergencyContactName', 'Emergency contact name', { maxLength: 120 })}
          {textField('emergencyContactPhone', 'Emergency contact phone', { maxLength: 30 })}
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save demographic changes'}</button>
        </div>
      </form>
    </div>
  );
}

export default function CardRoomRecords() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [clinicalRecords, setClinicalRecords] = useState([]);
  const [clinicalState, setClinicalState] = useState('idle');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [pdfError, setPdfError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const recordRef = useRef(null);

  useEffect(() => {
    let active = true;
    const loadPermissions = async () => {
      try {
        const response = await fetch('/api/card-room/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const result = await response.json();
        if (active && result.success && Array.isArray(result.data?.permissions)) {
          setRolePermissions(result.data.permissions);
        }
      } catch (permissionError) {
        console.error('Unable to load patient-record permissions:', permissionError);
      }
    };
    void loadPermissions();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (search.length < 2) {
      return undefined;
    }
    let active = true;
    const loadPatients = async () => {
      setLoadingSearch(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({ search, page: String(page), limit: String(PAGE_SIZE) });
        const response = await fetch(`/api/card-room/patients?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) throw new Error(result.message || 'Patient search returned an invalid response.');
        if (active) {
          setPatients(result.data);
          setPagination(result.pagination || { pages: 1, total: result.data.length });
        }
      } catch (loadError) {
        if (active) setSearchError(loadError.message || 'Unable to search patient records.');
      } finally {
        if (active) setLoadingSearch(false);
      }
    };
    void loadPatients();
    return () => { active = false; };
  }, [search, page, token, refresh]);

  const openFolder = async (patient) => {
    setSelectedPatient(null);
    setFolderError('');
    setNotice('');
    setPdfError('');
    setClinicalRecords([]);
    setClinicalState('loading');
    setLoadingFolder(true);
    setActiveTab(tabs[0]);
    try {
      const response = await fetch(`/api/card-room/patients/${encodeURIComponent(patient.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json();
      if (!result.success || !result.data) throw new Error(result.message || 'Unable to load the patient folder.');
      setSelectedPatient(result.data);
      const clinicalResponse = await fetch(`/api/card-room/patients/${encodeURIComponent(patient.id)}/clinical-records`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (clinicalResponse.status === 403) {
        setClinicalState('restricted');
      } else if (!clinicalResponse.ok) {
        setClinicalState('error');
      } else {
        const clinicalResult = await clinicalResponse.json();
        if (!clinicalResult.success || !Array.isArray(clinicalResult.data?.records)) setClinicalState('error');
        else {
          setClinicalRecords(clinicalResult.data.records);
          setClinicalState('loaded');
        }
      }
    } catch (loadError) {
      setFolderError(loadError.message || 'Unable to load the patient folder.');
    } finally {
      setLoadingFolder(false);
    }
  };

  const savedPatient = (patient, message) => {
    setSelectedPatient((current) => ({ ...current, ...patient }));
    setPatients((current) => current.map((item) => item.id === patient.id ? { ...item, ...patient } : item));
    setEditing(false);
    setNotice(message);
    setRefresh((value) => value + 1);
  };

  const downloadPdf = async () => {
    if (!selectedPatient || !recordRef.current) return;
    setPdfError('');
    setDownloadingPdf(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const safeMrn = String(selectedPatient.patientId || 'patient-record').replace(/[^a-zA-Z0-9_-]/g, '-');
      await html2pdf()
        .set({
          margin: 10,
          filename: `${safeMrn}-patient-record.pdf`,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            ignoreElements: (element) => element.classList?.contains('records-no-print'),
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(recordRef.current)
        .save();
    } catch (pdfFailure) {
      console.error('Unable to generate patient-record PDF:', pdfFailure);
      setPdfError('Unable to create the PDF. Please use Print patient record and choose Save as PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setSearch('');
    setPage(1);
    setPatients([]);
    setPagination({ pages: 0, total: 0 });
    setSearchError('');
    setLoadingSearch(false);
  };

  const activeRole = String(user?.activeRole || user?.role || '').toLowerCase();
  const canEditDemographics = activeRole === 'card chief' && rolePermissions.includes('patients:edit');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .records-print-area, .records-print-area * { visibility: visible !important; }
          .records-print-area { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 20px; }
          .records-no-print { display: none !important; }
          .records-print-area section { break-inside: avoid; }
        }
      `}</style>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">Card Room · MAU Clinic</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Patient Card / Records</h1>
          <p className="mt-1 text-sm text-slate-500">Search for a patient and open their demographic folder and visit history.</p>
        </div>
        {selectedPatient && (
          <div className="records-no-print flex flex-wrap gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Printer size={16} aria-hidden="true" /> Print patient record
            </button>
            <button type="button" onClick={() => void downloadPdf()} disabled={downloadingPdf} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
              <FileText size={16} aria-hidden="true" /> {downloadingPdf ? 'Creating PDF…' : 'Download PDF'}
            </button>
          </div>
        )}
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form onSubmit={(event) => {
          event.preventDefault();
          const value = searchText.trim();
          setSearch(value);
          setPage(1);
          if (value.length < 2) {
            setPatients([]);
            setPagination({ pages: 0, total: 0 });
            setSearchError('');
            setLoadingSearch(false);
          }
        }} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="records-search" className="sr-only">Search patients by MRN, name, phone, or ID</label>
          <div className="relative min-w-0 flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="records-search" type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search MRN, full name, phone, or ID number" className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"><Search size={16} /> Search</button>
          {searchText && <button type="button" onClick={clearSearch} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear</button>}
        </form>
      </section>

      {searchError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{searchError}</p>}
      {loadingSearch && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Searching the patient database…</p>}
      {!loadingSearch && search.length >= 2 && !searchError && patients.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <UserRound className="mx-auto text-slate-400" size={28} aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-slate-900">No matching patients</h2>
          <p className="mt-1 text-sm text-slate-500">Check the MRN, name, phone number, or identification number.</p>
        </div>
      )}
      {!search && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">Enter at least two characters to search protected patient records.</p>
      )}
      {patients.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-semibold text-slate-900">Search results</h2><p className="text-xs text-slate-500">{pagination.total} matching patient records</p></div>
            <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loadingSearch} aria-label="Refresh search results" className="rounded-lg border border-slate-300 p-2 text-slate-600 disabled:opacity-50"><RefreshCw size={16} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">MRN</th><th className="px-5 py-3">Student ID</th><th className="px-5 py-3">Patient</th><th className="px-5 py-3">Sex / Age</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-teal-800">{patient.patientId || '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{patient.universityIdNumber || '—'}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{patient.fullName || 'Name unavailable'}</td>
                    <td className="px-5 py-4 text-slate-600">{patient.sex || '—'}{patient.age == null ? '' : ` · ${patient.age} yrs`}</td>
                    <td className="px-5 py-4 text-slate-600">{patient.phoneNumber || '—'}</td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => void openFolder(patient)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800">View Records</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm"><span className="text-slate-500">Page {page} of {pagination.pages}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))} disabled={page >= pagination.pages} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button></div></footer>}
        </section>
      )}

      {loadingFolder && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Loading patient folder…</p>}
      {folderError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{folderError}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      {pdfError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{pdfError}</p>}

      {selectedPatient && (
        <article ref={recordRef} className="records-print-area overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><FileText size={22} aria-hidden="true" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Mekdela Amba University Clinic · Patient Folder</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{selectedPatient.fullName}</h2>
                <p className="mt-1 text-sm text-slate-600">MRN {selectedPatient.patientId} · Registered {displayDate(selectedPatient.createdAt)}</p>
              </div>
            </div>
            <div className="records-no-print flex flex-wrap gap-2">
              {canEditDemographics && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={15} /> Edit patient information</button>}
              <button type="button" onClick={() => navigate(`/card-room/visits/new?patientId=${encodeURIComponent(selectedPatient.id)}`, { state: { patient: selectedPatient } })} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">Register Visit / Start Queue</button>
              <button type="button" onClick={() => setSelectedPatient(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close folder</button>
            </div>
          </header>

          <nav className="records-no-print flex flex-wrap gap-1 border-b border-slate-100 px-4 pt-3" aria-label="Patient record sections">
            {tabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-current={activeTab === tab ? 'page' : undefined} className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold ${activeTab === tab ? 'border-b-2 border-teal-700 text-teal-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>{tab}</button>)}
          </nav>

          <div className="p-5 sm:p-6">
            {(activeTab === 'Patient Information' || activeTab === tabs[0]) && (
              <div className="space-y-6">
                <section><h3 className="mb-4 font-semibold text-slate-900">Patient identification</h3><InfoGrid entries={[
                  ['Medical Record Number', selectedPatient.patientId],
                  ['Card number', selectedPatient.cardNumber],
                  ['Registration date', displayDate(selectedPatient.createdAt)],
                  ['Current patient status', selectedPatient.patientStatus],
                  ['Patient category', selectedPatient.patientCategory],
                  ['Patient type', selectedPatient.patientType],
                ]} /></section>
                <section className="border-t border-slate-100 pt-5"><h3 className="mb-4 font-semibold text-slate-900">Personal information</h3><InfoGrid entries={[
                  ['Full name', selectedPatient.fullName],
                  ['First name', selectedPatient.firstName],
                  ["Father's name", selectedPatient.fatherName],
                  ["Grandfather's name", selectedPatient.grandfatherName],
                  ['Sex', selectedPatient.sex],
                  ['Date of birth', displayDate(selectedPatient.dateOfBirth)],
                  ['Age', selectedPatient.age == null ? '' : `${selectedPatient.age} years`],
                ]} /></section>
                <section className="border-t border-slate-100 pt-5"><h3 className="mb-4 font-semibold text-slate-900">Contact, address, and institution</h3><InfoGrid entries={[
                  ['University ID', selectedPatient.universityIdNumber],
                  ['Government ID', selectedPatient.governmentIdNumber],
                  ['Phone number', selectedPatient.phoneNumber],
                  ['Department / Faculty', selectedPatient.academicDepartment],
                  ['Address', [selectedPatient.region, selectedPatient.woreda, selectedPatient.kebele, selectedPatient.dormBlock, selectedPatient.houseNumber].filter(Boolean).join(', ') || selectedPatient.address],
                  ['Emergency contact', selectedPatient.emergencyContactName],
                  ['Emergency contact phone', selectedPatient.emergencyContactPhone],
                ]} /></section>
              </div>
            )}

            {activeTab === 'Visit History' && (
              <section>
                <h3 className="mb-4 font-semibold text-slate-900">Visit history</h3>
                {selectedPatient.visits?.length ? (
                  <div className="space-y-3">
                    {selectedPatient.visits.map((visit) => (
                      <article key={visit._id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><p className="font-semibold text-slate-900">{visit.visitId || 'Visit record'}</p><p className="mt-1 text-sm text-slate-500">{displayDate(visit.visitDate, true)}</p></div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{visit.status || 'Status unavailable'}</span>
                        </div>
                        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {[['Visit type', visit.visitType], ['Priority', visit.priority], ['Department', visit.department], ['Queue number', visit.queue?.queueNumber], ['Queue status', visit.queue?.status], ['Destination', visit.queue?.department]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{value || 'Not recorded'}</dd></div>)}
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No visits are recorded for this patient.</p>}
              </section>
            )}

            {activeTab === 'Clinical Records' && (
              <section>
                <h3 className="mb-2 font-semibold text-slate-900">Clinical records</h3>
                {clinicalState === 'restricted' ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your active role is not permitted to view clinical diagnoses or treatment details. Patient demographics and visit status remain available.</p>
                ) : clinicalState === 'error' ? (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Clinical records could not be loaded. Please try again later.</p>
                ) : clinicalState === 'loading' ? (
                  <p role="status" className="p-4 text-sm text-slate-500">Checking authorized clinical records…</p>
                ) : clinicalRecords.length ? (
                  <div className="space-y-3">
                    {clinicalRecords.map((record) => (
                      <article key={`${record.source}-${record.id}`} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-slate-900">{record.source}{record.visitId ? ` · ${record.visitId}` : ''}</h4><time className="text-xs text-slate-500">{displayDate(record.date, true)}</time></div>
                        <InfoGrid entries={ [['Diagnosis', record.diagnosis], ['Department', record.department], ['Recorded by', record.professional]] } />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No clinical diagnoses are recorded for this patient. This does not indicate a negative finding.</p>
                )}
              </section>
            )}
          </div>
        </article>
      )}

      {editing && selectedPatient && <PatientEditDialog patient={selectedPatient} token={token} onClose={() => setEditing(false)} onSaved={savedPatient} />}
    </div>
  );
}

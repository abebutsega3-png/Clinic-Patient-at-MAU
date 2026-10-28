import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, Pencil, Plus, RefreshCw, Search, UsersRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 15;
const categories = ['Student', 'Staff', 'Other Authorized Patient'];

const getErrorMessage = async (response) => {
  const result = await response.json().catch(() => ({}));
  return result.message || `Request failed (${response.status}).`;
};

const localDate = (date) => {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Africa/Addis_Ababa' }).format(parsed);
};

function PatientDialog({ patient, mode, onClose, onSaved }) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    fullName: patient.fullName || '',
    sex: patient.sex || '',
    phoneNumber: patient.phoneNumber || '',
    patientCategory: patient.patientCategory || '',
    region: patient.region || '',
    woreda: patient.woreda || '',
    kebele: patient.kebele || '',
    houseNumber: patient.houseNumber || '',
    academicDepartment: patient.academicDepartment || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(patient);
  const isEditing = mode === 'edit';

  useEffect(() => {
    if (isEditing) return undefined;
    let active = true;
    fetch(`/api/card-room/patients/${encodeURIComponent(patient.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Unable to load patient details.');
      if (active) setDetails(result.data);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Unable to load patient details.');
    });
    return () => {
      active = false;
    };
  }, [isEditing, patient.id, token]);

  const submitEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/card-room/patients/${encodeURIComponent(patient.id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Unable to save patient changes.');
      onSaved(result.data);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save patient changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="patient-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">Medical Record Number · {patient.patientId}</p>
            <h2 id="patient-dialog-title" className="mt-1 text-xl font-bold text-slate-900">{isEditing ? 'Edit patient details' : 'Patient details'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

        {isEditing ? (
          <form onSubmit={submitEdit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Patient name
                <input required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Sex
                <select value={form.sex} onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Not specified</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Patient category
                <select required value={form.patientCategory} onChange={(event) => setForm((current) => ({ ...current, patientCategory: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone number
                <input type="tel" maxLength={30} value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Department / Faculty
                <input maxLength={120} value={form.academicDepartment} onChange={(event) => setForm((current) => ({ ...current, academicDepartment: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              {['region', 'woreda', 'kebele', 'houseNumber'].map((field) => (
                <label key={field} className="text-sm font-medium capitalize text-slate-700">
                  {field === 'woreda' ? 'Woreda / Subcity' : field.replace(/([A-Z])/g, ' $1')}
                  <input value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        ) : (
          <>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Patient name', details.fullName],
                ['Sex', details.sex],
                ['Age', details.age == null ? '' : `${details.age} years`],
                ['Phone number', details.phoneNumber],
                ['Patient category', details.patientCategory],
                ['Registration date', localDate(details.createdAt)],
                ['Department / Faculty', details.academicDepartment],
                ['Address', [details.region, details.woreda, details.kebele, details.houseNumber].filter(Boolean).join(', ') || details.address],
              ].map(([label, value]) => (
                <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{value || 'Not recorded'}</dd></div>
              ))}
            </dl>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={onClose} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Close</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function CardRoomPatients() {
  const { token } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.savedPatient ? (location.state.message || 'Patient registered successfully.') : '');
  const [dialog, setDialog] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadPatients = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (query) params.set('search', query);
        const response = await fetch(`/api/card-room/patients?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Unable to load patient records.');
        if (active) {
          const rows = Array.isArray(result.data) ? result.data : [];
          const justSaved = location.state?.savedPatient;
          const merged = justSaved && page === 1 && !query
            ? [justSaved, ...rows.filter((patient) => patient.id !== justSaved.id)]
            : rows;
          setPatients(merged);
          setPagination({
            ...result.pagination,
            total: Math.max(result.pagination?.total || 0, justSaved && page === 1 && !query ? 1 : 0),
          });
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load patient records.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPatients();
    return () => {
      active = false;
    };
  }, [location.state, page, query, refresh, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextQuery = search.trim();
      if (nextQuery !== query) {
        setPage(1);
        setQuery(nextQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, query]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const clearSearch = () => {
    setSearch('');
    setQuery('');
    setPage(1);
  };

  const updatePatient = (patient) => {
    setPatients((current) => current.map((item) => item.id === patient.id ? patient : item));
    setDialog(null);
    setNotice('Patient details updated.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">Card Room · Patient Administration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Patient List</h1>
          <p className="mt-1 text-sm text-slate-500">Search and manage patients registered in the clinic database.</p>
        </div>
        <Link to="/card-room/register" className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800">
          <Plus size={17} aria-hidden="true" /> Add New Patient
        </Link>
      </header>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>{error}</span><button type="button" onClick={() => setRefresh((value) => value + 1)} className="font-semibold underline">Retry</button></div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><UsersRound size={20} aria-hidden="true" /></span>
            <div><h2 className="font-semibold text-slate-900">Registered patients</h2><p className="text-xs text-slate-500">{pagination.total || 0} records</p></div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={submitSearch} className="flex gap-2">
              <label htmlFor="patient-list-search" className="sr-only">Search patients</label>
              <div className="relative min-w-0 flex-1 sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input id="patient-list-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search MRN, name, phone, ID" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
              </div>
              <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Search</button>
              {search && <button type="button" onClick={clearSearch} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Clear</button>}
            </form>
            <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} aria-label="Refresh patient list" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">MRN</th><th scope="col" className="px-5 py-3">Patient name</th>
                <th scope="col" className="px-5 py-3">Sex</th><th scope="col" className="px-5 py-3">Age</th>
                <th scope="col" className="px-5 py-3">Phone</th><th scope="col" className="px-5 py-3">Registered</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-500">Loading patient records…</td></tr>
              ) : patients.length ? patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-teal-800">{patient.patientId || '—'}</td>
                  <td className="px-5 py-4 font-medium text-slate-900">{patient.fullName || 'Name unavailable'}</td>
                  <td className="px-5 py-4 text-slate-600">{patient.sex || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{patient.age ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{patient.phoneNumber || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">{localDate(patient.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setDialog({ patient, mode: 'view' })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"><Eye size={14} aria-hidden="true" /> View</button>
                      <button type="button" onClick={() => setDialog({ patient, mode: 'edit' })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"><Pencil size={14} aria-hidden="true" /> Edit</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="px-5 py-12 text-center">
                  <p className="font-medium text-slate-700">{error ? 'Patient records could not be loaded.' : query ? 'No patients match your search.' : 'No patient records yet.'}</p>
                  {!query && !error && <Link to="/card-room/register" className="mt-2 inline-block text-sm font-semibold text-teal-700 hover:underline">Register the first patient</Link>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
          <span>Page {page} of {Math.max(pagination.pages || 1, 1)}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-50">Previous</button>
            <button type="button" disabled={page >= (pagination.pages || 1) || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-50">Next</button>
          </div>
        </footer>
      </section>

      {dialog && <PatientDialog patient={dialog.patient} mode={dialog.mode} onClose={() => setDialog(null)} onSaved={updatePatient} />}
    </div>
  );
}

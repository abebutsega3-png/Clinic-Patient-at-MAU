import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  IdCard,
  Printer,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const FACILITY_NAME = 'Mekdela Amba University Student Clinic';
const emptyForm = {
  firstName: '',
  fatherName: '',
  grandfatherName: '',
  sex: '',
  dateOfBirth: '',
  phoneNumber: '',
  patientCategory: 'Student',
  region: '',
  woreda: '',
  kebele: '',
  dormBlock: '',
  houseNumber: '',
  universityIdNumber: '',
  departmentFaculty: '',
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return '';
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  if (!birthYear || !birthMonth || !birthDay) return '';
  const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  let age = Number(todayParts.year) - birthYear;
  if (
    Number(todayParts.month) < birthMonth
    || (Number(todayParts.month) === birthMonth && Number(todayParts.day) < birthDay)
  ) age -= 1;
  return age >= 0 ? age : '';
};

const getToday = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
};

const formatDate = (date) => {
  if (!date) return 'Not available';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'Africa/Addis_Ababa',
  }).format(parsed);
};

const formatDateTime = (date) => {
  if (!date) return 'Not available';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Addis_Ababa',
  }).format(parsed);
};

function Field({ label, name, value, onChange, required = false, ...props }) {
  const id = `patient-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        aria-required={required}
        {...props}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, required = false, disabled = false, children }) {
  return (
    <div>
      <label htmlFor={`patient-${name}`} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
      </label>
      <select
        id={`patient-${name}`}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-required={required}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {children}
      </select>
    </div>
  );
}

function PatientCard({ patient, onPrint }) {
  const fullName = patient.fullName
    || [patient.firstName, patient.fatherName, patient.grandfatherName].filter(Boolean).join(' ');
  const address = [patient.region, patient.woreda, patient.kebele, patient.houseNumber]
    .filter(Boolean)
    .join(', ') || patient.address;
  const fields = [
    ['First name', patient.firstName],
    ["Father's name", patient.fatherName],
    ["Grandfather's name", patient.grandfatherName],
    ['Student ID number', patient.universityIdNumber],
    ['Medical record number', patient.patientId],
    ['Department', patient.academicDepartment || patient.departmentFaculty],
    ['Age', patient.age == null ? '' : `${patient.age} years`],
    ['Sex', patient.sex],
    ['Date of birth', formatDate(patient.dateOfBirth)],
    ['Date of registration', formatDateTime(patient.createdAt)],
    ['Phone number', patient.phoneNumber],
    ['Dorm block / room number', patient.dormBlock],
    ['Home address / Kebele', address],
  ];

  return (
    <div className="patient-print-card rounded-xl border-2 border-slate-700 bg-white p-5 text-slate-900 sm:p-7">
      <header className="border-b-2 border-slate-800 pb-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-500 text-slate-700">
          <IdCard size={25} aria-hidden="true" />
        </div>
        <p className="mt-2 text-xs font-bold uppercase tracking-wider">Mekdela Amba University</p>
        <p className="text-sm font-bold uppercase tracking-wider">Student Clinic</p>
        <h2 className="mt-3 text-xl font-black uppercase tracking-wide">Student Medical Record Card</h2>
        <p className="mt-1 text-sm font-semibold">{fullName || 'Patient name unavailable'}</p>
      </header>
      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className={label === 'Home address / Kebele' ? 'sm:col-span-2' : ''}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 min-h-7 border-b border-slate-400 pb-1 text-sm font-semibold text-slate-900">{value || '—'}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onPrint}
        className="no-print mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
      >
        <Printer size={16} aria-hidden="true" />
        Print Patient Card
      </button>
    </div>
  );
}

function PatientMatch({ patient, onOpen, onSelect }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div>
        <p className="font-semibold text-slate-900">{patient.fullName}</p>
        <p className="mt-1 text-xs text-slate-600">
          MRN: {patient.patientId} · {patient.sex || 'Sex unavailable'} · {patient.age ?? 'Age unavailable'}
        </p>
        {patient.phoneNumber && <p className="mt-1 text-xs text-slate-600">Phone: {patient.phoneNumber}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onOpen} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-amber-100">
          Open record
        </button>
        <button type="button" onClick={onSelect} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800">
          Check in existing patient
        </button>
      </div>
    </div>
  );
}

export default function RegisterNewPatient() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState(null);
  const [savedPatientPrompt, setSavedPatientPrompt] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchOpen, setMatchOpen] = useState(null);
  const age = useMemo(() => calculateAge(form.dateOfBirth), [form.dateOfBirth]);

  const apiRequest = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      const error = new Error(result.message || `Request failed (${response.status}).`);
      error.details = result;
      throw error;
    }
    return result;
  };

  const setField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setNotice(null);
    setMatches([]);
  };

  const validate = () => {
    const next = {};
    const validName = /^\p{L}[\p{L}\p{M} .'-]*$/u;
    ['firstName', 'fatherName', 'grandfatherName'].forEach((field) => {
      const value = form[field].trim();
      if (!value) next[field] = 'This name is required.';
      else if (value.length < 2 || value.length > 60 || !validName.test(value)) {
        next[field] = 'Use 2–60 letters, spaces, apostrophes, or hyphens.';
      }
    });
    if (!form.sex) next.sex = 'Select sex.';
    if (!form.dateOfBirth) next.dateOfBirth = 'Date of birth is required.';
    else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) || form.dateOfBirth > currentDate) next.dateOfBirth = 'Enter a valid date that is not in the future.';
      else if (age === '' || age > 125) next.dateOfBirth = 'Date of birth must produce an age between 0 and 125.';
    }
    if (form.patientCategory !== 'Student') next.patientCategory = 'Patient category must be Student.';
    if (!form.phoneNumber.trim()) {
      next.phoneNumber = 'Phone number is required.';
    } else if (!/^[+()\d\s-]{6,30}$/.test(form.phoneNumber.trim())) {
      next.phoneNumber = 'Enter a valid phone number.';
    }
    if (!form.universityIdNumber.trim()) {
      next.universityIdNumber = 'Student ID number is required.';
    } else if (!/^[\p{L}\p{N}./-]{3,80}$/u.test(form.universityIdNumber.trim())) {
      next.universityIdNumber = 'Use 3–80 letters, numbers, dots, slashes, or hyphens.';
    }
    if (!form.departmentFaculty.trim()) {
      next.departmentFaculty = 'Department is required.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const findPossibleMatches = async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const result = await apiRequest(`/api/card-room/patients?search=${encodeURIComponent(trimmed)}&limit=20`);
    return Array.isArray(result.data)
      ? result.data.map((patient) => ({
        ...patient,
        id: String(patient.id || patient._id || ''),
      })).filter((patient) => patient.id)
      : [];
  };

  const matchesFormIdentity = (patient) => {
    const fullName = [form.firstName, form.fatherName, form.grandfatherName].map((item) => item.trim()).join(' ');
    const identityMatch = patient.universityIdNumber
      && patient.universityIdNumber.trim().toLowerCase() === form.universityIdNumber.trim().toLowerCase();
    const nameMatch = String(patient.fullName || '').trim().toLowerCase() === fullName.trim().toLowerCase();
    const birthMatch = patient.dateOfBirth && form.dateOfBirth
      && new Date(patient.dateOfBirth).toISOString().slice(0, 10) === form.dateOfBirth;
    const phoneMatch = form.phoneNumber
      && String(patient.phoneNumber || '').trim().toLowerCase() === form.phoneNumber.trim().toLowerCase();
    return Boolean(identityMatch || (nameMatch && (birthMatch || phoneMatch)));
  };

  const handleSubmit = async (event, registerVisit = false) => {
    event.preventDefault();
    setNotice(null);
    if (saving || registeredPatient) return;
    if (!validate()) {
      setNotice({ type: 'error', text: 'Please correct the highlighted fields.' });
      return;
    }

    setSaving(true);
    try {
      const searchTerms = [
        form.universityIdNumber.trim(),
        [form.firstName, form.fatherName, form.grandfatherName].map((item) => item.trim()).join(' '),
      ].filter(Boolean);
      const fetchedMatches = [];
      for (const searchTerm of searchTerms) {
        const found = await findPossibleMatches(searchTerm);
        fetchedMatches.push(...found);
      }
      const seen = new Set();
      const possibleMatches = fetchedMatches.filter((patient) => {
        if (!patient.id || seen.has(patient.id)) return false;
        seen.add(patient.id);
        return matchesFormIdentity(patient);
      });
      if (possibleMatches.length) {
        setMatches(possibleMatches);
        setNotice({ type: 'error', text: 'A possible existing patient was found. Open or select the matching record before continuing.' });
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        patientType: 'New Patient',
        fullName: [form.firstName, form.fatherName, form.grandfatherName].map((item) => item.trim()).join(' '),
      };
      const result = await apiRequest('/api/card-room/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setRegisteredPatient(result.data);
      setMatches([]);
      if (registerVisit) {
        navigate(`/card-room/visits/new?patientId=${encodeURIComponent(result.data.id)}`, {
          state: { patient: result.data },
        });
      } else {
        setSavedPatientPrompt({
          patient: result.data,
          message: result.message || 'Patient registered successfully.',
        });
      }
    } catch (saveError) {
      const existing = saveError.details?.existingPatient;
      if (existing) setMatches([existing]);
      setNotice({
        type: 'error',
        text: saveError.message || 'Unable to save patient. Please retry.',
      });
    } finally {
      setSaving(false);
    }
  };

  const clearForm = () => {
    if (saving) return;
    if (Object.values(form).some(Boolean) && !window.confirm('Clear all entered patient details?')) return;
    setForm(emptyForm);
    setErrors({});
    setNotice(null);
    setMatches([]);
    setRegisteredPatient(null);
  };

  const currentDate = getToday();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .patient-print-card, .patient-print-card * { visibility: visible !important; }
          .patient-print-card { position: absolute; inset: 0 auto auto 0; width: 100%; border: 2px solid #0f766e !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Register New Patient</h1>
          <p className="mt-1 text-sm text-slate-500">Register a new student. Use Quick Search / Check-in for returning patients.</p>
        </div>
      </div>

      {notice && (
        <div role={notice.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
          notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-sky-200 bg-sky-50 text-sky-800'
        }`}>
          {notice.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            : <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      {registeredPatient && (
        <PatientCard patient={registeredPatient} onPrint={() => window.print()} />
      )}

      <section className="overflow-hidden rounded-lg border border-emerald-700 bg-white shadow-sm">
        <div className="bg-emerald-700 px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Patient Identification</h2>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Facility Name</p>
            <div className="rounded border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-700">{FACILITY_NAME}</div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Medical Record Number</p>
            <div className="rounded border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700" aria-live="polite">
              {registeredPatient?.patientId || 'Assigned after successful registration'}
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={(event) => handleSubmit(event)} className="space-y-3">
            <section className="overflow-hidden rounded-lg border border-emerald-700 bg-white">
              <div className="bg-emerald-700 px-4 py-2">
                <h2 className="text-sm font-semibold text-white">Personal Information</h2>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['firstName', 'First Name'],
                  ['fatherName', "Father's Name"],
                  ['grandfatherName', "Grandfather's Name"],
                ].map(([name, label]) => (
                  <div key={name}>
                    <Field label={label} name={name} value={form[name]} onChange={setField} required autoComplete="off" maxLength={60} aria-invalid={Boolean(errors[name])} />
                    {errors[name] && <p className="mt-1 text-xs text-rose-700">{errors[name]}</p>}
                  </div>
                ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                  <SelectField label="Sex" name="sex" value={form.sex} onChange={setField} required>
                    <option value="">Select sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </SelectField>
                  {errors.sex && <p className="mt-1 text-xs text-rose-700">{errors.sex}</p>}
                  </div>
                  <div>
                  <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={setField} required max={currentDate} aria-invalid={Boolean(errors.dateOfBirth)} />
                  {errors.dateOfBirth && <p className="mt-1 text-xs text-rose-700">{errors.dateOfBirth}</p>}
                  </div>
                  <div>
                  <label htmlFor="patient-age" className="mb-1.5 block text-sm font-medium text-slate-700">Age</label>
                  <input id="patient-age" value={age === '' ? '' : `${age} years`} readOnly placeholder="Auto-calculated" className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-600" />
                  </div>
                  <div>
                  <SelectField label="Patient Category" name="patientCategory" value={form.patientCategory} onChange={setField} required>
                    <option value="Student">Student</option>
                  </SelectField>
                  {errors.patientCategory && <p className="mt-1 text-xs text-rose-700">{errors.patientCategory}</p>}
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <Field label="Phone Number" name="phoneNumber" type="tel" value={form.phoneNumber} onChange={setField} autoComplete="tel" maxLength={30} required aria-invalid={Boolean(errors.phoneNumber)} placeholder="+251…" />
                    {errors.phoneNumber && <p className="mt-1 text-xs text-rose-700">{errors.phoneNumber}</p>}
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-emerald-700 bg-white">
              <div className="bg-emerald-700 px-4 py-2">
                <h2 className="text-sm font-semibold text-white">Address Information</h2>
              </div>
              <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Dorm Block / Room No." name="dormBlock" value={form.dormBlock} onChange={setField} maxLength={80} />
                <Field label="Kebele" name="kebele" value={form.kebele} onChange={setField} maxLength={100} />
                <Field label="Woreda / Subcity" name="woreda" value={form.woreda} onChange={setField} maxLength={100} />
                <Field label="House Number" name="houseNumber" value={form.houseNumber} onChange={setField} maxLength={40} />
                <Field label="Region (Optional)" name="region" value={form.region} onChange={setField} maxLength={100} />
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-emerald-700 bg-white">
              <div className="bg-emerald-700 px-4 py-2">
                <h2 className="text-sm font-semibold text-white">Identity and Institutional Information</h2>
              </div>
              <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2">
                <div>
                  <Field label="Student ID Number" name="universityIdNumber" value={form.universityIdNumber} onChange={setField} required maxLength={80} aria-invalid={Boolean(errors.universityIdNumber)} placeholder="e.g. 1404253" />
                  {errors.universityIdNumber && <p className="mt-1 text-xs text-rose-700">{errors.universityIdNumber}</p>}
                </div>
                <div>
                  <Field label="Department / Faculty" name="departmentFaculty" value={form.departmentFaculty} onChange={setField} required maxLength={120} aria-invalid={Boolean(errors.departmentFaculty)} placeholder="Patient's university department or faculty" />
                  {errors.departmentFaculty && <p className="mt-1 text-xs text-rose-700">{errors.departmentFaculty}</p>}
                </div>
              </div>
            </section>

            {matches.length > 0 && (
              <section className="space-y-3" aria-label="Possible duplicate patient matches">
                <h2 className="font-semibold text-slate-900">Possible existing patient</h2>
                {matches.map((patient) => (
                  <PatientMatch
                    key={patient.id}
                    patient={patient}
                    onOpen={() => setMatchOpen(patient)}
                    onSelect={() => navigate(`/card-room/visits/new?patientId=${encodeURIComponent(patient.id)}`, { state: { patient } })}
                  />
                ))}
              </section>
            )}

            <div className="flex flex-col-reverse gap-3 rounded-lg border border-emerald-700 bg-white p-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate('/card-room/patients')} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={clearForm} disabled={saving} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  Clear Form
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving || Boolean(registeredPatient)} className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Patient'}
                </button>
                <button type="button" onClick={(event) => handleSubmit(event, true)} disabled={saving || Boolean(registeredPatient)} className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save & Register Visit'}
                </button>
              </div>
            </div>
        </form>

      {matchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMatchOpen(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="patient-match-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-teal-700">Existing patient record</p>
                <h2 id="patient-match-title" className="mt-1 text-xl font-bold text-slate-900">{matchOpen.fullName}</h2>
              </div>
              <button type="button" aria-label="Close patient record" onClick={() => setMatchOpen(null)} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">Close</button>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Medical Record Number', matchOpen.patientId],
                ['Card Number', matchOpen.cardNumber],
                ['Age', matchOpen.age == null ? '' : `${matchOpen.age} years`],
                ['Sex', matchOpen.sex],
                ['Date of Birth', formatDate(matchOpen.dateOfBirth)],
                ['Category', matchOpen.patientCategory],
                ['Phone', matchOpen.phoneNumber],
                ['University ID', matchOpen.universityIdNumber],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{value || 'Not recorded'}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setMatchOpen(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Close
              </button>
              <button type="button" onClick={() => {
                setMatchOpen(null);
                navigate(`/card-room/visits/new?patientId=${encodeURIComponent(matchOpen.id)}`, { state: { patient: matchOpen } });
              }} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                Register visit
              </button>
            </div>
          </section>
        </div>
      )}

      {savedPatientPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="registration-success-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><CheckCircle2 size={21} aria-hidden="true" /></span>
              <div>
                <h2 id="registration-success-title" className="text-lg font-bold text-slate-900">Patient registered successfully</h2>
                <p className="mt-1 text-sm text-slate-600">{savedPatientPrompt.message}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{savedPatientPrompt.patient.fullName}</p>
              <p className="mt-1 text-sm text-slate-600">MRN: {savedPatientPrompt.patient.patientId}</p>
            </div>
            <p className="mt-4 text-sm text-slate-600">Would you like to register a visit and issue a department queue ticket now?</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/card-room/patients', {
                  state: { savedPatient: savedPatientPrompt.patient, message: savedPatientPrompt.message },
                })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Return to Patient List
              </button>
              <button
                type="button"
                onClick={() => navigate(`/card-room/visits/new?patientId=${encodeURIComponent(savedPatientPrompt.patient.id)}`, {
                  state: { patient: savedPatientPrompt.patient },
                })}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Register Visit / Queue Ticket
              </button>
              <button
                type="button"
                onClick={() => navigate(`/card-room/visits/new?patientId=${encodeURIComponent(savedPatientPrompt.patient.id)}`, {
                  state: { patient: savedPatientPrompt.patient, emergencyVisit: true },
                })}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
              >
                Emergency Check-in
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function CardRoomVisitRegistration() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryPatientId = new URLSearchParams(location.search).get('patientId') || '';
  const [patient, setPatient] = useState(location.state?.patient || null);
  const emergencyCheckIn = Boolean(location.state?.emergencyVisit);
  const [visitType, setVisitType] = useState(emergencyCheckIn ? 'Emergency Visit' : 'New Visit');
  const [priority, setPriority] = useState(emergencyCheckIn ? 'Emergency' : 'Normal');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingPatient, setLoadingPatient] = useState(Boolean(!location.state?.patient && queryPatientId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [visitResult, setVisitResult] = useState(null);
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const isEmergencyVisit = visitType === 'Emergency Visit' || priority === 'Emergency';
  const emergencyRoom = departments.find((department) => /emergency/i.test(department.name));
  const assignedDepartmentId = isEmergencyVisit ? (emergencyRoom ? String(emergencyRoom._id) : '') : departmentId;

  useEffect(() => {
    let active = true;
    fetch('/api/master-data/catalog/department', {
      headers: { Authorization: 'Bearer ' + token },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !Array.isArray(data.data)) {
        throw new Error(data.message || `Unable to load clinic departments (${response.status}).`);
      }
      const queueDepartments = data.data.filter((department) => department.usesQueue && !/^CARD$/i.test(department.code));
      if (active) {
        setDepartments(queueDepartments);
        const examination = queueDepartments.find((department) => /examination/i.test(department.name));
        if (examination) setDepartmentId(String(examination._id));
      }
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Unable to load clinic departments.');
    }).finally(() => {
      if (active) setLoadingDepartments(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (patient || !queryPatientId) return undefined;
    let active = true;
    fetch(`/api/card-room/patients/${encodeURIComponent(queryPatientId)}`, {
      headers: { Authorization: 'Bearer ' + token },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || `Request failed (${response.status}).`);
      if (active) setPatient(data.data);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Unable to load the patient record.');
    }).finally(() => {
      if (active) setLoadingPatient(false);
    });
    return () => {
      active = false;
    };
  }, [patient, queryPatientId, token]);

  const submitVisit = async (event) => {
    event.preventDefault();
    if (!patient || submitting || visitResult) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/card-room/visits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: patient.patientId,
          visitType,
          priority,
          departmentId: assignedDepartmentId,
          idempotencyKey,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.message || `Request failed (${response.status}).`);
      setVisitResult(result.data);
      setResultMessage(result.message || 'Visit registered successfully.');
      navigate('/card-room/queue', {
        state: {
          registeredQueueNumber: result.data?.queue?.queueNumber || '',
          queueNotice: result.message || 'Visit registered and added to the queue.',
        },
      });
    } catch (visitError) {
      setError(visitError.message || 'Unable to register visit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button type="button" onClick={() => navigate('/card-room/register')} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900">
        <ArrowLeft size={16} aria-hidden="true" /> Back to patient registration
      </button>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><FileText size={21} aria-hidden="true" /></span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Visit Registration</h1>
            <p className="text-sm text-slate-500">Register a visit for an existing patient record.</p>
          </div>
        </div>
        {loadingPatient ? <p className="mt-6 text-sm text-slate-500">Loading patient…</p> : null}
        {error && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {!loadingPatient && !patient && !error && <p role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Choose a patient from registration or search before starting a visit.</p>}
        {patient && (
          <>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Selected patient</p>
              <p className="mt-1 font-semibold text-slate-900">{patient.fullName}</p>
              <p className="mt-1 text-sm text-slate-600">MRN {patient.patientId} · {patient.sex || 'Sex unavailable'} · {patient.age ?? 'Age unavailable'}</p>
            </div>
            {visitResult ? (
              <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">{resultMessage}</p>
                <p className="mt-1">Visit {visitResult.visit?.visitId || ''}{visitResult.queue?.queueNumber ? ` · Token ${visitResult.queue.queueNumber}` : ''}{visitResult.queue?.department ? ` · ${visitResult.queue.department}` : ''}</p>
                <button type="button" onClick={() => navigate('/card-room')} className="mt-4 font-semibold underline">Return to dashboard</button>
              </div>
            ) : (
              <form onSubmit={submitVisit} className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Visit Type" name="visitType" value={visitType} onChange={(event) => setVisitType(event.target.value)} required disabled={emergencyCheckIn}>
                    <option>New Visit</option>
                    <option>Follow-up Visit</option>
                    <option>Emergency Visit</option>
                  </SelectField>
                  <SelectField label="Priority" name="priority" value={priority} onChange={(event) => setPriority(event.target.value)} required disabled={emergencyCheckIn}>
                    <option>Normal</option>
                    <option>Urgent</option>
                    <option>Emergency</option>
                  </SelectField>
                  <SelectField label="Assign to Department" name="departmentId" value={assignedDepartmentId} onChange={(event) => setDepartmentId(event.target.value)} required disabled={isEmergencyVisit}>
                    <option value="">{loadingDepartments ? 'Loading departments…' : 'Select destination department'}</option>
                    {departments.map((department) => (
                      <option key={department._id} value={department._id}>{department.name}</option>
                    ))}
                  </SelectField>
                </div>
                {isEmergencyVisit && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    {emergencyRoom
                      ? 'Emergency visits are routed directly to the Emergency Room queue for immediate assessment.'
                      : 'An active Emergency Room queue is not configured. This emergency visit cannot be registered until the destination is available.'}
                  </p>
                )}
                <div className="flex justify-end">
                  <button type="submit" disabled={submitting || loadingPatient || loadingDepartments || !assignedDepartmentId || (isEmergencyVisit && !emergencyRoom)} className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                    {submitting ? 'Registering…' : 'Register Visit'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Bandage,
  ClipboardList,
  FileClock,
  FlaskConical,
  HeartPulse,
  Hospital,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  ShieldAlert,
  Stethoscope,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../components/context/AuthContext.jsx';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Emergency Patient Registration', icon: UserPlus },
  { label: 'Emergency Patient Queue', icon: Users },
  { label: 'Triage & Vital Signs', icon: HeartPulse },
  { label: 'Emergency Examination', icon: Stethoscope },
  { label: 'Emergency Treatment', icon: Activity },
  { label: 'Laboratory Requests', icon: FlaskConical },
  { label: 'Medication & Prescription', icon: Pill },
  { label: 'Emergency Procedures', icon: Bandage },
  { label: 'Emergency Referral', icon: Hospital },
  { label: 'Emergency History', icon: FileClock },
  { label: 'Emergency Reports', icon: ClipboardList },
];

const triagePriorities = ['Immediate', 'Very Urgent', 'Urgent', 'Standard', 'Non-Urgent'];

export default function EmergencyRoomDashboard() {
  const { user, token, logout, expireSession } = useAuth();
  const location = useLocation();
  const [activePage, setActivePage] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({});
  const roles = [user?.activeRole, user?.role, ...(user?.roles || []), user?.position, user?.department]
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase().replace(/[_-]+/g, ' '));

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`/api/emergency${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401) {
      expireSession();
      throw new Error(result?.message || 'Your session has expired. Sign in again.');
    }
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || `Emergency Room request failed (${response.status}).`);
    }
    return result;
  }, [expireSession, token]);

  const loadWorkspace = useCallback(async (preferredVisitId = '') => {
    try {
      const [dashboard, queueResult] = await Promise.all([
        request('/dashboard'),
        request('/queue'),
      ]);
      setSummary(dashboard.data);
      setQueue(queueResult.data);
      setError('');
      setSelected((current) => {
        if (preferredVisitId) {
          return queueResult.data.find((entry) => entry.visitId?._id === preferredVisitId) || current || queueResult.data[0] || null;
        }
        if (!current) return queueResult.data[0] || null;
        const selectedVisitId = current.visitId?._id || current._id;
        return queueResult.data.find((entry) => entry.visitId?._id === selectedVisitId) || current;
      });
    } catch (loadError) {
      console.error('Unable to load Emergency Room workspace:', loadError);
      setError(loadError.message || 'Unable to load Emergency Room records.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!['Emergency History', 'Emergency Reports'].includes(activePage)) return;
    let active = true;
    request('/history')
      .then((result) => {
        if (active) setHistory(result.data);
      })
      .catch((loadError) => {
        if (active) {
          console.error('Unable to load Emergency Room history:', loadError);
          setError(loadError.message || 'Unable to load Emergency Room history.');
        }
      });
    return () => { active = false; };
  }, [activePage, request]);

  const visit = selected?.visitId || selected;
  const visitId = visit?._id;
  const patient = visit?.patientRecordId;

  const submit = async (path, method, payload, successMessage, nextPage = '') => {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await request(path, { method, body: JSON.stringify(payload) });
      setNotice(successMessage);
      setForm({});
      if (nextPage) setActivePage(nextPage);
      await loadWorkspace(result.data?.visit?._id || '');
      if (['Emergency History', 'Emergency Reports'].includes(activePage)) {
        const result = await request('/history');
        setHistory(result.data);
      }
    } catch (saveError) {
      console.error('Unable to save Emergency Room record:', saveError);
      setError(saveError.message || 'Unable to save this Emergency Room record.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const selectedDetails = useMemo(() => {
    if (!visit) return null;
    return {
      name: patient?.fullName || visit.patientName || 'Patient',
      patientId: patient?.patientId || visit.patientId || 'ID unavailable',
      complaint: visit.examination?.chiefComplaint || 'Not recorded',
      arrival: visit.emergencyCare?.arrivalAt || selected?.arrivalAt || visit.visitDate,
      priority: visit.emergencyCare?.triagePriority || 'Pending',
    };
  }, [patient, selected, visit]);

  if (!user || !token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!roles.some((role) => role.includes('emergency'))) return <Navigate to="/" replace />;

  const changePage = (page) => {
    setActivePage(page);
    setError('');
    setNotice('');
    setSidebarOpen(false);
  };

  const renderQueue = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {queue.length ? (
        <ul className="divide-y divide-slate-100">
          {queue.map((entry) => {
            const entryVisit = entry.visitId;
            const entryPatient = entryVisit?.patientRecordId;
            const active = (entryVisit?._id || entry._id) === visitId;
            return (
              <li key={entry._id}>
                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition hover:bg-blue-50 ${active ? 'bg-blue-50 ring-inset ring-2 ring-blue-200' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-slate-900">{entryPatient?.fullName || entryVisit?.patientName || 'Patient'}</span>
                    <span className="mt-1 block text-xs text-slate-500">{entry.queueNumber} · {entryPatient?.patientId || entryVisit?.patientId || 'No patient ID'} · {entryVisit?.examination?.chiefComplaint || 'Complaint not recorded'}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${entryVisit?.emergencyCare?.triagePriority === 'Immediate' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {entryVisit?.emergencyCare?.triagePriority || 'Pending triage'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{new Date(entry.arrivalAt || entry.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="p-8 text-center text-sm text-slate-500">There are no active Emergency Room arrivals in the live queue.</p>}
    </div>
  );

  const renderPatientSummary = () => selectedDetails && (
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5" aria-label="Selected emergency visit">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Selected emergency visit</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">{selectedDetails.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{selectedDetails.patientId} · {selected?.queueNumber || visit.visitId || 'Emergency arrival'}</p>
        </div>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">{selectedDetails.priority}</span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs font-semibold text-slate-500">Arrival</dt><dd className="mt-1 font-medium text-slate-800">{selectedDetails.arrival ? new Date(selectedDetails.arrival).toLocaleString() : 'Not recorded'}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">Chief complaint</dt><dd className="mt-1 font-medium text-slate-800">{selectedDetails.complaint}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">Visit status</dt><dd className="mt-1 font-medium text-slate-800">{visit.status || 'Waiting'}</dd></div>
      </dl>
      {patient?.allergies?.length > 0 && <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">Recorded allergies: {patient.allergies.join(', ')}</p>}
    </section>
  );

  const renderForm = () => {
    if (activePage === 'Emergency Patient Registration') {
      return (
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault();
          const payload = {
            patientReference: form.patientReference?.trim() || undefined,
            chiefComplaint: form.chiefComplaint,
            patient: {
              fullName: form.fullName,
              patientCategory: form.patientCategory || 'Student',
              sex: form.sex,
              age: form.age,
              phoneNumber: form.phoneNumber,
              universityIdNumber: form.universityIdNumber,
              emergencyContactName: form.emergencyContactName,
              emergencyContactPhone: form.emergencyContactPhone,
            },
          };
          void submit('/visits', 'POST', payload, 'Emergency arrival registered and prioritized for immediate triage.', 'Triage & Vital Signs');
        }}>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
            Emergency patients are registered directly to the ER queue. <strong>Do not delay triage for Card Room registration.</strong>
          </div>
          <Field label="Existing patient ID, card number or university ID" name="patientReference" value={form.patientReference} onChange={updateForm} placeholder="Leave blank to create a patient record" />
          <p className="-mt-3 text-xs text-slate-500">If the patient is new or cannot be identified, record the available details below and continue urgent care.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Patient name (or Unknown patient)" name="fullName" value={form.fullName} onChange={updateForm} placeholder="Full name" />
            <label className="block text-sm font-semibold text-slate-700">Patient category
              <select name="patientCategory" value={form.patientCategory || 'Student'} onChange={updateForm} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
                {['Student', 'Staff', 'Other Authorized Patient'].map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Sex
              <select name="sex" value={form.sex || ''} onChange={updateForm} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
                <option value="">Not recorded</option><option>Female</option><option>Male</option><option>Other</option>
              </select>
            </label>
            <Field label="Age" name="age" type="number" value={form.age} onChange={updateForm} min="0" max="125" />
            <Field label="Phone number" name="phoneNumber" value={form.phoneNumber} onChange={updateForm} />
            <Field label="University ID (if available)" name="universityIdNumber" value={form.universityIdNumber} onChange={updateForm} />
            <Field label="Emergency contact name" name="emergencyContactName" value={form.emergencyContactName} onChange={updateForm} />
            <Field label="Emergency contact phone" name="emergencyContactPhone" value={form.emergencyContactPhone} onChange={updateForm} />
          </div>
          <TextArea label="Chief complaint / reason for arrival" name="chiefComplaint" value={form.chiefComplaint} onChange={updateForm} required />
          <SubmitButton submitting={submitting} label="Register emergency arrival" />
        </form>
      );
    }

    if (!visitId) {
      return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Select an active emergency patient from the queue before recording clinical care.</div>;
    }

    if (activePage === 'Triage & Vital Signs') {
      return (
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault();
          void submit(`/visits/${visitId}/triage`, 'PATCH', form, 'Triage priority and vital signs recorded.');
        }}>
          <label className="block text-sm font-semibold text-slate-700">Triage priority
            <select name="triagePriority" value={form.triagePriority || 'Immediate'} onChange={updateForm} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              {triagePriorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Blood pressure" name="bloodPressure" value={form.bloodPressure} onChange={updateForm} placeholder="e.g. 120/80 mmHg" />
            <Field label="Temperature" name="temperature" value={form.temperature} onChange={updateForm} placeholder="°C" />
            <Field label="Pulse" name="pulse" value={form.pulse} onChange={updateForm} placeholder="beats/min" />
            <Field label="Respiratory rate" name="respiratoryRate" value={form.respiratoryRate} onChange={updateForm} placeholder="breaths/min" />
            <Field label="Oxygen saturation" name="oxygenSaturation" value={form.oxygenSaturation} onChange={updateForm} placeholder="%" />
            <Field label="Weight" name="weight" value={form.weight} onChange={updateForm} placeholder="kg" />
          </div>
          <Field label="Level of consciousness" name="consciousness" value={form.consciousness} onChange={updateForm} />
          <TextArea label="Triage notes" name="triageNotes" value={form.triageNotes} onChange={updateForm} />
          <SubmitButton submitting={submitting} label="Save triage & vital signs" />
        </form>
      );
    }

    if (activePage === 'Emergency Examination') {
      return (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void submit(`/visits/${visitId}/examination`, 'PATCH', form, 'Emergency examination saved to the patient visit.');
        }}>
          <Field label="Chief complaint" name="chiefComplaint" value={form.chiefComplaint} onChange={updateForm} required />
          <TextArea label="Relevant history" name="history" value={form.history} onChange={updateForm} />
          <TextArea label="Examination findings" name="findings" value={form.findings} onChange={updateForm} required />
          <Field label="Working diagnosis" name="diagnosis" value={form.diagnosis} onChange={updateForm} />
          <TextArea label="Clinical plan" name="plan" value={form.plan} onChange={updateForm} />
          <SubmitButton submitting={submitting} label="Save examination" />
        </form>
      );
    }

    if (activePage === 'Emergency Treatment') {
      return (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void submit(`/visits/${visitId}/treatment`, 'PATCH', form, form.disposition && form.disposition !== 'Continue Monitoring' ? `Emergency visit marked ${form.disposition.toLowerCase()}.` : 'Emergency treatment and stabilization notes saved.');
        }}>
          <TextArea label="Treatment, first aid or stabilization provided" name="treatmentNotes" value={form.treatmentNotes} onChange={updateForm} required />
          <label className="block text-sm font-semibold text-slate-700">Disposition
            <select name="disposition" value={form.disposition || 'Continue Monitoring'} onChange={updateForm} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              <option>Continue Monitoring</option><option>Discharge</option><option>Admit</option>
            </select>
          </label>
          <SubmitButton submitting={submitting} label="Save treatment record" />
        </form>
      );
    }

    if (activePage === 'Laboratory Requests') {
      return (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void submit(`/visits/${visitId}/lab-requests`, 'POST', form, 'Laboratory request sent to the clinic laboratory workflow.');
        }}>
          <Field label="Laboratory test" name="testName" value={form.testName} onChange={updateForm} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Test category" name="category" value={form.category} onChange={updateForm} />
            <label className="block text-sm font-semibold text-slate-700">Priority
              <select name="priority" value={form.priority || 'urgent'} onChange={updateForm} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
                <option value="urgent">Urgent</option><option value="normal">Routine</option>
              </select>
            </label>
          </div>
          <TextArea label="Clinical note" name="clinicalNote" value={form.clinicalNote} onChange={updateForm} />
          <SubmitButton submitting={submitting} label="Send laboratory request" />
        </form>
      );
    }

    if (activePage === 'Medication & Prescription') {
      return (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void submit(`/visits/${visitId}/prescriptions`, 'POST', form, 'Prescription sent to the clinic dispensary workflow.');
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medicine" name="medicine" value={form.medicine} onChange={updateForm} required />
            <Field label="Strength / formulation" name="strength" value={form.strength} onChange={updateForm} />
            <Field label="Dose" name="dose" value={form.dose} onChange={updateForm} />
            <Field label="Frequency" name="frequency" value={form.frequency} onChange={updateForm} />
            <Field label="Duration" name="duration" value={form.duration} onChange={updateForm} />
            <Field label="Quantity" name="quantity" value={form.quantity} onChange={updateForm} />
          </div>
          <TextArea label="Instructions" name="instructions" value={form.instructions} onChange={updateForm} />
          <SubmitButton submitting={submitting} label="Create prescription" />
        </form>
      );
    }

    if (activePage === 'Emergency Procedures') {
      return (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void submit(`/visits/${visitId}/procedures`, 'POST', form, 'Procedure order saved and routed where applicable.');
        }}>
          <label className="block text-sm font-semibold text-slate-700">Procedure type
            <select name="type" value={form.type || 'Injection'} onChange={updateForm} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800">
              <option>Injection</option><option>Dressing</option><option>Other</option>
            </select>
          </label>
          <Field label="Procedure / service" name="name" value={form.name} onChange={updateForm} required />
          <TextArea label="Clinical instructions" name="notes" value={form.notes} onChange={updateForm} />
          <SubmitButton submitting={submitting} label="Save procedure order" />
        </form>
      );
    }

    if (activePage === 'Emergency Referral') {
      return (
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          void submit(`/visits/${visitId}/referrals`, 'POST', form, 'Referral and patient-transfer documentation saved.');
        }}>
          <Field label="Receiving hospital / facility" name="destination" value={form.destination} onChange={updateForm} required />
          <TextArea label="Referral reason and clinical handover" name="reason" value={form.reason} onChange={updateForm} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Transport / contact details" name="transportContact" value={form.transportContact} onChange={updateForm} />
            <Field label="Transfer time" name="transferTime" type="datetime-local" value={form.transferTime} onChange={updateForm} />
          </div>
          <TextArea label="Investigation, treatment and transfer documentation" name="documentation" value={form.documentation} onChange={updateForm} />
          <SubmitButton submitting={submitting} label="Record referral & transfer" />
        </form>
      );
    }

    return null;
  };

  const activeSection = activePage === 'Dashboard' || activePage === 'Emergency Patient Queue';
  const historySection = ['Emergency History', 'Emergency Reports'].includes(activePage);
  const PageIcon = navigation.find(({ label }) => label === activePage)?.icon || LayoutDashboard;
  const metrics = [
    { label: 'Arrivals today', value: summary?.arrivalsToday, icon: UserPlus, tone: 'blue' },
    { label: 'Active ER queue', value: summary?.activeQueue, icon: Users, tone: 'sky' },
    { label: 'Triage required', value: summary?.waitingForTriage, icon: HeartPulse, tone: 'rose' },
    { label: 'High priority', value: summary?.highPriority, icon: ShieldAlert, tone: 'amber' },
    { label: 'Referrals today', value: summary?.referralsToday, icon: Hospital, tone: 'violet' },
    { label: 'Pending lab requests', value: summary?.pendingLabRequests, icon: FlaskConical, tone: 'cyan' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {sidebarOpen && <button type="button" aria-label="Close emergency navigation" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[min(19rem,88vw)] flex-col border-r border-slate-800 bg-[#0b1e36] text-slate-200 transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-600 text-white"><HeartPulse size={23} aria-hidden="true" /></span>
            <div><p className="font-bold text-white">MAU Clinic</p><p className="text-xs text-slate-400">Emergency Room</p></div>
          </div>
          <button type="button" aria-label="Close emergency navigation" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)}><X size={19} /></button>
        </div>
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Immediate triage</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Emergency arrival goes directly to the ER queue—not via Card Room.</p>
        </div>
        <nav aria-label="Emergency Room workspace" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} type="button" onClick={() => changePage(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${activePage === label ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={17} className="shrink-0" aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold text-white">{user.name || user.username}</p>
          <p className="mb-3 text-xs text-slate-400">{user.activeRole || user.role || 'Emergency Room Staff'}</p>
          <button type="button" onClick={() => { logout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"><LogOut size={17} aria-hidden="true" /> Sign out</button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[19rem]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" aria-label="Open emergency navigation" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Mekdela Amba University Clinic</p>
                <h1 className="flex min-w-0 items-center gap-2 truncate text-lg font-bold text-[#102f5e]"><PageIcon size={19} className="shrink-0 text-rose-700" aria-hidden="true" />{activePage}</h1>
              </div>
            </div>
            <button type="button" onClick={() => { setLoading(true); void loadWorkspace(); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">Refresh queue</button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
          {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error}</span></div>}
          {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{notice}</div>}
          {activePage === 'Dashboard' && (
            <>
              <div className="rounded-2xl bg-gradient-to-r from-[#102f5e] to-blue-800 p-6 text-white sm:p-8">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-100"><span className="h-2 w-2 rounded-full bg-rose-400" /> Emergency care workspace</p>
                <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Good day, {user.name?.split(' ')[0] || 'team'}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Prioritize immediate assessment, record arrival and triage, and coordinate care across clinic services.</p>
                <button type="button" onClick={() => changePage('Emergency Patient Registration')} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"><UserPlus size={17} aria-hidden="true" /> Register emergency arrival</button>
              </div>
              <section aria-label="Emergency Room statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone === 'rose' || tone === 'amber' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}><Icon size={22} aria-hidden="true" /></span>
                    <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#102f5e]">{value ?? (loading ? '…' : '—')}</p></div>
                  </div>
                ))}
              </section>
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-lg font-bold text-[#102f5e]">Live Emergency Patient Queue</h2><p className="mt-1 text-sm text-slate-500">Active arrivals are prioritized for triage and assessment.</p></div>
                  <button type="button" onClick={() => changePage('Emergency Patient Queue')} className="text-sm font-bold text-blue-800 hover:text-blue-950">View full queue</button>
                </div>
                {loading && !queue.length ? <LoadingNotice /> : renderQueue()}
              </section>
            </>
          )}

          {activePage === 'Emergency Patient Queue' && (
            <section className="space-y-4">
              <div><h2 className="text-lg font-bold text-[#102f5e]">Active arrivals</h2><p className="mt-1 text-sm text-slate-500">Select a visit to review its arrival and start triage or treatment.</p></div>
              {loading && !queue.length ? <LoadingNotice /> : renderQueue()}
            </section>
          )}

          {activePage === 'Emergency Patient Registration' && (
            <Panel title="Emergency Patient Registration" description="Record an arrival immediately; routine Card Room registration is not required first.">
              {renderForm()}
            </Panel>
          )}

          {!['Dashboard', 'Emergency Patient Queue', 'Emergency Patient Registration'].includes(activePage) && !historySection && (
            <div className="space-y-5">
              {renderPatientSummary()}
              <Panel title={activePage} description={activePage === 'Triage & Vital Signs' ? 'Record priority and vital signs at first contact.' : 'Clinical entries are saved to the selected patient and emergency visit.'}>
                {renderForm()}
              </Panel>
              {['Laboratory Requests', 'Medication & Prescription', 'Emergency Procedures', 'Emergency Referral'].includes(activePage) && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  These orders are linked to the visit and routed into the clinic’s existing {activePage === 'Laboratory Requests' ? 'laboratory' : activePage === 'Medication & Prescription' ? 'dispensary' : activePage === 'Emergency Procedures' ? 'Injection and Dressing' : 'referral'} workflow.
                </div>
              )}
            </div>
          )}

          {historySection && (
            <div className="space-y-5">
              {activePage === 'Emergency Reports' && (
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {metrics.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon size={21} aria-hidden="true" /></span>
                      <div><p className="text-sm text-slate-500">{label}</p><p className="text-xl font-extrabold text-[#102f5e]">{value ?? (loading ? '…' : '—')}</p></div>
                    </div>
                  ))}
                </section>
              )}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-[#102f5e]">{activePage === 'Emergency Reports' ? 'Recent emergency activity' : 'Emergency visit history'}</h2><p className="mt-1 text-sm text-slate-500">Authenticated patient and visit records. Access is permission-controlled.</p></div>
                {history.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Patient</th><th className="px-5 py-3">Arrival</th><th className="px-5 py-3">Triage</th><th className="px-5 py-3">Diagnosis</th><th className="px-5 py-3">Disposition</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((item) => (
                          <tr key={item._id} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-5 py-3.5"><span className="block font-semibold text-slate-900">{item.patientRecordId?.fullName || item.patientName}</span><span className="text-xs text-slate-500">{item.patientRecordId?.patientId || item.patientId}</span></td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{new Date(item.emergencyCare?.arrivalAt || item.visitDate).toLocaleString()}</td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{item.emergencyCare?.triagePriority || 'Pending'}</td>
                            <td className="max-w-56 px-5 py-3.5 text-slate-600">{item.examination?.diagnosis || item.examination?.chiefComplaint || '—'}</td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{item.referred ? 'Referred' : item.emergencyResolved ? 'Resolved' : item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="p-8 text-center text-sm text-slate-500">{loading ? 'Loading emergency visit records…' : 'No emergency visits have been recorded.'}</p>}
              </section>
            </div>
          )}

          {activeSection && selectedDetails && activePage !== 'Dashboard' && <section>{renderPatientSummary()}</section>}
          {activePage === 'Emergency Patient Queue' && selectedDetails && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">Use the patient action tabs to document triage, examination, treatment and care orders for the selected visit.</div>
          )}
        </main>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, ...inputProps }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input name={name} value={value || ''} onChange={onChange} {...inputProps} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function TextArea({ label, name, value, onChange, ...inputProps }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea name={name} value={value || ''} onChange={onChange} rows={3} {...inputProps} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function SubmitButton({ submitting, label }) {
  return <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Saving…' : label}</button>;
}

function Panel({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 border-b border-slate-100 pb-4"><h2 className="text-lg font-bold text-[#102f5e]">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      {children}
    </section>
  );
}

function LoadingNotice() {
  return <div role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading live Emergency Room data…</div>;
}

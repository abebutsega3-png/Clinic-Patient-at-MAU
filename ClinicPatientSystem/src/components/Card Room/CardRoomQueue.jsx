import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  ArrowLeftRight,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { io } from 'socket.io-client';

const PAGE_SIZE = 20;
const queueStatuses = [
  ['waiting', 'Waiting'],
  ['called', 'Called'],
  ['routed', 'Routed to Department'],
  ['sent_to_examination', 'Sent to Examination'],
  ['in_progress', 'In Progress'],
  ['completed', 'Completed'],
  ['no_show', 'No-show'],
  ['cancelled', 'Cancelled'],
];

const getClinicDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Addis_Ababa',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const formatTime = (date) => {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' }).format(parsed);
};

const formatDate = (date) => {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Africa/Addis_Ababa' }).format(parsed);
};

const readErrorMessage = async (response) => {
  const result = await response.json().catch(() => ({}));
  return result.message || `Request failed (${response.status}).`;
};

const statusLabel = (status, department = '') => status === 'routed'
  ? `Routed to ${department || 'Department'}`
  : queueStatuses.find(([value]) => value === status)?.[1] || status;

const statusClasses = {
  waiting: 'bg-amber-50 text-amber-800 ring-amber-200',
  called: 'bg-sky-50 text-sky-800 ring-sky-200',
  routed: 'bg-teal-50 text-teal-800 ring-teal-200',
  sent_to_examination: 'bg-teal-50 text-teal-800 ring-teal-200',
  in_progress: 'bg-violet-50 text-violet-800 ring-violet-200',
  completed: 'bg-slate-100 text-slate-700 ring-slate-200',
  no_show: 'bg-orange-50 text-orange-800 ring-orange-200',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
};

const priorityClasses = {
  Normal: 'text-slate-600',
  Urgent: 'font-semibold text-orange-700',
  Emergency: 'font-bold text-rose-700',
};

function QueueDetails({ queue, onClose }) {
  const visit = queue.visitId && typeof queue.visitId === 'object' ? queue.visitId : null;
  const patient = visit?.patientRecordId && typeof visit.patientRecordId === 'object' ? visit.patientRecordId : {};
  const fields = [
    ['Queue number', queue.queueNumber],
    ['Medical record number', queue.patientId],
    ['Student ID', patient.universityIdNumber],
    ['Patient name', queue.patientName],
    ['Visit ID', visit?.visitId],
    ['Visit type', queue.visitType],
    ['Priority', queue.priority],
    ['Queue status', statusLabel(queue.status, queue.department)],
    ['Destination', queue.department],
    ['Registration date', formatDate(queue.arrivedAt)],
    ['Registration time', formatTime(queue.arrivedAt)],
    ['Sex', patient.sex],
    ['Age', patient.age == null ? '' : `${patient.age} years`],
    ['Phone number', patient.phoneNumber],
    ['Patient category', patient.patientCategory],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="queue-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">Queue record · {queue.queueNumber || 'Queue entry'}</p>
            <h2 id="queue-details-title" className="mt-1 text-xl font-bold text-slate-900">Patient and visit details</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close queue details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || 'Not recorded'}</dd>
            </div>
          ))}
          {queue.cancellationReason && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Cancellation reason</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{queue.cancellationReason}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </section>
    </div>
  );
}

function CancelQueueDialog({ queue, saving, error, onCancel, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <form role="dialog" aria-modal="true" aria-labelledby="cancel-queue-title" onSubmit={(event) => {
        event.preventDefault();
        onCancel(queue, reason);
      }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="cancel-queue-title" className="text-lg font-bold text-slate-900">Cancel queue entry</h2>
        <p className="mt-1 text-sm text-slate-600">Queue {queue.queueNumber || queue.patientId}. Record why this entry is being cancelled.</p>
        {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Cancellation reason *
          <textarea required minLength={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Keep in queue</button>
          <button type="submit" disabled={saving || reason.trim().length < 3} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Cancelling…' : 'Confirm cancellation'}</button>
        </div>
      </form>
    </div>
  );
}

function ChangeRoomDialog({ queue, departments, selectedDepartment, setSelectedDepartment, saving, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <form role="dialog" aria-modal="true" aria-labelledby="change-room-title" onSubmit={(event) => {
        event.preventDefault();
        onSave(queue, selectedDepartment);
      }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="change-room-title" className="text-lg font-bold text-slate-900">Change destination room</h2>
        <p className="mt-1 text-sm text-slate-600">Move {queue.patientName || queue.patientId} from {queue.department || 'the current department'}.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          New room / department
          <select required value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Select a room</option>
            {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saving || !selectedDepartment || selectedDepartment === queue.department} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Moving…' : 'Change room'}</button>
        </div>
      </form>
    </div>
  );
}

export default function CardRoomQueue() {
  const { token } = useAuth();
  const location = useLocation();
  const [date, setDate] = useState(getClinicDate);
  const [searchInput, setSearchInput] = useState(location.state?.registeredQueueNumber || '');
  const [search, setSearch] = useState(location.state?.registeredQueueNumber || '');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [visitType, setVisitType] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [liveConnected, setLiveConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [queues, setQueues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.queueNotice || '');
  const [savingId, setSavingId] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [details, setDetails] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [transferTarget, setTransferTarget] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [clock, setClock] = useState(0);
  const clinicDate = getClinicDate();

  useEffect(() => {
    const socket = io('/', { path: '/socket.io' });
    const handleConnect = () => setLiveConnected(true);
    const handleDisconnect = () => setLiveConnected(false);
    const handleQueueChanged = () => setRefreshKey((key) => key + 1);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('clinic:queue-updated', handleQueueChanged);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('clinic:queue-updated', handleQueueChanged);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadDepartments = async () => {
      try {
        const response = await fetch('/api/master-data/catalog/department', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.message || `Unable to load clinic departments (${response.status}).`);
        }
        if (active) {
          setDepartments(result.data.filter((department) => department.usesQueue && !/^CARD$/i.test(department.code)));
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load clinic departments.');
      }
    };
    void loadDepartments();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(Date.now());
      setRefreshKey((key) => key + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    const loadQueue = async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ date, page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (visitType) params.set('visitType', visitType);
      if (roomFilter) params.set('department', roomFilter);
      try {
        const response = await fetch(`/api/card-room/queue?${params}`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) throw new Error(result.message || 'The queue response was incomplete.');
        if (active) {
          setClock(Date.now());
          setQueues(result.data);
          setSummary(result.summary || null);
          setPagination(result.pagination || { page: 1, pages: 1, total: result.data.length });
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load the Card Room queue.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadQueue();
    return () => { active = false; };
  }, [date, page, search, status, priority, visitType, roomFilter, token, refreshKey]);

  const updateQueue = async (queue, updates, cancellationReason = '') => {
    if (savingId) return false;
    setSavingId(queue._id);
    setError('');
    setCancelError('');
    setNotice('');
    try {
      const response = await fetch(`/api/card-room/queue/${encodeURIComponent(queue._id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...updates, cancellationReason }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Unable to update this queue entry.');
      setNotice(result.message || 'Queue entry updated.');
      setCancelTarget(null);
      setTransferTarget(null);
      setRefreshKey((key) => key + 1);
      return true;
    } catch (actionError) {
      const message = actionError.message || 'Unable to update this queue entry.';
      if (updates.status === 'cancelled') setCancelError(message);
      else setError(message);
      return false;
    } finally {
      setSavingId('');
    }
  };

  const cards = [
    { label: 'Total Visits Today', value: summary?.visitsToday, icon: Users, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Waiting Patients', value: summary?.waitingPatients, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Called Patients', value: summary?.calledPatients, icon: PhoneCall, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Sent to Examination', value: summary?.sentToExamination, icon: CheckCircle2, tone: 'bg-teal-50 text-teal-700' },
    { label: 'Urgent / Emergency', value: summary?.urgentEmergencyPatients, icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">MAU Clinic · Card Room</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Queue Management</h1>
          <p className="mt-1 text-sm text-slate-500">Live patient queue, room routing, priority, and service status · Refreshes every 15 seconds.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="font-semibold underline">Try again</button>
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <section aria-label="Queue summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{loading && summary == null ? <span className="inline-block h-8 w-10 animate-pulse rounded bg-slate-100" /> : value ?? 0}</p>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={19} aria-hidden="true" /></span>
            </div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form onSubmit={(event) => event.preventDefault()} className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs font-semibold text-slate-600">
            Search Student ID, MRN, queue, or name
            <span className="relative mt-1.5 block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Queue date
            <input type="date" value={date} max={clinicDate} onChange={(event) => { setDate(event.target.value || clinicDate); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
              <option value="">All statuses</option>{queueStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Priority
            <select value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
              <option value="">All priorities</option><option>Normal</option><option>Urgent</option><option>Emergency</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Visit type
            <select value={visitType} onChange={(event) => { setVisitType(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
              <option value="">All visit types</option><option>New Visit</option><option>Follow-up Visit</option><option>Emergency Visit</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Room / department
            <select value={roomFilter} onChange={(event) => { setRoomFilter(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
              <option value="">All rooms</option>
              {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
            </select>
          </label>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-900">Queue entries</h2>
            <p className="text-xs text-slate-500">{formatDate(`${date}T12:00:00+03:00`)} · {pagination.total || 0} matching entries</p>
          </div>
          <p className="text-xs font-medium text-rose-700">{liveConnected ? 'Live updates connected' : 'Live updates reconnecting · automatic refresh remains active'}</p>
        </div>
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          Waiting time starts at registration. Urgent and Emergency entries are sorted to the top within the queue. Room changes are available before care starts.
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading queue from the clinic database…</p>
        ) : queues.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardListIcon />
            <h3 className="mt-3 font-semibold text-slate-900">No queue entries found</h3>
            <p className="mt-1 text-sm text-slate-500">Try another date or filter, or register a visit to add a queue entry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Queue / MRN</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">Waiting time</th>
                  <th className="px-4 py-3 font-semibold">Visit type</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queues.map((queue) => {
                  const canManage = date === clinicDate && ['waiting', 'called'].includes(queue.status);
                  const canChangeRoom = date === clinicDate && ['waiting', 'called', 'routed', 'sent_to_examination'].includes(queue.status);
                  const elapsedMinutes = Math.max(0, Math.floor((clock - new Date(queue.arrivedAt).getTime()) / 60000));
                  return (
                    <tr key={queue._id} className={queue.priority === 'Emergency' ? 'bg-rose-50/50' : queue.priority === 'Urgent' ? 'bg-orange-50/40' : 'hover:bg-slate-50'}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-bold text-slate-900">{queue.queueNumber || '—'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{queue.patientId || 'No MRN'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{queue.patientName || 'Name unavailable'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Student ID: {queue.visitId?.patientRecordId?.universityIdNumber || '—'}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{date === clinicDate && ['waiting', 'called'].includes(queue.status) && Number.isFinite(elapsedMinutes) ? `${elapsedMinutes} min` : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{queue.visitType || '—'}</td>
                      <td className={`whitespace-nowrap px-4 py-3 ${priorityClasses[queue.priority] || 'text-slate-600'}`}>
                        <span className="inline-flex items-center gap-1">{queue.priority === 'Emergency' && <AlertTriangle size={14} aria-label="Emergency" />}{queue.priority || 'Normal'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(queue.arrivedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses[queue.status] || statusClasses.waiting}`}>{statusLabel(queue.status, queue.department)}</span></td>
                      <td className="px-4 py-3 text-slate-600">{queue.department || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setDetails(queue)} title="View patient and visit details" aria-label={`View details for ${queue.queueNumber || queue.patientName}`} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Eye size={15} /></button>
                          {canManage && queue.status === 'waiting' && (
                            <button type="button" onClick={() => void updateQueue(queue, { status: 'called' })} disabled={Boolean(savingId)} className="inline-flex items-center gap-1 rounded-md bg-sky-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"><PhoneCall size={14} /> Call</button>
                          )}
                                {canManage && queue.status === 'called' && (
                            <button type="button" onClick={() => void updateQueue(queue, { status: /examination/i.test(queue.department || '') ? 'sent_to_examination' : 'routed' })} disabled={Boolean(savingId)} className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"><Send size={14} /> Send to {(/examination/i.test(queue.department || '') ? 'Exam' : queue.department || 'Department')}</button>
                          )}
                          {canManage && (
                            <>
                              <label className="sr-only" htmlFor={`priority-${queue._id}`}>Priority for {queue.patientName || queue.queueNumber}</label>
                              <select id={`priority-${queue._id}`} aria-label={`Set priority for ${queue.patientName || queue.queueNumber}`} value={queue.priority || 'Normal'} onChange={(event) => void updateQueue(queue, { priority: event.target.value })} disabled={Boolean(savingId)} className="max-w-28 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60">
                                <option value="Normal">Normal</option><option value="Urgent">Urgent</option><option value="Emergency">Emergency</option>
                              </select>
                              {queue.status === 'called' && <button type="button" onClick={() => void updateQueue(queue, { status: 'no_show' })} disabled={Boolean(savingId)} className="rounded-md border border-orange-200 px-2 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-60">No-show</button>}
                            </>
                          )}
                          {canChangeRoom && <button type="button" onClick={() => { setTransferTarget(queue); setSelectedDepartment(queue.department || ''); }} disabled={Boolean(savingId) || departments.length === 0} title="Change room" className="inline-flex items-center gap-1 rounded-md border border-teal-200 px-2 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"><ArrowLeftRight size={14} /> Change Room</button>}
                          {date === clinicDate && ['sent_to_examination', 'routed'].includes(queue.status) && (
                            <button type="button" onClick={() => void updateQueue(queue, { status: 'in_progress' })} disabled={Boolean(savingId)} className="rounded-md bg-violet-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60">Start Service</button>
                          )}
                          {date === clinicDate && queue.status === 'in_progress' && (
                            <button type="button" onClick={() => void updateQueue(queue, { status: 'completed' })} disabled={Boolean(savingId)} className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"><CheckCircle2 size={14} /> Complete</button>
                          )}
                          {canManage && (
                            <button type="button" onClick={() => { setCancelTarget(queue); setCancelError(''); }} disabled={Boolean(savingId)} title="Cancel queue entry" aria-label={`Cancel ${queue.queueNumber || queue.patientName}`} className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-60"><Ban size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">Page {pagination.page || page} of {Math.max(1, pagination.pages || 1)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-40">Previous</button>
            <button type="button" onClick={() => setPage((current) => Math.min(pagination.pages || 1, current + 1))} disabled={loading || page >= (pagination.pages || 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-40">Next</button>
          </div>
        </footer>
      </section>

      {details && <QueueDetails queue={details} onClose={() => setDetails(null)} />}
      {cancelTarget && <CancelQueueDialog queue={cancelTarget} saving={savingId === cancelTarget._id} error={cancelError} onCancel={(queue, reason) => updateQueue(queue, { status: 'cancelled' }, reason)} onClose={() => { if (!savingId) setCancelTarget(null); }} />}
      {transferTarget && <ChangeRoomDialog queue={transferTarget} departments={departments.filter((department) => department.name !== transferTarget.department)} selectedDepartment={selectedDepartment} setSelectedDepartment={setSelectedDepartment} saving={savingId === transferTarget._id} onSave={(queue, nextDepartment) => updateQueue(queue, { department: nextDepartment })} onClose={() => { if (!savingId) setTransferTarget(null); }} />}
    </div>
  );
}

function ClipboardListIcon() {
  return <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Users size={22} aria-hidden="true" /></div>;
}

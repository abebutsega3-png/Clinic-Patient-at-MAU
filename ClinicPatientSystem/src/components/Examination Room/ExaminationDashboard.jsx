import { useEffect, useEffectEvent, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  BedDouble,
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  FlaskConical,
  HeartPulse,
  Info,
  Search,
  Share2,
  Siren,
  Users,
  UserRoundCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function PanelTitle({ icon: Icon, children, action }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-t-lg bg-[#0b4e9a] px-3 text-white">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold">
        <Icon size={17} aria-hidden="true" />
        <span className="truncate">{children}</span>
      </h2>
      {action}
    </div>
  );
}

function ExaminationDashboard({ activeItem = 'Dashboard', onNavigate, onQueueSummaryChange }) {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyQueueId, setBusyQueueId] = useState('');
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatus, setQueueStatus] = useState('all');
  const [queuePriority, setQueuePriority] = useState('all');
  const [queuePage, setQueuePage] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [savingVisit, setSavingVisit] = useState(false);

  const request = async (path, options = {}) => {
    const response = await fetch(`/api/examination${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || `Request failed (${response.status}).`);
    }
    return result.data;
  };

  const loadDashboard = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!dashboard) setLoading(true);
    try {
      const data = await request('/dashboard');
      setDashboard(data);
      const nextQueue = data.queue || [];
      setQueue(nextQueue);
      setSelectedQueueId((current) => nextQueue.some((patient) => patient.id === current) ? current : (nextQueue[0]?.id || ''));
      onQueueSummaryChange?.({
        queueCount: nextQueue.length,
        labRequestsCount: data.metrics?.labRequests?.pending ?? 0,
      });
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load examination data.');
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboard = useEffectEvent(loadDashboard);

  useEffect(() => {
    const refresh = () => void refreshDashboard();
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [token]);

  const visits = dashboard?.visits || [];
  const metricsData = dashboard?.metrics || {};
  const newVisits = metricsData.newVisits ?? 0;
  const repeatVisits = metricsData.followUpVisits ?? 0;
  const visitTotal = metricsData.totalVisits ?? visits.length;
  const newVisitPercent = visitTotal ? Math.round((newVisits / visitTotal) * 100) : 0;
  const repeatVisitPercent = visitTotal ? Math.round((repeatVisits / visitTotal) * 100) : 0;
  const metrics = [
    { value: loading ? '…' : (metricsData.waiting ?? 0), label: 'Waiting', icon: Users, tone: 'blue' },
    { value: loading ? '…' : (metricsData.inConsultation ?? 0), label: 'In Consultation', icon: HeartPulse, tone: 'green' },
    { value: loading ? '…' : (metricsData.completedToday ?? 0), label: 'Completed Today', icon: Check, tone: 'mint' },
    { value: loading ? '…' : (metricsData.emergency ?? 0), label: 'Emergency', icon: Siren, tone: 'rose' },
  ];
  const labRequests = visits.flatMap((visit) => (visit.examination?.labRequests || []).map((item) => ({ ...item, patientName: visit.patientName, patientId: visit.patientId })));
  const prescriptions = visits.flatMap((visit) => (visit.examination?.prescriptions || []).map((item) => ({ ...item, patientName: visit.patientName, patientId: visit.patientId })));
  const referrals = visits.filter((visit) => visit.referred || visit.examination?.referral?.department);
  const alerts = [
    ...queue.filter((patient) => patient.emergency).map((patient) => ({ tone: 'rose', icon: Siren, text: `Emergency patient: ${patient.name} (${patient.queueNumber || patient.patientId})`, time: 'In queue' })),
    ...labRequests.filter((item) => item.status === 'Results Ready').slice(0, 3).map((item) => ({ tone: 'blue', icon: FlaskConical, text: `Lab result ready: ${item.testName} · ${item.patientName}`, time: 'Ready' })),
  ].slice(0, 3);
  const matchingQueue = queue.filter((patient) => {
    const search = queueSearch.trim().toLowerCase();
    const matchesSearch = !search || [patient.name, patient.patientId, patient.cardNumber, patient.studentId, patient.queueNumber]
      .some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = queueStatus === 'all'
      || (queueStatus === 'waiting' && patient.status === 'sent_to_examination')
      || (queueStatus === 'in_progress' && patient.status === 'in_progress');
    const matchesPriority = queuePriority === 'all' || patient.priority.toLowerCase() === queuePriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });
  const queuePageSize = 5;
  const queuePageCount = Math.max(1, Math.ceil(matchingQueue.length / queuePageSize));
  const queuePageRows = matchingQueue.slice((queuePage - 1) * queuePageSize, queuePage * queuePageSize);
  const selectedQueuePatient = queue.find((patient) => patient.id === selectedQueueId) || queue[0] || null;
  const emergencyPatient = queue.find((patient) => patient.emergency) || null;

  const runQueueAction = async (patient, action) => {
    setBusyQueueId(patient.id);
    setError('');
    setNotice('');
    try {
      await request(`/queue/${patient.id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      setNotice(action === 'call' ? `${patient.name} called for consultation.` : action === 'skip' ? `${patient.name} moved to the end of the queue.` : `${patient.name} returned to the queue.`);
      await loadDashboard();
      if (action === 'call') onNavigate?.('Current Consultation');
    } catch (actionError) {
      setError(actionError.message || 'Unable to update the queue.');
    } finally {
      setBusyQueueId('');
    }
  };

  const callNextPatient = () => {
    const nextPatient = queue.find((patient) => patient.status === 'sent_to_examination');
    if (nextPatient) void runQueueAction(nextPatient, 'call');
    else setNotice('There are no patients waiting for examination.');
  };

  const startSelectedConsultation = () => {
    if (!selectedQueuePatient) {
      setNotice('There is no patient selected.');
      return;
    }
    if (selectedQueuePatient.status === 'sent_to_examination') {
      void runQueueAction(selectedQueuePatient, 'call');
      return;
    }
    onNavigate?.('Current Consultation');
  };

  const searchPatients = async (event) => {
    event.preventDefault();
    setPatientHistory(null);
    try {
      const data = await request(`/patients?search=${encodeURIComponent(patientSearch)}`);
      setPatientResults(data || []);
    } catch (searchError) {
      setError(searchError.message || 'Unable to search patients.');
    }
  };

  const loadPatientHistory = async (patient) => {
    try {
      const result = await request(`/patients/${patient._id}/history`);
      setSelectedPatient(result.patient);
      setPatientHistory(result);
    } catch (historyError) {
      setError(historyError.message || 'Unable to load patient history.');
    }
  };

  const handleSaveExamination = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const visit = queue.find((patient) => patient.status === 'in_progress' && patient.visitId);
    if (!visit) {
      setError('Call a patient into consultation before saving an examination.');
      return;
    }
    setSavingVisit(true);
    setError('');
    setNotice('');
    try {
      await request(`/visits/${visit.visitId}/examination`, {
        method: 'POST',
        body: JSON.stringify({
          chiefComplaint: formData.get('chiefComplaint'),
          historyOfPresentIllness: formData.get('historyOfPresentIllness'),
          diagnosis: formData.get('diagnosis'),
          vitals: {
            bloodPressure: formData.get('bloodPressure'),
            temperature: formData.get('temperature'),
            pulse: formData.get('pulse'),
          },
          labRequests: String(formData.get('labRequests') || '').split('\n').filter(Boolean),
          prescriptions: String(formData.get('prescriptions') || '').split('\n').filter(Boolean).map((line) => ({ medicine: line })),
          referral: { department: formData.get('referralDepartment'), reason: formData.get('referralReason') },
          sickLeaveDays: Number(formData.get('sickLeaveDays') || 0),
        }),
      });
      setNotice(`Examination saved for ${visit.name}.`);
      form.reset();
      await loadDashboard();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the examination.');
    } finally {
      setSavingVisit(false);
    }
  };

  const actionButtons = (patient) => (
    <div className="flex items-center gap-1.5">
      {patient.status === 'sent_to_examination' ? (
        <>
          <button type="button" disabled={Boolean(busyQueueId)} onClick={() => void runQueueAction(patient, 'call')} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Call</button>
          <button type="button" disabled={Boolean(busyQueueId)} onClick={() => void runQueueAction(patient, 'skip')} className="rounded bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600 disabled:opacity-50">Skip</button>
        </>
      ) : (
        <button type="button" disabled={Boolean(busyQueueId)} onClick={() => void runQueueAction(patient, 'recall')} className="rounded bg-violet-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-violet-700 disabled:opacity-50">Recall</button>
      )}
    </div>
  );

  if (activeItem === 'Patient Queue') {
    return (
      <section className="mx-auto max-w-[1600px] space-y-3 text-slate-900">
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

        <section aria-label="Queue summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metrics.map(({ value, label, icon: Icon, tone }) => <article key={label} className={`flex min-h-[66px] items-center justify-between gap-3 rounded-lg border px-3 py-2 shadow-sm ${tone === 'blue' ? 'border-blue-200 bg-blue-100' : tone === 'green' ? 'border-emerald-200 bg-emerald-100' : tone === 'mint' ? 'border-violet-200 bg-violet-100' : 'border-rose-200 bg-rose-100'}`}><span className="grid h-10 w-10 place-items-center rounded-lg bg-white/70 text-blue-700"><Icon size={21} /></span><div className="text-right"><p className="text-2xl font-extrabold leading-none">{value}</p><p className="mt-1 text-xs font-semibold">{label}</p></div></article>)}
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-100 px-3 py-2"><Clock3 className="text-cyan-700" size={21} /><strong>{metricsData.avgWaitingTime ?? 0} min</strong><span className="text-xs font-semibold">Avg Waiting Time</span></article>
          <article className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-100 px-3 py-2"><Share2 className="text-violet-700" size={21} /><strong>{metricsData.referralsToday ?? 0}</strong><span className="text-xs font-semibold">Referrals Today</span></article>
          <article className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2"><BedDouble className="text-emerald-700" size={21} /><strong>{metricsData.sickLeaveGiven ?? 0}</strong><span className="text-xs font-semibold">Sick Leave Given</span></article>
        </section>

        {emergencyPatient && <div role="status" className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-100 px-4 py-2.5 text-sm font-bold text-rose-800"><Siren size={20} className="shrink-0" /><span className="min-w-0 flex-1">Emergency Patient: {emergencyPatient.name} (Queue #{emergencyPatient.queueNumber || emergencyPatient.patientId}) – Please attend immediately!</span><span className="hidden shrink-0 rounded-full bg-rose-200 px-2 py-1 text-xs sm:inline">{emergencyPatient.waitMinutes} min</span></div>}

        <section className="grid gap-3 xl:grid-cols-[1.7fr_0.9fr]">
          <article className="min-w-0 overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
            <PanelTitle icon={Users} action={<span className="inline-flex items-center gap-1.5 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live <button type="button" title="Refresh queue" aria-label="Refresh queue" onClick={() => void loadDashboard()} className="ml-2 rounded p-1 hover:bg-white/15"><Activity size={15} /></button></span>}>Patient Queue (FIFO + Priority)</PanelTitle>
            <div className="grid gap-2 border-b border-slate-100 p-2 sm:grid-cols-[minmax(180px,1fr)_130px_130px_auto]">
              <label className="flex items-center gap-2 rounded-md border border-slate-300 px-2.5"><Search size={15} className="shrink-0 text-slate-400" /><input aria-label="Search queue by name, MRN or student ID" value={queueSearch} onChange={(event) => { setQueueSearch(event.target.value); setQueuePage(1); }} className="min-w-0 flex-1 py-2 text-xs outline-none" placeholder="Search by Name, MRN or Student ID..." /></label>
              <select aria-label="Filter by queue status" value={queueStatus} onChange={(event) => { setQueueStatus(event.target.value); setQueuePage(1); }} className="rounded-md border border-slate-300 px-2 py-2 text-xs"><option value="all">All Status</option><option value="waiting">Waiting</option><option value="in_progress">In Consultation</option></select>
              <select aria-label="Filter by priority" value={queuePriority} onChange={(event) => { setQueuePriority(event.target.value); setQueuePage(1); }} className="rounded-md border border-slate-300 px-2 py-2 text-xs"><option value="all">All Priority</option><option value="emergency">Emergency</option><option value="urgent">Urgent</option><option value="normal">Normal</option></select>
              <button type="button" onClick={() => { setQueueSearch(''); setQueueStatus('all'); setQueuePriority('all'); setQueuePage(1); }} className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Filter size={14} />Clear</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-[10px]">
                <thead className="bg-blue-50 text-[#102b56]"><tr>{['#', 'Queue #', 'MRN', 'Name', 'Age/Sex', 'Student ID', 'Type', 'Status', 'Wait', 'Source', 'Actions'].map((label) => <th key={label} className="px-2 py-2.5">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {queuePageRows.map((patient, index) => <tr key={patient.id} onClick={() => setSelectedQueueId(patient.id)} className={`cursor-pointer ${selectedQueueId === patient.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-2 py-2.5 font-bold text-blue-800">{(queuePage - 1) * queuePageSize + index + 1}</td>
                    <td className="px-2 py-2.5"><span className={`rounded-full border px-2 py-1 font-bold ${patient.emergency ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{patient.queueNumber || '—'}</span></td>
                    <td className="px-2 py-2.5">{patient.cardNumber || patient.patientId}</td>
                    <td className="px-2 py-2.5 font-semibold">{patient.name}</td>
                    <td className="px-2 py-2.5">{patient.age ? `${patient.age}/` : '—/'}{patient.sex?.slice(0, 1) || '—'}</td>
                    <td className="px-2 py-2.5">{patient.studentId || '—'}</td>
                    <td className="px-2 py-2.5"><span className={`rounded px-1.5 py-1 font-bold ${patient.emergency ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{patient.emergency ? 'Emergency' : patient.visitType || 'Waiting'}</span></td>
                    <td className="px-2 py-2.5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${patient.emergency ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{patient.status === 'in_progress' ? 'In Consultation' : 'Waiting'}</span></td>
                    <td className={`px-2 py-2.5 font-semibold ${patient.emergency ? 'text-rose-700' : ''}`}>{patient.waitMinutes} min</td>
                    <td className="px-2 py-2.5">{patient.source}</td>
                    <td className="px-2 py-2.5">{actionButtons(patient)}</td>
                  </tr>)}
                  {loading && <tr><td colSpan="11" className="px-3 py-10 text-center text-slate-500">Loading examination queue…</td></tr>}
                  {!loading && !queuePageRows.length && <tr><td colSpan="11" className="px-3 py-10 text-center text-slate-500">{queue.length ? 'No patients match these filters.' : 'No patients are currently queued for examination.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs">
              <span className="text-slate-600">Showing {matchingQueue.length ? (queuePage - 1) * queuePageSize + 1 : 0}–{Math.min(queuePage * queuePageSize, matchingQueue.length)} of {matchingQueue.length} patients</span>
              <div className="flex items-center gap-1"><button type="button" aria-label="Previous queue page" disabled={queuePage <= 1} onClick={() => setQueuePage((page) => Math.max(1, page - 1))} className="rounded border p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button><span className="px-2">{queuePage} / {queuePageCount}</span><button type="button" aria-label="Next queue page" disabled={queuePage >= queuePageCount} onClick={() => setQueuePage((page) => Math.min(queuePageCount, page + 1))} className="rounded border p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button></div>
            </div>
          </article>

          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
            <PanelTitle icon={UserRoundCheck}>Current Patient</PanelTitle>
            {selectedQueuePatient ? <div className="space-y-3 p-3">
              <div className="flex items-center gap-3"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-blue-100 text-xl font-bold text-blue-800">{selectedQueuePatient.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</div><div className="min-w-0"><p className="truncate font-bold">{selectedQueuePatient.name}</p><p className="mt-1 text-xs text-slate-600">MRN: {selectedQueuePatient.cardNumber || selectedQueuePatient.patientId}</p><p className="text-xs text-slate-600">Age: {selectedQueuePatient.age ?? '—'} · Gender: {selectedQueuePatient.sex || '—'}</p><p className="text-xs text-slate-600">Student ID: {selectedQueuePatient.studentId || '—'}</p></div></div>
              <p className={`rounded-md border px-3 py-2 text-center text-sm font-bold ${selectedQueuePatient.emergency ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}><Clock3 size={15} className="mr-1 inline" />Waiting Time: {selectedQueuePatient.waitMinutes} min</p>
              <div><h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Zap size={15} />Quick Actions</h3><div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={startSelectedConsultation} disabled={Boolean(busyQueueId)} className="rounded-md bg-blue-600 px-2 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">Start Consultation</button>
                <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="rounded-md bg-emerald-600 px-2 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">Lab Request</button>
                <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="rounded-md bg-violet-600 px-2 py-2.5 text-xs font-bold text-white hover:bg-violet-700">Injection &amp; Dressing</button>
                <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="rounded-md bg-orange-500 px-2 py-2.5 text-xs font-bold text-white hover:bg-orange-600">Dispensary</button>
                <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="rounded-md bg-rose-600 px-2 py-2.5 text-xs font-bold text-white hover:bg-rose-700">Emergency</button>
                <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="rounded-md bg-cyan-700 px-2 py-2.5 text-xs font-bold text-white hover:bg-cyan-800">Referral</button>
              </div></div>
            </div> : <p className="p-5 text-sm text-slate-500">Select a patient from the queue to view details.</p>}
          </article>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm"><PanelTitle icon={FlaskConical}>Lab Requests Status (Today)</PanelTitle><div className="grid grid-cols-3 gap-1 p-2 text-center text-xs"><div className="rounded bg-blue-50 p-2"><Clock3 className="mx-auto text-blue-700" size={18} /><span className="mt-1 block">Pending</span><strong>{metricsData.labRequests?.pending ?? 0}</strong></div><div className="rounded bg-emerald-50 p-2"><Activity className="mx-auto text-emerald-700" size={18} /><span className="mt-1 block">In Progress</span><strong>{metricsData.labRequests?.inProgress ?? 0}</strong></div><div className="rounded bg-green-50 p-2"><Check className="mx-auto text-green-700" size={18} /><span className="mt-1 block">Result Ready</span><strong>{metricsData.labRequests?.resultsReady ?? 0}</strong></div></div></article>
          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm"><PanelTitle icon={ChartNoAxesColumnIncreasing}>OPD Statistics (Today)</PanelTitle><div className="space-y-2 p-3 text-xs"><p className="flex justify-between"><span>Total visits</span><strong>{visitTotal}</strong></p><p className="flex justify-between"><span>New visits</span><strong>{newVisits} ({newVisitPercent}%)</strong></p><p className="flex justify-between"><span>Follow-up visits</span><strong>{repeatVisits} ({repeatVisitPercent}%)</strong></p><p className="border-t pt-2 font-semibold">Top diagnoses</p>{(metricsData.topDiagnoses || []).slice(0, 3).map((diagnosis, index) => <p key={diagnosis.name} className="flex justify-between"><span>{index + 1}. {diagnosis.name}</span><strong>{diagnosis.count}</strong></p>)}{!metricsData.topDiagnoses?.length && <p className="text-slate-500">No diagnoses recorded.</p>}</div></article>
          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm"><PanelTitle icon={Bell} action={<span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold">{alerts.length}</span>}>Real-time Alerts</PanelTitle><div className="space-y-2 p-2">{alerts.map(({ tone, icon: Icon, text, time }) => <div key={text} className={`flex items-center gap-2 rounded-md border p-2 text-[11px] ${tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}><Icon size={15} className="shrink-0" /><span className="min-w-0 flex-1">{text}</span><span className="shrink-0">{time}</span></div>)}{!alerts.length && <p className="p-3 text-xs text-slate-500">No active alerts.</p>}</div></article>
        </section>
      </section>
    );
  }

  if (activeItem === 'Current Consultation') {
    const currentVisit = queue.find((patient) => patient.status === 'in_progress');
    return (
      <section className="mx-auto max-w-4xl space-y-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Current Consultation</h1><p className="mt-1 text-sm text-slate-500">Record the consultation and complete the active queue entry.</p></div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {!currentVisit ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No consultation is active. Select a waiting patient and choose <strong>Call</strong> to begin.</div> : (
          <form onSubmit={handleSaveExamination} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="rounded-md bg-blue-50 p-3"><p className="text-xs font-semibold uppercase text-blue-700">Now examining</p><p className="mt-1 text-lg font-bold">{currentVisit.name}</p><p className="text-sm text-slate-600">{currentVisit.studentId} · Queue {currentVisit.queueNumber || '—'}</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium">Blood pressure<input name="bloodPressure" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="120/80" /></label>
              <label className="text-sm font-medium">Temperature<input name="temperature" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="36.8 C" /></label>
              <label className="text-sm font-medium">Pulse<input name="pulse" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="72 bpm" /></label>
            </div>
            <label className="block text-sm font-medium">Chief complaint *<textarea name="chiefComplaint" required maxLength={1000} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" rows="2" /></label>
            <label className="block text-sm font-medium">History of present illness<textarea name="historyOfPresentIllness" maxLength={3000} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" rows="3" /></label>
            <label className="block text-sm font-medium">Diagnosis *<input name="diagnosis" required maxLength={500} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Lab tests, one per line<textarea name="labRequests" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" rows="3" /></label>
              <label className="text-sm font-medium">Prescriptions, one medicine per line<textarea name="prescriptions" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" rows="3" /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr_160px]">
              <label className="text-sm font-medium">Referral department<input name="referralDepartment" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm font-medium">Referral reason<input name="referralReason" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm font-medium">Sick leave (days)<input name="sickLeaveDays" type="number" min="0" max="365" defaultValue="0" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            </div>
            <button type="submit" disabled={savingVisit} className="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{savingVisit ? 'Saving…' : 'Save examination and complete visit'}</button>
          </form>
        )}
      </section>
    );
  }

  if (activeItem === 'Patient Records / History') {
    return (
      <section className="space-y-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Patient Records / History</h1><p className="mt-1 text-sm text-slate-500">Search by name, patient ID, university ID, or card number.</p></div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <form onSubmit={searchPatients} className="flex max-w-2xl gap-2"><input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} minLength="2" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2" placeholder="Search patient records" /><button className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white">Search</button></form>
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {patientResults.map((patient) => <button key={patient._id} type="button" onClick={() => void loadPatientHistory(patient)} className="block w-full px-4 py-3 text-left hover:bg-blue-50"><span className="block font-semibold">{patient.fullName}</span><span className="text-xs text-slate-500">{patient.patientId} · {patient.cardNumber}</span></button>)}
            {!patientResults.length && <p className="p-4 text-sm text-slate-500">Search results will appear here.</p>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {selectedPatient ? <><h2 className="font-bold">{selectedPatient.fullName}</h2><p className="mt-1 text-xs text-slate-500">{selectedPatient.patientId} · {selectedPatient.cardNumber}</p><div className="mt-4 space-y-3">{patientHistory?.visits?.map((visit) => <article key={visit._id} className="border-t border-slate-100 pt-3 text-sm"><p className="font-semibold">{visit.diagnosis || 'No diagnosis recorded'}</p><p className="text-xs text-slate-500">{new Date(visit.visitDate).toLocaleString()} · {visit.department} · {visit.status}</p><p className="mt-1 text-xs text-slate-600">{visit.examination?.chiefComplaint}</p></article>)}{patientHistory?.legacy?.map((record) => <article key={record._id} className="border-t border-slate-100 pt-3 text-sm"><p className="font-semibold">{record.diagnosis || 'Historical record'}</p><p className="text-xs text-slate-500">{new Date(record.createdAt).toLocaleDateString()} · {record.department} · {record.doctorName}</p></article>)}</div></> : <p className="text-sm text-slate-500">Select a patient to view visit history.</p>}
          </div>
        </div>
      </section>
    );
  }

  if (activeItem === 'Lab Requests' || activeItem === 'Prescriptions' || activeItem === 'Referrals' || activeItem === 'Reports') {
    const reportItems = activeItem === 'Reports';
    const records = activeItem === 'Lab Requests' ? labRequests : activeItem === 'Prescriptions' ? prescriptions : activeItem === 'Referrals' ? referrals : metricsData.topDiagnoses || [];
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">{activeItem}</h1><p className="mt-1 text-sm text-slate-500">{dashboard?.department || 'Examination Room'} · today</p></div>{!reportItems && <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Add from consultation</button>}</div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {records.map((record, index) => <article key={record._id || `${record.patientId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"><div><p className="font-semibold">{reportItems ? record.name : activeItem === 'Referrals' ? record.examination?.referral?.department : activeItem === 'Lab Requests' ? record.testName : record.medicine}</p><p className="mt-1 text-xs text-slate-500">{reportItems ? `${record.count} visits` : `${record.patientName || record.patientId} · ${record.status || record.examination?.referral?.reason || record.dosage || ''}`}</p></div>{activeItem === 'Referrals' && <span className="text-xs text-slate-500">{record.examination?.referral?.reason}</span>}</article>)}
          {!records.length && <p className="p-6 text-sm text-slate-500">No {activeItem.toLowerCase()} recorded today.</p>}
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 text-slate-900">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-blue-700">MAU Clinic · OPD Patient Flow</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102b56]">Examination Room Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${error ? 'text-rose-700' : loading ? 'text-amber-700' : 'text-emerald-700'}`}>
            <span className={`h-2 w-2 rounded-full ${error ? 'bg-rose-500' : loading ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {error ? 'Unavailable' : loading ? 'Updating' : 'Live data'}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <CalendarDays size={15} aria-hidden="true" />
            {dashboard?.clinicDate || 'Loading clinic date'}
          </span>
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <section aria-label="Today's examination summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(({ value, label, icon: Icon, tone }) => (
          <article key={label} className={`flex min-h-[76px] items-center justify-between gap-3 rounded-lg border p-3 shadow-sm ${
            tone === 'blue' ? 'border-blue-200 bg-blue-100' :
            tone === 'green' ? 'border-emerald-200 bg-emerald-100' :
            tone === 'mint' ? 'border-green-200 bg-green-50' : 'border-rose-200 bg-rose-100'
          }`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
              tone === 'blue' ? 'bg-blue-600 text-white' :
              tone === 'green' ? 'bg-emerald-600 text-white' :
              tone === 'mint' ? 'bg-green-600 text-white' : 'bg-rose-600 text-white'
            }`}>
              <Icon size={23} aria-hidden="true" />
            </span>
            <div className="min-w-0 text-right">
              <p className="text-2xl font-extrabold leading-none text-[#102b56]">{value}</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-700">{label}</p>
            </div>
          </article>
        ))}
      </section>

      <section aria-label="Additional examination metrics" className="grid gap-3 sm:grid-cols-3">
        <article className="flex min-h-14 items-center justify-between rounded-lg border border-purple-200 bg-purple-100 px-4 py-2.5">
          <div className="flex items-center gap-3"><Clock3 className="text-purple-700" size={23} /><strong className="text-xl text-[#102b56]">{metricsData.avgWaitingTime ?? 0} min</strong></div>
          <span className="text-xs font-semibold text-slate-700">Avg Waiting Time</span>
          <ChartNoAxesColumnIncreasing className="text-purple-600" size={19} />
        </article>
        <article className="flex min-h-14 items-center justify-between rounded-lg border border-cyan-200 bg-cyan-100 px-4 py-2.5">
          <div className="flex items-center gap-3"><ArrowRightLeft className="text-cyan-700" size={23} /><strong className="text-xl text-[#102b56]">{metricsData.referralsToday ?? 0}</strong></div>
          <span className="text-xs font-semibold text-slate-700">Referrals Today</span>
          <ArrowRight className="text-cyan-700" size={18} />
        </article>
        <article className="flex min-h-14 items-center justify-between rounded-lg border border-orange-200 bg-orange-100 px-4 py-2.5">
          <div className="flex items-center gap-3"><BedDouble className="text-orange-700" size={23} /><strong className="text-xl text-[#102b56]">{metricsData.sickLeaveGiven ?? 0}</strong></div>
          <span className="text-xs font-semibold text-slate-700">Sick Leave Given</span>
          <ArrowRight className="text-orange-600" size={18} />
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle
            icon={Users}
            action={<span className="inline-flex items-center gap-2 text-xs font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Live</span>}
          >Patient Queue</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[690px] text-left text-xs">
              <thead className="bg-blue-50 text-[#102b56]">
                <tr>
                  <th className="px-3 py-2.5">#</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Student ID</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Wait Time</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.slice(0, 5).map((patient, index) => (
                  <tr key={patient.id} className="hover:bg-blue-50/60">
                    <td className="px-3 py-2.5 font-semibold text-blue-800">{index + 1}</td>
                    <td className="px-3 py-2.5 font-semibold">{patient.name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{patient.studentId}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${patient.emergency ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{patient.status.replaceAll('_', ' ')}</span></td>
                    <td className="px-3 py-2.5 text-slate-700">{patient.waitMinutes} min</td>
                    <td className={`px-3 py-2.5 font-semibold ${patient.priority === 'Emergency' || patient.priority === 'Urgent' ? 'text-rose-700' : 'text-slate-600'}`}>{patient.priority}</td>
                    <td className="px-3 py-2.5">{actionButtons(patient)}</td>
                  </tr>
                ))}
                {!loading && !queue.length && <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No patients currently in the Examination Room queue.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5 text-xs">
            <span className="font-medium text-slate-600">Showing {Math.min(queue.length, 5)} of {queue.length} patients</span>
            <button type="button" onClick={() => onNavigate?.('Patient Queue')} className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700">View All Queue <ChevronRight size={14} /></button>
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
            <PanelTitle icon={Bell} action={<span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold">{alerts.length}</span>}>Real-time Alerts</PanelTitle>
            <div className="space-y-2 p-2.5">
              {alerts.map(({ tone, icon: Icon, text, time }) => (
                <div key={text} className={`flex items-center gap-2 rounded-md border p-2 ${tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-800' : tone === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <Icon size={17} className="shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-[11px] font-semibold leading-4">{text}</p>
                  <span className="shrink-0 text-[10px]">{time}</span>
                </div>
              ))}
              {!alerts.length && <p className="p-3 text-xs text-slate-500">No active alerts.</p>}
            </div>
          </article>

          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
            <PanelTitle icon={FlaskConical} action={<button type="button" onClick={() => onNavigate?.('Lab Requests')} className="inline-flex items-center gap-1 text-[10px] font-semibold hover:underline">View All <ArrowRight size={13} /></button>}>Lab Requests Status</PanelTitle>
            <div className="grid grid-cols-3 divide-x divide-white p-1">
              <div className="rounded-l-md bg-blue-100 p-2 text-center"><Clock3 className="mx-auto text-blue-700" size={18} /><p className="mt-1 text-[10px] font-semibold">Pending</p><strong className="text-lg">{metricsData.labRequests?.pending ?? 0}</strong></div>
              <div className="bg-emerald-100 p-2 text-center"><Activity className="mx-auto text-emerald-700" size={18} /><p className="mt-1 text-[10px] font-semibold">In Progress</p><strong className="text-lg">{metricsData.labRequests?.inProgress ?? 0}</strong></div>
              <div className="rounded-r-md bg-green-100 p-2 text-center"><Check className="mx-auto text-green-700" size={18} /><p className="mt-1 text-[10px] font-semibold">Results Ready</p><strong className="text-lg">{metricsData.labRequests?.resultsReady ?? 0}</strong></div>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr_0.85fr]">
        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle icon={ChartNoAxesColumnIncreasing}>OPD Statistics (Today)</PanelTitle>
          <div className="grid min-h-[150px] grid-cols-[0.85fr_1.15fr] items-center gap-3 p-3">
            <div className="flex justify-center">
              <div className="grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb 0 ${newVisitPercent}%, #9333ea ${newVisitPercent}% 100%)` }}>
                <div className="grid h-[76px] w-[76px] place-content-center rounded-full bg-white text-center"><span className="text-[10px] font-semibold text-slate-500">Total</span><strong className="text-xl leading-5">{visitTotal}</strong></div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <p className="flex justify-between border-b border-slate-100 pb-1.5"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />New Visit</span><strong>{newVisits} ({newVisitPercent}%)</strong></p>
              <p className="flex justify-between"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-purple-600" />Repeat Visit</span><strong>{repeatVisits} ({repeatVisitPercent}%)</strong></p>
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-2">
              <p className="mb-1.5 text-[10px] font-bold text-slate-600">Top 5 Diagnoses (Today)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                {(metricsData.topDiagnoses || []).map((diagnosis, index) => <span key={diagnosis.name}>{index + 1}. {diagnosis.name} <b className="float-right">{diagnosis.count}</b></span>)}
                {!metricsData.topDiagnoses?.length && <span className="col-span-2 text-slate-500">No diagnoses recorded today.</span>}
              </div>
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle icon={Zap}>Quick Actions</PanelTitle>
          <div className="grid grid-cols-2 gap-2 p-3">
            <button type="button" onClick={callNextPatient} disabled={Boolean(busyQueueId)} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-blue-600 p-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><UserRoundCheck size={19} />Call Next Patient</button>
            <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-emerald-600 p-2 text-xs font-bold text-white hover:bg-emerald-700"><FlaskConical size={19} />New Lab Request</button>
            <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 p-2 text-xs font-bold text-white hover:bg-violet-700"><Share2 size={19} />New Referral</button>
            <button type="button" onClick={() => onNavigate?.('Patient Records / History')} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-orange-500 p-2 text-xs font-bold text-white hover:bg-orange-600"><Search size={19} />Search Patient (MRN)</button>
          </div>
        </article>

        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle icon={Info}>Quick Info</PanelTitle>
          <div className="divide-y divide-slate-100 px-3">
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><Users size={16} className="text-blue-600" />Total Visits Today</span><strong>{visitTotal}</strong></p>
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><HeartPulse size={16} className="text-emerald-600" />Active Consultations</span><strong>{metricsData.inConsultation ?? 0}</strong></p>
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><Share2 size={16} className="text-blue-600" />Referrals Today</span><strong>{metricsData.referralsToday ?? 0}</strong></p>
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-blue-600" />Average Wait Time</span><strong>{metricsData.avgWaitingTime ?? 0} min</strong></p>
          </div>
        </article>
      </section>

    </div>
  );
}

export default ExaminationDashboard;
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Search,
  UserRoundCheck,
  Users,
} from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatWait = (minutes) => {
  const totalMinutes = Math.max(0, Number(minutes) || 0);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
};

export default function ExaminationPatientQueue({
  error,
  notice,
  queue,
  queuePageRows,
  matchingQueue,
  loading,
  liveConnected,
  onRefresh,
  queueSearch,
  setQueueSearch,
  queueStatus,
  setQueueStatus,
  queuePriority,
  setQueuePriority,
  queueVisitType,
  setQueueVisitType,
  queueSort,
  setQueueSort,
  queuePage,
  queuePageCount,
  queuePageSize,
  setQueuePage,
  selectedQueueId,
  onSelectQueuePatient,
  selectedQueuePatient,
  selectedQueueHistory,
  selectedQueueHistoryLoading,
  previousPatientVisits,
  emergencyPatient,
  busyQueueId,
  onViewMedicalHistory,
  onStartSelectedConsultation,
}) {
  const isWaiting = (patient) => patient.status === 'sent_to_examination';
  const isInProgress = (patient) => patient.status === 'in_progress';
  const statusLabel = (patient) => (
    isWaiting(patient) ? 'Waiting' : isInProgress(patient) ? 'In Examination' : 'Completed'
  );
  const stopRowClick = (event) => event.stopPropagation();
  const actionButtons = (patient) => (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={(event) => { stopRowClick(event); onSelectQueuePatient(patient.id); }}
        className="whitespace-nowrap rounded border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
      >
        {isWaiting(patient) ? 'View Patient' : 'View Details'}
      </button>
      {isWaiting(patient) && (
        <button
          type="button"
          disabled={Boolean(busyQueueId)}
          onClick={(event) => { stopRowClick(event); void onViewMedicalHistory(patient); }}
          className="whitespace-nowrap rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
        >
          View Medical History
        </button>
      )}
      {(isWaiting(patient) || isInProgress(patient)) && (
        <button
          type="button"
          disabled={Boolean(busyQueueId)}
          onClick={(event) => { stopRowClick(event); onStartSelectedConsultation(patient); }}
          className="whitespace-nowrap rounded bg-blue-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isWaiting(patient)
            ? patient.emergency ? 'Start Emergency Examination' : 'Start Examination'
            : 'Continue Examination'}
        </button>
      )}
    </div>
  );

  return (
    <section className="mx-auto max-w-[1600px] space-y-2 text-slate-900">
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <div className="flex items-center justify-between gap-2 rounded-md border border-blue-100 bg-white px-3 py-2 text-[11px] text-slate-600 shadow-sm">
        <p className="font-semibold text-[#102b56]">Examination Room <span className="mx-1 text-slate-300">/</span> Examination Room</p>
        {emergencyPatient && <span className="hidden rounded-full bg-rose-100 px-2 py-1 font-bold text-rose-700 sm:inline">Emergency: {emergencyPatient.name}</span>}
      </div>

      <section className="grid min-h-[calc(100vh-8rem)] gap-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <article className="min-w-0 overflow-hidden rounded-md border border-blue-200 bg-white shadow-sm">
          <div className="flex min-h-9 items-center justify-between gap-2 border-l-4 border-blue-600 bg-blue-50 px-2.5 text-[#102b56]">
            <h2 className="flex items-center gap-1.5 text-xs font-bold"><Users size={14} />Patient Queue (From Card Room)</h2>
            <div className="flex items-center gap-2 text-[9px] font-semibold">
              <span className={`inline-flex items-center gap-1 ${liveConnected ? 'text-emerald-700' : 'text-slate-500'}`}>
                <span className={`h-2 w-2 rounded-full ${liveConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {liveConnected ? 'Real-time · Socket.io' : 'Live updates reconnecting'}
              </span>
              <button type="button" title="Refresh queue" aria-label="Refresh queue" onClick={onRefresh} className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-blue-100">
                <Activity size={12} />Refresh
              </button>
            </div>
          </div>
          <div className="grid gap-1.5 border-b border-slate-100 bg-slate-50 p-2 sm:grid-cols-[minmax(160px,1fr)_repeat(2,minmax(110px,0.6fr))] xl:grid-cols-[minmax(160px,1fr)_repeat(4,minmax(110px,0.6fr))_auto]">
            <label className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input
                aria-label="Search queue by name, MRN or student ID"
                value={queueSearch}
                onChange={(event) => { setQueueSearch(event.target.value); setQueuePage(1); }}
                className="min-w-0 flex-1 py-1.5 text-[10px] outline-none"
                placeholder="Search name, MRN or student ID"
              />
            </label>
            <select aria-label="Filter by queue status" value={queueStatus} onChange={(event) => { setQueueStatus(event.target.value); setQueuePage(1); }} className="rounded border border-slate-200 bg-white px-1.5 py-1.5 text-[10px]">
              <option value="all">All Status</option>
              <option value="waiting">Waiting</option>
              <option value="in_progress">In Examination</option>
              <option value="completed">Completed</option>
            </select>
            <select aria-label="Filter by priority" value={queuePriority} onChange={(event) => { setQueuePriority(event.target.value); setQueuePage(1); }} className="rounded border border-slate-200 bg-white px-1.5 py-1.5 text-[10px]">
              <option value="all">All Priority</option>
              <option value="emergency">Emergency</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
            </select>
            <select aria-label="Filter by visit type" value={queueVisitType} onChange={(event) => { setQueueVisitType(event.target.value); setQueuePage(1); }} className="rounded border border-slate-200 bg-white px-1.5 py-1.5 text-[10px]">
              <option value="all">All Visit Types</option>
              <option value="New Visit">New Visit</option>
              <option value="Follow-up Visit">Follow-up</option>
              <option value="Emergency Visit">Emergency Visit</option>
            </select>
            <select aria-label="Sort queue" value={queueSort} onChange={(event) => { setQueueSort(event.target.value); setQueuePage(1); }} className="rounded border border-slate-200 bg-white px-1.5 py-1.5 text-[10px]">
              <option value="queueNumber">Queue Number</option>
              <option value="priority">Priority</option>
            </select>
            <button type="button" onClick={() => { setQueueSearch(''); setQueueStatus('all'); setQueuePriority('all'); setQueueVisitType('all'); setQueueSort('queueNumber'); setQueuePage(1); }} className="inline-flex items-center justify-center gap-1 rounded bg-blue-700 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-800">
              <Filter size={12} />Clear
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-[9px]">
              <thead className="bg-slate-50 text-[#102b56]">
                <tr>{['Queue No.', 'MRN', 'Student ID', 'Patient Name', 'Age/Sex', 'Department', 'Visit Type', 'Priority', 'Arrival Time', 'Waiting Time', 'Status', 'Actions'].map((label) => <th key={label} className="whitespace-nowrap px-1.5 py-2 font-bold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queuePageRows.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => onSelectQueuePatient(patient.id)}
                    aria-selected={selectedQueueId === patient.id}
                    className={`cursor-pointer border-l-2 ${selectedQueueId === patient.id ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}
                  >
                    <td className="whitespace-nowrap px-1.5 py-2 font-bold text-blue-800">{patient.queueNumber || '—'}</td>
                    <td className="whitespace-nowrap px-1.5 py-2">{patient.cardNumber || patient.patientId || '—'}</td>
                    <td className="whitespace-nowrap px-1.5 py-2">{patient.studentId || '—'}</td>
                    <td className="whitespace-nowrap px-1.5 py-2 font-semibold">{patient.name}</td>
                    <td className="whitespace-nowrap px-1.5 py-2">{patient.age != null ? `${patient.age}/` : '—/'}{patient.sex?.slice(0, 1) || '—'}</td>
                    <td className="whitespace-nowrap px-1.5 py-2">{patient.academicDepartment || patient.department || '—'}</td>
                    <td className="px-1.5 py-2">
                      <span className="whitespace-nowrap">{patient.visitType === 'Follow-up Visit' ? 'Follow-up' : patient.visitType || '—'}</span>
                      {patient.labReturn && <span className="ml-1 rounded bg-teal-100 px-1 py-0.5 font-bold text-teal-800">Lab Return</span>}
                    </td>
                    <td className="px-1.5 py-2">
                      <span className={`rounded px-1 py-0.5 font-bold ${patient.emergency ? 'bg-rose-100 text-rose-700' : patient.priority === 'Urgent' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                        {patient.emergency ? 'Emergency' : patient.priority || 'Normal'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-2">{formatTime(patient.arrivalTime || patient.arrivedAt || patient.createdAt)}</td>
                    <td className="whitespace-nowrap px-1.5 py-2">{formatWait(patient.waitMinutes)}</td>
                    <td className="px-1.5 py-2">
                      <span className={`rounded px-1 py-0.5 font-bold ${isInProgress(patient) ? 'bg-blue-100 text-blue-700' : isWaiting(patient) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {statusLabel(patient)}
                      </span>
                    </td>
                    <td className="px-1.5 py-2">{actionButtons(patient)}</td>
                  </tr>
                ))}
                {loading && <tr><td colSpan="12" className="px-3 py-8 text-center text-slate-500">Loading examination queue…</td></tr>}
                {!loading && !queuePageRows.length && <tr><td colSpan="12" className="px-3 py-8 text-center text-slate-500">{queue.length ? 'No patients match these filters.' : 'No patients are currently queued for examination.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-[10px]">
            <span className="text-slate-600">Showing {matchingQueue.length ? (queuePage - 1) * queuePageSize + 1 : 0}–{Math.min(queuePage * queuePageSize, matchingQueue.length)} of {matchingQueue.length} patients</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous queue page" disabled={queuePage <= 1} onClick={() => setQueuePage((page) => Math.max(1, page - 1))} className="rounded border p-1 disabled:opacity-40"><ChevronLeft size={12} /></button>
              <span className="px-1">{queuePage} / {queuePageCount}</span>
              <button type="button" aria-label="Next queue page" disabled={queuePage >= queuePageCount} onClick={() => setQueuePage((page) => Math.min(queuePageCount, page + 1))} className="rounded border p-1 disabled:opacity-40"><ChevronRight size={12} /></button>
            </div>
          </div>
        </article>

        <article className="min-w-0 overflow-hidden rounded-md border border-blue-200 bg-white shadow-sm">
          <div className="flex min-h-10 items-center gap-2 bg-[#0b4e9a] px-3 text-white">
            <UserRoundCheck size={17} aria-hidden="true" />
            <h2 className="truncate text-sm font-bold">Patient Card</h2>
          </div>
          {selectedQueuePatient ? (
            <div className="divide-y divide-slate-100">
              <div className="flex items-center gap-2.5 p-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {(selectedQueuePatient.name || 'Patient').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <h3 className="truncate text-[11px] font-bold text-[#102b56]">{selectedQueuePatient.name}</h3>
                    <span className="text-[9px] text-slate-500">{selectedQueuePatient.telephone || selectedQueuePatient.patientRecordId?.phoneNumber || '—'}</span>
                  </div>
                  <p className="mt-1 text-[9px] text-slate-600">MRN: {selectedQueuePatient.cardNumber || selectedQueuePatient.patientId} <span className="mx-1 text-slate-300">|</span> Age: {selectedQueuePatient.age ?? '—'} <span className="mx-1 text-slate-300">|</span> Sex: {selectedQueuePatient.sex || '—'}</p>
                  <p className="text-[9px] text-slate-600">Student ID: {selectedQueuePatient.studentId || '—'} <span className="mx-1 text-slate-300">|</span> Dept: {selectedQueuePatient.academicDepartment || selectedQueuePatient.department || '—'}</p>
                </div>
              </div>

              <section className="p-2">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-[#102b56]"><CalendarDays size={12} />Current Visit Details</h3>
                <dl className="grid grid-cols-2 gap-1.5 rounded bg-slate-50 p-2 text-[9px]">
                  <div><dt className="font-semibold text-slate-500">Queue No.</dt><dd>{selectedQueuePatient.queueNumber || '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Visit ID</dt><dd className="break-all">{selectedQueuePatient.visitId || '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Visit Type</dt><dd>{selectedQueuePatient.visitType || '—'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Priority</dt><dd>{selectedQueuePatient.emergency ? 'Emergency' : selectedQueuePatient.priority || 'Normal'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Arrival Time</dt><dd>{formatTime(selectedQueuePatient.arrivedAt)}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Waiting Time</dt><dd>{formatWait(selectedQueuePatient.waitMinutes)}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Status</dt><dd>{statusLabel(selectedQueuePatient)}</dd></div>
                  {selectedQueuePatient.labReturn && <div><dt className="font-semibold text-slate-500">Queue Note</dt><dd>Lab return</dd></div>}
                </dl>
                {(isWaiting(selectedQueuePatient) || isInProgress(selectedQueuePatient)) && (
                  <button
                    type="button"
                    disabled={Boolean(busyQueueId)}
                    onClick={() => onStartSelectedConsultation(selectedQueuePatient)}
                    className="mt-2 w-full rounded bg-blue-700 px-2 py-2 text-[10px] font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {isWaiting(selectedQueuePatient)
                      ? selectedQueuePatient.emergency ? 'Start Emergency Examination' : 'Start Examination'
                      : 'Continue Examination'}
                  </button>
                )}
              </section>

              <section className="p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-bold text-[#102b56]"><Clock3 size={12} />Patient History</h3>
                  <button
                    type="button"
                    disabled={selectedQueueHistoryLoading}
                    onClick={() => void onViewMedicalHistory(selectedQueuePatient)}
                    className="whitespace-nowrap rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                  >
                    View Medical History
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[300px] text-left text-[9px]">
                    <thead className="bg-blue-50 text-slate-600"><tr><th className="px-1.5 py-1">Date</th><th className="px-1.5 py-1">Previous Diagnosis</th><th className="px-1.5 py-1">Notes</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {previousPatientVisits.map((visit) => <tr key={visit._id}><td className="whitespace-nowrap px-1.5 py-1">{formatDate(visit.visitDate)}</td><td className="px-1.5 py-1">{visit.diagnosis || '—'}</td><td className="px-1.5 py-1">{visit.examination?.doctorNotes || visit.examination?.chiefComplaint || '—'}</td></tr>)}
                      {(selectedQueueHistory?.legacy || []).slice(0, 3).map((visit) => <tr key={visit._id}><td className="whitespace-nowrap px-1.5 py-1">{formatDate(visit.createdAt)}</td><td className="px-1.5 py-1">{visit.diagnosis || '—'}</td><td className="px-1.5 py-1">{visit.department || '—'}</td></tr>)}
                      {selectedQueueHistoryLoading && <tr><td colSpan="3" className="px-1.5 py-2 text-center text-slate-500">Loading patient history…</td></tr>}
                      {!selectedQueueHistoryLoading && !previousPatientVisits.length && !selectedQueueHistory?.legacy?.length && <tr><td colSpan="3" className="px-1.5 py-2 text-center text-slate-500">No previous visits recorded.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          ) : <p className="p-5 text-sm text-slate-500">Select a patient from the queue to view details.</p>}
        </article>
      </section>
    </section>
  );
}

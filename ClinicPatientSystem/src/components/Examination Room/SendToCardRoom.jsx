import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  FlaskConical,
  FolderOpen,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const emptyDocuments = {
  individualFolder: true,
  patientCard: true,
  labRequestResult: true,
};

const readResponse = async (response, fallback) => {
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || fallback);
  }
  return result.data;
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

function DocumentCard({ title, icon: Icon, checked, onChange, children }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
        />
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="text-sm font-bold text-slate-800">{title}</span>
      </label>
      <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">
        {children}
      </div>
    </article>
  );
}

export default function SendToCardRoom() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [documents, setDocuments] = useState(emptyDocuments);
  const [remarks, setRemarks] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [sendError, setSendError] = useState('');
  const [notice, setNotice] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersError, setTransfersError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((key) => key + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError('');
      try {
        const params = new URLSearchParams({ search: query });
        const response = await fetch(`/api/examination/patients?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readResponse(response, 'Unable to search patient records.');
        if (active) setPatients(Array.isArray(data) ? data : []);
      } catch (error) {
        if (active) setSearchError(error.message || 'Unable to search patient records.');
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, token]);

  useEffect(() => {
    if (!selectedPatient?._id) return undefined;

    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const response = await fetch(`/api/examination/patients/${selectedPatient._id}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readResponse(response, 'Unable to load the patient record.');
        if (active) {
          setHistory(data);
          setSelectedVisitId(data.visits?.[0]?._id || '');
        }
      } catch (error) {
        if (active) setHistoryError(error.message || 'Unable to load the patient record.');
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [selectedPatient?._id, token]);

  useEffect(() => {
    let active = true;
    const loadTransfers = async () => {
      setTransfersLoading(true);
      setTransfersError('');
      try {
        const response = await fetch('/api/examination/card-room-transfers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readResponse(response, 'Unable to load Card Room transfer history.');
        if (active) setTransfers(Array.isArray(data) ? data : []);
      } catch (error) {
        if (active) setTransfersError(error.message || 'Unable to load Card Room transfer history.');
      } finally {
        if (active) setTransfersLoading(false);
      }
    };
    void loadTransfers();
    return () => {
      active = false;
    };
  }, [refreshKey, token]);

  const patient = history?.patient || selectedPatient;
  const selectedVisit = history?.visits?.find((visit) => visit._id === selectedVisitId) || null;
  const examination = selectedVisit?.examination || {};
  const labRequests = Array.isArray(examination.labRequests) ? examination.labRequests : [];

  const selectPatient = (record) => {
    setSelectedPatient(record);
    setHistory(null);
    setSelectedVisitId('');
    setDocuments({ ...emptyDocuments });
    setRemarks('');
    setNotice('');
    setSendError('');
  };

  const toggleDocument = (key) => {
    setDocuments((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!selectedPatient?._id) return;
    setSending(true);
    setSendError('');
    setNotice('');
    try {
      const response = await fetch('/api/examination/send-to-card-room', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientRecordId: selectedPatient._id,
          visitId: selectedVisitId || undefined,
          documents,
          remarks,
        }),
      });
      await readResponse(response, 'Unable to send documents to Card Room.');
      setNotice(`Sent to Card Room for ${patient?.fullName || selectedPatient.fullName}.`);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setSendError(error.message || 'Unable to send documents to Card Room.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-teal-700">Examination Room · Patient records handoff</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Send to Card Room</h1>
        <p className="mt-1 text-sm text-slate-500">Review the patient folder, examination card, and laboratory documents before sending.</p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]">
        <aside className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <label htmlFor="card-room-patient-search" className="text-sm font-semibold text-slate-800">Find patient</label>
            <div className="relative mt-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="card-room-patient-search"
                type="search"
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                  if (value.trim().length < 2) {
                    setPatients([]);
                    setSearchError('');
                    setSearchLoading(false);
                  }
                }}
                placeholder="Search name, MRN, or ID"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Enter at least 2 characters.</p>
          </div>
          {searchError && <p role="alert" className="border-b border-rose-100 bg-rose-50 p-3 text-xs text-rose-800">{searchError}</p>}
          <div className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
            {searchLoading && <p className="p-4 text-sm text-slate-500">Searching patient records…</p>}
            {!searchLoading && search.trim().length >= 2 && !searchError && patients.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No matching patient records.</p>
            )}
            {patients.map((record) => (
              <button
                key={record._id}
                type="button"
                onClick={() => selectPatient(record)}
                className={`w-full px-4 py-3 text-left transition hover:bg-teal-50 ${selectedPatient?._id === record._id ? 'bg-teal-50' : ''}`}
              >
                <span className="block truncate text-sm font-semibold text-slate-800">{record.fullName}</span>
                <span className="mt-1 block text-xs text-slate-500">{record.cardNumber || record.patientId} · {record.sex || 'Sex unavailable'} · {record.age ?? 'Age unavailable'}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {!selectedPatient ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <FolderOpen size={28} className="mx-auto text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Select a patient to review documents</p>
              <p className="mt-1 text-xs text-slate-500">The latest examination and laboratory details will be loaded from the patient record.</p>
            </div>
          ) : historyLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading patient and examination details…</div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Selected patient</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{patient?.fullName || selectedPatient.fullName}</h2>
                  <p className="mt-1 text-xs text-slate-500">MRN: {patient?.cardNumber || patient?.patientId || '—'} · Patient ID: {patient?.patientId || '—'}</p>
                </div>
                {history?.visits?.length > 0 && (
                  <label className="w-full max-w-sm text-xs font-medium text-slate-600">
                    Examination encounter
                    <select
                      value={selectedVisitId}
                      onChange={(event) => setSelectedVisitId(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {history.visits.map((visit) => (
                        <option key={visit._id} value={visit._id}>
                          {formatDate(visit.visitDate)} · {visit.diagnosis || visit.examination?.hmisDiagnosis || visit.examination?.chiefComplaint || 'No diagnosis'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {historyError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{historyError}</p>}

              <div className="grid gap-3 lg:grid-cols-3">
                <DocumentCard
                  title="Individual Folder"
                  icon={FolderOpen}
                  checked={documents.individualFolder}
                  onChange={() => toggleDocument('individualFolder')}
                >
                  <dl className="space-y-1">
                    <div className="flex justify-between gap-2"><dt>Registration</dt><dd className="text-right">{formatDate(patient?.createdAt)}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Name</dt><dd className="text-right">{displayValue(patient?.fullName)}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Father / grandfather</dt><dd className="text-right">{[patient?.fatherName, patient?.grandfatherName].filter(Boolean).join(' / ') || '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Age / sex</dt><dd className="text-right">{displayValue(patient?.age)} / {displayValue(patient?.sex)}</dd></div>
                    <div className="flex justify-between gap-2"><dt>ID number</dt><dd className="text-right">{patient?.governmentIdNumber || patient?.universityIdNumber || '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Phone</dt><dd className="text-right">{displayValue(patient?.phoneNumber)}</dd></div>
                    <div><dt>Address</dt><dd>{[patient?.region, patient?.woreda, patient?.kebele, patient?.address].filter(Boolean).join(' · ') || '—'}</dd></div>
                    <div><dt>Department</dt><dd>{patient?.academicDepartment || patient?.campus || '—'}</dd></div>
                  </dl>
                </DocumentCard>

                <DocumentCard
                  title="Patient Card"
                  icon={ClipboardList}
                  checked={documents.patientCard}
                  onChange={() => toggleDocument('patientCard')}
                >
                  {selectedVisit ? (
                    <div className="space-y-1.5">
                      <p><span className="font-semibold">Date:</span> {formatDate(selectedVisit.visitDate)}</p>
                      <p><span className="font-semibold">Diagnosis:</span> {selectedVisit.diagnosis || examination.hmisDiagnosis || examination.otherDiagnosis || 'Not recorded'}</p>
                      <p><span className="font-semibold">Chief complaint:</span> {examination.chiefComplaint || 'Not recorded'}</p>
                      <p><span className="font-semibold">Encounter notes:</span> {examination.doctorNotes || 'No notes recorded'}</p>
                      <p><span className="font-semibold">Treatment:</span> {examination.prescriptions?.map((item) => item.medicine).filter(Boolean).join(', ') || 'No treatment recorded'}</p>
                    </div>
                  ) : <p>No examination encounter is available for this patient.</p>}
                </DocumentCard>

                <DocumentCard
                  title="Lab Request / Lab Result"
                  icon={FlaskConical}
                  checked={documents.labRequestResult}
                  onChange={() => toggleDocument('labRequestResult')}
                >
                  {selectedVisit ? (
                    <div className="space-y-2">
                      <p><span className="font-semibold">Status:</span> {examination.labStatus || (labRequests.length ? 'Requested' : 'No request')}</p>
                      {examination.labRequestNumber && <p><span className="font-semibold">Request No:</span> {examination.labRequestNumber}</p>}
                      {labRequests.length ? (
                        <ul className="space-y-1">
                          {labRequests.map((test, index) => (
                            <li key={`${test.testName}-${index}`} className="rounded-md bg-slate-50 px-2 py-1.5">
                              <span className="font-semibold">{test.testName || test.category || 'Laboratory test'}</span>
                              <span className="block">{test.status || 'Pending'}{test.result ? ` · ${test.result} ${test.unit || ''}` : ''}{test.flag ? ` · ${test.flag}` : ''}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <p>No laboratory requests or results are recorded.</p>}
                      {examination.labTestedBy && <p><span className="font-semibold">Tested by:</span> {examination.labTestedBy}</p>}
                      {examination.labDateOfReport && <p><span className="font-semibold">Report date:</span> {formatDate(examination.labDateOfReport)}</p>}
                    </div>
                  ) : <p>No laboratory record is available without an examination encounter.</p>}
                </DocumentCard>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <label htmlFor="card-room-transfer-remarks" className="text-xs font-semibold text-slate-700">Note for Card Room (optional)</label>
                <textarea
                  id="card-room-transfer-remarks"
                  rows="2"
                  maxLength="1000"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Add a handoff note"
                  className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
                {historyError && <p className="mt-3 text-xs text-rose-700">Patient details could not be verified. Reload the patient record before sending.</p>}
                {sendError && <p role="alert" className="mt-3 text-sm text-rose-700">{sendError}</p>}
                {notice && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} aria-hidden="true" />{notice}</p>}
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={sending || historyLoading || Boolean(historyError) || !Object.values(documents).some(Boolean)}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={15} aria-hidden="true" />
                    {sending ? 'Sending…' : 'Confirm & Send to Card Room'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Recent Card Room transfers</h2>
            <p className="mt-1 text-xs text-slate-500">Current delivery status for documents sent from Examination Room.</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={transfersLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={transfersLoading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </div>
        {transfersError && <p role="alert" className="border-b border-rose-100 bg-rose-50 p-3 text-sm text-rose-800">{transfersError}</p>}
        {transfersLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading transfer history…</p>
        ) : transfers.length ? (
          <div className="divide-y divide-slate-100">
            {transfers.slice(0, 8).map((transfer) => (
              <article key={transfer._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{transfer.patientName} <span className="font-normal text-slate-500">· {transfer.mrn}</span></p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={12} aria-hidden="true" />Sent {formatDate(transfer.sentAt)} by {transfer.sentByName || 'Examination Room'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${transfer.status === 'RECEIVED_BY_CARD_ROOM' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {transfer.status === 'RECEIVED_BY_CARD_ROOM' ? 'Received by Card Room' : 'Sent to Card Room'}
                </span>
              </article>
            ))}
          </div>
        ) : <p className="p-4 text-sm text-slate-500">No patient records have been sent to Card Room yet.</p>}
      </section>
    </div>
  );
}

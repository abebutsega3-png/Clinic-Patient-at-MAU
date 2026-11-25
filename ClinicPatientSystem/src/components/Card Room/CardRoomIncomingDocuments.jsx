import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, FileCheck2, FlaskConical, FolderOpen, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const readResponse = async (response, fallback) => {
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || fallback);
  }
  return result.data;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const valueOrDash = (value) => (value === null || value === undefined || value === '' ? '—' : String(value));

function DocumentSection({ title, icon: Icon, included, children }) {
  return (
    <section className={`rounded-lg border p-3 ${included ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Icon size={15} className="text-teal-700" aria-hidden="true" />
          {title}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${included ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
          {included ? 'Included' : 'Not sent'}
        </span>
      </div>
      {included && <div className="mt-2 text-xs leading-5 text-slate-600">{children}</div>}
    </section>
  );
}

export default function CardRoomIncomingDocuments() {
  const { token } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [status, setStatus] = useState('SENT_TO_CARD_ROOM');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [receivingId, setReceivingId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((key) => key + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadTransfers = async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      try {
        const response = await fetch(`/api/card-room/examination-transfers?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readResponse(response, 'Unable to load documents from Examination Room.');
        if (active) setTransfers(Array.isArray(data) ? data : []);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load documents from Examination Room.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadTransfers();
    return () => {
      active = false;
    };
  }, [refreshKey, search, status, token]);

  const markReceived = async (transfer) => {
    setReceivingId(transfer._id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/card-room/examination-transfers/${transfer._id}/receive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      await readResponse(response, 'Unable to mark this transfer as received.');
      setNotice(`Received documents for ${transfer.patientName}.`);
      setRefreshKey((key) => key + 1);
    } catch (receiveError) {
      setError(receiveError.message || 'Unable to mark this transfer as received.');
    } finally {
      setReceivingId('');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">MAU Clinic · Card Room</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Incoming from Examination Room</h1>
          <p className="mt-1 text-sm text-slate-500">Review patient folders, examination cards, and laboratory documents sent for return or update.</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="min-w-[14rem] flex-1 text-xs font-semibold text-slate-700">
          Search MRN or patient
          <span className="relative mt-1.5 block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, MRN, or patient ID"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </span>
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Transfer status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1.5 block min-w-52 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700"
          >
            <option value="SENT_TO_CARD_ROOM">Waiting to receive</option>
            <option value="RECEIVED_BY_CARD_ROOM">Received</option>
            <option value="">All transfers</option>
          </select>
        </label>
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={16} aria-hidden="true" />{notice}</p>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading incoming documents…</div>
      ) : transfers.length ? (
        <div className="space-y-4">
          {transfers.map((transfer) => {
            const folder = transfer.snapshot?.individualFolder || {};
            const card = transfer.snapshot?.patientCard;
            const lab = transfer.snapshot?.labRequestResult;
            return (
              <article key={transfer._id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{transfer.patientName || 'Patient name unavailable'}</h2>
                    <p className="mt-1 text-xs text-slate-500">MRN: {transfer.mrn || '—'} · Patient ID: {transfer.patientId || '—'} · Sent {formatDate(transfer.sentAt)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Sent by {transfer.sentByName || 'Examination Room'}{transfer.remarks ? ` · Note: ${transfer.remarks}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${transfer.status === 'RECEIVED_BY_CARD_ROOM' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                      {transfer.status === 'RECEIVED_BY_CARD_ROOM' ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
                      {transfer.status === 'RECEIVED_BY_CARD_ROOM' ? 'Received' : 'Waiting to receive'}
                    </span>
                    {transfer.status === 'SENT_TO_CARD_ROOM' && (
                      <button
                        type="button"
                        onClick={() => void markReceived(transfer)}
                        disabled={receivingId === transfer._id}
                        className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        {receivingId === transfer._id ? 'Updating…' : 'Mark received'}
                      </button>
                    )}
                  </div>
                </header>

                <div className="grid gap-3 p-3 lg:grid-cols-3">
                  <DocumentSection title="Individual Folder" icon={FolderOpen} included={Boolean(transfer.documents?.individualFolder)}>
                    <dl className="space-y-1">
                      <div><dt className="inline font-semibold">Registered:</dt> <dd className="inline">{formatDate(folder.dateOfRegistration)}</dd></div>
                      <div><dt className="inline font-semibold">Name:</dt> <dd className="inline">{valueOrDash(folder.name)}</dd></div>
                      <div><dt className="inline font-semibold">Father / grandfather:</dt> <dd className="inline">{[folder.fatherName, folder.grandfatherName].filter(Boolean).join(' / ') || '—'}</dd></div>
                      <div><dt className="inline font-semibold">Age / sex:</dt> <dd className="inline">{valueOrDash(folder.age)} / {valueOrDash(folder.sex)}</dd></div>
                      <div><dt className="inline font-semibold">ID:</dt> <dd className="inline">{valueOrDash(folder.idNumber)}</dd></div>
                      <div><dt className="inline font-semibold">Phone:</dt> <dd className="inline">{valueOrDash(folder.phoneNumber)}</dd></div>
                      <div><dt className="inline font-semibold">Address:</dt> <dd className="inline">{[folder.region, folder.woreda, folder.kebele, folder.address].filter(Boolean).join(' · ') || '—'}</dd></div>
                      <div><dt className="inline font-semibold">Department:</dt> <dd className="inline">{valueOrDash(folder.department)}</dd></div>
                    </dl>
                  </DocumentSection>

                  <DocumentSection title="Patient Card" icon={FileCheck2} included={Boolean(transfer.documents?.patientCard)}>
                    {card ? (
                      <div className="space-y-1">
                        <p><span className="font-semibold">Date:</span> {formatDate(card.date)}</p>
                        <p><span className="font-semibold">Diagnosis:</span> {valueOrDash(card.diagnosis)}</p>
                        <p><span className="font-semibold">Chief complaint:</span> {valueOrDash(card.chiefComplaint)}</p>
                        <p><span className="font-semibold">Encounter notes:</span> {valueOrDash(card.encounterNotes)}</p>
                        <p><span className="font-semibold">Treatment:</span> {card.treatment?.map((item) => item.medicine).filter(Boolean).join(', ') || '—'}</p>
                      </div>
                    ) : <p>No examination encounter was available when these documents were sent.</p>}
                  </DocumentSection>

                  <DocumentSection title="Lab Request / Lab Result" icon={FlaskConical} included={Boolean(transfer.documents?.labRequestResult)}>
                    {lab ? (
                      <div className="space-y-1.5">
                        <p><span className="font-semibold">Status:</span> {lab.status || 'Not requested'}</p>
                        {lab.requestNumber && <p><span className="font-semibold">Request No:</span> {lab.requestNumber}</p>}
                        {lab.tests?.length ? lab.tests.map((test, index) => (
                          <p key={`${test.testName}-${index}`} className="rounded bg-slate-50 px-2 py-1">
                            <span className="font-semibold">{test.testName || test.category || 'Laboratory test'}:</span> {test.status || 'Pending'}{test.result ? ` · ${test.result} ${test.unit || ''}` : ''}
                          </p>
                        )) : <p>No lab tests were recorded.</p>}
                        {lab.testedBy && <p><span className="font-semibold">Tested by:</span> {lab.testedBy}</p>}
                        {lab.dateOfReport && <p><span className="font-semibold">Report date:</span> {formatDate(lab.dateOfReport)}</p>}
                      </div>
                    ) : <p>No laboratory record was available when these documents were sent.</p>}
                  </DocumentSection>
                </div>

                {transfer.receivedAt && (
                  <footer className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
                    Received {formatDate(transfer.receivedAt)} by {transfer.receivedByName || 'Card Room'}
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <FolderOpen size={28} className="mx-auto text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No incoming documents found</p>
          <p className="mt-1 text-xs text-slate-500">Transfers from Examination Room will appear here.</p>
        </div>
      )}
    </div>
  );
}

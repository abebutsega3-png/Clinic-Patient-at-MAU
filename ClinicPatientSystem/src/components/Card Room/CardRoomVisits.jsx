import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, RefreshCw, Search, UserRoundPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 20;
const visitStatuses = [
  'Registered',
  'Waiting',
  'Called',
  'In Service',
  'Routed',
  'Sent to Examination',
  'Completed',
  'Cancelled',
  'No-show',
];

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Addis_Ababa',
    }).format(date);
};

const readErrorMessage = async (response) => {
  const result = await response.json().catch(() => ({}));
  return result.message || `Request failed (${response.status}).`;
};

const statusClass = (status) => {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-800';
  if (status === 'Cancelled' || status === 'No-show') return 'bg-rose-50 text-rose-800';
  if (status === 'In Service' || status === 'Sent to Examination' || status === 'Routed') return 'bg-teal-50 text-teal-800';
  if (status === 'Called') return 'bg-sky-50 text-sky-800';
  return 'bg-amber-50 text-amber-800';
};

const priorityClass = (priority) => {
  if (priority === 'Emergency') return 'font-bold text-rose-700';
  if (priority === 'Urgent') return 'font-semibold text-orange-700';
  return 'text-slate-600';
};

export default function CardRoomVisits() {
  const { token } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visits, setVisits] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== search) {
        setSearch(nextSearch);
        setPage(1);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, searchInput]);

  useEffect(() => {
    const timer = setInterval(() => setRefreshKey((key) => key + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadVisits = async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      try {
        const response = await fetch(`/api/card-room/visits?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) {
          throw new Error(result.message || 'The visits response was incomplete.');
        }
        if (active) {
          setVisits(result.data);
          setPagination(result.pagination || { page: 1, pages: 1, total: result.data.length });
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load today’s visits.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadVisits();
    return () => {
      active = false;
    };
  }, [page, refreshKey, search, status, token]);

  const updateStatus = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">MAU Clinic · Card Room</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Today’s Visits</h1>
          <p className="mt-1 text-sm text-slate-500">Review today’s patient visits, priorities, and queue progress.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
          <Link to="/card-room/register" className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            <UserRoundPlus size={16} aria-hidden="true" />
            Register visit
          </Link>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="font-semibold underline">Try again</button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><CalendarClock size={20} aria-hidden="true" /></span>
            <div>
              <h2 className="font-semibold text-slate-900">Visit register</h2>
              <p className="text-xs text-slate-500">{pagination.total || 0} visit{pagination.total === 1 ? '' : 's'} today</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_12rem]">
            <label htmlFor="today-visits-search" className="sr-only">Search visits</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="today-visits-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search patient, MRN, or visit ID"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <label className="sr-only" htmlFor="today-visits-status">Filter by visit status</label>
            <select
              id="today-visits-status"
              value={status}
              onChange={updateStatus}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">All statuses</option>
              {visitStatuses.map((visitStatus) => <option key={visitStatus} value={visitStatus}>{visitStatus}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">Time</th>
                <th scope="col" className="px-5 py-3">Visit / MRN</th>
                <th scope="col" className="px-5 py-3">Patient</th>
                <th scope="col" className="px-5 py-3">Visit type</th>
                <th scope="col" className="px-5 py-3">Department</th>
                <th scope="col" className="px-5 py-3">Priority</th>
                <th scope="col" className="px-5 py-3">Visit status</th>
                <th scope="col" className="px-5 py-3">Queue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-slate-500">Loading today’s visits…</td></tr>
              ) : visits.length ? visits.map((visit) => (
                <tr key={visit._id || visit.visitId} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatTime(visit.visitDate)}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <p className="font-semibold text-teal-800">{visit.visitId || '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{visit.patientId || visit.cardNumber || 'MRN unavailable'}</p>
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-900">{visit.patientName || 'Name unavailable'}</td>
                  <td className="px-5 py-4 text-slate-600">{visit.visitType || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{visit.department || '—'}</td>
                  <td className={`px-5 py-4 ${priorityClass(visit.priority)}`}>
                    {visit.emergency && visit.priority !== 'Emergency' ? 'Emergency' : visit.priority || 'Normal'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(visit.status)}`}>
                      {visit.status || 'Registered'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {visit.queue ? (
                      <span className="text-slate-700">
                        <span className="font-semibold">{visit.queue.queueNumber || '—'}</span>
                        <span className="ml-1.5 text-xs capitalize text-slate-500">{String(visit.queue.status || '').replaceAll('_', ' ')}</span>
                      </span>
                    ) : <span className="text-slate-400">Not queued</span>}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center">
                    <p className="font-medium text-slate-700">{error ? 'Today’s visits could not be loaded.' : search || status ? 'No visits match these filters.' : 'No visits have been registered today.'}</p>
                    {!error && !search && !status && <Link to="/card-room/register" className="mt-3 inline-flex text-sm font-semibold text-teal-700 hover:underline">Register a patient visit</Link>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-xs text-slate-500">
            {pagination.total
              ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, pagination.total)} of ${pagination.total}`
              : 'No visits to display'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="min-w-16 text-center text-xs text-slate-500">Page {page} of {pagination.pages || 1}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pagination.pages || 1, current + 1))}
              disabled={loading || page >= (pagination.pages || 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

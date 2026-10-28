import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Clock3, Plus, RefreshCw, Search, Siren, Users, UserRoundCheck } from 'lucide-react';
import CardRoomNavbar from './cardroomnavbar.jsx';
import CardRoomSidebar from './cardroomsidbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const readErrorMessage = async (response) => {
  const result = await response.json().catch(() => ({}));
  return result.message || `Request failed (${response.status}).`;
};

function CardRoomLayout() {
  const { user, token, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (!user || !token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const activeRole = String(user.activeRole || user.role || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  if (activeRole !== 'card chief') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Card Room access required</h1>
          <p className="mt-2 text-sm text-slate-600">This area is available only to authorized Card Room staff.</p>
          <Link to="/" className="mt-5 inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            Return to home
          </Link>
        </section>
      </main>
    );
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <CardRoomSidebar
        isOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className="min-h-screen lg:pl-64">
        <CardRoomNavbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CardRoomDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkInMode, setCheckInMode] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setRefreshKey((key) => key + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/card-room/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }
        const result = await response.json();
        if (!result.success || !result.data) {
          throw new Error(result.message || 'The dashboard response was incomplete.');
        }
        if (active) {
          setDashboard(result.data);
          setError('');
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load the Card Room dashboard.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [token, refreshKey]);

  const summary = dashboard?.summary;
  const metrics = [
    { label: "Today's Total Patients", value: summary?.visitsToday, icon: Users, tone: 'text-sky-700 bg-sky-50' },
    { label: 'New Patients Registered', value: summary?.registrationsToday, icon: Plus, tone: 'text-teal-700 bg-teal-50' },
    { label: 'Returning Patients', value: summary?.returningPatients, icon: UserRoundCheck, tone: 'text-indigo-700 bg-indigo-50' },
    { label: 'Emergency Cases', value: summary?.emergencyVisits, icon: AlertTriangle, tone: 'text-rose-700 bg-rose-50' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">MAU Clinic · Card Room</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Welcome, {user?.name || 'Card Room User'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Patient flow overview for today · Updates every 15 seconds.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setRefreshKey((key) => key + 1);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRefreshKey((key) => key + 1);
            }}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      <section aria-label="Today's Card Room statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {loading ? <span className="inline-block h-9 w-12 animate-pulse rounded bg-slate-100" /> : (value ?? 0)}
                </p>
              </div>
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
            </div>
          </article>
        ))}
      </section>

      <section aria-label="Quick actions" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">Start registration or check in a returning patient.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/card-room/register" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800">
            <Plus size={18} aria-hidden="true" /> Register New Patient
          </Link>
          <button type="button" onClick={() => setCheckInMode('normal')} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Search size={18} aria-hidden="true" /> Quick Search / Check-in
          </button>
          <button type="button" onClick={() => setCheckInMode('emergency')} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 hover:bg-rose-100">
            <Siren size={18} aria-hidden="true" /> Emergency Check-in
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">Department live queue</h2>
              <p className="mt-1 text-xs text-slate-500">Waiting includes patients who have been called.</p>
            </div>
            <Activity size={18} className="text-teal-700" aria-hidden="true" />
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading department queues…</p>
          ) : dashboard?.departmentQueues?.length ? (
            <div className="divide-y divide-slate-100">
              {dashboard.departmentQueues.map(({ department, waiting, active }) => (
                <div key={department} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{department}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} aria-hidden="true" /> {waiting} waiting · {active} in progress</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${waiting >= 10 ? 'bg-rose-50 text-rose-800' : waiting > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                    {waiting >= 10 ? 'High queue' : waiting > 0 ? 'Normal' : 'Available'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">{error ? 'Department queue data is unavailable.' : 'No department queues have activity today.'}</p>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">Recent registrations</h2>
              <p className="mt-1 text-xs text-slate-500">Latest visits and queue tickets from today.</p>
            </div>
            <Link to="/card-room/visits" className="shrink-0 text-sm font-semibold text-teal-700 hover:underline">All visits</Link>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading recent registrations…</p>
          ) : dashboard?.todayVisits?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">MRN / Patient</th>
                    <th scope="col" className="px-4 py-3">Department</th>
                    <th scope="col" className="px-4 py-3">Queue #</th>
                    <th scope="col" className="px-4 py-3">Arrival</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboard.todayVisits.map((visit) => (
                    <tr key={visit._id || visit.visitId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{visit.patientName || 'Patient unavailable'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{visit.patientId || visit.visitId || 'ID unavailable'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{visit.queue?.department || visit.department || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-teal-800">{visit.queue?.queueNumber || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {visit.visitDate ? new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' }).format(new Date(visit.visitDate)) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                          {visit.queue?.status?.replaceAll('_', ' ') || visit.status || 'Registered'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">{error ? 'Visit data is unavailable.' : 'No visits found for today.'}</p>
          )}
        </article>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/card-room/queue" className="text-sm font-semibold text-teal-700 hover:underline">Open Queue Management</Link>
        <Link to="/card-room/patients" className="text-sm font-semibold text-teal-700 hover:underline">View Patient Records</Link>
      </div>
      {checkInMode && (
        <QuickCheckInDialog
          mode={checkInMode}
          token={token}
          onClose={() => setCheckInMode('')}
          onSelect={(patient, emergencyVisit) => navigate('/card-room/visits/new', {
            state: { patient, emergencyVisit },
          })}
        />
      )}
    </div>
  );
}

function QuickCheckInDialog({ mode, token, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const emergencyVisit = mode === 'emergency';

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return undefined;

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
        const response = await fetch(`/api/card-room/patients?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) throw new Error(result.message || 'Patient search response was incomplete.');
        if (active) setPatients(result.data);
      } catch (searchError) {
        if (active) setError(searchError.message || 'Unable to search patient records.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="quick-checkin-title" className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-sm font-semibold ${emergencyVisit ? 'text-rose-700' : 'text-teal-700'}`}>{emergencyVisit ? 'Emergency check-in' : 'Returning patient'}</p>
            <h2 id="quick-checkin-title" className="mt-1 text-xl font-bold text-slate-900">Find patient</h2>
            <p className="mt-1 text-sm text-slate-500">Search by name, MRN, card number, or phone. Select the matching patient to continue.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close patient search" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
        </div>
        <label htmlFor="quick-checkin-search" className="sr-only">Search patient records</label>
        <div className="relative mt-5">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="quick-checkin-search"
            autoFocus
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              if (value.trim().length < 2) {
                setPatients([]);
                setError('');
                setLoading(false);
              }
            }}
            placeholder="Type at least 2 characters"
            className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        {emergencyVisit && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Emergency priority and Emergency Room routing will be selected in the next step.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div className="mt-4 divide-y divide-slate-100">
          {loading && <p className="py-4 text-sm text-slate-500">Searching patient records…</p>}
          {!loading && search.trim().length >= 2 && !error && patients.length === 0 && <p className="py-4 text-sm text-slate-500">No matching patients found.</p>}
          {patients.map((patient) => (
            <button key={patient.id} type="button" onClick={() => onSelect(patient, emergencyVisit)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50">
              <span>
                <span className="block font-semibold text-slate-800">{patient.fullName}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{patient.patientId} · {patient.cardNumber || 'Card number unavailable'} · {patient.phoneNumber || 'Phone unavailable'}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-teal-700">Check in</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CardRoomUnavailable() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">Card Room screen unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">This frontend screen is not currently installed. The navigation shell is active; use the Dashboard link to return.</p>
      <Link to="/card-room" className="mt-5 inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
        Go to Dashboard
      </Link>
    </section>
  );
}

export { CardRoomDashboard, CardRoomLayout, CardRoomUnavailable };

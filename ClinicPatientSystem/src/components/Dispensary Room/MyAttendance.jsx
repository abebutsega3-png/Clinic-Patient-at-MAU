import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarDays, CheckCircle2, Clock3, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}`;
};

const formatTime = (value) => {
  if (!value) return '—';
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(':').map(Number);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
      .format(new Date(2000, 0, 1, hour, minute));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Africa/Addis_Ababa'
    }).format(date);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const statusLabel = (status) => {
  if (!status || status === 'unrecorded') return 'Not checked in';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function MyAttendance() {
  const { token } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: result } = await axios.get(`/api/attendance/me?month=${encodeURIComponent(month)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(result);
    } catch (loadError) {
      console.error('Failed to load personal attendance:', loadError);
      setError(loadError.response?.data?.message || 'Unable to load your attendance.');
    } finally {
      setLoading(false);
    }
  }, [month, token]);

  useEffect(() => {
    void Promise.resolve().then(loadAttendance);
  }, [loadAttendance]);

  const recordTime = async (action) => {
    setBusy(action);
    setError('');
    setNotice('');
    try {
      const { data: result } = await axios.post(`/api/attendance/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotice(result.message || 'Attendance recorded and sent to the Clinic Head.');
      await loadAttendance();
    } catch (actionError) {
      console.error(`Failed to ${action} attendance:`, actionError);
      const message = actionError.response?.data?.message || 'Unable to record attendance.';
      if (actionError.response?.status === 409) {
        await loadAttendance();
        setError(message);
      } else {
        setError(message);
      }
    } finally {
      setBusy('');
    }
  };

  const attendance = data?.attendance;
  const hasCheckedIn = Boolean(attendance?.timeIn);
  const hasCheckedOut = Boolean(attendance?.timeOut);
  const schedule = data?.schedule;
  const history = data?.history || [];

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Staff account</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">My Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Check in and out for your assigned shift and review your attendance history.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAttendance()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} />{notice}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:px-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Clock3 size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-bold text-slate-900">{data?.staff?.name || 'Today’s attendance'}</h2>
            <p className="text-xs capitalize text-slate-500">
              {data?.staff?.role || 'Staff'} · {schedule?.isScheduled
                ? `${schedule.shiftLabel || `${schedule.shift} shift`}${schedule.shiftStart ? ` · starts ${formatTime(schedule.shiftStart)}` : ''}`
                : schedule?.shiftLabel || 'No shift assigned'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            attendance?.status === 'late' ? 'bg-amber-100 text-amber-800'
              : hasCheckedIn ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
          }`}>
            {statusLabel(attendance?.status)}
          </span>
        </header>

        {loading && !data ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading attendance…</p>
        ) : (
          <div className="space-y-5 p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500">Check-in time</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatTime(attendance?.checkInTime || attendance?.timeIn)}</p>
                {hasCheckedIn && !hasCheckedOut && <p className="mt-1 text-xs text-emerald-700">Currently present</p>}
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500">Check-out time</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatTime(attendance?.checkOutTime || attendance?.timeOut)}</p>
                {hasCheckedOut && <p className="mt-1 text-xs text-slate-500">Shift completed</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!hasCheckedIn ? (
                <button
                  type="button"
                  onClick={() => void recordTime('check-in')}
                  disabled={Boolean(busy) || !schedule?.isScheduled || loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <LogIn size={17} aria-hidden="true" />
                  {busy === 'check-in' ? 'Checking in…' : 'Mark Present / Check In'}
                </button>
              ) : !hasCheckedOut ? (
                <button
                  type="button"
                  onClick={() => void recordTime('check-out')}
                  disabled={Boolean(busy) || loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut size={17} aria-hidden="true" />
                  {busy === 'check-out' ? 'Checking out…' : 'Check Out'}
                </button>
              ) : (
                <p className="text-sm font-semibold text-emerald-700">Your attendance has been recorded for today.</p>
              )}
              {attendance?.checkInTime && <p className="text-xs text-slate-500">Report sent to Clinic Head.</p>}
              {!schedule?.isScheduled && (
                <p className="text-xs text-amber-700">Check-in is unavailable because no shift is assigned and the clinic is closed today.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-6">
          <div>
            <h2 className="font-bold text-slate-900">Attendance history</h2>
            <p className="mt-1 text-xs text-slate-500">Your recorded attendance for the selected month.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays size={16} aria-hidden="true" />
            <span className="sr-only">Attendance history month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3 sm:px-5">Date</th>
                <th className="p-3 sm:px-5">Check-in</th>
                <th className="p-3 sm:px-5">Check-out</th>
                <th className="p-3 sm:px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length ? history.map((entry) => (
                <tr key={entry._id}>
                  <td className="p-3 font-medium text-slate-800 sm:px-5">{formatDate(entry.date)}</td>
                  <td className="p-3 text-slate-600 sm:px-5">{formatTime(entry.checkInTime || entry.timeIn)}</td>
                  <td className="p-3 text-slate-600 sm:px-5">{formatTime(entry.checkOutTime || entry.timeOut)}</td>
                  <td className="p-3 sm:px-5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      entry.status === 'late' ? 'bg-amber-100 text-amber-800'
                        : entry.status === 'present' ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}>{statusLabel(entry.status)}</span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="p-8 text-center text-sm text-slate-500">No attendance records for this month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

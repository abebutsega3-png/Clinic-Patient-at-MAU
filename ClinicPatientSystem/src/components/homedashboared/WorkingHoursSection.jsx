import { useEffect, useState } from 'react';
import { Clock3, Phone } from 'lucide-react';

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getClinicTime = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const isOpenAt = (hours, day, time) => {
  if (!hours) return false;
  if (hours.allDayService) return true;
  const today = hours.days?.find((entry) => entry.day === day);
  const yesterdayIndex = (weekdayNames.indexOf(day) + 6) % 7;
  const yesterday = hours.days?.find((entry) => entry.day === weekdayNames[yesterdayIndex]);
  const currentMinutes = toMinutes(time);

  if (today && !today.closed) {
    const opening = toMinutes(today.open);
    const closing = toMinutes(today.close);
    if (opening === closing || (opening < closing && currentMinutes >= opening && currentMinutes < closing)) return true;
    if (opening > closing && currentMinutes >= opening) return true;
  }

  if (yesterday && !yesterday.closed && toMinutes(yesterday.open) > toMinutes(yesterday.close)) {
    return currentMinutes < toMinutes(yesterday.close);
  }
  return false;
};

const getNextOpening = (hours, day, time) => {
  if (!hours?.days?.length || hours.allDayService) return null;

  const todayIndex = weekdayNames.indexOf(day);
  if (todayIndex < 0) return null;
  const currentMinutes = toMinutes(time);

  for (let offset = 0; offset < weekdayNames.length; offset += 1) {
    const candidateDay = weekdayNames[(todayIndex + offset) % weekdayNames.length];
    const schedule = hours.days.find((entry) => entry.day === candidateDay);
    if (!schedule || schedule.closed) continue;
    if (offset === 0 && toMinutes(schedule.open) <= currentMinutes) continue;

    return {
      day: offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : candidateDay,
      time: schedule.open,
    };
  }

  return null;
};

const formatTime = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
};

export default function WorkingHoursSection({ overview, loading, error }) {
  const [now, setNow] = useState(() => getClinicTime());
  const workingHours = overview?.workingHours;
  const currentTime = `${now.hour}:${now.minute}`;
  const isOpen = isOpenAt(workingHours, now.weekday, currentTime);
  const nextOpening = !isOpen && getNextOpening(workingHours, now.weekday, currentTime);
  const emergencyAvailable = Boolean(
    workingHours?.allDayService
    || workingHours?.allDayDepartments?.some((department) => department.toLowerCase() === 'emergency')
  );
  const emergencyPhone = overview?.emergencyPhone || '+251583209653';

  useEffect(() => {
    const interval = window.setInterval(() => setNow(getClinicTime()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section id="working-hours" className="scroll-mt-32 bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-7 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Plan Your Visit</p>
          <h2 className="mt-2 text-2xl font-bold text-[#102f5e] sm:text-3xl">Working Hours</h2>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            {loading || error ? (
              <span className="text-slate-600">{loading ? 'Checking current hours…' : 'Current hours unavailable'}</span>
            ) : (
              <span className={`inline-flex flex-wrap items-center justify-center gap-2 ${isOpen ? 'text-emerald-700' : 'text-rose-700'}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {isOpen ? 'The clinic is open now' : 'The clinic is closed now'}
                {!isOpen && nextOpening && (
                  <span className="w-full font-medium">
                    Opens {nextOpening.day} at {formatTime(nextOpening.time)}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-[#102f5e]">
            <Clock3 size={18} className="text-sky-600" aria-hidden="true" />
            Regular clinic hours
          </div>
          {loading ? (
            <p role="status" className="p-5 text-sm text-slate-500">Loading the clinic schedule…</p>
          ) : error ? (
            <p role="status" className="p-5 text-sm text-amber-800">
              Unable to load the clinic schedule: {error}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {workingHours?.days?.map(({ day, open, close, closed }) => (
                <div key={day} className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${day === now.weekday ? 'bg-sky-50' : 'bg-white'}`}>
                  <span className="font-medium text-slate-700">{day}{day === now.weekday ? ' (Today)' : ''}</span>
                  <span className={closed ? 'text-slate-500' : 'font-medium text-slate-700'}>
                    {closed ? 'Closed' : `${formatTime(open)} – ${formatTime(close)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-red-800">
              Emergency Service {emergencyAvailable ? '· Available 24/7' : ''}
            </p>
            <p className="mt-1 text-sm text-red-700">
              For urgent medical concerns, call the clinic before travelling.
            </p>
          </div>
          <a
            href={`tel:${emergencyPhone.replace(/[^\d+]/g, '')}`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            <Phone size={17} aria-hidden="true" />
            {emergencyPhone}
          </a>
        </div>

        <p className="mt-4 text-center text-sm leading-6 text-slate-600">
          Clinic hours may change on public holidays. Please bring your patient card when you visit.
        </p>
      </div>
    </section>
  );
}

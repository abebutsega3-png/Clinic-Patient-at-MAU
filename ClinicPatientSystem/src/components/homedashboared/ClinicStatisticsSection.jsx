import { Building2, Clock3, Stethoscope, UserRound } from 'lucide-react';
import { clinicServices } from '../../data/clinicServices.js';

export default function ClinicStatisticsSection({ overview, loading, error }) {
  const emergencyHours = overview?.workingHours?.allDayService
    || overview?.workingHours?.allDayDepartments?.some((department) => department.toLowerCase() === 'emergency');
  const statistics = [
    { label: 'Medical Staff', value: overview?.statistics?.staff, icon: UserRound },
    { label: 'Departments', value: overview?.statistics?.departments, icon: Building2 },
    { label: 'Clinic Services', value: clinicServices.length, icon: Stethoscope },
    { label: 'Emergency Service', value: emergencyHours ? '24/7' : 'Contact us', icon: Clock3 },
  ];

  return (
    <section aria-label="Clinic statistics" className="bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-5">
        {statistics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-500 text-white shadow-md sm:h-28 sm:w-28">
              <Icon size={43} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-4 min-h-9 text-3xl font-extrabold tabular-nums text-slate-900" aria-live={loading ? 'polite' : undefined}>
              {label === 'Emergency Service'
                ? (loading ? '…' : (error ? '—' : value))
                : label === 'Clinic Services'
                  ? value
                  : (loading ? '…' : (error ? '—' : (value ?? 0).toLocaleString()))}
            </p>
            <h2 className="text-sm font-medium text-slate-700 sm:text-base">{label}</h2>
          </div>
        ))}
      </div>
      {error && (
        <p role="status" className="mx-auto mt-5 max-w-3xl text-center text-sm text-amber-800">
          Clinic statistics are temporarily unavailable: {error}
        </p>
      )}
    </section>
  );
}

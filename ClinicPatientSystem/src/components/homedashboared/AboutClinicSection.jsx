import {
  BadgeCheck,
  Building2,
  ClipboardPlus,
  FlaskConical,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  PackageSearch,
  Pill,
  Stethoscope,
  Syringe,
  Target,
  Zap,
} from 'lucide-react';
import campusImage from '../../assets/image1.png';

const coreValues = [
  { label: 'Compassion', icon: HeartHandshake },
  { label: 'Confidentiality', icon: LockKeyhole },
  { label: 'Timeliness', icon: Zap },
  { label: 'Quality', icon: BadgeCheck },
];

const clinicUnits = [
  {
    name: 'Card Room',
    description: 'Registers patients and opens or retrieves patient cards.',
    icon: ClipboardPlus,
  },
  {
    name: 'Examination Room',
    description: 'Doctors examine patients and decide on treatment.',
    icon: Stethoscope,
  },
  {
    name: 'Laboratory Room',
    description: 'Provides blood, urine, and other laboratory tests.',
    icon: FlaskConical,
  },
  {
    name: 'Injection & Dressing Room',
    description: 'Provides injections and wound dressing care.',
    icon: Syringe,
  },
  {
    name: 'Dispensary Room',
    description: 'Dispenses prescribed medicines to patients.',
    icon: Pill,
  },
  {
    name: 'Drug Store',
    description: 'Stores medicines and monitors medicine stock.',
    icon: PackageSearch,
  },
  {
    name: 'Emergency Room',
    description: 'Provides urgent care for emergency cases.',
    icon: HeartPulse,
    emergency: true,
  },
  {
    name: 'Clinic Student Head Office',
    description: 'Coordinates and oversees the clinic’s overall operations.',
    icon: Building2,
  },
];

export default function AboutClinicSection() {
  return (
    <section id="about" className="scroll-mt-32 bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="overflow-hidden rounded-2xl shadow-md">
            <img
              src={campusImage}
              alt="Mekdela Amba University campus"
              className="h-64 w-full object-cover sm:h-80 lg:h-[26rem]"
              loading="lazy"
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-600">About the Clinic</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#102f5e] sm:text-3xl">
              Care for the university community
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              MAU Clinic provides essential healthcare for the university’s students, faculty, and staff.
              We help patients move through registration, assessment, and treatment in an organized,
              timely way.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="inline-flex items-center gap-2 font-semibold text-[#102f5e]">
                  <HeartPulse size={19} className="text-sky-600" aria-hidden="true" />
                  Our Mission
                </span>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Provide quality, timely, and accessible healthcare.
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="inline-flex items-center gap-2 font-semibold text-[#102f5e]">
                  <Target size={19} className="text-sky-600" aria-hidden="true" />
                  Our Vision
                </span>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Become a trusted, modern clinic for the university community.
                </p>
              </article>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-bold text-[#102f5e]">Our Core Values</h3>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
                {coreValues.map(({ label, icon: Icon }) => (
                  <li key={label} className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <Icon size={17} className="text-sky-600" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Patient Flow</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#102f5e] sm:text-3xl">Our Units</h3>
            <p className="mt-2 text-sm text-slate-600">
              The clinic units support patients from registration through treatment and follow-up.
            </p>
          </div>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {clinicUnits.map(({ name, description, icon: Icon, emergency }) => (
              <li
                key={name}
                className={`group min-h-40 rounded-xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${
                  emergency
                    ? 'border-red-200 hover:border-red-400'
                    : 'border-slate-200 hover:border-sky-300'
                }`}
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${
                    emergency
                      ? 'bg-red-100 text-red-700'
                      : 'bg-sky-100 text-sky-700 group-hover:bg-sky-500 group-hover:text-white'
                  }`}
                >
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h4 className={`mt-3 font-bold ${emergency ? 'text-red-800' : 'text-[#102f5e]'}`}>
                  {name}
                </h4>
                <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

import {
  Bandage,
  ContactRound,
  FlaskConical,
  HeartPulse,
  Package,
  Pill,
  Siren,
  Stethoscope,
} from 'lucide-react';

const clinicUnits = [
  {
    name: 'Drug Store',
    id: 'department-drug-store',
    description: 'Route for medicine and supply needs.',
    icon: Pill,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Emergency Room',
    id: 'department-emergency-room',
    description: 'Route urgent cases here for immediate assessment.',
    icon: Siren,
    image: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Injection and Dressing Room',
    id: 'department-injection-and-dressing-room',
    description: 'Route for injections, dressings, and related care.',
    icon: Bandage,
    image: 'https://images.unsplash.com/photo-1583911860205-72f8ac8ddcbe?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Examination Room',
    id: 'department-examination-room',
    description: 'Route for consultation and clinical examination.',
    icon: Stethoscope,
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Dispensary Room',
    id: 'department-dispensary-room',
    description: 'Route for dispensing medicines after care.',
    icon: Package,
    image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Card Room',
    id: 'department-card-room',
    description: 'Route for patient cards and registration records.',
    icon: ContactRound,
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Laboratory Room',
    id: 'department-laboratory-room',
    description: 'Route for laboratory work supporting clinical assessment.',
    icon: FlaskConical,
    image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=80',
  },
];

export default function HomeCareUnitsSection() {
  return (
    <section id="services" className="scroll-mt-32 bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">Care on campus</p>
          <h2 className="mt-2 font-serif text-xl font-bold text-slate-900 sm:text-2xl">
            Student clinic health services
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-5 text-slate-600">
            Start at the clinic, join the queue, and follow the right department route for faster, clearer care.
          </p>
        </div>

        <div className="mb-5 flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
          <img
            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=240&h=160&q=80"
            alt=""
            className="h-16 w-24 shrink-0 rounded-lg object-cover sm:h-20 sm:w-28"
            loading="lazy"
          />
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <HeartPulse size={25} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-bold text-[#102f5e]">Student Clinic Health Services</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Begin here for registration, patient flow, queue guidance, and routing to the right department.
            </p>
          </div>
        </div>

        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clinicUnits.map(({ name, id, description, icon: Icon, image }, index) => (
            <li
              id={id}
              key={name}
              className={`rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm sm:p-5 ${
                index === clinicUnits.length - 1 ? 'md:col-span-2 lg:col-span-3' : ''
              }`}
            >
              <img
                src={image}
                alt=""
                className={`h-20 w-full rounded-lg object-cover sm:h-24 ${
                  index === clinicUnits.length - 1 ? 'lg:h-28' : ''
                }`}
                loading="lazy"
              />
              <Icon size={22} className="mt-3 text-blue-600" aria-hidden="true" />
              <h3 className="mt-2 font-semibold text-slate-900">{name}</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import {
  BadgeCheck,
  Bandage,
  Building2,
  ClipboardPlus,
  FlaskConical,
  HeartPulse,
  Pill,
  ShieldCheck,
  Stethoscope,
  Target,
  UsersRound,
} from 'lucide-react';
import campusImage from '../../assets/image1.png';

const informationColumns = [
  [
    {
      title: 'Who We Are',
      description: 'The Mekdela Amba University (MAU) Clinic System is a university health service established to provide comprehensive, affordable, and quality healthcare services to students, academic staff, and other university community members.',
      icon: UsersRound,
    },
    {
      title: 'Purpose of the System',
      description: 'The purpose of the MAU Clinic System is to ensure accessible, timely, and quality healthcare services, promote a healthy campus environment, and support the academic and personal success of our community.',
      icon: Target,
    },
    {
      title: 'Our Vision',
      description: 'To be a leading university clinic system in Ethiopia, providing trusted care through compassion, quality, and innovation.',
      icon: HeartPulse,
    },
  ],
  [
    {
      title: 'About the System',
      description: 'The MAU Clinic System is a modern, well-equipped healthcare facility within the university, designed to support the physical and mental well-being of students and staff through integrated clinical services, preventive care, and health education.',
      icon: Building2,
    },
    {
      title: 'Our Mission',
      description: 'To deliver responsive, high-quality, and compassionate healthcare services, promote preventive health, and contribute to the well-being and success of students, staff, and the wider university community.',
      icon: ShieldCheck,
    },
    {
      title: 'Who Can Use the System',
      description: 'The system is open to all Mekdela Amba University students, academic and non-academic staff, and eligible visitors on campus.',
      icon: UsersRound,
    },
  ],
];

const clinicServices = [
  { title: 'Examination Room', icon: Stethoscope },
  { title: 'Emergency Room', icon: HeartPulse },
  { title: 'Laboratory Room', icon: FlaskConical },
  { title: 'Injection and Dressing Room', icon: Bandage },
  { title: 'Pharmacy / Drug Store', icon: Pill },
  { title: 'Dispensary Room', icon: ClipboardPlus },
  { title: 'Care Room', icon: HeartPulse },
  { title: 'Clinic Head Office', icon: Building2 },
];

const benefits = [
  'Easy access to quality healthcare services',
  'Timely and professional medical support',
  'Reduced waiting time with organized service flow',
  'Supports academic performance and well-being',
];

function InformationCard({ title, description, icon: Icon }) {
  return (
    <article className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-serif text-sm font-bold text-[#102f5e]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </div>
    </article>
  );
}

export default function AboutClinicSection() {
  return (
    <>
      <section
        aria-labelledby="about-title"
        className="relative isolate flex min-h-44 items-center overflow-hidden bg-[#102f5e] px-4 py-8 sm:min-h-52 sm:px-6 lg:px-8"
      >
        <img
          src={campusImage}
          alt=""
          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#102f5e]/95 via-[#102f5e]/75 to-[#102f5e]/25" />
        <div className="relative z-20 mx-auto w-full max-w-7xl text-white">
          <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
            Mekdela Amba University
          </p>
          <h1 id="about-title" className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
            About MAU Clinic System
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-100 sm:text-sm">
            Committed to providing accessible, quality and student-centered healthcare services
            for a healthier university community.
          </p>
        </div>
      </section>

      <section id="about" className="scroll-mt-32 bg-white px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-7 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {informationColumns.map((column, index) => (
            <div key={index} className="space-y-6">
              {column.map((item) => (
                <InformationCard key={item.title} {...item} />
              ))}
            </div>
          ))}

          <div className="space-y-6">
            <section aria-labelledby="about-services-title">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <HeartPulse size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="about-services-title" className="font-serif text-sm font-bold text-[#102f5e]">
                    Our Services
                  </h2>
                  <p className="text-xs text-slate-600">We provide the following clinic services:</p>
                </div>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {clinicServices.map(({ title, icon: Icon }) => (
                  <li
                    key={title}
                    className="flex min-h-10 items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-2 text-[11px] font-medium leading-4 text-slate-700"
                  >
                    <Icon size={16} className="shrink-0 text-sky-600" aria-hidden="true" />
                    {title}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="about-benefits-title">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <BadgeCheck size={18} aria-hidden="true" />
                </span>
                <h2 id="about-benefits-title" className="font-serif text-sm font-bold text-[#102f5e]">
                  Benefits of the System
                </h2>
              </div>
              <ul className="mt-2 space-y-1 pl-12">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-600">
                    <BadgeCheck size={13} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}

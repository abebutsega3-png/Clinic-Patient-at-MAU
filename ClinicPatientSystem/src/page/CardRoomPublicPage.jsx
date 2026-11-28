import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  ContactRound,
  CreditCard,
  FileText,
  History,
  ListOrdered,
  Mail,
  MapPin,
  Phone,
  Route,
  Search,
  Siren,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import Navbar from '../components/homedashboared/Navbar.jsx';
import Footer from '../components/homedashboared/Footer.jsx';
import WorkingHoursSection from '../components/homedashboared/WorkingHoursSection.jsx';

const clinicPhoto = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1800&q=85';

const services = [
  {
    title: 'Student Registration',
    description: 'Staff register students for clinic visits and maintain the correct patient record.',
    icon: UserRound,
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Student Identification',
    description: 'Confirm student identity before creating or updating a medical record.',
    icon: BadgeCheck,
    image: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Student Search',
    description: 'Authorized Card Room staff can find an existing student record when needed.',
    icon: Search,
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Medical Card Management',
    description: 'Create and maintain medical cards as part of the clinic registration process.',
    icon: CreditCard,
    image: 'https://images.unsplash.com/photo-1583911860205-72f8ac8ddcbe?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Visit History',
    description: 'Keep visit records available to authorized clinic staff for continuity of care.',
    icon: History,
    image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Patient Queue Management',
    description: 'Create a queue entry for a registered visit and support an orderly clinic flow.',
    icon: ListOrdered,
    image: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Department Routing',
    description: 'Direct each visit to the appropriate next department based on the care needed.',
    icon: Route,
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
  },
];

const steps = [
  { title: 'Student Arrival', icon: UserRound },
  { title: 'Student Identification', icon: ContactRound },
  { title: 'Registration', icon: BadgeCheck },
  { title: 'Create Visit', icon: FileText },
  { title: 'Generate Queue Number', icon: ListOrdered },
  { title: 'Send to Examination or Emergency Room', icon: Route },
];

export default function CardRoomPublicPage() {
  const [overview, setOverview] = useState(null);
  const [hoursError, setHoursError] = useState('');
  const [hoursLoading, setHoursLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadOverview = async () => {
      try {
        const response = await fetch('/api/public/clinic/overview', { signal: controller.signal });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result.data) {
          throw new Error(result?.message || 'Unable to load clinic information.');
        }
        setOverview(result.data);
        setHoursError('');
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error('Failed to load public clinic information:', loadError);
          setHoursError(loadError.message || 'Unable to load clinic information.');
        }
      } finally {
        if (!controller.signal.aborted) setHoursLoading(false);
      }
    };

    void loadOverview();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden bg-[#102f5e]">
          <img
            src={clinicPhoto}
            alt="Healthcare professional providing care in a clinic"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07152b]/90 via-[#102f5e]/75 to-[#102f5e]/45" />
          <div className="relative mx-auto flex min-h-[390px] max-w-7xl items-center px-4 py-16 sm:px-6 lg:min-h-[440px] lg:px-8">
            <div className="max-w-3xl text-white">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-100">
                Mekdela Amba University Clinic
              </p>
              <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Card Room</h1>
              <p className="mt-3 text-lg font-semibold text-sky-100 sm:text-xl">
                Student Registration &amp; Medical Records
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
                The Card Room is the clinic’s first point of contact for student identification, visit registration,
                medical cards, and guidance to the next care department.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#visit-registration"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#102f5e] transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Register Your Visit
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a
                  href="#public-queue-info"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/60 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Check Queue Status
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="about-card-room" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Your first stop at the clinic</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">About the Card Room</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                The Card Room is the first point of contact for students seeking clinic care. Staff verify student
                identification, manage medical cards, register visits, and guide patients to the appropriate clinic
                service. Visit information and medical records are handled through the clinic’s staff-only system.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white">
                <ContactRound size={25} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#102f5e]">Start with your student ID</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Bring your student identification to the Card Room so clinic staff can verify your details and help
                with registration.
              </p>
            </div>
          </div>
        </section>

        <section id="visit-registration" className="scroll-mt-32 bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <FileText size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold text-[#102f5e]">How to register your visit</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Students: visit the Card Room with your student ID. An authorized staff member will verify your
                  identity and register the visit in the secure clinic system. Public self-registration is not
                  available on this page; staff use the separate Staff Login to access registration tools.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Card Room services</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Services We Provide</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                These services support a clear, organized start to each clinic visit.
              </p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map(({ title, description, icon: Icon, image }) => (
                <li key={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative h-36 overflow-hidden bg-slate-100">
                    <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-[#102f5e]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how-card-room-works" className="scroll-mt-32 bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-9 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">A clear, guided process</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">How Card Room Works</h2>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map(({ title, icon: Icon }, index) => (
                <li key={title} className="relative flex min-h-28 items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon size={23} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Step {index + 1}</p>
                    <h3 className="mt-1 font-semibold text-slate-800">{title}</h3>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="absolute -right-3 z-10 hidden bg-slate-50 text-blue-500 lg:block" size={22} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="patient-flow" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Next department</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Patient Flow</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                After registration and queue assignment, Card Room staff guide the student to the next appropriate
                department.
              </p>
            </div>
            <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1.2fr] md:items-center">
              <div className="flex min-h-24 items-center justify-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
                <ContactRound className="shrink-0 text-blue-700" size={24} aria-hidden="true" />
                <span className="font-bold text-[#102f5e]">Card Room</span>
              </div>
              <ArrowRight className="mx-auto hidden text-sky-600 md:block" size={25} aria-hidden="true" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
                  <Stethoscope className="shrink-0 text-blue-700" size={23} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For clinical assessment</p>
                    <p className="mt-1 font-bold text-[#102f5e]">Examination Room</p>
                  </div>
                </div>
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5">
                  <Siren className="shrink-0 text-rose-700" size={23} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">For urgent care</p>
                    <p className="mt-1 font-bold text-rose-900">Emergency Room</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="public-queue-info" className="scroll-mt-32 bg-blue-50 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-start gap-4 rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Clock3 size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-[#102f5e]">Queue status</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Live queue status is not available on the public website. Please ask Card Room staff at the clinic
                for current queue guidance. Patient queue details remain within the staff system.
              </p>
            </div>
          </div>
        </section>

        <WorkingHoursSection overview={overview} loading={hoursLoading} error={hoursError} />

        <section id="card-room-contact" className="scroll-mt-32 bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Plan your visit</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Location &amp; Contact</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5">
                <MapPin className="mt-0.5 shrink-0 text-sky-700" size={21} aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-slate-800">Location</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Mekdela Amba University, Ethiopia</p>
                </div>
              </div>
              <a href="tel:+251583209653" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:bg-blue-50">
                <Phone className="mt-0.5 shrink-0 text-sky-700" size={21} aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-slate-800">Call the clinic</span>
                  <span className="mt-1 block text-sm text-slate-600">+251 583 20 9653</span>
                </span>
              </a>
              <a href="mailto:support@clinicmau.org" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:bg-blue-50">
                <Mail className="mt-0.5 shrink-0 text-sky-700" size={21} aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-slate-800">Email support</span>
                  <span className="mt-1 block break-all text-sm text-slate-600">support@clinicmau.org</span>
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

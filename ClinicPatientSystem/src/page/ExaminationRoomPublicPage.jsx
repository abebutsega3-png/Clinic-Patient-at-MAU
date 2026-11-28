import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ClipboardList,
  Clock3,
  FileHeart,
  FlaskConical,
  HeartPulse,
  Hospital,
  Microscope,
  Pill,
  Stethoscope,
  Thermometer,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/homedashboared/Navbar.jsx';
import Footer from '../components/homedashboared/Footer.jsx';
import WorkingHoursSection from '../components/homedashboared/WorkingHoursSection.jsx';
import { labTestCategories } from '../components/Examination Room/LabTestCatalog.js';

const heroImage = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1800&q=85';

const services = [
  {
    title: 'OPD Registration',
    description: 'Register outpatient visits and maintain confidential visit records.',
    icon: ClipboardList,
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Medical Consultation',
    description: 'Discuss health concerns with a healthcare professional.',
    icon: Stethoscope,
    image: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Vital Signs Assessment',
    description: 'Clinical assessment may include blood pressure, temperature, pulse, breathing rate and weight.',
    icon: HeartPulse,
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Physical Examination',
    description: 'A clinician examines symptoms and records relevant findings.',
    icon: UserRound,
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Laboratory Investigation',
    description: 'Clinicians can request the tests available in the clinic laboratory catalog.',
    icon: FlaskConical,
    image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
    href: '#laboratory-investigation',
  },
  {
    title: 'Diagnosis and Treatment',
    description: 'Assessment findings guide diagnosis, care decisions and follow-up.',
    icon: FileHeart,
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Prescription Services',
    description: 'Prescriptions include medicine, strength, dosage, frequency, duration and instructions.',
    icon: Pill,
    image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80',
    href: '#prescription-services',
  },
  {
    title: 'Patient Referral',
    description: 'When further care is needed, clinic staff prepare a referral for the appropriate destination.',
    icon: Hospital,
    image: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=800&q=80',
    href: '#referral-service',
  },
  {
    title: 'Medical Records and Follow-up',
    description: 'Authorized clinic staff use visit history to support continuity of care.',
    icon: FileHeart,
    image: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=800&q=80',
  },
];

const processSteps = [
  'Card Room registration',
  'Patient queue',
  'Medical examination',
  'Diagnosis',
  'Laboratory request, if needed',
  'Treatment',
  'Prescription',
  'Referral or follow-up',
];

const referrals = [
  { title: 'Emergency referral', description: 'Urgent cases can be referred for timely care at another health facility.' },
  { title: 'Non-emergency referral', description: 'A clinician may arrange a referral when additional assessment or services are needed.' },
  { title: 'Clinical referral details', description: 'The staff referral record captures findings, investigation results, diagnosis, reason, referring clinician and date.' },
];

export default function ExaminationRoomPublicPage() {
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
          <img src={heroImage} alt="Healthcare professional providing care in a clinic" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07152b]/90 via-[#102f5e]/75 to-[#102f5e]/40" />
          <div className="relative mx-auto flex min-h-[390px] max-w-7xl items-center px-4 py-16 sm:px-6 lg:min-h-[440px] lg:px-8">
            <div className="max-w-3xl text-white">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-100">
                Mekdela Amba University Clinic
              </p>
              <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Examination &amp; Medical Consultation</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
                Comprehensive outpatient medical examination, diagnosis, laboratory investigation, treatment and referral services for the university community.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#medical-services" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#102f5e] transition hover:bg-sky-50">
                  Explore Medical Services <ArrowRight size={17} aria-hidden="true" />
                </a>
                <Link to="/departments/card-room#public-queue-info" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/60 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20">
                  Check Patient Queue <Clock3 size={17} aria-hidden="true" />
                </Link>
                <Link to="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                  Staff Login <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <p className="mt-3 max-w-2xl text-xs leading-5 text-sky-100">
                Public queue guidance is available through the Card Room page. Patient-specific queue details are only available to authorized staff.
              </p>
            </div>
          </div>
        </section>

        <section id="about-examination-room" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Care for the university community</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">About the Examination Room</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                The Examination Room provides outpatient clinical assessment for students and other eligible members of the Mekdela Amba University community. After registration, a healthcare professional reviews the patient’s concern, assesses vital signs and examination findings, and decides whether tests, treatment, prescription, referral or follow-up are appropriate.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Individual visit records are handled in the authenticated clinic system and are not displayed on this public information page.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white"><Stethoscope size={25} aria-hidden="true" /></span>
              <h3 className="mt-4 text-lg font-bold text-[#102f5e]">A guided clinical visit</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Start at the Card Room with your patient card. Clinic staff will guide you through the queue and to the appropriate service.
              </p>
              <Link to="/departments/card-room" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-800 hover:text-blue-950">
                Card Room information <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section id="medical-services" className="scroll-mt-32 bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Examination Room services</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Medical Services</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Services are provided according to clinical assessment and the patient’s care needs.</p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map(({ title, description, icon: Icon, image, href }) => (
                <li key={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative h-36 overflow-hidden bg-slate-100">
                    <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon size={22} aria-hidden="true" /></span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-[#102f5e]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                    {href && <a href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-800 hover:text-blue-950">Learn more <ArrowRight size={15} aria-hidden="true" /></a>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="patient-examination-process" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-9 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">How to get medical care</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Patient Examination Process</h2>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step, index) => (
                <li key={step} className="flex min-h-24 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">{index + 1}</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Step {index + 1}</p>
                    <h3 className="mt-1 font-semibold text-slate-800">{step}</h3>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="laboratory-investigation" className="scroll-mt-32 bg-blue-50 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><Microscope size={24} aria-hidden="true" /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Available laboratory tests</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Laboratory Investigation</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  The following are the test options configured in the clinic’s laboratory request form. Your clinician will determine whether a test is needed; availability may vary.
                </p>
              </div>
            </div>
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {labTestCategories.map(({ name, items }) => (
                <li key={name} className="rounded-xl border border-blue-100 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={18} className="text-blue-700" aria-hidden="true" />
                    <h3 className="font-bold text-[#102f5e]">{name.replace(/^[IVX]+\.\s*/, '')}</h3>
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {items.map(([, testName]) => (
                      <li key={testName} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{testName}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="referral-service" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Continuity of care</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Patient Referral Service</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">A clinician may refer a patient when additional or higher-level care is required.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {referrals.map(({ title, description }, index) => (
                <article key={title} className={`rounded-xl border p-5 ${index === 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                  <h3 className={`font-bold ${index === 0 ? 'text-rose-900' : 'text-[#102f5e]'}`}>{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
            <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
              The clinic referral form lists Akesta General Hospital as a destination. The treating clinician confirms the appropriate destination for each referral.
            </p>
          </div>
        </section>

        <section id="prescription-services" className="scroll-mt-32 bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Pill size={24} aria-hidden="true" /></span>
            <div>
              <h2 className="font-serif text-xl font-bold text-[#102f5e] sm:text-2xl">Prescription Services</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                When medication is prescribed, the authenticated clinic system records the medicine, strength, dosage form, dose, frequency, duration, quantity and instructions. Prescriber evaluation and dispenser coordination remain within the staff workflow.
              </p>
            </div>
          </div>
        </section>

        <section id="patient-information-guide" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl items-start gap-8 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Before your visit</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Patient Information Guide</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Bring your patient card and follow clinic staff guidance during your visit.</p>
            </div>
            <ol className="space-y-3">
              {[
                'Obtain or confirm your patient card at the Card Room.',
                'Register your visit with clinic staff and follow the queue instructions.',
                'Share your symptoms and relevant history with the healthcare professional.',
                'Complete any requested investigation and follow the treatment instructions provided.',
                'Keep your follow-up guidance and attend a referral facility if one is arranged.',
              ].map((item, index) => (
                <li key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  <span className="font-bold text-blue-700">{index + 1}.</span><span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="related-departments" className="scroll-mt-32 bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-2xl font-bold text-[#102f5e]">Related Clinic Departments</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <RelatedDepartment title="Card Room" description="Patient cards, visit registration and queue guidance." href="/departments/card-room" icon={ClipboardList} />
              <RelatedDepartment title="Laboratory Room" description="Laboratory services supporting clinical assessment." href="/#department-laboratory-room" icon={FlaskConical} />
              <RelatedDepartment title="Dispensary Room" description="Medicine dispensing and pharmacy coordination." href="/#department-dispensary-room" icon={Pill} />
            </div>
          </div>
        </section>

        <div id="contact-and-hours" className="scroll-mt-32">
          <WorkingHoursSection overview={overview} loading={hoursLoading} error={hoursError} />
        </div>
        <section className="bg-white px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <Thermometer size={22} className="shrink-0 text-blue-700" aria-hidden="true" />
            <p className="text-sm leading-6 text-slate-700">For questions about your visit, contact the clinic using the contact details and current working hours shown above.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function RelatedDepartment({ title, description, href, icon: Icon }) {
  return (
    <Link to={href} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:bg-blue-50">
      <Icon size={21} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
      <span>
        <span className="block font-bold text-[#102f5e]">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span>
      </span>
    </Link>
  );
}

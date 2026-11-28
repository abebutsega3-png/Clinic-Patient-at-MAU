import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bandage,
  Clock3,
  HeartPulse,
  Hospital,
  Phone,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  Wind,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/homedashboared/Navbar.jsx';
import Footer from '../components/homedashboared/Footer.jsx';

const heroImage = 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=1800&q=85';
const verifiedClinicPhone = '+251583209653';

const services = [
  { title: 'Emergency Assessment', description: 'Rapid assessment helps identify immediate threats and the right level of care.', icon: Stethoscope, image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80' },
  { title: 'Triage', description: 'Patients are prioritized by clinical urgency so the most critical needs are seen first.', icon: Activity, image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80' },
  { title: 'Vital Signs Monitoring', description: 'Care teams monitor vital signs and reassess a patient’s condition as needed.', icon: HeartPulse, image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80' },
  { title: 'First Aid', description: 'Prompt first aid is provided while the patient is assessed and the next care steps are arranged.', icon: ShieldAlert, image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=800&q=80' },
  { title: 'Wound Care', description: 'Wounds are assessed and cared for according to clinical needs.', icon: Bandage, image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=800&q=80' },
  { title: 'Emergency Examination', description: 'A clinician examines urgent symptoms and documents relevant findings.', icon: Thermometer, image: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80' },
  { title: 'Emergency Stabilization', description: 'Immediate stabilization and ongoing monitoring are provided based on the patient’s condition.', icon: HeartPulse, image: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80' },
  { title: 'Emergency Referral', description: 'When further care is needed, clinic staff coordinate referral and patient transfer.', icon: Hospital, image: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=800&q=80' },
];

const urgentConditions = [
  { label: 'Severe bleeding', icon: Bandage },
  { label: 'Difficulty breathing', icon: Wind },
  { label: 'Severe injury', icon: ShieldAlert },
  { label: 'Fainting or loss of consciousness', icon: Activity },
  { label: 'Severe allergic reaction', icon: HeartPulse },
  { label: 'Other urgent or rapidly worsening conditions', icon: Stethoscope },
];

const careSteps = [
  'Patient arrival',
  'Triage',
  'Vital signs',
  'Emergency examination',
  'Immediate treatment',
  'Further investigation or procedure',
  'Monitoring, referral or discharge',
];

function formatTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':');
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function EmergencyRoomPublicPage() {
  const [clinicInfo, setClinicInfo] = useState(null);
  const [clinicInfoError, setClinicInfoError] = useState('');
  const [clinicInfoLoading, setClinicInfoLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const loadClinicInfo = async () => {
      try {
        const response = await fetch('/api/public/clinic/overview', { signal: controller.signal });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result.data) {
          throw new Error(result?.message || 'Clinic contact and working-hours information is unavailable.');
        }
        setClinicInfo(result.data);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to load public clinic information:', error);
          setClinicInfoError(error.message || 'Clinic contact and working-hours information is unavailable.');
        }
      } finally {
        if (!controller.signal.aborted) setClinicInfoLoading(false);
      }
    };
    void loadClinicInfo();
    return () => controller.abort();
  }, []);

  const allDayDepartments = clinicInfo?.workingHoursConfigured ? (clinicInfo.workingHours?.allDayDepartments || []) : [];
  const emergencyAllDay = allDayDepartments.some((name) => /emergency|triage/i.test(name));
  const emergencyPhone = clinicInfo?.emergencyPhone || verifiedClinicPhone;
  const workingDays = clinicInfo?.workingHours?.days || [];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section className="relative isolate overflow-hidden bg-[#102f5e]">
          <img src={heroImage} alt="Clinic staff providing urgent medical care" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07152b]/95 via-[#102f5e]/80 to-rose-950/45" />
          <div className="relative mx-auto flex min-h-[410px] max-w-7xl items-center px-4 py-16 sm:px-6 lg:min-h-[470px] lg:px-8">
            <div className="max-w-3xl text-white">
              <p className="inline-flex items-center gap-2 rounded-full border border-rose-200/40 bg-rose-500/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-100">
                <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
                Mekdela Amba University Clinic
              </p>
              <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Emergency Medical Services</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
                Immediate emergency assessment, medical care, stabilization and referral for the university community.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="#emergency-services" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#102f5e] transition hover:bg-sky-50">
                  Emergency Services <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a href="#emergency-care-process" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/60 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20">
                  Emergency Care Process <ArrowDownRight size={17} aria-hidden="true" />
                </a>
                <Link to="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700">
                  Staff Login <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-rose-100">
                <Clock3 size={15} aria-hidden="true" />
                {emergencyAllDay ? 'Emergency and triage service is configured for all-day coverage.' : 'For urgent needs, contact the clinic using its published contact details.'}
              </p>
            </div>
          </div>
        </section>

        <section id="about-emergency-room" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Urgent care for the university community</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">About the Emergency Room</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                The university clinic Emergency Room provides prompt assessment and initial care for urgent health concerns. The team prioritizes patients by clinical need, monitors their condition, provides appropriate immediate treatment and coordinates further investigation or referral when needed.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Emergency patients are taken directly for triage and are not required to wait for routine Card Room registration before urgent assessment. Authorized clinic staff securely record patient and visit information in the clinical system.
              </p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white"><HeartPulse size={25} aria-hidden="true" /></span>
              <h3 className="mt-4 text-lg font-bold text-[#102f5e]">Urgency comes first</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Tell clinic staff immediately if someone has a severe or rapidly worsening condition. Triage determines the order of care based on clinical urgency.</p>
              <a href="#emergency-contact" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-rose-800 hover:text-rose-950">
                Clinic contact information <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section id="emergency-services" className="scroll-mt-32 bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Emergency Room services</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Emergency Medical Services</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Care is based on the patient’s immediate condition and assessment by clinic staff.</p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map(({ title, description, icon: Icon, image }) => (
                <li key={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative h-36 overflow-hidden bg-slate-100">
                    <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-rose-700 shadow-sm"><Icon size={22} aria-hidden="true" /></span>
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

        <section id="emergency-conditions" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">When urgent assessment may be needed</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Emergency Conditions</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Examples include, but are not limited to:</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {urgentConditions.map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-4 text-sm font-semibold text-slate-800">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700"><Icon size={20} aria-hidden="true" /></span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="emergency-care-process" className="scroll-mt-32 bg-[#102f5e] px-4 py-14 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-9 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">A patient-centred pathway</p>
              <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">Emergency Care Process</h2>
              <p className="mt-3 text-sm leading-6 text-slate-200">The sequence may adapt to the patient’s condition and immediate clinical needs.</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {careSteps.map((step, index) => (
                <li key={step} className="flex min-h-24 items-center gap-4 rounded-xl border border-white/15 bg-white/5 p-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${index < 2 ? 'bg-rose-500 text-white' : 'bg-sky-200 text-[#102f5e]'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-semibold leading-5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="emergency-referral" className="scroll-mt-32 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Continuity of urgent care</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Emergency Referral &amp; Transfer</h2>
            </div>
            <div className="space-y-4 text-sm leading-7 text-slate-600">
              <p>If care beyond the clinic’s available services is required, the clinical team may arrange referral to an external hospital. Staff document the assessment, reason for referral, relevant investigations and treatment provided.</p>
              <p>Transfer details are recorded and communicated to support continuity of care. The patient’s condition is monitored and stabilized as appropriate while referral arrangements are made.</p>
            </div>
          </div>
        </section>

        <section id="emergency-contact" className="scroll-mt-32 bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Contact &amp; location</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#102f5e] sm:text-3xl">Emergency Contact and Location</h2>
              <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
                <p className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                  <Hospital size={20} className="mt-0.5 shrink-0 text-rose-700" aria-hidden="true" />
                  <span><strong className="block text-[#102f5e]">Mekdela Amba University Clinic</strong>Mekdela Amba University, Ethiopia</span>
                </p>
                {emergencyPhone && (
                  <p className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Phone size={18} aria-hidden="true" /></span>
                    <span>Clinic contact: <a href={`tel:${emergencyPhone.replace(/[^\d+]/g, '')}`} className="font-bold text-blue-800 hover:text-blue-950">{emergencyPhone}</a></span>
                  </p>
                )}
                {clinicInfoLoading && <p role="status" className="text-sm text-slate-500">Loading verified clinic contact and hours…</p>}
                {!clinicInfoLoading && !emergencyPhone && <p className="text-sm text-slate-600">Clinic contact details are unavailable right now. Please use the contact information in the website header or footer.</p>}
                {emergencyAllDay && <p className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">Emergency and triage service: All-day coverage, as configured by the clinic.</p>}
                {clinicInfoError && <p role="status" className="text-sm text-amber-800">{clinicInfoError}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white p-6 sm:p-8">
              <h3 className="flex items-center gap-2 font-bold text-[#102f5e]"><Clock3 size={19} aria-hidden="true" /> Clinic Working Hours</h3>
              {clinicInfo?.workingHoursConfigured && workingDays.length ? (
                <ul className="mt-4 divide-y divide-slate-100 text-sm">
                  {workingDays.map(({ day, open, close, closed }) => (
                    <li key={day} className="flex items-center justify-between gap-4 py-2.5 text-slate-600">
                      <span>{day}</span><span className="font-semibold text-slate-800">{closed ? 'Closed' : `${formatTime(open)} – ${formatTime(close)}`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-600">Current clinic working hours are not available. Please contact the clinic using its published contact details.</p>
              )}
              {allDayDepartments.length > 0 && (
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
                  All-day services configured by the clinic: <strong className="text-slate-800">{allDayDepartments.join(', ')}</strong>
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

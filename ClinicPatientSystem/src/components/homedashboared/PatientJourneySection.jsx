import { ArrowRight, ClipboardPlus, FlaskConical, Stethoscope, Pill, Activity } from 'lucide-react';

const steps = [
  { title: 'Registration', description: 'Register your visit and confirm your details.', icon: ClipboardPlus },
  { title: 'Triage', description: 'Get an initial assessment and care priority.', icon: Activity },
  { title: 'Consultation & Diagnosis', description: 'A general practitioner assesses your concern and recommends care.', icon: Stethoscope },
  { title: 'Laboratory', description: 'Complete any tests requested by your clinician.', icon: FlaskConical },
  { title: 'Pharmacy', description: 'Receive prescription guidance and medicines.', icon: Pill },
];

export default function PatientJourneySection() {
  return (
    <section id="how-it-works" className="scroll-mt-32 bg-sky-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700">How It Works</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#102f5e] sm:text-3xl">
            Your clinic visit, step by step
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Patient flow helps you understand where to go next during your visit.
          </p>
        </div>

        <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(({ title, description, icon: Icon }, index) => (
            <li key={title} className="relative rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-sky-700">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-bold text-[#102f5e]">{title}</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
              {index < steps.length - 1 && (
                <ArrowRight size={18} className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-sky-500 lg:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { PhoneCall } from 'lucide-react';
import { clinicServices } from '../../data/clinicServices.js';

export default function ServicesSection({ emergencyPhone }) {
  const phoneHref = emergencyPhone?.replace(/[^\d+]/g, '');

  return (
    <section id="services" className="scroll-mt-32 bg-slate-50 px-4 py-20 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Our Services</p>
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Clinic Services
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Explore the care and support available to you at the clinic.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clinicServices.map(({ title, description, icon: Icon, emergency }) => (
            <article
              key={title}
              className={`rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
                emergency
                  ? 'border-rose-300 shadow-sm'
                  : 'border-slate-200 hover:border-teal-300'
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className={`inline-flex rounded-xl p-3 ${
                  emergency ? 'bg-rose-100 text-rose-600' : 'bg-teal-50 text-teal-700'
                }`}>
                  <Icon size={24} aria-hidden="true" />
                </span>
                {emergency && (
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                    Emergency
                  </span>
                )}
              </div>

              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

              {emergency && phoneHref && (
                <a
                  href={`tel:${phoneHref}`}
                  className="mt-4 inline-flex items-center gap-2 border-t border-rose-100 pt-3 text-sm font-semibold text-rose-700 hover:text-rose-900"
                >
                  <PhoneCall size={16} aria-hidden="true" />
                  {emergencyPhone}
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Mail, MapPin, Phone, Send } from 'lucide-react';

const contactDetails = [
  {
    title: 'Mekdela Amba University Clinic',
    detail: 'Clinic support and patient information',
    icon: Building2,
  },
  {
    title: 'Location',
    detail: 'Mekdela Amba University, Ethiopia',
    icon: MapPin,
  },
];

export default function ContactUs() {
  const [notice, setNotice] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name').trim();
    const email = formData.get('email').trim();
    const topic = formData.get('topic');
    const message = formData.get('message').trim();
    const subject = encodeURIComponent(`Clinic enquiry: ${topic}`);
    const body = encodeURIComponent(
      `Name: ${name}\nReply email: ${email}\nTopic: ${topic}\n\n${message}`,
    );

    setNotice('Your email app should open with this message ready. It will only be sent after you press Send in that app.');
    window.location.href = `mailto:support@clinicmau.org?subject=${subject}&body=${body}`;
  };

  return (
    <main>
      <section className="bg-[#101d3b] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-sm text-sky-200">
            <Link to="/" className="hover:text-white">Home</Link>
            <ChevronRight size={16} aria-hidden="true" />
            <span aria-current="page" className="font-semibold text-white">Contact Us</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Contact Us</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
            Have a question about clinic services or visiting the clinic? Our support team is ready to help.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="border-b border-slate-100 pb-4 text-xl font-bold text-[#102f5e]">
              Contact Information
            </h2>
            <ul className="mt-6 space-y-5">
              {contactDetails.map(({ title, detail, icon: Icon }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-900">{title}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">{detail}</span>
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                  <Mail size={19} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-slate-900">Email</span>
                  <a href="mailto:support@clinicmau.org" className="mt-0.5 block text-sm text-sky-700 hover:underline">
                    support@clinicmau.org
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                  <Phone size={19} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-slate-900">Phone</span>
                  <a href="tel:+251583209653" className="mt-0.5 block text-sm text-sky-700 hover:underline">
                    +251 583 20 9653
                  </a>
                </span>
              </li>
            </ul>
            <Link to="/working-hours" className="mt-7 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900">
              View clinic working hours <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title" className="text-xl font-bold text-[#102f5e]">Contact Clinic Support</h2>
            <p className="mt-2 text-sm text-slate-600">
              Complete the form to prepare an email to the clinic support team.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Full Name <span aria-hidden="true">*</span>
                  <input
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={120}
                    placeholder="Enter your full name"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Email Address <span aria-hidden="true">*</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="you@example.com"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Topic <span aria-hidden="true">*</span>
                <select
                  name="topic"
                  required
                  defaultValue=""
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="" disabled>Select a topic</option>
                  <option>Clinic services</option>
                  <option>Working hours</option>
                  <option>Appointments</option>
                  <option>General question</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Message <span aria-hidden="true">*</span>
                <textarea
                  name="message"
                  required
                  maxLength={3000}
                  rows={5}
                  placeholder="How can we help?"
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <p className="text-xs leading-5 text-slate-500">
                For your privacy, do not include sensitive medical details in this message. For urgent medical help, call the clinic.
              </p>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Send size={16} aria-hidden="true" />
                Prepare Email
              </button>
              {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
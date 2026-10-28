import { Mail, MapPin, Phone } from 'lucide-react';
import { FaGoogle, FaInstagram, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import { Link } from 'react-router-dom';

const currentYear = new Date().getFullYear();

const quickLinks = [
  { label: 'Home', href: '/' },
  { label: 'Clinic Services', href: '/services' },
  { label: 'Appointments', href: '/appointments' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
];

const clinicLinks = [
  { label: 'Book an Appointment', href: '/appointments' },
  { label: 'Patient Services', href: '/services' },
  { label: 'Patient Portal', href: '/login' },
];

const supportLinks = [
  { label: 'Email Support', href: 'mailto:support@clinicmau.org' },
  { label: 'Call the Clinic', href: 'tel:+251583209653' },
  { label: 'Clinic Services', href: '/services' },
  { label: 'Appointments', href: '/appointments' },
];

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/explore/search/keyword/?q=Mekdela%20Amba%20University', icon: FaInstagram },
  { label: 'YouTube', href: 'https://www.youtube.com/results?search_query=Mekdela+Amba+University', icon: FaYoutube },
  { label: 'Google', href: 'https://www.google.com/search?q=Mekdela+Amba+University', icon: FaGoogle },
  { label: 'X', href: 'https://x.com/search?q=Mekdela%20Amba%20University', icon: FaXTwitter },
];

export default function Footer() {
  return (
    <footer className="bg-[#07152b] text-slate-200">
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-9 px-5 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(0,1.2fr)]">
        <div id="contact" className="min-w-0 scroll-mt-20 space-y-4 text-sm leading-6">
          <h2 className="text-base font-bold uppercase tracking-wide text-amber-400">Contact Us</h2>
          <p className="flex items-start gap-3">
            <MapPin size={20} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
            <span>Mekdela Amba University, Ethiopia</span>
          </p>
          <a href="mailto:support@clinicmau.org" className="flex items-center gap-3 hover:text-white">
            <Mail size={20} className="shrink-0 text-amber-400" aria-hidden="true" />
            <span>support@clinicmau.org</span>
          </a>
          <a href="tel:+251583209653" className="flex items-center gap-3 hover:text-white">
            <Phone size={20} className="shrink-0 text-amber-400" aria-hidden="true" />
            <span>+251 583 20 9653</span>
          </a>
        </div>

        <FooterLinkList title="Quick Links" links={quickLinks} />
        <FooterLinkList title="Clinic Services" links={clinicLinks} />
        <FooterLinkList title="Help & Support" links={supportLinks} />

        <div className="min-w-0">
          <p className="text-sm leading-6 text-slate-300">
            Our goal is to make accessing clinic services simple, efficient, and patient friendly.
          </p>
          <div className="my-6 border-t border-slate-700" />
          <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-amber-400">Follow Us</h2>
          <div className="flex gap-3">
            {socialLinks.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={`Search for Mekdela Amba University on ${label}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <Icon size={21} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-700 px-4 py-4 text-center text-xs text-slate-400">
        © {currentYear} Mekdela Amba University Clinic System. All rights reserved.
      </div>
    </footer>
  );
}

function FooterLinkList({ title, links }) {
  return (
    <nav aria-label={title} className="min-w-0">
      <h2 className="mb-4 text-base font-bold uppercase tracking-wide text-amber-400">{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {links.map(({ label, href }) => (
          <li key={label}>
            {href.startsWith('/') ? (
              <Link to={href} className="transition-colors hover:text-white">
                {label}
              </Link>
            ) : (
              <a href={href} className="transition-colors hover:text-white">
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
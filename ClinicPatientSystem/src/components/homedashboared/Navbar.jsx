import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, Mail, Menu, Phone, ShieldPlus, X } from 'lucide-react';
import { FaFacebookF, FaXTwitter } from 'react-icons/fa6';

const navigation = [
  { label: 'Home', href: '/' },
  { label: 'About Us', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Working Hours', href: '/working-hours' },
  { label: 'Contact Us', href: '/contact' },
];

const socialLinks = [
  {
    label: 'Search Mekdela Amba University on Facebook',
    href: 'https://www.facebook.com/search/top?q=Mekdela%20Amba%20University',
    icon: FaFacebookF,
  },
  {
    label: 'Search Mekdela Amba University on X',
    href: 'https://x.com/search?q=Mekdela%20Amba%20University',
    icon: FaXTwitter,
  },
];

export default function Navbar() {
  const { pathname, hash } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(hash.slice(1));

  useEffect(() => {
    const updateActiveSection = () => {
      if (pathname !== '/') {
        setActiveSection('');
        return;
      }

      const headerHeight = document.querySelector('header')?.offsetHeight || 0;
      const activationLine = window.scrollY + headerHeight + 24;
      const sections = ['services', 'how-it-works', 'working-hours', 'contact']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      const currentSection = sections
        .filter((section) => section.getBoundingClientRect().top + window.scrollY <= activationLine)
        .at(-1);

      setActiveSection(currentSection?.id || '');
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [hash, pathname]);

  const isActive = (href) => {
    if (href === '/') return pathname === '/' && !activeSection;
    if (href === '/about') return pathname === '/about';
    if (href === '/services') return pathname === '/services' || (pathname === '/' && activeSection === 'services');
    if (href === '/working-hours') return pathname === '/working-hours' || (pathname === '/' && activeSection === 'working-hours');
    if (href === '/contact') return pathname === '/contact' || (pathname === '/' && activeSection === 'contact');
    return pathname === '/' && activeSection === href.slice(2);
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-sky-500 text-white">
        <div className="mx-auto flex min-h-8 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 text-xs sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <a href="tel:+251583209653" className="inline-flex items-center gap-1.5 hover:text-sky-100">
              <Phone size={13} aria-hidden="true" />
              +251 583 20 9653
            </a>
            <a href="mailto:support@clinicmau.org" className="hidden items-center gap-1.5 hover:text-sky-100 sm:inline-flex">
              <Mail size={13} aria-hidden="true" />
              support@clinicmau.org
            </a>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Link to="/login" className="inline-flex items-center gap-1.5 hover:text-sky-100">
              <LogIn size={13} aria-hidden="true" />
              Login
            </Link>
            <div className="hidden items-center gap-3 sm:flex">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sky-100"
                >
                  <Icon size={13} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-b border-slate-100 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="Mekdela Amba University Clinic home"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white">
              <ShieldPlus size={27} aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-[#102f5e] sm:text-base">
                Mekdela Amba University
              </span>
              <span className="block text-xs font-medium text-sky-600 sm:text-sm">Clinic System</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-4 lg:flex xl:gap-6">
            {navigation.map(({ label, href }) => (
              href.startsWith('/') && !href.startsWith('/#') ? (
                <Link
                  key={href}
                  to={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={`border-b-2 px-0.5 py-2 text-sm transition-colors hover:border-blue-600 hover:text-blue-700 ${
                    isActive(href) ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-slate-700'
                  }`}
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={`border-b-2 px-0.5 py-2 text-sm transition-colors hover:border-blue-600 hover:text-blue-700 ${
                    isActive(href) ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-slate-700'
                  }`}
                >
                  {label}
                </a>
              )
            ))}
          </nav>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 lg:hidden"
          >
            {mobileMenuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </button>

          {mobileMenuOpen && (
            <nav
              aria-label="Mobile navigation"
              className="absolute left-0 right-0 top-full flex flex-col border-t border-blue-100 bg-white px-4 py-3 shadow-lg lg:hidden"
            >
              {navigation.map(({ label, href }) => (
                href.startsWith('/') && !href.startsWith('/#') ? (
                  <Link
                    key={href}
                    to={href}
                    aria-current={isActive(href) ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-blue-50 hover:text-blue-700 ${
                      isActive(href) ? 'text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {label}
                  </Link>
                ) : (
                  <a
                    key={href}
                    href={href}
                    aria-current={isActive(href) ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-blue-50 hover:text-blue-700 ${
                      isActive(href) ? 'text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {label}
                  </a>
                )
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

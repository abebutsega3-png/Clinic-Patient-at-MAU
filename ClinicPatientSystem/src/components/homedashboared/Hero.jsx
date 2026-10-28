import { ArrowRight, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import campusImage from '../../assets/image1.png';

export default function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[460px] items-center justify-center overflow-hidden bg-[#102f5e] px-4 py-12 sm:h-[min(70vw,720px)] sm:min-h-[520px] sm:px-6"
    >
      <img
        src={campusImage}
        alt="Mekdela Amba University campus"
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/25 via-[#102f5e]/30 to-slate-950/60" />

      <div className="relative z-20 w-full max-w-5xl rounded-sm bg-blue-900/75 px-6 py-8 text-center text-white shadow-xl backdrop-blur-sm sm:px-12 sm:py-9 lg:px-20 lg:py-10">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-sky-100">
          <Stethoscope size={15} aria-hidden="true" />
          Mekdela Amba University
        </p>
        <h1 id="hero-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          University Clinic
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-100 sm:text-lg sm:leading-7">
          Patient care, connected from registration through consultation and treatment.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-blue-800 transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Stethoscope size={16} aria-hidden="true" />
            Login to Clinic System
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Patient Flow
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

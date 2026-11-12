import { ArrowRight } from 'lucide-react';
import campusImage from '../../assets/image1.png';

export default function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[360px] items-center overflow-hidden bg-[#102f5e] px-4 py-12 sm:px-6 lg:px-8"
    >
      <img
        src={campusImage}
        alt="Mekdela Amba University campus"
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#102f5e]/95 via-[#102f5e]/75 to-[#102f5e]/35" />

      <div className="relative z-20 mx-auto w-full max-w-5xl text-white">
        <p className="mb-5 inline-flex items-center rounded-full bg-white/20 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
          Mekdela Amba University
        </p>
        <h1 id="hero-title" className="font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          University Clinic
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-100 sm:text-base">
          Patient care for our university community, from registration and consultation through treatment and follow-up.
        </p>
        <div className="mt-6">
          <a
            href="#services"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore our services
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

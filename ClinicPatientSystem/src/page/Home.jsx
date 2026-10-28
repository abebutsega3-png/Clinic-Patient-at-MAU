import { useEffect, useState } from 'react';
import axios from 'axios';
import apiBaseUrl from '../until/apiBaseUrl';
import { Link } from 'react-router-dom';
function SectionHeading({ eyebrow, title }) {
  return (
    <div className="text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#002147] font-extrabold">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{title}</h2>
    </div>
  );
}
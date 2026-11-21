import { useState } from 'react';
import { ArrowRight, Printer, Search, Share2 } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
};

const formatClinicalDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
};

const fullName = (visit) => visit?.patientRecordId?.fullName || visit?.patientName || 'Patient';
const recordNumber = (visit) => visit?.patientRecordId?.cardNumber || visit?.patientId || '—';

function PaperField({ label, value, lines = 1 }) {
  return (
    <div className="flex items-start gap-2 font-serif text-[11px] leading-[25px]">
      <strong className="shrink-0">{label}</strong>
      <div
        className="relative min-w-0 flex-1"
        style={{
          minHeight: `${lines * 25}px`,
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 23px, #9ca3af 24px, transparent 25px)',
          backgroundSize: '100% 25px',
        }}
      >
        <span className="relative z-10 block whitespace-pre-wrap bg-white/70">{value || ''}</span>
      </div>
    </div>
  );
}

function PaperIdentity({ label, value, className = '' }) {
  return (
    <p className={`flex min-w-0 items-end gap-1 font-serif text-[10px] ${className}`}>
      <strong className="shrink-0">{label}</strong>
      <span className="min-w-0 flex-1 border-b border-dotted border-slate-500 px-1 pb-0.5">{value || ''}</span>
    </p>
  );
}

function ReferralSlip({ visit }) {
  const patient = visit?.patientRecordId || {};
  const examination = visit?.examination || {};
  const referral = examination.referral || {};
  const vitals = examination.vitals || {};
  const prescriptions = examination.prescriptions || [];
  const labRequests = examination.labRequests || [];
  const examiner = examination.examiner?.name
    ? examination.examiner
    : examination.prescriber?.name
      ? examination.prescriber
      : { name: referral.referredBy, qualification: referral.qualification };
  const referralNumber = `REF-${String(visit?._id || '').slice(-8).toUpperCase() || '—'}`;
  const investigation = labRequests.map((item) => {
    const result = item.result ? `: ${item.result}${item.unit ? ` ${item.unit}` : ''}` : '';
    return `${item.testName || item.testCode || 'Lab test'}${result}`;
  }).join('; ');
  const prescriptionText = prescriptions.map((item) => [
    item.medicine || item.name,
    item.strength,
    item.dose || item.dosage,
    item.frequency,
    item.duration,
  ].filter(Boolean).join(' ')).join('; ');
  const address = patient.address
    || [patient.dormBlock, patient.woreda, patient.kebele].filter(Boolean).join(', ');
  const serviceDate = formatDate(visit?.visitDate);
  const referralDate = formatClinicalDate(referral.referredAt || visit?.visitDate);

  if (!visit) {
    return (
      <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        <div>
          <Share2 className="mx-auto mb-2 text-slate-300" size={28} />
          <p className="font-semibold">Select a referral to view its slip.</p>
        </div>
      </div>
    );
  }

  return (
    <article className="referral-slip-print mx-auto min-h-[1000px] w-full max-w-[794px] border border-slate-300 bg-white px-8 py-9 shadow-sm sm:px-12 sm:py-12">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body * { visibility: hidden !important; }
          .referral-slip-print, .referral-slip-print * { visibility: visible !important; }
          .referral-slip-print { position: fixed !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; color: #111827 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .referral-slip-screen-only { display: none !important; }
        }
      `}</style>

      <header className="grid grid-cols-2 items-start gap-3 font-serif text-[10px]">
        <div className="pt-1 text-slate-700">
          <p>Ref No: {referralNumber}</p>
          <p>Service date: {serviceDate}</p>
        </div>
        <div className="text-right leading-relaxed text-slate-700">
          <p className="font-bold">Mekdela Amba University</p>
          <p>Tulu Awuliya Campus</p>
          <p>Student Clinic</p>
          <p>Date: {referralDate}</p>
        </div>
      </header>

      <section className="mt-5 space-y-2 font-serif text-[11px]">
        <h2 className="font-bold">Referral Slip</h2>
        {visit.status !== 'Completed' && (
          <p className="text-[10px] font-bold text-rose-700">DRAFT — NOT YET ISSUED</p>
        )}
        <div className="flex flex-wrap items-end gap-x-2">
          <strong className="shrink-0">Referred to</strong>
          <span className="min-w-[220px] flex-1 border-b border-dotted border-slate-500 px-1 pb-0.5">
            {referral.department || ''}
          </span>
          <strong className="shrink-0">
            {referral.emergency ? '[X] Emergency' : '[ ] Emergency'}
          </strong>
          <strong className="shrink-0">
            {referral.emergency ? '[ ] Non Emergency' : '[X] Non Emergency'}
          </strong>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[9px]">
          <p>OPD Referral Code: {examination.opd?.referredCode || ''}</p>
          <p>Visit: {String(visit.visitType || '').startsWith('New') ? 'New' : 'Repeat'}</p>
        </div>
      </section>

      <section className="mt-4 space-y-2 border-b border-slate-300 pb-3">
        <div className="grid grid-cols-[minmax(0,2fr)_0.7fr_0.45fr_minmax(0,1fr)] gap-x-3">
          <PaperIdentity label="Name" value={fullName(visit)} />
          <PaperIdentity label="Sex" value={patient.sex} />
          <PaperIdentity label="Age" value={patient.age} />
          <PaperIdentity label="Card No" value={recordNumber(visit)} />
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <PaperIdentity label="ID No" value={patient.universityIdNumber || patient.governmentIdNumber} />
          <PaperIdentity label="Address" value={address} />
        </div>
      </section>

      <section className="mt-3 space-y-1">
        <PaperField label="C/C" value={examination.chiefComplaint} />
        <PaperField label="HPI" value={examination.historyOfPresentIllness} lines={3} />
        <PaperField label="P/E" value={examination.physicalExamination} lines={2} />
        <div className="flex flex-wrap items-end gap-x-4 border-b border-dotted border-slate-500 py-1 font-serif text-[10px]">
          <strong>V/S:</strong>
          <span>T° {vitals.temperature || '________'}</span>
          <span>BP {vitals.bloodPressure || '________'}</span>
          <span>RR {vitals.respiratoryRate || '________'} /minute</span>
          <span>PR {vitals.pulse || '________'} /minute</span>
        </div>
        <PaperField label="Review of System" value={examination.reviewOfSystem} />
        <PaperField label="Investigation" value={investigation} />
        <PaperField label="Diagnosis" value={visit.diagnosis || examination.hmisDiagnosis} />
        <PaperField label="Rx" value={prescriptionText} lines={2} />
        <PaperField label="Reason for referral" value={referral.reason} />
      </section>

      <footer className="mt-5 grid grid-cols-[1.2fr_1fr_0.8fr_1fr] gap-x-3 border-t border-slate-300 pt-2 font-serif text-[9px]">
        <PaperIdentity label="Referred By" value={examiner.name || referral.referredBy} />
        <PaperIdentity label="Qualification" value={examiner.qualification || referral.qualification} />
        <PaperIdentity label="Sign" value={visit.status === 'Completed' && examiner.signedAt ? 'Electronically signed' : ''} />
        <PaperIdentity label="Date" value={referralDate} />
      </footer>

      <div className="referral-slip-screen-only mt-4 flex justify-end">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700">
          <Printer size={14} /> Print Referral Slip
        </button>
      </div>
    </article>
  );
}

export default function PatientReferrals({
  referrals = [],
  search,
  onSearchChange,
  activePatient,
  loading = false,
  error = '',
  notice = '',
  onOpenConsultation,
}) {
  const [selectedId, setSelectedId] = useState('');
  const normalizedSearch = String(search || '').trim().toLowerCase();
  const filteredReferrals = referrals.filter((visit) => [
    fullName(visit),
    recordNumber(visit),
    visit.patientRecordId?.universityIdNumber,
    visit.examination?.referral?.department,
    visit.examination?.referral?.reason,
    visit.diagnosis,
  ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)));
  const selectedReferral = filteredReferrals.find((visit) => String(visit._id) === selectedId)
    || filteredReferrals[0]
    || null;

  return (
    <section className="space-y-4 text-slate-900">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Patient Referrals</h1>
          <p className="mt-1 text-sm text-slate-500">Issued referrals · MAU Student Clinic Referral Slip</p>
        </div>
        {activePatient && (
          <button type="button" onClick={onOpenConsultation} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Continue {activePatient.name}'s consultation <ArrowRight size={15} />
          </button>
        )}
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.4fr)]">
        <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3">
            <label className="relative block">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search || ''}
                onChange={(event) => onSearchChange?.(event.target.value)}
                placeholder="Search name, MRN, destination, diagnosis"
                className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-500"
              />
            </label>
          </div>
          <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {filteredReferrals.map((visit) => {
              const isSelected = String(visit._id) === String(selectedReferral?._id);
              return (
                <button
                  key={visit._id}
                  type="button"
                  onClick={() => setSelectedId(String(visit._id))}
                  className={`w-full px-3 py-3 text-left hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <strong className="block truncate text-xs text-slate-900">{fullName(visit)}</strong>
                      <span className="mt-1 block text-[10px] text-slate-500">{recordNumber(visit)} · {formatDate(visit.visitDate)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${visit.examination?.referral?.emergency ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'}`}>
                      {visit.examination?.referral?.emergency ? 'Emergency' : 'Non Emergency'}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-slate-600">
                    {visit.examination?.referral?.department || 'Destination not recorded'} · {visit.diagnosis || 'Diagnosis not recorded'}
                  </span>
                </button>
              );
            })}
            {!filteredReferrals.length && (
              <p className="p-5 text-center text-xs text-slate-500">
                {loading ? 'Loading referrals…' : 'No referral records match this search.'}
              </p>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <ReferralSlip visit={selectedReferral} />
        </div>
      </div>
    </section>
  );
}

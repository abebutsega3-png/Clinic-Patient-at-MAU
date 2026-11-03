import { useEffect, useRef, useState } from 'react';
import { Printer, Plus, Trash2 } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const newMedicine = () => ({
  medicine: '',
  strength: '',
  form: '',
  dose: '',
  frequency: '',
  duration: '',
  quantity: '',
  quantityUnit: '',
  instructions: '',
  priceCents: 0,
});

const inputClass = 'min-h-8 w-full min-w-0 border-b border-slate-300 bg-transparent px-1 py-1 text-[18px] leading-tight text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 print:min-h-0 print:border-0 print:p-0 print:text-[8px]';

function AutoGrowTextarea({ value, onChange, className = '', ...props }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      rows={1}
      className={`${inputClass} resize-none whitespace-pre-wrap [overflow-wrap:anywhere] ${className}`}
    />
  );
}

export default function PrescriptionPaper({ visit, doctor, onNewPrescription, onSubmit, saving = false }) {
  const patient = visit?.patientRecordId && typeof visit.patientRecordId === 'object'
    ? visit.patientRecordId
    : {};
  const examination = visit?.examination || {};
  const existingPrescriptions = examination.prescriptions || [];
  const prescriber = examination.prescriber || {};
  const paperRef = useRef(null);
  const [prescriptions, setPrescriptions] = useState(() => existingPrescriptions.length
    ? existingPrescriptions.map((item) => ({ ...newMedicine(), ...item, dose: item.dose || item.dosage || '' }))
    : [newMedicine()]);
  const [weight, setWeight] = useState(examination.vitals?.weight || '');
  const [diagnosis, setDiagnosis] = useState(visit?.diagnosis || '');
  const [patientType, setPatientType] = useState(examination.prescriptionPatientType || 'outpatient');
  const patientName = visit?.name || visit?.patientName || patient.fullName || '—';
  const cardNumber = visit?.cardNumber || patient.cardNumber || visit?.patientId || '—';
  const idNumber = visit?.governmentIdNumber || patient.governmentIdNumber
    || visit?.studentId || patient.universityIdNumber || visit?.patientId || '—';
  const phone = visit?.telephone || patient.phoneNumber || '—';
  const hasPrescription = prescriptions.some((item) => item.medicine?.trim());
  const status = examination.prescriptionStatus || (existingPrescriptions.length ? 'Pending' : '');

  const updateMedicine = (index, field, value) => {
    setPrescriptions((items) => items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };
  const submit = (event) => {
    event.preventDefault();
    const items = prescriptions.filter((item) => item.medicine.trim()).map((item) => ({
      medicine: item.medicine.trim(),
      strength: item.strength.trim(),
      form: item.form.trim(),
      dose: item.dose.trim(),
      frequency: item.frequency.trim(),
      duration: item.duration.trim(),
      quantity: item.quantity.trim(),
      quantityUnit: item.quantityUnit.trim(),
      instructions: item.instructions.trim(),
    }));
    if (items.length) onSubmit?.({ prescriptions: items, diagnosis, weight, prescriptionPatientType: patientType });
  };
  const printPaper = () => {
    paperRef.current?.classList.add('prescription-paper-print-target');
    window.print();
    paperRef.current?.classList.remove('prescription-paper-print-target');
  };
  const priceInBirr = (item) => Math.floor((item.priceCents || 0) / 100);
  const priceInCents = (item) => String((item.priceCents || 0) % 100).padStart(2, '0');
  const totalCents = existingPrescriptions.reduce((sum, item) => sum + (Number(item.priceCents) || 0), 0);

  return (
    <article ref={paperRef} className="prescription-paper-record space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-800">{patientName}</h2>
          <p className="text-xs text-slate-500">{cardNumber} · {formatDate(visit?.visitDate)}</p>
        </div>
        <div className="flex gap-2">
          {onNewPrescription && <button type="button" onClick={onNewPrescription} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50">Open Patient Queue</button>}
          <button type="button" onClick={printPaper} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Printer size={15} /> Print</button>
        </div>
      </header>

      <form onSubmit={submit} className="prescription-paper-sheet mx-auto w-full min-w-0 max-w-[760px] border border-slate-400 bg-white p-4 font-serif text-slate-900 shadow-sm sm:p-6">
        <header className="border-b border-slate-700 pb-2 text-center">
          <h1 className="text-lg font-extrabold tracking-wide sm:text-xl">MEKDELA AMBA UNIVERSITY</h1>
          <p className="text-xs font-bold uppercase underline underline-offset-2">Prescription Paper</p>
        </header>

        <div className="mt-3 space-y-1.5 text-[10px] leading-relaxed sm:text-[11px]">
          <p><strong>Patient’s Full Name:</strong> <span className="inline-block min-w-48 border-b border-slate-500">{patientName}</span></p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <p><strong>Sex:</strong> {visit?.sex || patient.sex || '—'}</p>
            <p><strong>Age:</strong> {visit?.age ?? patient.age ?? '—'}</p>
            <label className="flex items-center gap-1"><strong>Weight:</strong>{onSubmit ? <><input aria-label="Weight in kilograms" value={weight} onChange={(event) => setWeight(event.target.value)} className="w-12 border-b border-slate-500 px-1 py-0.5" /><span>kg</span></> : `${weight ? ` ${weight} kg` : ' —'}`}</label>
            <p><strong>Card No.:</strong> {cardNumber}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <p><strong>Region:</strong> {visit?.region || patient.region || '—'}</p>
            <p><strong>Town:</strong> {visit?.town || patient.town || '—'}</p>
            <p><strong>Woreda:</strong> {visit?.woreda || patient.woreda || '—'}</p>
            <p><strong>Kebele:</strong> {visit?.kebele || patient.kebele || '—'}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-[1fr_1.2fr_1.5fr]">
            <p><strong>ID No.:</strong> {idNumber}</p>
            <p><strong>Tel. No.:</strong> {phone}</p>
            <div className="flex flex-wrap items-center gap-2">
            <strong>Patient type:</strong>
            {onSubmit ? ['inpatient', 'outpatient'].map((type) => (
              <label key={type} className="inline-flex items-center gap-1">
                <input type="radio" name="prescriptionPatientType" checked={patientType === type} onChange={() => setPatientType(type)} />
                {type === 'inpatient' ? 'Inpatient' : 'Outpatient'}
              </label>
            )) : examination.prescriptionPatientType === 'inpatient' ? 'Inpatient' : 'Outpatient'}
          </div>
          </div>
          <label className="flex items-end gap-1"><strong className="shrink-0">Diagnosis:</strong> {onSubmit
            ? <input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} maxLength={500} className="min-w-0 flex-1 border-b border-slate-500 px-1 py-0.5" />
            : <span className="min-w-0 flex-1 border-b border-slate-500">{diagnosis || '—'}</span>}</label>
        </div>

        {status && <p className="screen-only mt-3 text-xs font-semibold text-slate-700">Prescription status: <span className="rounded bg-blue-50 px-2 py-1 text-blue-800">{status}</span></p>}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 screen-only">
          {onSubmit && <button type="button" onClick={() => setPrescriptions((items) => [...items, newMedicine()])} className="inline-flex items-center gap-1 rounded bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"><Plus size={14} /> Add medicine</button>}
        </div>
        <div className="mt-2">
          <table className="prescription-print-table w-full table-fixed border-collapse text-[9px]">
            <colgroup>
              <col className="w-[78%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan="2" className="border border-slate-600 p-1 text-left align-middle leading-relaxed">
                  <strong className="block text-[10px]">Drug Treatment</strong>
                  <span className="block font-normal">
                    Drug Name, Strength, Dosage Form, Dose,<br />
                    Frequency, Duration, Quantity, How to use &amp; Other Information
                  </span>
                </th>
                <th colSpan="2" className="border border-slate-600 p-1 text-center">
                  Price <span className="block font-normal">Dispensers use only</span>
                </th>
              </tr>
              <tr>
                <th className="border border-slate-600 p-1 text-center font-normal">Birr</th>
                <th className="border border-slate-600 p-1 text-center font-normal">Cent</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((item, index) => (
                <tr key={item._id || `medicine-${index}`} className={onSubmit ? 'min-h-36' : 'min-h-12'}>
                  <td className="border border-slate-600 p-2 align-top">
                    {onSubmit ? (
                      <div className="relative grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                        <label className="col-span-2 block space-y-0.5 sm:col-span-4">
                          <span className="block text-[10px] font-semibold text-slate-600">Medicine name</span>
                          <AutoGrowTextarea aria-label="Medicine name" placeholder="e.g. Amoxicillin" value={item.medicine || ''} onChange={(event) => updateMedicine(index, 'medicine', event.target.value)} maxLength="300" className="font-semibold" />
                        </label>
                        <label className="block space-y-0.5">
                          <span className="block text-[10px] font-semibold text-slate-600">Strength</span>
                          <AutoGrowTextarea aria-label="Strength" placeholder="e.g. 500 mg" value={item.strength || ''} onChange={(event) => updateMedicine(index, 'strength', event.target.value)} maxLength="100" />
                        </label>
                        <label className="block space-y-0.5">
                          <span className="block text-[10px] font-semibold text-slate-600">Dosage form</span>
                          <AutoGrowTextarea aria-label="Dosage form" placeholder="e.g. tablet" value={item.form || ''} onChange={(event) => updateMedicine(index, 'form', event.target.value)} maxLength="100" />
                        </label>
                        <label className="block space-y-0.5">
                          <span className="block text-[10px] font-semibold text-slate-600">Dose</span>
                          <AutoGrowTextarea aria-label="Dose" placeholder="e.g. 1 tablet" value={item.dose || ''} onChange={(event) => updateMedicine(index, 'dose', event.target.value)} maxLength="100" />
                        </label>
                        <label className="block space-y-0.5">
                          <span className="block text-[10px] font-semibold text-slate-600">Frequency</span>
                          <AutoGrowTextarea aria-label="Frequency" placeholder="e.g. twice daily" value={item.frequency || ''} onChange={(event) => updateMedicine(index, 'frequency', event.target.value)} maxLength="100" />
                        </label>
                        <label className="block space-y-0.5">
                          <span className="block text-[10px] font-semibold text-slate-600">Duration</span>
                          <AutoGrowTextarea aria-label="Duration" placeholder="e.g. 7 days" value={item.duration || ''} onChange={(event) => updateMedicine(index, 'duration', event.target.value)} maxLength="100" />
                        </label>
                        <label className="block space-y-0.5">
                          <span className="block text-[10px] font-semibold text-slate-600">Quantity</span>
                          <AutoGrowTextarea aria-label="Quantity" placeholder="e.g. 14" value={item.quantity || ''} onChange={(event) => updateMedicine(index, 'quantity', event.target.value)} maxLength="80" />
                        </label>
                        <label className="block space-y-0.5">
                          <span className="block text-[10px] font-semibold text-slate-600">Quantity unit</span>
                          <AutoGrowTextarea aria-label="Quantity unit" placeholder="e.g. tablets" value={item.quantityUnit || ''} onChange={(event) => updateMedicine(index, 'quantityUnit', event.target.value)} maxLength="80" />
                        </label>
                        <label className="col-span-2 block space-y-0.5 sm:col-span-4">
                          <span className="block text-[10px] font-semibold text-slate-600">How to use &amp; other information</span>
                          <AutoGrowTextarea aria-label="How to use and other information" placeholder="e.g. Take with food" value={item.instructions || ''} onChange={(event) => updateMedicine(index, 'instructions', event.target.value)} maxLength="300" className="min-h-12" />
                        </label>
                        <button type="button" aria-label="Remove medicine" onClick={() => setPrescriptions((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="screen-only absolute right-0 top-0 text-rose-700"><Trash2 size={14} /></button>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {[item.medicine, item.strength, item.form, item.dose || item.dosage, item.frequency, item.duration, [item.quantity, item.quantityUnit].filter(Boolean).join(' '), item.instructions].filter(Boolean).join(' · ') || '—'}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-600 p-1 text-center">{priceInBirr(item) || '—'}</td>
                  <td className="border border-slate-600 p-1 text-center">{item.priceCents ? priceInCents(item) : '—'}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - prescriptions.length) }, (_, index) => (
                <tr key={`blank-row-${index}`} className="h-8">
                  <td className="border border-slate-600" />
                  <td className="border border-slate-600" />
                  <td className="border border-slate-600" />
                </tr>
              ))}
              {!prescriptions.length && <tr><td colSpan="3" className="border border-slate-600 p-4 text-center text-slate-500">No medicine prescribed.</td></tr>}
              <tr>
                <td className="border border-slate-600 p-2 text-right font-bold">Total Price</td>
                <td colSpan="2" className="border border-slate-600 text-center font-semibold">{totalCents ? `${Math.floor(totalCents / 100)} Birr ${String(totalCents % 100).padStart(2, '0')} Cent` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {onSubmit && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 screen-only">
          <p className="text-[11px] text-slate-500">Price, evaluation and dispensing information are managed by the pharmacy.</p>
          <button type="submit" disabled={saving || !hasPrescription} className="rounded bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Submitting…' : 'Submit to Pharmacy'}</button>
        </div>}

        <footer className="mt-5 grid gap-x-3 gap-y-4 text-[18px] print:text-[9px] sm:grid-cols-3">
          <div className="space-y-1">
            <strong className="underline">Prescriber’s</strong>
            <p>Full Name: <span className="inline-block min-w-16 border-b border-slate-500">{prescriber.name || doctor?.name || ''}</span></p>
            <p>Qualification: <span className="inline-block min-w-16 border-b border-slate-500">{prescriber.qualification || doctor?.qualification || ''}</span></p>
            <p>Registration: <span className="inline-block min-w-16 border-b border-slate-500">{prescriber.registration || doctor?.registrationNo || doctor?.registration || doctor?.licenseNumber || ''}</span></p>
            <p>Signature: <span className="inline-block min-w-16 border-b border-slate-500">{prescriber.signedAt ? 'Digitally signed' : hasPrescription ? 'Signature on submission' : ''}</span></p>
            <p>Date: <span className="inline-block min-w-16 border-b border-slate-500">{formatDate(prescriber.signedAt || visit?.visitDate)}</span></p>
          </div>
          <div className="space-y-1">
            <strong className="underline">Evaluator’s (Pharmacist / Dispenser)</strong>
            <p>Name: <span className="inline-block min-w-16 border-b border-slate-500">{examination.prescriptionEvaluatedBy || ''}</span></p>
            <p>Signature: <span className="inline-block min-w-16 border-b border-slate-500" /></p>
            <p>Date: <span className="inline-block min-w-16 border-b border-slate-500">{formatDate(examination.prescriptionEvaluatedAt)}</span></p>
          </div>
          <div className="space-y-1">
            <strong className="underline">Dispenser’s</strong>
            <p>Name: <span className="inline-block min-w-16 border-b border-slate-500">{examination.prescriptionDispensedBy || ''}</span></p>
            <p>Signature: <span className="inline-block min-w-16 border-b border-slate-500" /></p>
            <p>Date: <span className="inline-block min-w-16 border-b border-slate-500">{formatDate(examination.prescriptionDispensedAt)}</span></p>
          </div>
        </footer>
        {!hasPrescription && !onSubmit && <p className="mt-4 text-center text-xs text-slate-500">{visit ? 'No medicines are recorded for this visit.' : 'No patient is currently in consultation.'}</p>}
      </form>

      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          .prescription-paper-record.prescription-paper-print-target,
          .prescription-paper-record.prescription-paper-print-target * { visibility: visible !important; }
          .prescription-paper-record .screen-only,
          .prescription-paper-record header.print\\:hidden { display: none !important; }
          .prescription-paper-sheet { width: 100% !important; max-width: none !important; min-height: 270mm !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
          .prescription-paper-sheet > div { overflow: visible !important; }
          .prescription-print-table { width: 100% !important; table-layout: fixed !important; font-size: 8px !important; }
          .prescription-print-table th, .prescription-print-table td { overflow-wrap: anywhere !important; padding: 2px !important; }
          .prescription-print-table input { width: 100% !important; min-width: 0 !important; font-size: 7px !important; }
          .prescription-paper-sheet input { appearance: none !important; }
        }
      `}</style>
    </article>
  );
}

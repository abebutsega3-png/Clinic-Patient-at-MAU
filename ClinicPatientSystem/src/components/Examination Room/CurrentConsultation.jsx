import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  FlaskConical,
  Pill,
  Share2,
  Syringe,
} from 'lucide-react';

const dispositions = ['Discharge', 'Admit', 'Refer', 'Follow-up date'];
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatVital = (value, unit = '') => {
  if (value === undefined || value === null || value === '') return '—';
  const text = String(value);
  return unit && !text.toLowerCase().includes(unit.toLowerCase())
    ? `${text} ${unit}`
    : text;
};

function HiddenField({ name, value }) {
  return <input type="hidden" name={name} value={value ?? ''} />;
}

export default function CurrentConsultation({
  patient,
  history,
  alerts = [],
  onSave,
  onDraft,
  onNavigate,
  onCallPatient,
  waitingPatients = [],
  busyQueueId = '',
  loading = false,
  saving = false,
  error = '',
  notice = '',
}) {
  const examination = patient?.examination || {};
  const vitals = examination.vitals || patient?.vitals || {};
  const opd = examination.opd || {};
  const referral = examination.referral || {};
  const prescriptions = examination.prescriptions || [];
  const labRequests = examination.labRequests || [];
  const active = Boolean(patient);
  const [selectedDisposition, setSelectedDisposition] = useState(
    examination.disposition || 'Discharge',
  );
  const [activeTab, setActiveTab] = useState('clinical');
  const [showVitalsEditor, setShowVitalsEditor] = useState(false);
  const [vitalsDraft, setVitalsDraft] = useState(null);
  const currentVitals = {
    temperature: vitalsDraft?.temperature ?? vitals.temperature,
    bloodPressure: vitalsDraft?.bloodPressure ?? vitals.bloodPressure ?? vitals.bp,
    pulse: vitalsDraft?.pulse ?? vitals.pulse ?? vitals.pr,
    rr: vitalsDraft?.rr ?? vitals.respiratoryRate ?? vitals.rr,
    weight: vitalsDraft?.weight ?? vitals.weight,
  };
  const hasRecordedVitals = [
    currentVitals.temperature,
    currentVitals.bloodPressure,
    currentVitals.rr,
    currentVitals.pulse,
  ].some((value) => value !== undefined && value !== null && value !== '');
  const patientName = patient?.name || patient?.patientName || 'No patient selected';
  const patientRecord = history?.patient || patient?.patientRecordId || {};
  const allergy = patient?.allergies
    || patient?.allergy
    || patientRecord.allergies
    || patientRecord.allergy;
  const allergyText = Array.isArray(allergy) ? allergy.join(', ') : allergy;
  const hasAllergy = Boolean(allergyText && !/^(no known|none|n\/a|no allergy)/i.test(String(allergyText).trim()));
  const initials = patientName === 'No patient selected'
    ? '—'
    : patientName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const pastVisits = (history?.visits || [])
    .filter((visit) => String(visit._id) !== String(patient?.visitId))
    .sort((left, right) => new Date(right.visitDate || 0) - new Date(left.visitDate || 0));
  const recentLabResults = [
    ...labRequests.map((request) => ({
      ...request,
      visitDate: examination.labDateOfReport || patient?.visitDate,
    })),
    ...pastVisits.flatMap((visit) => (
    (visit.examination?.labRequests || []).map((request) => ({
      ...request,
      visitDate: visit.examination?.labDateOfReport || visit.visitDate,
    }))
    )),
  ].filter((request) => (
    request.result || request.labResult || request.labStatus === 'Results Ready' || request.status === 'Results Ready'
  )).slice(0, 8);
  const handleDraft = (event) => {
    const form = event.currentTarget.form;
    if (form) void onDraft?.(form);
  };
  const handleConsultationSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const invalidField = ['diagnosis', 'hmisDiagnosis']
      .map((name) => form.elements.namedItem(name))
      .find((field) => !String(field?.value || '').trim());
    if (invalidField) {
      setActiveTab('clinical');
      window.requestAnimationFrame(() => invalidField.reportValidity());
      return;
    }
    void onSave?.(event);
  };

  return (
    <div className="min-h-full bg-[#f2f6fc] p-2 text-[#132c51] sm:p-3">
      <div className="mx-auto max-w-[1500px] space-y-2.5">
        {!active && (
          <section className="rounded-lg border border-blue-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {loading ? 'Checking the examination queue…' : 'No consultation is active'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  {loading
                    ? 'Please wait while the latest queue status is loaded.'
                    : waitingPatients.length
                      ? 'Call a waiting patient to begin the consultation.'
                      : 'No patient is waiting in the examination queue.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('Patient Queue')}
                className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-50"
              >
                Open Patient Queue
              </button>
            </div>
            {waitingPatients.length > 0 && (
              <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
                {waitingPatients.map((waitingPatient) => (
                  <div key={waitingPatient.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                    <div>
                      <p className="text-xs font-bold">{waitingPatient.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {waitingPatient.cardNumber || waitingPatient.patientId} · Queue {waitingPatient.queueNumber || '—'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCallPatient?.(waitingPatient)}
                      disabled={Boolean(busyQueueId)}
                      className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {busyQueueId === waitingPatient.id ? 'Calling…' : 'Call patient'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}

        <form id="consultation-form" noValidate onSubmit={handleConsultationSubmit} className="space-y-2.5">
          <section className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-800">{initials}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-extrabold text-[#102b56]">{patientName}</h2>
                  <p className="truncate text-[10px] text-slate-600">MRN: {patient?.cardNumber || patient?.patientId || '—'}</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-600">Age <strong className="text-slate-900">{Number(patient?.age ?? patientRecord.age) > 0 ? patient?.age ?? patientRecord.age : '—'}</strong></span>
              <span className="text-[11px] text-slate-600">Sex <strong className="text-slate-900">{patient?.sex || patient?.gender || patientRecord.sex || '—'}</strong></span>
              <span className="text-[11px] text-slate-600">Card <strong className="text-slate-900">{patient?.cardNumber || patientRecord.cardNumber || '—'}</strong></span>
              <span className="text-[11px] text-slate-600">Student ID <strong className="text-slate-900">{patient?.studentId || patientRecord.studentId || patientRecord.universityIdNumber || '—'}</strong></span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${hasAllergy ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {hasAllergy && <AlertTriangle size={12} />}
                {hasAllergy ? `Allergy: ${allergyText}` : 'No known allergy'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px]">
              <span className="font-semibold text-slate-500">Vitals:</span>
              {hasRecordedVitals
                ? [
                    ['Temp', formatVital(currentVitals.temperature, '°C')],
                    ['BP', formatVital(currentVitals.bloodPressure)],
                    ['RR', formatVital(currentVitals.rr, '/min')],
                    ['Pulse', formatVital(currentVitals.pulse, '/min')],
                  ].map(([label, value]) => <span key={label} className="text-slate-600">{label} <strong className="text-slate-900">{value}</strong></span>)
                : <span className="text-slate-500">Not recorded yet</span>}
              <button
                type="button"
                form="consultation-form"
                onClick={() => setShowVitalsEditor((value) => !value)}
                disabled={!active}
                className="ml-auto rounded px-2 py-1 font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {showVitalsEditor ? 'Hide vitals' : 'Add vitals'}
              </button>
            </div>
            {showVitalsEditor && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-5">
                {[
                  ['temperature', 'Temperature'],
                  ['bloodPressure', 'Blood pressure'],
                  ['rr', 'Respiratory rate'],
                  ['pulse', 'Pulse'],
                  ['weight', 'Weight (kg)'],
                ].map(([name, label]) => (
                  <label key={name} className="text-[10px] font-semibold text-slate-600">
                    {label}
                    <input
                      name={name}
                      form="consultation-form"
                      defaultValue={currentVitals[name] ?? ''}
                      onChange={(event) => setVitalsDraft({ ...currentVitals, [name]: event.target.value })}
                      disabled={!active}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-normal disabled:bg-slate-50"
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(245px,0.34fr)]">
            <div className="min-w-0 space-y-2.5">
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex border-b border-slate-200" role="tablist" aria-label="Consultation sections">
                  {[
                    { id: 'clinical', label: 'Clinical Information' },
                    { id: 'history', label: 'History' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-w-0 flex-1 border-b-2 px-2 py-2.5 text-[10px] font-bold sm:text-xs ${activeTab === tab.id ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div hidden={activeTab !== 'clinical'} className="space-y-2.5 p-3">
                  <label className="block text-[10px] font-bold">
                    Chief Complaint
                    <input
                      name="chiefComplaint"
                      defaultValue={examination.chiefComplaint || ''}
                      placeholder="Enter chief complaint"
                      disabled={!active}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="block text-[10px] font-bold">
                    History of Present Illness
                    <textarea
                      name="historyOfPresentIllness"
                      defaultValue={examination.historyOfPresentIllness || ''}
                      placeholder="Onset, duration, severity..."
                      rows="2"
                      disabled={!active}
                      className="mt-1 w-full resize-y rounded-md border border-slate-300 px-2 py-1.5 text-[11px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="block text-[10px] font-bold">
                    Examination
                    <textarea
                      name="physicalExamination"
                      defaultValue={examination.physicalExamination || ''}
                      placeholder="Physical examination findings..."
                      rows="2"
                      disabled={!active}
                      className="mt-1 w-full resize-y rounded-md border border-slate-300 px-2 py-1.5 text-[11px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="block text-[10px] font-bold">
                    Diagnosis
                    <input
                      name="diagnosis"
                      defaultValue={patient?.diagnosis || examination.diagnosis || ''}
                      placeholder="Enter diagnosis"
                      required
                      disabled={!active}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="block text-[10px] font-bold">
                    Other Diagnosis
                    <input
                      name="otherDiagnosis"
                      defaultValue={examination.otherDiagnosis || ''}
                      placeholder="Optional"
                      disabled={!active}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="block text-[10px] font-bold">
                    HMIS Dx
                    <input
                      name="hmisDiagnosis"
                      defaultValue={examination.hmisDiagnosis || ''}
                      placeholder="Select or enter HMIS diagnosis"
                      required
                      disabled={!active}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"
                    />
                  </label>
                </div>
                {activeTab === 'history' && (
                  <div className="space-y-2 p-3">
                    <details className="rounded-md border border-slate-200 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-bold">Previous Visits ({pastVisits.length})</summary>
                      {pastVisits.length ? (
                        <div className="mt-2 max-h-48 overflow-auto">
                          <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 text-slate-600"><tr><th className="px-2 py-1">Date</th><th className="px-2 py-1">Diagnosis</th><th className="px-2 py-1">Prescription</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {pastVisits.slice(0, 8).map((visit) => (
                                <tr key={visit._id}>
                                  <td className="whitespace-nowrap px-2 py-1">{formatDate(visit.visitDate)}</td>
                                  <td className="px-2 py-1">{visit.diagnosis || '—'}</td>
                                  <td className="px-2 py-1">{visit.examination?.prescriptions?.map((item) => item.medicine || item.medicineName || item.name).filter(Boolean).join(', ') || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="mt-2 text-xs text-slate-500">No previous visits recorded.</p>}
                    </details>
                    <details className="rounded-md border border-slate-200 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-bold">Previous Lab Results ({recentLabResults.length})</summary>
                      {recentLabResults.length ? (
                        <div className="mt-2 max-h-48 overflow-auto">
                          <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 text-slate-600"><tr><th className="px-2 py-1">Test</th><th className="px-2 py-1">Result</th><th className="px-2 py-1">Date</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {recentLabResults.map((result, index) => <tr key={`${result.testCode || result.testName}-${index}`}><td className="px-2 py-1">{result.testName || result.testCode || 'Lab test'}</td><td className="px-2 py-1">{result.result || result.labResult || result.status}</td><td className="px-2 py-1">{formatDate(result.visitDate)}</td></tr>)}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="mt-2 text-xs text-slate-500">No previous lab results.</p>}
                    </details>
                    <button type="button" onClick={() => onNavigate?.('Patient Records / History')} disabled={!active} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      View full history <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-2.5">
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="mb-2 text-xs font-bold text-slate-800">Orders</h2>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => onNavigate?.('Lab Requests')} disabled={!active} className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 px-2.5 py-2 text-[10px] font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
                    <FlaskConical size={14} />Lab <span className="rounded-full bg-slate-100 px-1.5">{labRequests.length}</span>
                  </button>
                  <button type="button" onClick={() => onNavigate?.('Prescriptions')} disabled={!active} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 px-2.5 py-2 text-[10px] font-bold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50">
                    <Pill size={14} />Prescription <span className="rounded-full bg-slate-100 px-1.5">{prescriptions.length}</span>
                  </button>
                  <button type="button" disabled title="Procedure ordering is not available in this workflow." className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-2 text-[10px] font-bold text-slate-500 disabled:cursor-not-allowed">
                    <Syringe size={14} />Injection / Dressing
                  </button>
                  <button type="button" onClick={() => setSelectedDisposition('Refer')} disabled={!active} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <Share2 size={14} />Refer
                  </button>
                  <button type="button" disabled title="Emergency routing is not available in this workflow." className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 px-2.5 py-2 text-[10px] font-bold text-rose-700 disabled:cursor-not-allowed">
                    <AlertTriangle size={14} />Emergency
                  </button>
                </div>
              </section>
              <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-800">
                  <Bell size={14} />Live Updates <span className="rounded-full bg-slate-100 px-1.5 text-[10px]">{alerts.length}</span>
                </summary>
                <div className="divide-y divide-slate-100 border-t border-slate-100 px-3">
                  {alerts.slice(0, 4).map(({ tone, icon: Icon, text, time }) => (
                    <div key={text} className="flex items-center gap-1.5 py-2 text-[10px]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${tone === 'rose' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                      {Icon && <Icon size={12} className="shrink-0 text-slate-500" />}
                      <span className="min-w-0 flex-1 font-semibold">{text}</span>
                      <span className="shrink-0 text-slate-500">{time}</span>
                    </div>
                  ))}
                  {!alerts.length && <p className="py-3 text-center text-[10px] text-slate-500">No active updates.</p>}
                </div>
              </details>
            </aside>
          </div>

          <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <summary className="cursor-pointer text-xs font-bold text-slate-700">
              Disposition & consultation note <span className="ml-1 font-normal text-slate-500">({selectedDisposition})</span>
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <section>
                <h2 className="mb-1.5 text-[11px] font-bold">Disposition</h2>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {dispositions.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      disabled={!active}
                      onClick={() => setSelectedDisposition(option)}
                      className={[
                        'flex min-h-9 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-bold disabled:opacity-50',
                        selectedDisposition === option ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {index === 0 ? <Check size={13} /> : index === 1 ? <Activity size={13} /> : index === 2 ? <Share2 size={13} /> : <CalendarDays size={13} />}
                      {option === 'Follow-up date' ? 'Follow-up' : option}
                    </button>
                  ))}
                </div>
                {selectedDisposition === 'Follow-up date' && (
                  <label className="mt-2 block text-[10px] font-semibold">
                    Follow-up date
                    <input type="date" name="followUpDate" defaultValue={examination.followUpDate || ''} disabled={!active} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50" />
                  </label>
                )}
              </section>
              <label className="block text-[11px] font-bold">
                Consultation Note
                <textarea
                  name="doctorNotes"
                  defaultValue={examination.doctorNotes || ''}
                  placeholder="Add clinical notes and recommendations..."
                  rows="3"
                  disabled={!active}
                  className="mt-1 w-full resize-y rounded-md border border-slate-300 px-2 py-1.5 text-xs font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"
                />
              </label>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <button type="button" onClick={handleDraft} disabled={!active || saving} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Save draft
            </button>
            <button type="submit" disabled={!active || saving} className="flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Check size={15} />{saving ? 'Saving…' : 'Complete Consultation'}
            </button>
          </div>

          <input type="hidden" name="patientCondition" value={['Outpatient', 'Emergency', 'Non-emergency', 'Sick Leave'].includes(examination.patientCondition) ? examination.patientCondition : 'Outpatient'} />
          <input type="hidden" name="disposition" value={selectedDisposition} />
          {selectedDisposition !== 'Follow-up date' && <HiddenField name="followUpDate" value={examination.followUpDate} />}
          <HiddenField name="reviewOfSystem" value={examination.reviewOfSystem} />
          <HiddenField name="prescriptionPatientType" value={examination.prescriptionPatientType || 'outpatient'} />
          {!showVitalsEditor && <>
            <HiddenField name="bloodPressure" value={currentVitals.bloodPressure} />
            <HiddenField name="temperature" value={currentVitals.temperature} />
            <HiddenField name="pulse" value={currentVitals.pulse} />
            <HiddenField name="rr" value={currentVitals.rr} />
            <HiddenField name="weight" value={currentVitals.weight} />
          </>}
          <HiddenField name="labRequests" value={JSON.stringify(labRequests)} />
          <HiddenField name="prescriptions" value={JSON.stringify(prescriptions)} />
          <HiddenField name="roadTrafficAccident" value={opd.roadTrafficAccident ? 'on' : ''} />
          <HiddenField name="accidentType" value={opd.accidentType} />
          <HiddenField name="hivTestOffered" value={opd.hivTestOffered ? 'on' : ''} />
          <HiddenField name="hivTestPerformed" value={opd.hivTestPerformed ? 'on' : ''} />
          <HiddenField name="hivResult" value={opd.hivResult} />
          <HiddenField name="targetPopulation" value={opd.targetPopulation} />
          <HiddenField name="tbScreened" value={opd.tbScreened ? 'on' : ''} />
          <HiddenField name="tbResult" value={opd.tbResult} />
          <HiddenField name="diagnosticEvaluation" value={opd.diagnosticEvaluation} />
          <HiddenField name="referredTo" value={opd.referredTo} />
          <HiddenField name="isReferred" value={referral.department ? 'on' : ''} />
          <HiddenField name="referralDepartment" value={referral.department} />
          <HiddenField name="referralReason" value={referral.reason} />
          <HiddenField name="qualification" value={referral.qualification} />
          <HiddenField name="emergencyReferral" value={referral.emergency ? 'on' : ''} />
          <HiddenField name="ambulanceDriver" value={referral.ambulanceDriver} />
          <HiddenField name="takeOffTime" value={referral.takeOffTime} />
          <HiddenField name="remark" value={referral.remark} />
          <HiddenField name="sickLeaveDays" value={examination.sickLeaveDays} />
        </form>
      </div>
    </div>
  );
}

import React, { useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Check,
  ClipboardList,
  ChevronRight,
  Clock3,
  FlaskConical,
  Pill,
  Share2,
  Save,
  UserCheck,
  X,
  ArrowRight,
  ClipboardCheck,
} from 'lucide-react';
import LabRequestForm from './LabRequestForm.jsx';
import PrescriptionPaper from './PrescriptionPaper.jsx';

const dispositions = ['Discharge', 'Admit', 'Refer', 'Follow-up date'];
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};
const formatServiceDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
};

function HiddenField({ name, value }) {
  return <input type="hidden" name={name} value={value ?? ''} />;
}

const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};

const getResultFlag = (test) => {
  const flag = String(test.flag || '').trim();
  const result = String(test.result || '').trim();
  if (/^(high|low|positive|reactive)$/i.test(flag)) return flag.toUpperCase();
  if (/positive|reactive/i.test(result)) return 'POSITIVE';
  if (/normal/i.test(flag)) return 'NORMAL';
  return flag && flag !== '—' ? flag.toUpperCase() : (result ? '—' : 'PENDING');
};

function LabResultsPanel({
  patient,
  doctor,
  requests,
  status,
  requestNumber,
  requestedAt,
  requestedBy,
  resultReadyAt,
  reportDate,
  testedBy,
  technicianSignature,
  enteredAt,
  technicianNotes,
  approvedBy,
  approvedAt,
  department,
  active,
  onApply,
  onFollowUp,
  onPrescription,
  onReferral,
}) {
  const patientRecord = patient?.patientRecordId && typeof patient.patientRecordId === 'object'
    ? patient.patientRecordId
    : {};
  const patientName = patient?.name || patient?.patientName || 'No patient selected';
  const normalizedStatus = status || (requests.some((test) => test.result) ? 'Results Ready' : 'Pending');
  const ready = normalizedStatus === 'Results Ready' || normalizedStatus === 'Reviewed';
  const completedAt = ready ? resultReadyAt || reportDate : null;
  const statusTone = normalizedStatus === 'Reviewed'
    ? 'bg-emerald-100 text-emerald-800'
    : ready
      ? 'bg-green-100 text-green-800'
      : normalizedStatus === 'In Progress' || normalizedStatus === 'Sample Collected'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-amber-100 text-amber-900';
  const priority = requests.some((test) => test.priority === 'urgent') ? 'Urgent' : 'Routine';

  return (
    <section className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-3 py-2">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-blue-700" aria-hidden="true" />
          <h2 className="text-xs font-bold text-blue-950">Lab Results</h2>
          <span className="hidden text-[9px] text-slate-500 sm:inline">Patient-specific · Clinical review</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <span>{doctor?.name || 'Examination Room'}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDateTime(completedAt)}</span>
        </div>
      </header>

      <div className="grid gap-2.5 p-2.5 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-w-0 space-y-2.5">
          <div className="grid gap-2 rounded-md border border-blue-100 bg-[#f7faff] p-2 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ['MRN', patient?.cardNumber || patientRecord.cardNumber || patient?.patientId],
              ['Full Name', patientName],
              ['Age', patient?.age ?? patientRecord.age],
              ['Sex', patient?.sex || patient?.gender || patientRecord.sex],
              ['Order Date & Time', formatDateTime(requestedAt)],
              ['Completed Date & Time', formatDateTime(completedAt)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-800" title={value ? String(value) : undefined}>
                  {value || '—'}
                </p>
                {label === 'Completed Date & Time' && (
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold ${statusTone}`}>
                    {normalizedStatus}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[620px] text-left text-[9px]">
              <thead className="bg-slate-100 text-[8px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Test Type</th>
                  <th className="px-2 py-1.5">Test Name</th>
                  <th className="px-2 py-1.5">Result</th>
                  <th className="px-2 py-1.5">Unit</th>
                  <th className="px-2 py-1.5">Reference Range</th>
                  <th className="px-2 py-1.5">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((test, index) => {
                  const flag = getResultFlag(test);
                  const flagged = ['HIGH', 'LOW', 'POSITIVE', 'REACTIVE'].includes(flag);
                  return (
                    <tr key={test.testCode || `${test.testName}-${index}`} className={flagged ? 'bg-rose-50/40' : 'bg-white'}>
                      <td className="px-2 py-1.5 text-slate-600">{test.category || 'Laboratory'}</td>
                      <td className="px-2 py-1.5 font-semibold text-slate-800">{test.testName || test.testCode || 'Lab test'}</td>
                      <td className={`px-2 py-1.5 font-bold ${flagged ? 'text-rose-700' : 'text-slate-800'}`}>{test.result || 'Pending'}</td>
                      <td className="px-2 py-1.5 text-slate-600">{test.unit || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-600">{test.referenceRange || '—'}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[8px] font-bold ${
                          flagged ? 'bg-rose-100 text-rose-800'
                            : flag === 'NORMAL' ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {flag}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!requests.length && (
                  <tr><td colSpan="6" className="px-3 py-5 text-center text-slate-500">No laboratory request is linked to this visit.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-md border border-blue-100 bg-blue-50/70 p-2">
            <h3 className="text-[9px] font-bold text-blue-900">Order Information</h3>
            <dl className="mt-1.5 space-y-1 text-[8px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Order ID</dt><dd className="text-right font-semibold">{requestNumber || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Ordered By</dt><dd className="text-right font-semibold">{requestedBy || 'Not recorded'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Department</dt><dd className="text-right font-semibold">{department || 'Laboratory'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Priority</dt><dd className="text-right font-semibold">{priority}</dd></div>
            </dl>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <h3 className="text-[9px] font-bold text-slate-800">Technician Note</h3>
            <p className="mt-1 whitespace-pre-wrap text-[8px] leading-relaxed text-slate-700">{technicianNotes || 'No laboratory remarks recorded.'}</p>
          </div>
          <div className="rounded-md border border-sky-100 bg-sky-50 p-2">
            <h3 className="text-[9px] font-bold text-sky-900">Entered By</h3>
            <p className="mt-1 text-[8px] font-semibold text-slate-800">{testedBy || 'Not recorded'}</p>
            <p className="mt-0.5 text-[8px] text-slate-600">Signature: {technicianSignature || 'Not recorded'}</p>
            <p className="mt-0.5 text-[8px] text-slate-600">{formatDateTime(enteredAt)}</p>
          </div>
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-2">
            <h3 className="text-[9px] font-bold text-emerald-900">Verified By</h3>
            <p className="mt-1 text-[8px] font-semibold text-slate-800">{approvedBy || 'Not yet verified'}</p>
            <p className="mt-0.5 text-[8px] text-slate-600">{formatDateTime(approvedAt)}</p>
          </div>
        </aside>
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-2.5 py-2">
        <button type="button" onClick={onApply} disabled={!active} className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1.5 text-[9px] font-bold text-white hover:bg-blue-800 disabled:opacity-50">
          <ClipboardCheck size={12} /> Apply to Examination / Back to Exam
        </button>
        <button type="button" onClick={onFollowUp} disabled={!active} className="inline-flex items-center gap-1 rounded border border-blue-300 bg-white px-2.5 py-1.5 text-[9px] font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50">
          <FlaskConical size={12} /> Order Follow-up Lab
        </button>
        <button type="button" onClick={onPrescription} disabled={!active} className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 text-[9px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
          <ArrowRight size={12} /> Proceed to Prescription
        </button>
        <button type="button" onClick={onReferral} disabled={!active} className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2.5 py-1.5 text-[9px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
          <Clock3 size={12} /> Referral
        </button>
      </footer>
      <p className="border-t border-slate-100 px-3 py-1.5 text-[8px] text-slate-500">
        Review laboratory findings clinically; enter any diagnosis and OPD HIV/TB screening codes separately after interpretation.
      </p>
    </section>
  );
}

export default function PatientExamination({
  patient,
  history,
  alerts = [],
  onSave,
  onDraft,
  onNavigate,
  onCallPatient,
  doctor,
  prescriptionVisit,
  onCheckMedicineStock,
  onSubmitPrescription,
  labRequestsForVisit = [],
  onLabSubmit,
  onLabUpdateProcessing,
  onLabSaveResults,
  onLabApproveResults,
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
  const visibleLabRequests = labRequestsForVisit.length ? labRequestsForVisit : labRequests;
  const labMetadata = visibleLabRequests[0] || {};
  const active = Boolean(patient);
  const [selectedDisposition, setSelectedDisposition] = useState(
    examination.disposition || 'Discharge',
  );
  const [patientCondition, setPatientCondition] = useState(
    examination.patientCondition || 'Outpatient',
  );
  const [sickLeaveDays, setSickLeaveDays] = useState(examination.sickLeaveDays || 0);
  const [referralDepartment, setReferralDepartment] = useState(referral.department || '');
  const [referralReason, setReferralReason] = useState(referral.reason || '');
  const [referralEmergency, setReferralEmergency] = useState(Boolean(referral.emergency));
  const [vitalsDraft, setVitalsDraft] = useState(null);
  const [dispositionOpen, setDispositionOpen] = useState(examination.disposition === 'Refer');
  const [activePanel, setActivePanel] = useState('');
  const formRef = useRef(null);
  const dispositionRef = useRef(null);
  const currentVitals = {
    temperature: vitalsDraft?.temperature ?? vitals.temperature,
    bloodPressure: vitalsDraft?.bloodPressure ?? vitals.bloodPressure ?? vitals.bp,
    pulse: vitalsDraft?.pulse ?? vitals.pulse ?? vitals.pr,
    rr: vitalsDraft?.rr ?? vitals.respiratoryRate ?? vitals.rr,
    weight: vitalsDraft?.weight ?? vitals.weight,
  };
  const patientName = patient?.name || patient?.patientName || 'No patient selected';
  const patientRecord = history?.patient || patient?.patientRecordId || {};
  const allergy = patient?.allergies
    || patient?.allergy
    || patientRecord.allergies
    || patientRecord.allergy;
  const allergyText = Array.isArray(allergy) ? allergy.join(', ') : allergy;
  const hasAllergy = Boolean(allergyText && !/^(no known|none|n\/a|no allergy)/i.test(String(allergyText).trim()));
  const address = patient?.address
    || patientRecord.address
    || [patient?.dormBlock || patientRecord.dormBlock, patient?.woreda || patientRecord.woreda, patient?.kebele || patientRecord.kebele].filter(Boolean).join(', ');
  const serviceDate = formatServiceDate(patient?.visitDate);
  const visitType = !patient
    ? '—'
    : String(patient.visitType || '').toLowerCase().startsWith('new') ? 'New' : 'Repeat';
  const medicalHistory = patientRecord.medicalHistory
    || patientRecord.pastMedicalHistory
    || patientRecord.medicalHistoryText
    || 'No medical history recorded';
  const chronicConditions = (patient?.chronicConditions?.length ? patient.chronicConditions : null)
    || (patientRecord.chronicConditions?.length ? patientRecord.chronicConditions : null)
    || medicalHistory
    || 'None recorded';
  const chronicConditionText = Array.isArray(chronicConditions) ? chronicConditions.join(', ') : chronicConditions;
  const hasChronicCondition = Boolean(
    String(chronicConditionText || '').trim()
    && !/^(none recorded|none|no medical history recorded|no significant past medical history recorded|no chronic conditions recorded)$/i.test(String(chronicConditionText).trim()),
  );
  const patientInformation = [
    ['Student ID', patient?.studentId || patientRecord.universityIdNumber || patientRecord.studentId],
    ['Full Name', patientName === 'No patient selected' ? '' : patientName],
    ['MRN', patient?.cardNumber || patientRecord.cardNumber || patient?.patientId],
    ['Gender', patient?.sex || patient?.gender || patientRecord.sex],
    ['Age', Number(patient?.age ?? patientRecord.age) > 0 ? patient?.age ?? patientRecord.age : ''],
    ['Address (Dorm / Woreda / Kebele)', address],
    ['Visit Type', visitType],
    ['Service Date', serviceDate],
    ['Department', patient?.academicDepartment || patientRecord.academicDepartment || patient?.department],
    ['Campus', patient?.campus || patientRecord.campus],
    ['Phone Number', patient?.telephone || patientRecord.phoneNumber],
    ['Visit ID', patient?.visitId || patient?.id],
    ['Queue Number', patient?.queueNumber],
  ];
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
  const handleDraft = () => {
    if (formRef.current) void onDraft?.(formRef.current);
  };
  const openSavedReferralSlip = async () => {
    if (!formRef.current) return;
    const invalidField = ['referralDepartment', 'referralReason', 'referredCode']
      .map((name) => formRef.current.elements.namedItem(name))
      .find((field) => !String(field?.value || '').trim());
    if (invalidField) {
      invalidField.reportValidity();
      return;
    }
    const saved = await onDraft?.(formRef.current);
    if (saved) onNavigate?.('Patient Referrals');
  };
  const saveDraftAndOpen = async (panel) => {
    if (!formRef.current) return;
    const saved = await onDraft?.(formRef.current);
    if (saved) setActivePanel(panel);
  };
  const submitLabRequest = async (request) => {
    const saved = await onLabSubmit?.(request);
    if (saved) setActivePanel('');
    return saved;
  };
  const submitPrescription = async (prescription) => {
    const saved = await onSubmitPrescription?.(prescription);
    if (saved) setActivePanel('');
  };
  const openReferralForm = () => {
    setSelectedDisposition('Refer');
    setDispositionOpen(true);
    window.requestAnimationFrame(() => {
      dispositionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };
  const handleConsultationSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const invalidField = [
      'diagnosis',
      'hmisDiagnosis',
      ...(selectedDisposition === 'Refer' ? ['referralDepartment', 'referralReason', 'referredCode'] : []),
    ]
      .map((name) => form.elements.namedItem(name))
      .find((field) => !String(field?.value || '').trim());
    if (invalidField) {
      window.requestAnimationFrame(() => invalidField.reportValidity());
      return;
    }
    void onSave?.(event);
  };
  return (
    <div className="min-h-full bg-[#f2f6fc] p-2 text-[#132c51] sm:p-3">
      <div className="mx-auto max-w-[1500px] space-y-2.5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Activity className="mt-1 shrink-0 text-blue-700" size={20} aria-hidden="true" />
            <div>
              <h1 className="text-lg font-extrabold text-[#102b56]">Patient Examination</h1>
              <p className="mt-0.5 text-[10px] text-slate-600">Examine the patient selected from Patient Queue, record the problem, give a diagnosis, and decide treatment.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('Patient Queue')}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-800 hover:bg-blue-50"
          >
            <ChevronRight size={13} className="rotate-180" />Back to Patient Queue
          </button>
        </header>

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

        <form ref={formRef} id="consultation-form" noValidate onSubmit={handleConsultationSubmit} className="space-y-2.5">
          <section className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-3 py-2">
              <UserCheck size={15} className="text-blue-700" aria-hidden="true" />
              <h2 className="text-xs font-bold text-blue-900">Patient Information</h2>
              <span className="ml-auto text-[9px] text-slate-500">View only · Automatically received from Card Room</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 sm:grid-cols-3 xl:grid-cols-4">
              {patientInformation.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="mb-0.5 text-[9px] font-semibold text-slate-600">{label}</p>
                  <p className="min-h-7 truncate rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-700" title={value ? String(value) : undefined}>
                    {value || '—'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-2 sm:grid-cols-3">
            <div className={`rounded-lg border px-3 py-2 ${hasAllergy ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
              <p className={`text-[10px] font-bold ${hasAllergy ? 'text-rose-800' : 'text-slate-700'}`}>Allergy Alert</p>
              <p className={`mt-0.5 text-[10px] ${hasAllergy ? 'text-rose-700' : 'text-slate-600'}`}>
                {hasAllergy ? allergyText : 'No known allergies'}
              </p>
            </div>
            <div className={`rounded-lg border px-3 py-2 ${hasChronicCondition ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
              <p className={`text-[10px] font-bold ${hasChronicCondition ? 'text-rose-800' : 'text-slate-700'}`}>Chronic / Medical Conditions</p>
              <p className={`mt-0.5 text-[10px] ${hasChronicCondition ? 'text-rose-700' : 'text-slate-600'}`}>
                {chronicConditionText}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[10px] font-bold text-blue-900">Previous Visits</p>
              {pastVisits.slice(0, 2).map((visit) => (
                <div key={visit._id} className="mt-0.5 text-[10px] text-blue-800">
                  <p className="truncate">{formatDate(visit.visitDate)} · {visit.diagnosis || 'Diagnosis not recorded'}</p>
                  <p className="truncate text-blue-700">
                    Rx: {visit.examination?.prescriptions?.map((item) => item.medicine || item.medicineName || item.name).filter(Boolean).join(', ') || 'None recorded'}
                  </p>
                </div>
              ))}
              {!pastVisits.length && <p className="mt-0.5 text-[10px] text-blue-800">No previous visits recorded</p>}
            </div>
          </section>

          <LabResultsPanel
            patient={patient}
            doctor={doctor}
            requests={visibleLabRequests}
            status={examination.labStatus || labMetadata.labStatus}
            requestNumber={examination.labRequestNumber || labMetadata.labRequestNumber}
            requestedAt={examination.labRequestedAt || labMetadata.labRequestedAt}
            requestedBy={examination.labRequestedBy || labMetadata.labRequestedBy}
            resultReadyAt={examination.labResultReadyAt || labMetadata.labResultReadyAt}
            reportDate={examination.labDateOfReport || labMetadata.labDateOfReport}
            testedBy={examination.labTestedBy || labMetadata.labTestedBy}
            technicianSignature={examination.labTechnicianSignature || labMetadata.labTechnicianSignature}
            enteredAt={examination.labEnteredAt || labMetadata.labEnteredAt}
            technicianNotes={examination.labTechnicianNotes || labMetadata.labTechnicianNotes}
            approvedBy={examination.labApprovedBy || labMetadata.labApprovedBy}
            approvedAt={examination.labApprovedAt || labMetadata.labApprovedAt}
            department={patient?.department || labMetadata.department}
            active={active}
            onApply={() => {
              document.getElementById('diagnosis-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              window.requestAnimationFrame(() => document.getElementById('primary-diagnosis')?.focus());
            }}
            onFollowUp={() => void saveDraftAndOpen('lab')}
            onPrescription={() => void saveDraftAndOpen('prescription')}
            onReferral={openReferralForm}
          />

          <section className="overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/70 px-3 py-2">
              <Activity size={15} className="text-emerald-700" aria-hidden="true" />
              <h2 className="text-xs font-bold text-emerald-900">Vital Signs</h2>
              <span className="text-[9px] text-slate-500">Doctor / Nurse Entry</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-5">
              {[
                ['bloodPressure', 'Blood Pressure', 'e.g. 120/80 mmHg'],
                ['temperature', 'Temperature', '°C'],
                ['pulse', 'Pulse Rate', 'bpm'],
                ['rr', 'Respiratory Rate', '/min'],
                ['weight', 'Weight', 'kg'],
              ].map(([name, label, placeholder]) => (
                <label key={name} className="text-[9px] font-semibold text-slate-700">
                  {label}
                  <input
                    name={name}
                    defaultValue={currentVitals[name] ?? ''}
                    placeholder={placeholder}
                    onChange={(event) => setVitalsDraft({ ...currentVitals, [name]: event.target.value })}
                    disabled={!active}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal outline-none focus:border-emerald-400 disabled:bg-slate-50"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-amber-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/70 px-3 py-2">
              <ClipboardList size={15} className="text-amber-700" aria-hidden="true" />
              <h2 className="text-xs font-bold text-amber-900">Patient Complaint</h2>
            </div>
            <div className="grid gap-2.5 p-3 md:grid-cols-3">
              <label className="text-[9px] font-semibold text-slate-700">
                Chief Complaint
                <input
                  name="chiefComplaint"
                  defaultValue={examination.chiefComplaint || ''}
                  placeholder="Enter chief complaint"
                  disabled={!active}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal outline-none focus:border-amber-400 disabled:bg-slate-50"
                />
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                Symptoms
                <textarea
                  name="historyOfPresentIllness"
                  defaultValue={examination.historyOfPresentIllness || ''}
                  placeholder="Describe symptoms and history"
                  rows="2"
                  disabled={!active}
                  className="mt-1 w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal outline-none focus:border-amber-400 disabled:bg-slate-50"
                />
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                Duration
                <input
                  name="duration"
                  placeholder="e.g. 3 days"
                  disabled={!active}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal outline-none focus:border-amber-400 disabled:bg-slate-50"
                />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-violet-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-2">
              <Activity size={15} className="text-violet-700" aria-hidden="true" />
              <h2 className="text-xs font-bold text-violet-900">Physical Examination</h2>
            </div>
            <div className="grid gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['generalAppearance', 'General Appearance', 'General patient appearance…', ''],
                ['systemExamination', 'System Examination', 'System examination findings…', examination.physicalExamination || ''],
                ['physicalFindings', 'Physical Findings', 'Physical findings…', ''],
                ['doctorNotes', 'Clinical Notes', 'Clinical notes and recommendations…', examination.doctorNotes || ''],
              ].map(([name, label, placeholder, value]) => (
                <label key={name} className="text-[9px] font-semibold text-slate-700">
                  {label}
                  <textarea
                    name={name}
                    defaultValue={value}
                    placeholder={placeholder}
                    rows="3"
                    disabled={!active}
                    className="mt-1 w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal outline-none focus:border-violet-400 disabled:bg-slate-50"
                  />
                </label>
              ))}
            </div>
          </section>

          <section id="diagnosis-section" className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-3 py-2">
              <Check size={15} className="text-blue-700" aria-hidden="true" />
              <h2 className="text-xs font-bold text-blue-900">Diagnosis</h2>
            </div>
            <div className="grid gap-2.5 p-3 md:grid-cols-3">
              <label className="text-[9px] font-semibold text-slate-700">
                Primary Diagnosis
                <input id="primary-diagnosis" name="diagnosis" defaultValue={patient?.diagnosis || examination.diagnosis || ''} placeholder="Enter primary diagnosis" required disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50" />
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                Secondary Diagnosis
                <input name="otherDiagnosis" defaultValue={examination.otherDiagnosis || ''} placeholder="Optional" disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal outline-none focus:border-blue-400 disabled:bg-slate-50" />
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                HMIS Diagnosis
                <input name="hmisDiagnosis" defaultValue={examination.hmisDiagnosis || ''} placeholder="Select or enter HMIS diagnosis" required disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal uppercase outline-none focus:border-blue-400 disabled:bg-slate-50" />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-teal-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-teal-100 bg-teal-50/70 px-3 py-2">
              <ClipboardList size={15} className="text-teal-700" aria-hidden="true" />
              <h2 className="text-xs font-bold text-teal-900">FMOH OPD Register Fields</h2>
              <span className="ml-auto text-[9px] text-slate-500">Saved to the OPD register on completion</span>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-[9px] font-semibold text-slate-700">
                Road Traffic Accident
                <select name="rtaType" defaultValue={opd.rtaType || opd.accidentType || 'None'} disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal disabled:bg-slate-50">
                  {['None', '1. Pedestrian', '2. Motorcyclist', '3. Vehicle occupant'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded border border-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-700">
                <input type="checkbox" name="hivTestOffered" defaultChecked={opd.hivTestOffered} disabled={!active} className="accent-teal-700" />
                HIV test offered
              </label>
              <label className="flex items-center gap-2 self-end rounded border border-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-700">
                <input type="checkbox" name="hivTestPerformed" defaultChecked={opd.hivTestPerformed} disabled={!active} className="accent-teal-700" />
                HIV test performed
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                HIV target code
                <select name="hivTargetCode" defaultValue={opd.hivTargetCode || ''} disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal disabled:bg-slate-50">
                  <option value="">Select category</option>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                HIV test result
                <select name="hivTestResult" defaultValue={opd.hivTestResult || opd.hivResult || 'N/A'} disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal disabled:bg-slate-50">
                  {['N/A', 'P', 'N'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded border border-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-700">
                <input type="checkbox" name="screenedForTb" defaultChecked={opd.screenedForTb || opd.tbScreened} disabled={!active} className="accent-teal-700" />
                Screened for TB
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                TB screening result
                <select name="tbScreeningResult" defaultValue={opd.tbScreeningResult || 'N/A'} disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal disabled:bg-slate-50">
                  {['N/A', 'P', 'N'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                TB diagnostic code
                <select name="tbDiagnosticCode" defaultValue={opd.tbDiagnosticCode || ''} disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal disabled:bg-slate-50">
                  <option value="">Select code</option>
                  {['1', '2', '3', '4', '5', '6'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                TB result code
                <select name="tbResultCode" defaultValue={opd.tbResultCode || ''} disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal disabled:bg-slate-50">
                  <option value="">Select result</option>
                  {['TB', 'No TB', 'ND'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-semibold text-slate-700">
                Referral code
                <select name="referredCode" defaultValue={opd.referredCode || ''} required={active && selectedDisposition === 'Refer'} disabled={!active} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-[10px] font-normal disabled:bg-slate-50">
                  <option value="">Not referred</option>
                  {[
                    ['1', 'Hospital'],
                    ['2', 'Health Center'],
                    ['3', 'Health Post'],
                    ['4', 'MCH'],
                    ['5', 'ART'],
                    ['6', 'SOPD'],
                    ['7', 'ObGyn'],
                    ['8', 'TB Clinic'],
                    ['9', 'Other Service / Health Institution'],
                  ].map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-semibold text-rose-800">
                <input type="checkbox" name="died" defaultChecked={opd.died} disabled={!active} className="accent-rose-700" />
                Patient died
              </label>
            </div>
          </section>

          <div className="grid gap-2.5 lg:grid-cols-2">
            <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <summary className="cursor-pointer text-[10px] font-bold text-slate-700">Previous visits &amp; lab results ({pastVisits.length} visits · {recentLabResults.length} results)</summary>
              <div className="mt-2 space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-slate-50 text-slate-600"><tr><th className="px-2 py-1">Date</th><th className="px-2 py-1">Diagnosis</th><th className="px-2 py-1">Prescription</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {pastVisits.slice(0, 5).map((visit) => (
                        <tr key={visit._id}>
                          <td className="whitespace-nowrap px-2 py-1">{formatDate(visit.visitDate)}</td>
                          <td className="px-2 py-1">{visit.diagnosis || '—'}</td>
                          <td className="px-2 py-1">{visit.examination?.prescriptions?.map((item) => item.medicine || item.medicineName || item.name).filter(Boolean).join(', ') || '—'}</td>
                        </tr>
                      ))}
                      {!pastVisits.length && <tr><td colSpan="3" className="px-2 py-2 text-center text-slate-500">No previous visits recorded.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-slate-50 text-slate-600"><tr><th className="px-2 py-1">Test</th><th className="px-2 py-1">Result</th><th className="px-2 py-1">Date</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentLabResults.map((result, index) => <tr key={`${result.testCode || result.testName}-${index}`}><td className="px-2 py-1">{result.testName || result.testCode || 'Lab test'}</td><td className="px-2 py-1">{result.result || result.labResult || result.status}</td><td className="px-2 py-1">{formatDate(result.visitDate)}</td></tr>)}
                      {!recentLabResults.length && <tr><td colSpan="3" className="px-2 py-2 text-center text-slate-500">No previous lab results.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => onNavigate?.('Patient Records / History')} disabled={!active} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                  View full history <ChevronRight size={12} />
                </button>
              </div>
            </details>

            <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <summary className="cursor-pointer text-[10px] font-bold text-slate-700">Orders &amp; live updates ({labRequests.length} lab · {prescriptions.length} prescriptions · {alerts.length} alerts)</summary>
              <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                {alerts.slice(0, 4).map(({ tone, icon: Icon, text, time }) => (
                  <div key={text} className="flex items-center gap-1.5 py-2 text-[9px]">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${tone === 'rose' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                    {Icon && <Icon size={12} className="shrink-0 text-slate-500" />}
                    <span className="min-w-0 flex-1 font-semibold">{text}</span>
                    <span className="shrink-0 text-slate-500">{time}</span>
                  </div>
                ))}
                {!alerts.length && <p className="py-2 text-center text-[9px] text-slate-500">No active updates.</p>}
              </div>
            </details>
          </div>

          <details
            ref={dispositionRef}
            open={dispositionOpen}
            onToggle={(event) => setDispositionOpen(event.currentTarget.open)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
          >
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
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block text-[10px] font-semibold">
                    Patient condition
                    <select name="patientCondition" value={patientCondition} onChange={(event) => setPatientCondition(event.target.value)} disabled={!active} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50">
                      {['Outpatient', 'Emergency', 'Non-emergency', 'Sick Leave'].map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] font-semibold">
                    Sick leave days
                    <input type="number" name="sickLeaveDays" min="0" max="365" step="1" value={sickLeaveDays} onChange={(event) => setSickLeaveDays(event.target.value)} disabled={!active} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50" />
                  </label>
                </div>
                {selectedDisposition === 'Refer' && (
                  <div className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-2">
                    <label className="block text-[10px] font-semibold">
                      Referral department
                      <input name="referralDepartment" value={referralDepartment} onChange={(event) => setReferralDepartment(event.target.value)} required disabled={!active} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal disabled:bg-slate-50" placeholder="Destination hospital or department" />
                    </label>
                    <label className="block text-[10px] font-semibold">
                      Referral reason
                      <textarea name="referralReason" value={referralReason} onChange={(event) => setReferralReason(event.target.value)} required rows="2" disabled={!active} className="mt-1 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal disabled:bg-slate-50" placeholder="Reason for referral" />
                    </label>
                    <label className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-semibold text-rose-800">
                      <input type="checkbox" checked={referralEmergency} onChange={(event) => setReferralEmergency(event.target.checked)} disabled={!active} className="accent-rose-700" />
                      Emergency referral
                    </label>
                    <button
                      type="button"
                      onClick={() => void openSavedReferralSlip()}
                      disabled={!active || saving}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      <Share2 size={13} />Save Draft &amp; View / Print Referral Slip
                    </button>
                  </div>
                )}
              </section>
            </div>
          </details>

          <section className="space-y-2 rounded-lg border border-blue-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-extrabold text-[#102b56]">Examination Actions</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button type="button" onClick={handleDraft} disabled={!active || saving} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Save size={14} />{saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button type="button" onClick={() => void saveDraftAndOpen('lab')} disabled={!active || saving} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50">
                <FlaskConical size={14} />Order Lab Tests
              </button>
              <button type="button" onClick={() => void saveDraftAndOpen('prescription')} disabled={!active || saving} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50">
                <Pill size={14} />Prescription Pad
              </button>
              <button type="button" onClick={openReferralForm} disabled={!active || saving} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                <Share2 size={14} />Create Referral
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <p className="text-[10px] text-slate-500">Finish when the examination and clinical decisions are complete.</p>
              <button type="submit" disabled={!active || saving} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                <Check size={15} />{saving ? 'Completing…' : 'Complete Examination'}
              </button>
            </div>
          </section>

          <input type="hidden" name="disposition" value={selectedDisposition} />
          {selectedDisposition !== 'Follow-up date' && <HiddenField name="followUpDate" value={examination.followUpDate} />}
          <HiddenField name="reviewOfSystem" value={examination.reviewOfSystem} />
          <HiddenField name="prescriptionPatientType" value={examination.prescriptionPatientType || 'outpatient'} />
          <HiddenField name="labRequests" value={JSON.stringify(labRequests)} />
          <HiddenField name="prescriptions" value={JSON.stringify(prescriptions)} />
          <HiddenField name="isReferred" value={selectedDisposition === 'Refer' ? 'on' : ''} />
          {selectedDisposition !== 'Refer' && <>
            <HiddenField name="referralDepartment" value="" />
            <HiddenField name="referralReason" value="" />
          </>}
          <HiddenField name="qualification" value={selectedDisposition === 'Refer' ? referral.qualification : ''} />
          <HiddenField name="referredBy" value={selectedDisposition === 'Refer' ? referral.referredBy || doctor?.name : ''} />
          <HiddenField name="referralSignature" value={selectedDisposition === 'Refer' ? referral.signature : ''} />
          <HiddenField name="emergencyReferral" value={selectedDisposition === 'Refer' && referralEmergency ? 'on' : ''} />
          <HiddenField name="ambulanceDriver" value={selectedDisposition === 'Refer' ? referral.ambulanceDriver : ''} />
          <HiddenField name="takeOffTime" value={selectedDisposition === 'Refer' ? referral.takeOffTime : ''} />
          <HiddenField name="remark" value={selectedDisposition === 'Refer' ? referral.remark : ''} />
        </form>

        {activePanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={activePanel === 'lab' ? 'Laboratory request' : 'Prescription pad'}>
            <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-[#f2f6fc] shadow-2xl">
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {activePanel === 'lab' ? 'Laboratory Request' : 'Prescription Pad'}
                  </h2>
                  <p className="text-xs text-slate-500">{patientName} · {patient?.cardNumber || patient?.patientId || ''}</p>
                </div>
                <button type="button" onClick={() => setActivePanel('')} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close">
                  <X size={18} />
                </button>
              </header>
              <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
                {activePanel === 'lab' ? (
                  <LabRequestForm
                    patient={patient}
                    requestBy={doctor?.name || ''}
                    requests={labRequestsForVisit}
                    onSubmit={submitLabRequest}
                    onOpenQueue={() => {
                      setActivePanel('');
                      onNavigate?.('Patient Queue');
                    }}
                    onUpdateProcessing={onLabUpdateProcessing}
                    onSaveResults={onLabSaveResults}
                    onApproveResults={onLabApproveResults}
                    canProcessResults={false}
                    submitting={saving}
                    error={error}
                    notice={notice}
                  />
                ) : (
                  <PrescriptionPaper
                    key={`${prescriptionVisit?._id || patient?.visitId}:${JSON.stringify(prescriptionVisit?.examination?.prescriptions || [])}`}
                    visit={prescriptionVisit || patient}
                    doctor={doctor}
                    onCheckMedicineStock={onCheckMedicineStock}
                    onSubmit={submitPrescription}
                    saving={saving}
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

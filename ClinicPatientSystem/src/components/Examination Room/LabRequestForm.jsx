import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FlaskConical,
  Printer,
  Save,
  Send,
} from 'lucide-react';
import { labTestCategories } from './LabTestCatalog.js';

const emptyTests = () => Object.fromEntries(
  labTestCategories.map((category) => [category.name, []]),
);
const toDateInputValue = (date = new Date()) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

function LabRequestForm({
  patient,
  requestBy,
  requests = [],
  onSubmit,
  onOpenQueue,
  onUpdateProcessing,
  onSaveResults,
  onApproveResults,
  canProcessResults = false,
  submitting = false,
  error = '',
  notice = '',
}) {
  const [selectedTests, setSelectedTests] = useState(emptyTests);
  const [clinicalNote, setClinicalNote] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [activeLabTab, setActiveLabTab] = useState('form');
  const [resultDraftsByVisit, setResultDraftsByVisit] = useState({});
  const [reportDatesByVisit, setReportDatesByVisit] = useState({});
  const [todayInput] = useState(toDateInputValue);

  const selectedCount = Object.values(selectedTests).reduce((count, items) => count + items.length, 0);

  const toggleTest = (categoryName, code) => {
    setSelectedTests((current) => {
      const currentItems = current[categoryName] || [];
      return {
        ...current,
        [categoryName]: currentItems.includes(code)
          ? currentItems.filter((item) => item !== code)
          : [...currentItems, code],
      };
    });
  };

  const toggleCategory = (categoryName, codes, checked) => {
    setSelectedTests((current) => ({
      ...current,
      [categoryName]: checked ? codes : [],
    }));
  };

  const toggleLftPanel = (checked) => {
    const category = labTestCategories.find((item) => item.name === 'V. Blood chemistry');
    const lftCodes = category?.items
      .filter(([code]) => ['SGOT', 'SGPT', 'BILIRUBIN_TOTAL', 'BILIRUBIN_DIRECT', 'TOTAL_PROTEIN', 'ALK_PHOS'].includes(code))
      .map(([code]) => code) || [];
    setSelectedTests((current) => {
      const currentItems = current['V. Blood chemistry'] || [];
      return {
        ...current,
        'V. Blood chemistry': checked
          ? [...new Set([...currentItems, ...lftCodes])]
          : currentItems.filter((code) => !lftCodes.includes(code)),
      };
    });
  };

  const clearForm = () => {
    setSelectedTests(emptyTests());
    setClinicalNote('');
    setUrgent(false);
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!patient) return;
    const tests = labTestCategories.flatMap((category) => category.items
      .filter(([code]) => selectedTests[category.name]?.includes(code))
      .map(([testCode, testName]) => ({ testCode, testName })));
    if (!tests.length) return;
    const saved = await onSubmit?.({ tests, clinicalNote, priority: urgent ? 'urgent' : 'normal' });
    if (saved) clearForm();
  };

  const requestGroups = useMemo(() => Object.values(requests.reduce((groups, request) => {
    const key = request.visitId || request.patientId || request.patientName;
    if (!groups[key]) groups[key] = { ...request, tests: [] };
    groups[key].tests.push(request);
    return groups;
  }, {})).sort((left, right) => new Date(right.visitDate || 0) - new Date(left.visitDate || 0)), [requests]);
  const selectedRequest = requestGroups.find((group) => group.visitId === selectedVisitId) || requestGroups[0];
  const selectedVisitKey = selectedRequest?.visitId || '';
  const savedResultDrafts = Object.fromEntries((selectedRequest?.tests || []).map((test) => [
    test.testCode || test.testName,
    {
      result: test.result || '',
      unit: test.unit || '',
      referenceRange: test.referenceRange || '',
      flag: test.flag || '',
    },
  ]));
  const resultDrafts = resultDraftsByVisit[selectedVisitKey] || savedResultDrafts;
  const dateOfReport = reportDatesByVisit[selectedVisitKey]
    || (selectedRequest?.labDateOfReport ? toDateInputValue(selectedRequest.labDateOfReport) : todayInput);

  const updateResultDraft = (testCode, field, value) => {
    setResultDraftsByVisit((current) => ({
      ...current,
      [selectedVisitKey]: {
        ...(current[selectedVisitKey] || savedResultDrafts),
        [testCode]: {
          ...(current[selectedVisitKey]?.[testCode] || savedResultDrafts[testCode]),
          [field]: value,
        },
      },
    }));
  };
  const calculateFlag = (draft) => {
    if (!String(draft.result ?? '').trim()) return draft.flag || '—';
    const value = Number(draft.result);
    const range = String(draft.referenceRange ?? '').match(/^\s*(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!Number.isFinite(value) || !range) return draft.flag || '—';
    const low = Number(range[1]);
    const high = Number(range[2]);
    return value < low ? 'LOW' : value > high ? 'HIGH' : 'NORMAL';
  };

  const latestRequest = requestGroups[0];
  const patientName = patient?.name || patient?.patientName || '';
  const mrn = patient?.cardNumber || patient?.patientId || '—';
  const age = patient?.age ?? '—';
  const sex = patient?.sex || patient?.gender || '—';
  const displayDate = patient?.visitDate
    ? new Date(patient.visitDate).toLocaleDateString()
    : '—';
  const labStatus = selectedRequest?.labStatus || selectedRequest?.status || 'Pending';
  const workflowSteps = ['Pending', 'Sample Collected', 'In Progress', 'Results Ready', 'Reviewed'];
  const workflowStep = workflowSteps.indexOf(labStatus);
  const saveResults = () => {
    if (!selectedRequest || !onSaveResults) return;
    const results = selectedRequest.tests.map((test) => ({
      testCode: test.testCode || test.testName,
      ...resultDrafts[test.testCode || test.testName],
      flag: calculateFlag(resultDrafts[test.testCode || test.testName] || {}),
    }));
    void onSaveResults({
      visitId: selectedRequest.visitId,
      results,
      dateOfReport,
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 text-slate-900">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .lab-request-print, .lab-request-print * { visibility: visible !important; }
          .lab-request-print { position: fixed !important; inset: 0 auto auto 0 !important; width: 100% !important; min-height: 0 !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; padding: 8mm !important; box-shadow: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .lab-request-screen-only { display: none !important; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#102b56] md:text-2xl">Laboratory Request Form</h1>
          <p className="mt-1 text-xs text-slate-500">MAU Clinic · Examination Room</p>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <section className="flex w-full min-w-0 flex-col gap-5">
        <div className="flex border-b border-slate-200" role="tablist" aria-label="Laboratory requests and results">
          <button
            type="button"
            role="tab"
            aria-selected={activeLabTab === 'form'}
            onClick={() => setActiveLabTab('form')}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${activeLabTab === 'form' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Request Form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeLabTab === 'requests'}
            onClick={() => setActiveLabTab('requests')}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${activeLabTab === 'requests' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Current Requests <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{requestGroups.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeLabTab === 'results'}
            onClick={() => setActiveLabTab('results')}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${activeLabTab === 'results' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Lab Result
          </button>
        </div>

        <div className="min-w-0 space-y-3">
          {activeLabTab === 'form' && <>
          <form onSubmit={submitRequest} className="space-y-3">
            {!patient && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span>Call a patient into Current Consultation before submitting a request.</span>
                <button type="button" onClick={onOpenQueue} className="rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white transition hover:bg-blue-800">
                  Open Patient Queue
                </button>
              </div>
            )}
            <article className="overflow-hidden rounded-xl border border-amber-800/50 bg-[#e8c94e] shadow-lg">
            <div className="lab-request-print min-w-0 bg-[#e8c94e] p-5 font-serif text-[#332b1b] sm:p-7 lg:p-8">
            <header className="mb-4 border-b border-amber-900/40 pb-4 text-center leading-tight">
              <p className="text-lg font-bold tracking-wide sm:text-xl">MEKDELA AMBA UNIVERSITY</p>
              <h2 className="mt-1 text-xl font-bold uppercase underline underline-offset-2 sm:text-2xl">Laboratory Request Form</h2>
            </header>

            <>
                <div className="grid grid-cols-1 gap-3 border-b border-amber-900/50 pb-4 text-sm leading-6 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="grid grid-cols-4 items-end gap-x-3 gap-y-2">
                    <p className="col-span-2 border-b border-amber-900/60"><strong>Name</strong> <span className="ml-1">{patientName || '____________'}</span></p>
                    <p className="border-b border-amber-900/60"><strong>Age</strong> <span className="ml-1">{age === '—' ? '____' : age}</span></p>
                    <p className="border-b border-amber-900/60"><strong>Sex</strong> <span className="ml-1">{sex === '—' ? '____' : sex}</span></p>
                    <p className="col-span-2 border-b border-amber-900/60"><strong>Request By</strong> <span className="ml-1">{requestBy || '____________'}</span></p>
                    <p className="col-span-2 border-b border-amber-900/60"><strong>Record No.</strong> <span className="ml-1">{mrn === '—' ? '____________' : mrn}</span></p>
                    <p className="col-span-4 border-b border-amber-900/60"><strong>Sign</strong> <span className="ml-1">________________________</span></p>
                  </div>
                  <div className="grid grid-cols-1 gap-y-1 sm:content-start">
                    <p className="border-b border-amber-900/60"><strong>Tel.</strong> <span className="ml-1">{patient?.telephone || patient?.phoneNumber || '________'}</span></p>
                    <p className="border-b border-amber-900/60"><strong>Po.Box</strong> <span className="ml-1">{patient?.poBox || patient?.pobox || '________'}</span></p>
                    <p className="border-b border-amber-900/60"><strong>Date</strong> <span className="ml-1">{displayDate === '—' ? '________' : displayDate}</span></p>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 pt-5 sm:grid-cols-3">
                  {[[labTestCategories[0], labTestCategories[1]], [labTestCategories[2], labTestCategories[3]], [labTestCategories[4], labTestCategories[5]]].map((column, columnIndex) => (
                    <div key={columnIndex} className="min-w-0 space-y-5">
                      {column.map((category) => {
                        const selected = selectedTests[category.name] || [];
                        const categoryCodes = category.items.map(([code]) => code);
                        const allSelected = categoryCodes.every((code) => selected.includes(code));
                        const lftCodes = ['SGOT', 'SGPT', 'BILIRUBIN_TOTAL', 'BILIRUBIN_DIRECT', 'TOTAL_PROTEIN', 'ALK_PHOS'];
                        const lftSelected = lftCodes.every((code) => selected.includes(code));
                        return (
                          <fieldset key={category.name} className="min-w-0 border-t border-amber-900/35 pt-2">
                            <legend className="mb-1 text-sm font-bold uppercase underline underline-offset-2">{category.name}</legend>
                            <label className="lab-request-screen-only mb-1 flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(event) => toggleCategory(category.name, categoryCodes, event.target.checked)}
                                className="h-4 w-4 accent-amber-800"
                              />
                              Select all
                            </label>
                            {category.name === 'V. Blood chemistry' && (
                              <label className="lab-request-screen-only mb-1 flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                                <input
                                  type="checkbox"
                                  checked={lftSelected}
                                  onChange={(event) => toggleLftPanel(event.target.checked)}
                                  className="h-4 w-4 accent-amber-800"
                                />
                                LFT panel
                              </label>
                            )}
                            <div className="space-y-0.5">
                              {category.items.map(([code, testName]) => {
                                if (code === 'RBS') return null;
                                if (code === 'FBS') {
                                  const rbs = category.items.find(([itemCode]) => itemCode === 'RBS');
                                  return (
                                    <div key="FBS-RBS" className="flex min-h-8 items-end gap-2 text-sm leading-6">
                                      {[['FBS', testName], rbs].filter(Boolean).map(([itemCode, itemName]) => (
                                        <label key={itemCode} className="flex min-w-0 flex-1 cursor-pointer items-end gap-1">
                                          <input
                                            type="checkbox"
                                            checked={selected.includes(itemCode)}
                                            onChange={() => toggleTest(category.name, itemCode)}
                                            className="mb-0.5 h-4 w-4 shrink-0 accent-amber-800"
                                          />
                                          <span>{itemName}</span>
                                          <span aria-hidden="true" className="mb-0.5 min-w-3 flex-1 border-b border-amber-900/60" />
                                        </label>
                                      ))}
                                    </div>
                                  );
                                }
                                return (
                                  <div key={code}>
                                    {code === 'SGOT' && <p className="py-1 text-center text-xs font-bold uppercase">LFT</p>}
                                    <label className="flex min-h-8 cursor-pointer items-end gap-2 text-sm leading-6">
                                      <input
                                        type="checkbox"
                                        checked={selected.includes(code)}
                                        onChange={() => toggleTest(category.name, code)}
                                        className="mb-0.5 h-4 w-4 shrink-0 accent-amber-800"
                                      />
                                      <span className="shrink-0">{testName}</span>
                                      <span aria-hidden="true" className="mb-0.5 min-w-3 flex-1 border-b border-amber-900/60" />
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </fieldset>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <footer className="mt-5 grid grid-cols-2 gap-4 border-t border-amber-900/35 pt-4 text-sm leading-6">
                  <p>Tested: ____________________<br />Signature of Lab Tech: ____________________</p>
                  <p>Date of Report: ____________________<br />Approved By: _____________</p>
                </footer>
            </>
            </div>
            </article>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-sm font-bold text-rose-800 transition hover:bg-rose-100">
                <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="h-4 w-4 accent-rose-700" />
                <AlertTriangle size={16} /> Urgent (STAT)
              </label>
              <p className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{selectedCount} test(s) selected</p>
            </div>

            <label className="block rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 shadow-sm">
              Clinical Note to Lab
              <textarea
                value={clinicalNote}
                onChange={(event) => setClinicalNote(event.target.value)}
                rows="2"
                maxLength={1000}
                placeholder="Clinical indication or note for the laboratory"
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-normal transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              <button type="button" onClick={clearForm} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Clear</button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-bold text-amber-900 transition hover:bg-amber-50">
                <Printer size={14} /> Print
              </button>
              <button type="submit" disabled={!patient || !selectedCount || submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                <Send size={14} /> {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
          </>}

          {activeLabTab === 'requests' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex min-h-12 items-center justify-between gap-2 bg-[#0b4e9a] px-4 text-white">
              <h2 className="flex items-center gap-2 text-base font-bold"><FlaskConical size={18} /> Current Requests</h2>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{requestGroups.length}</span>
            </div>
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {requestGroups.map((request) => {
                const status = request.labStatus || request.status || 'Pending';
                return (
                  <button
                    key={request.visitId || request.patientId}
                    type="button"
                    onClick={() => {
                      setSelectedVisitId(request.visitId);
                      setActiveLabTab('results');
                    }}
                    aria-pressed={request.visitId === selectedRequest?.visitId}
                    className={`w-full px-3 py-2.5 text-left hover:bg-blue-50 ${request.visitId === selectedRequest?.visitId ? 'bg-blue-50' : ''}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-xs text-[#102b56]">{request.patientName || patientName || 'Patient'}</strong>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${status === 'Reviewed' ? 'bg-emerald-100 text-emerald-800' : status === 'Results Ready' ? 'bg-teal-100 text-teal-800' : status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'}`}>{status}</span>
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-500">
                      {request.labRequestNumber || 'Request'} · MRN {request.mrn || request.patientId || '—'} · {request.tests.length} test(s)
                    </span>
                  </button>
                );
              })}
              {!requestGroups.length && <p className="p-5 text-center text-sm text-slate-500">No laboratory requests are recorded today.</p>}
            </div>
          </section>}
        </div>

        {activeLabTab === 'results' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-11 items-center justify-between gap-3 bg-[#0b4e9a] px-4 text-white">
            <h2 className="flex items-center gap-2 text-sm font-bold"><FlaskConical size={18} /> Lab Result</h2>
            {selectedRequest && <span className="rounded bg-white/15 px-2 py-1 text-xs font-semibold">{selectedRequest.labRequestNumber || 'Lab Request'}</span>}
          </div>
          {selectedRequest ? (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#102b56]">{selectedRequest.patientName || patientName || 'Patient'}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    MRN: {selectedRequest.mrn || selectedRequest.patientId || '—'} · {selectedRequest.visitDate ? new Date(selectedRequest.visitDate).toLocaleString() : displayDate}
                  </p>
                  {selectedRequest.clinicalNote && <p className="mt-1 text-xs text-slate-600">Clinical note: {selectedRequest.clinicalNote}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${labStatus === 'Reviewed' ? 'bg-emerald-100 text-emerald-800' : labStatus === 'Results Ready' ? 'bg-teal-100 text-teal-800' : labStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'}`}>{labStatus}</span>
              </div>

              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Laboratory request progress">
                {workflowSteps.map((step, index) => (
                  <li key={step} className={`flex items-center gap-1.5 rounded-md px-2 py-2 text-[10px] font-semibold ${workflowStep >= index ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-400'}`}>
                    {workflowStep > index ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="lab-request-screen-only flex flex-wrap gap-2">
                {canProcessResults && labStatus === 'Pending' && (
                  <button type="button" disabled={submitting} onClick={() => onUpdateProcessing?.({ visitId: selectedRequest.visitId, action: 'collect-sample' })} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                    Collect Sample
                  </button>
                )}
                {canProcessResults && labStatus === 'Sample Collected' && (
                  <button type="button" disabled={submitting} onClick={() => onUpdateProcessing?.({ visitId: selectedRequest.visitId, action: 'start-processing' })} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                    Start Processing
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr><th className="px-2 py-2">Test</th><th className="px-2 py-2">Result</th><th className="px-2 py-2">Unit</th><th className="px-2 py-2">Reference range</th><th className="px-2 py-2">Flag</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequest.tests.map((test) => {
                      const code = test.testCode || test.testName;
                      const draft = resultDrafts[code] || { result: '', unit: '', referenceRange: '', flag: '' };
                      const editable = canProcessResults && ['In Progress', 'Results Ready'].includes(labStatus);
                      return (
                        <tr key={code}>
                          <td className="px-2 py-2 font-semibold text-slate-800">{test.testName}</td>
                          {['result', 'unit', 'referenceRange'].map((field) => (
                            <td key={field} className="px-2 py-2">
                              <input
                                aria-label={`${test.testName} ${field}`}
                                value={draft[field]}
                                disabled={!editable}
                                onChange={(event) => updateResultDraft(code, field, event.target.value)}
                                className="w-full min-w-20 rounded border border-slate-300 px-2 py-1.5 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <span className={`rounded px-1.5 py-1 text-[10px] font-bold ${calculateFlag(draft) === 'HIGH' || calculateFlag(draft) === 'LOW' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
                              {calculateFlag(draft)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                <p className="text-xs text-slate-600"><strong>Tested by:</strong> {selectedRequest.labTestedBy || 'Not recorded'}</p>
                <label className="text-xs text-slate-600"><strong>Date of report</strong>
                  <input type="date" value={dateOfReport} disabled={!canProcessResults || labStatus === 'Reviewed'} onChange={(event) => setReportDatesByVisit((current) => ({ ...current, [selectedVisitKey]: event.target.value }))} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50" />
                </label>
                <p className="text-xs text-slate-600"><strong>Approved by:</strong> {selectedRequest.labApprovedBy || 'Not approved'}</p>
              </div>

              {canProcessResults && ['In Progress', 'Results Ready'].includes(labStatus) && (
                <div className="lab-request-screen-only flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                  <button type="button" disabled={submitting || selectedRequest.tests.some((test) => !(resultDrafts[test.testCode || test.testName]?.result || '').trim())} onClick={saveResults} className="inline-flex items-center gap-1.5 rounded-md border border-blue-700 px-3 py-2 text-xs font-bold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <Save size={14} /> {submitting ? 'Saving…' : 'Save Results'}
                  </button>
                  {labStatus === 'Results Ready' && (
                    <button type="button" disabled={submitting} onClick={() => onApproveResults?.(selectedRequest.visitId)} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                      <ClipboardCheck size={14} /> Approve Results
                    </button>
                  )}
                </div>
              )}
              {labStatus === 'Reviewed' && <p className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><Check size={15} /> Results approved on {selectedRequest.labApprovedAt ? new Date(selectedRequest.labApprovedAt).toLocaleString() : '—'}.</p>}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-slate-500">
              <FlaskConical className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 font-semibold">No laboratory request selected</p>
              <p className="mt-1 text-xs">Submit a laboratory request or choose an existing request to view its status.</p>
            </div>
          )}
          {latestRequest && <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">Latest request: <strong>{latestRequest.patientName || patientName || 'patient'}</strong></p>}
        </section>}
      </section>
    </div>
  );
}

export default LabRequestForm;

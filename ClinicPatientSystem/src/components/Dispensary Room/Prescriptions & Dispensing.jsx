import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, FileText, Pill, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const PrescriptionsDispensing = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingPrescriptions, setPendingPrescriptions] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingVisitId, setProcessingVisitId] = useState('');
  const [verificationSavingVisitId, setVerificationSavingVisitId] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [priceInputs, setPriceInputs] = useState({});

  const loadPendingPrescriptions = useCallback(async () => {
    const response = await fetch('/api/dispensary/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !result.data) {
      throw new Error(result?.message || `Unable to load prescriptions (${response.status}).`);
    }
    const prescriptions = result.data.pendingPrescriptions || [];
    setPendingPrescriptions(prescriptions.map((visit) => ({
      ...visit,
      verificationSelection: visit.allergyVerification || '',
    })));
    setPriceInputs((current) => Object.fromEntries(prescriptions.flatMap((visit) => visit.prescriptions.map((item) => {
      const currentPrice = current[item.id];
      const priceCents = Number(item.priceCents) || 0;
      return [item.id, currentPrice || {
        birr: String(Math.floor(priceCents / 100)),
        cent: String(priceCents % 100).padStart(2, '0'),
      }];
    }))));
  }, [token]);

  const loadHistory = useCallback(async () => {
    const response = await fetch('/api/dispensary/history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !Array.isArray(result.data)) {
      throw new Error(result?.message || `Unable to load dispensing history (${response.status}).`);
    }
    setHistoryLogs(result.data);
  }, [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadPendingPrescriptions();
      if (activeTab === 'history') await loadHistory();
    } catch (loadError) {
      console.error('Failed to load prescriptions and dispensing data:', loadError);
      setError(loadError.message || 'Unable to load prescriptions and dispensing data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadHistory, loadPendingPrescriptions]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData, refreshKey]);

  const saveAllergyVerification = async (visit) => {
    const verification = visit.verificationSelection || '';
    if (!verification) {
      setError('Select the patient allergy status before saving verification.');
      return;
    }
    setVerificationSavingVisitId(visit.visitId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/dispensary/prescriptions/${encodeURIComponent(visit.visitId)}/allergy-verification`, {
        method: 'PATCH',
        headers: {
          Authorization: ['Bearer', token].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ verification }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to save allergy verification (${response.status}).`);
      }
      setSuccess(result.message || 'Patient allergy verification saved.');
      await loadPendingPrescriptions();
    } catch (verificationError) {
      console.error('Failed to save prescription allergy verification:', verificationError);
      setError(verificationError.message || 'Unable to save patient allergy verification.');
    } finally {
      setVerificationSavingVisitId('');
    }
  };

  const updatePrescription = async (visit, status) => {
    const prices = visit.prescriptions.map((item) => {
      const value = priceInputs[item.id] || { birr: '0', cent: '00' };
      return { id: item.id, priceCents: Number(value.birr) * 100 + Number(value.cent) };
    });
    if (visit.prescriptions.some((item) => {
      const value = priceInputs[item.id] || { birr: '0', cent: '00' };
      return !/^\d+$/.test(value.birr) || !/^\d{1,2}$/.test(value.cent) || Number(value.cent) > 99;
    })) {
      setError('Enter whole Birr and Cent values (Cent must be between 0 and 99) for every medicine.');
      return;
    }
    setProcessingVisitId(visit.visitId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/dispensary/prescriptions/${encodeURIComponent(visit.visitId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          prices,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to update prescription (${response.status}).`);
      }
      await loadData();
    } catch (updateError) {
      console.error('Failed to process prescription:', updateError);
      setError(updateError.message || 'Unable to process prescription.');
    } finally {
      setProcessingVisitId('');
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-slate-100 px-2 py-4 text-xs sm:px-4 sm:py-6 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sky-100 p-2.5 text-sky-700"><Pill className="h-5 w-5" /></div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Prescriptions &amp; Dispensing</h1>
            <p className="text-[11px] text-slate-500">Doctor prescriptions, stock availability, and dispensing history</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('pending')} className={`rounded-lg px-4 py-2 font-bold shadow-sm ${activeTab === 'pending' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Pending Orders ({pendingPrescriptions.length})
          </button>
          <button type="button" onClick={() => setActiveTab('history')} className={`rounded-lg px-4 py-2 font-bold shadow-sm ${activeTab === 'history' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Dispensing History
          </button>
          <button type="button" aria-label="Refresh prescriptions" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
      {loading && <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600">Loading prescription data…</p>}

      {!loading && activeTab === 'pending' && (
        pendingPrescriptions.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            <Check className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="font-semibold text-slate-700">No pending prescriptions in the queue.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingPrescriptions.map((visit) => {
              const knownAllergies = (visit.allergies || []).filter((allergy) => (
                typeof allergy === 'string' && allergy.trim() && !/^(nka|no known allergies)$/i.test(allergy.trim())
              ));
              const expectedVerification = knownAllergies.length > 0 ? 'known-allergies' : 'nka';
              const currentSelection = visit.verificationSelection ?? visit.allergyVerification ?? '';
              const verificationSelection = currentSelection === expectedVerification ? currentSelection : '';
              const verificationIsCurrent = Boolean(
                visit.allergyReviewed && verificationSelection === visit.allergyVerification,
              );
              const hasAvailableStock = visit.prescriptions.every((medicine) => (
                Number(medicine.stock?.quantity) >= Number(medicine.quantity)
                && Number(medicine.quantity) > 0
                && /^\d+(?:\.\d+)?$/.test(String(medicine.quantity || '').trim())
              ));
              const totalCents = visit.prescriptions.reduce((total, item) => {
                const price = priceInputs[item.id] || { birr: '0', cent: '00' };
                return total + (Number(price.birr) || 0) * 100 + (Number(price.cent) || 0);
              }, 0);
              return (
                <article key={visit.visitId} className="mx-auto w-full max-w-6xl space-y-4 rounded-xl border border-slate-300 bg-white p-4 font-serif text-slate-900 shadow-sm sm:p-6 lg:p-8">
                  <header className="border-b border-slate-700 pb-2 text-center">
                    <h2 className="text-lg font-extrabold tracking-wide">MEKDELA AMBA UNIVERSITY</h2>
                    <p className="text-xs font-bold uppercase underline">Prescription Paper</p>
                    <p className="mt-1 text-[11px] text-slate-600">{visit.visitNumber || visit.visitId} · {formatDate(visit.visitDate)}</p>
                  </header>

                  <div className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
                    <p><strong>Patient’s Full Name:</strong> {visit.patientName || '—'}</p>
                    <p><strong>Sex:</strong> {visit.sex || '—'}</p>
                    <p><strong>Age:</strong> {visit.age ?? '—'}</p>
                    <p><strong>Weight:</strong> {visit.weight ? `${visit.weight} kg` : '—'}</p>
                    <p><strong>Card No. / MRN:</strong> {visit.cardNumber || '—'}</p>
                    <p><strong>ID No.:</strong> {visit.governmentIdNumber || visit.studentId || '—'}</p>
                    <p><strong>Tel. No.:</strong> {visit.phoneNumber || '—'}</p>
                    <p><strong>Patient type:</strong> {visit.patientType === 'inpatient' ? 'Inpatient' : 'Outpatient'}</p>
                    <p><strong>Region:</strong> {visit.region || '—'}</p>
                    <p><strong>Town:</strong> {visit.town || '—'}</p>
                    <p><strong>Woreda:</strong> {visit.woreda || '—'}</p>
                    <p><strong>Kebele:</strong> {visit.kebele || '—'}</p>
                    <p className="sm:col-span-2 lg:col-span-4"><strong>Diagnosis:</strong> {visit.diagnosis || '—'}</p>
                    <p><strong>Prescriber:</strong> {visit.prescriber?.name || '—'}</p>
                    <p><strong>Prescription status:</strong> <span className="font-bold text-amber-800">{visit.status || 'Pending'}</span></p>
                  </div>

                  {knownAllergies.length > 0 ? (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 font-bold text-rose-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p>Allergy warning: {knownAllergies.join(', ')}</p>
                        <p className="mt-1 text-[11px] font-medium">{verificationIsCurrent
                          ? 'These known allergies were reviewed with the patient.'
                          : 'Review these allergies against the prescribed medicines and confirm them with the patient.'}</p>
                      </div>
                    </div>
                  ) : verificationIsCurrent ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>No Known Allergies (NKA) was confirmed with the patient.</p>
                    </div>
                  ) : (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>Allergy status not recorded — verify directly with the patient before dispensing.</p>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
                      <thead><tr>
                        <th className="w-[70%] border border-slate-600 p-2">Drug Treatment: Name, Strength, Dosage Form, Dose, Frequency, Duration, Quantity, How to Use &amp; Other Information</th>
                        <th colSpan="2" className="border border-slate-600 p-2 text-center">Price <span className="block font-normal">Dispenser use only</span></th>
                      </tr><tr>
                        <th className="border border-slate-600 p-1" />
                        <th className="border border-slate-600 p-1 text-center font-normal">Birr</th>
                        <th className="border border-slate-600 p-1 text-center font-normal">Cent</th>
                      </tr></thead>
                      <tbody>
                        {visit.prescriptions.map((medicine) => (
                          <tr key={medicine.id} className="align-top">
                            <td className="border border-slate-600 p-2">
                              <p className="font-bold">{medicine.medicine} {medicine.strength} {medicine.form}</p>
                              <p>{[medicine.dose, medicine.frequency, medicine.duration, [medicine.quantity, medicine.quantityUnit].filter(Boolean).join(' '), medicine.instructions].filter(Boolean).join(' · ') || 'No usage instructions recorded'}</p>
                              <p className={`mt-1 font-bold ${medicine.stock?.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                Stock: {medicine.stock?.quantity > 0 ? `${medicine.stock.quantity} ${medicine.stock.unit || ''} available` : 'Out of stock'}
                              </p>
                            </td>
                            <td className="border border-slate-600 p-1">
                              <input aria-label={`${medicine.medicine} price in Birr`} type="number" min="0" step="1" value={priceInputs[medicine.id]?.birr ?? '0'} onChange={(event) => setPriceInputs((current) => ({ ...current, [medicine.id]: { ...current[medicine.id], birr: event.target.value } }))} className="w-full min-w-12 rounded border border-slate-300 px-1 py-1 text-center" />
                            </td>
                            <td className="border border-slate-600 p-1">
                              <input aria-label={`${medicine.medicine} price in cents`} type="number" min="0" max="99" step="1" value={priceInputs[medicine.id]?.cent ?? '00'} onChange={(event) => setPriceInputs((current) => ({ ...current, [medicine.id]: { ...current[medicine.id], cent: event.target.value } }))} className="w-full min-w-12 rounded border border-slate-300 px-1 py-1 text-center" />
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td className="border border-slate-600 p-2 text-right font-bold">Total Price</td>
                          <td colSpan="2" className="border border-slate-600 p-2 text-center font-semibold">{Math.floor(totalCents / 100)} Birr {String(totalCents % 100).padStart(2, '0')} Cent</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <footer className="grid gap-3 border-t border-slate-300 pt-3 text-[11px] sm:grid-cols-3">
                    <div><strong className="underline">Prescriber’s</strong><p>Name: {visit.prescriber?.name || '—'}</p><p>Qualification: {visit.prescriber?.qualification || '—'}</p><p>Registration: {visit.prescriber?.registration || '—'}</p><p>Date: {formatDate(visit.prescriber?.signedAt)}</p></div>
                    <div><strong className="underline">Evaluator’s (Pharmacist / Dispenser)</strong><p>Name: {visit.evaluatedBy || user?.name || '—'}</p><p>Date: {visit.evaluatedAt ? formatDate(visit.evaluatedAt) : 'Recorded when order is processed'}</p><p>Allergy review: {visit.allergyReviewed ? `${visit.allergyVerification === 'nka' ? 'NKA confirmed' : 'Known allergies reviewed'} by ${visit.allergyReviewedBy} · ${formatDate(visit.allergyReviewedAt)}` : visit.allergyReviewedBy ? 'Re-verify: patient allergy record has changed' : 'Required before dispensing'}</p></div>
                    <div><strong className="underline">Dispenser’s</strong><p>Name: {visit.dispensedBy || '—'}</p><p>Date: {formatDate(visit.dispensedAt)}</p></div>
                  </footer>

                  <div className="flex flex-wrap justify-end gap-2 border-t pt-3 font-sans">
                    <button type="button" disabled={processingVisitId === visit.visitId} onClick={() => void updatePrescription(visit, 'Cancelled')} className="rounded-lg border border-rose-200 px-4 py-2 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancel order</button>
                    <div className="mr-auto flex flex-wrap items-center gap-2 text-xs font-sans font-semibold text-slate-700">
                      <label htmlFor={`allergy-verification-${visit.visitId}`}>Confirm with patient:</label>
                      <select
                        id={`allergy-verification-${visit.visitId}`}
                        value={verificationSelection}
                        onChange={(event) => setPendingPrescriptions((current) => current.map((item) => item.visitId === visit.visitId
                          ? { ...item, verificationSelection: event.target.value }
                          : item))}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-2"
                      >
                        <option value="">Select allergy status</option>
                        {knownAllergies.length > 0
                          ? <option value="known-allergies">Known allergies reviewed</option>
                          : <option value="nka">No Known Allergies (NKA)</option>}
                      </select>
                      <button
                        type="button"
                        disabled={!verificationSelection
                          || verificationIsCurrent
                          || verificationSavingVisitId === visit.visitId
                          || processingVisitId === visit.visitId}
                        onClick={() => void saveAllergyVerification({ ...visit, verificationSelection })}
                        className="rounded-lg border border-blue-300 px-3 py-2 font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {verificationSavingVisitId === visit.visitId ? 'Saving…' : verificationIsCurrent ? 'Verification Saved' : 'Save Verification'}
                      </button>
                    </div>
                    <button type="button" disabled={!hasAvailableStock || !verificationIsCurrent || processingVisitId === visit.visitId} onClick={() => void updatePrescription(visit, 'Dispensed')} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <Check className="h-4 w-4" /> {processingVisitId === visit.visitId ? 'Saving…' : 'Confirm & Dispense'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {!loading && activeTab === 'history' && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 border-b pb-3 font-bold text-slate-800"><FileText className="h-4 w-4 text-sky-600" />Dispensing History</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead><tr className="border-b text-slate-500">
                <th className="p-2">Patient ID / MRN</th><th className="p-2">Medicine</th><th className="p-2">Quantity</th><th className="p-2">Dispensed by</th><th className="p-2">Date &amp; Time</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {historyLogs.map((log) => (
                  <tr key={log._id}>
                    <td className="p-2 font-semibold text-slate-800">{log.dispensedToPatientId || '—'}</td>
                    <td className="p-2">{log.medicineName}</td>
                    <td className="p-2">{log.quantityDispensed}</td>
                    <td className="p-2">{log.dispensedByDoctorOrPharmacist || '—'}</td>
                    <td className="p-2 text-slate-500">{formatDate(log.dispensedAt)}</td>
                  </tr>
                ))}
                {!historyLogs.length && <tr><td colSpan="5" className="p-6 text-center text-slate-500">No dispensing history found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default PrescriptionsDispensing;

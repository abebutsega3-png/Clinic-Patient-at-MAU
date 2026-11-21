import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';

const getClinicDateInput = () => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const OpdRegister = () => {
  const { token, expireSession } = useAuth();
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [summary, setSummary] = useState({
    totalPatients: 0,
    newPatients: 0,
    repeatPatients: 0,
    referralPatients: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceDate, setServiceDate] = useState(getClinicDateInput);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    let active = true;
    const loadOpdData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ search: searchTerm, date: serviceDate });
        const response = await fetch(`/api/opd?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (response.status === 401) expireSession();
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Unable to load the OPD register (${response.status}).`);
        }
        if (active) {
          setRecords(result.data || []);
          setSummary(result.summary || {
            totalPatients: 0,
            newPatients: 0,
            repeatPatients: 0,
            referralPatients: 0,
          });
        }
      } catch (loadError) {
        if (active && loadError.name !== 'AbortError') {
          setError(loadError.message || 'Unable to load the OPD register.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadOpdData();
    return () => {
      active = false;
      controller.abort();
    };
  }, [searchTerm, serviceDate, token, expireSession, refreshVersion]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io('/', { path: '/socket.io', auth: { token } });
    const refreshOpdRegister = () => setRefreshVersion((version) => version + 1);
    socket.on('opd-register-updated', refreshOpdRegister);
    return () => {
      socket.off('opd-register-updated', refreshOpdRegister);
      socket.disconnect();
    };
  }, [token]);

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800 print:bg-white print:p-0">
      {/* Header */}
      <div className="mb-5 rounded-lg border border-slate-300 bg-white px-5 py-4 text-center shadow-sm print:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Digital Register</p>
        <h1 className="mt-1 text-2xl font-black uppercase text-slate-950">
          Out Patient Department (OPD) Register
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Service Date: {serviceDate.split('-').reverse().join('/')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
        <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-blue-700">Today&apos;s Patients</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{summary.totalPatients}</p>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">New Patients</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{summary.newPatients}</p>
        </div>

        <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-purple-700">Repeat Patients</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{summary.repeatPatients}</p>
        </div>

        <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-700">Referral Patients</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{summary.referralPatients}</p>
        </div>
      </div>

      {/* Search & Date Bar */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 mb-5 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between print:hidden">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search MRN, Patient Name..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
          className="w-full md:w-44 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full md:w-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
        >
          Print Register
        </button>
      </div>

      {(error || (!token && 'Sign in to view the OPD register.')) && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error || 'Sign in to view the OPD register.'}
        </p>
      )}

      {/* OPD Daily Register Table */}
      <div className="bg-white border-2 border-slate-900 shadow-sm overflow-hidden print:border-black">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[1660px] table-fixed border-collapse text-[11px] text-slate-950">
            <thead>
              <tr className="bg-slate-200 text-center font-bold uppercase">
                <th rowSpan="2" className="w-10 border border-slate-900 px-1 py-2">No.</th>
                <th rowSpan="2" className="w-24 border border-slate-900 px-2 py-2">Service Date</th>
                <th colSpan="5" className="border border-slate-900 px-2 py-2">Identification</th>
                <th colSpan="2" className="border border-slate-900 px-2 py-2">Diagnosis</th>
                <th rowSpan="2" className="w-20 border border-slate-900 px-2 py-2">New / Repeat</th>
                <th colSpan="3" className="border border-slate-900 px-2 py-2">HIV / TB Screening</th>
                <th rowSpan="2" className="w-24 border border-slate-900 px-2 py-2">Road Traffic Accident</th>
                <th rowSpan="2" className="w-16 border border-slate-900 px-2 py-2">Referral</th>
                <th rowSpan="2" className="w-14 border border-slate-900 px-2 py-2">Died</th>
                <th rowSpan="2" className="w-20 border border-slate-900 px-2 py-2">Date</th>
                <th rowSpan="2" className="w-28 border border-slate-900 px-2 py-2">Doctor / Signature</th>
                <th rowSpan="2" className="w-20 border border-slate-900 px-2 py-2 print:hidden">Action</th>
              </tr>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-center font-semibold uppercase">
                <th className="w-20 border border-slate-900 px-2 py-2">ID</th>
                <th className="w-20 border border-slate-900 px-2 py-2">MRN</th>
                <th className="w-24 border border-slate-900 px-2 py-2">Patient Name</th>
                <th className="w-16 border border-slate-900 px-2 py-2">Age / Sex</th>
                <th className="w-24 border border-slate-900 px-2 py-2">Address</th>
                <th className="w-28 border border-slate-900 px-2 py-2">Clinical Diagnosis</th>
                <th className="w-20 border border-slate-900 px-2 py-2">NCoD</th>
                <th className="w-32 border border-slate-900 px-2 py-2">HIV / PITCT</th>
                <th className="w-20 border border-slate-900 px-2 py-2">TB Screening</th>
                <th className="w-24 border border-slate-900 px-2 py-2">TB Diagnostic / Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {loading ? (
                <tr>
                  <td colSpan="19" className="h-24 border-r border-slate-900 text-center text-slate-500">
                    Loading OPD daily register...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="19" className="h-24 border-r border-slate-900 text-center text-slate-500">
                    No OPD records found.
                  </td>
                </tr>
              ) : (
                records.map((item, index) => (
                  <tr key={item._id} className="h-12 hover:bg-blue-50/60 transition-colors">
                    <td className="border border-slate-900 px-1 text-center">{index + 1}</td>
                    <td className="border border-slate-900 px-2 text-center">{item.serviceDate || '-'}</td>
                    <td className="border border-slate-900 px-2 font-bold">{item.identification || '-'}</td>
                    <td className="border border-slate-900 px-2 font-bold">{item.mrn || '-'}</td>
                    <td className="border border-slate-900 px-2">{item.patientName || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center">
                      {item.age} / {item.sex}
                    </td>
                    <td className="border border-slate-900 px-2">{item.address || '-'}</td>
                    <td className="border border-slate-900 px-2">{item.diagnosis || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center font-bold">{item.ncodDiagnosis || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center">{item.visitType || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center">{item.hivTbStatus || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center">{item.screening || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center font-bold">{item.testResults || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center">{item.roadTrafficAccident || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center font-bold">{item.referral || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center">{item.died || 'No'}</td>
                    <td className="border border-slate-900 px-2 text-center">{item.date || '-'}</td>
                    <td className="border border-slate-900 px-2 text-center">
                      <span className="block font-bold">{item.doctorName || item.prescriber?.name || '-'}</span>
                      {item.doctorSignature ? (
                        <span className="mt-1 block border-t border-slate-700 text-[9px]">Signed</span>
                      ) : (
                        <span className="mt-1 block border-t border-slate-700 text-[9px] text-slate-400">Signature</span>
                      )}
                    </td>
                    <td className="border border-slate-900 px-2 text-center print:hidden">
                      <button
                        onClick={() => setSelectedRecord(item)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden justify-end gap-16 px-6 pt-8 text-sm font-semibold text-slate-950 print:flex">
          <div className="min-w-52 text-center">
            <div className="mb-2 border-b border-slate-950">____________________________</div>
            <p>Doctor Name</p>
          </div>
          <div className="min-w-52 text-center">
            <div className="mb-2 border-b border-slate-950">____________________________</div>
            <p>Doctor Signature</p>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                OPD Record Details — {selectedRecord.mrn}
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="font-semibold">Identification:</span> {selectedRecord.identification}</p>
              <p><span className="font-semibold">MRN:</span> {selectedRecord.mrn}</p>
              <p><span className="font-semibold">Diagnosis:</span> {selectedRecord.diagnosis}</p>
              <p><span className="font-semibold">Visit Type:</span> {selectedRecord.visitType}</p>
              <p><span className="font-semibold">Age / Sex:</span> {selectedRecord.age} / {selectedRecord.sex}</p>
              <p><span className="font-semibold">Address:</span> {selectedRecord.address || '-'}</p>
              <p><span className="font-semibold">Screening:</span> {selectedRecord.screening}</p>
              <p><span className="font-semibold">NCoD Diagnosis:</span> {selectedRecord.ncodDiagnosis}</p>
              <p><span className="font-semibold">HIV offered / performed:</span> {selectedRecord.hivTestOffered ? 'Yes' : 'No'} / {selectedRecord.hivTestPerformed ? 'Yes' : 'No'}</p>
              <p><span className="font-semibold">HIV target / result:</span> {selectedRecord.hivTargetCode || '-'} / {selectedRecord.hivTestResult || 'N/A'}</p>
              <p><span className="font-semibold">TB screening:</span> {selectedRecord.screenedForTb ? 'Yes' : 'No'} · {selectedRecord.tbScreeningResult || 'N/A'}</p>
              <p><span className="font-semibold">TB diagnostic / result:</span> {selectedRecord.tbDiagnosticCode || '-'} / {selectedRecord.tbResultCode || '-'}</p>
              <p><span className="font-semibold">Test Results:</span> {selectedRecord.testResults}</p>
              <p><span className="font-semibold">RTA:</span> {selectedRecord.roadTrafficAccident}</p>
              <p><span className="font-semibold">Referral code:</span> {selectedRecord.referredCode || selectedRecord.referral}</p>
              <p><span className="font-semibold">Died:</span> {selectedRecord.died}</p>
              <p><span className="font-semibold">Doctor:</span> {selectedRecord.doctorName || selectedRecord.prescriber?.name || '-'}</p>
              <p><span className="font-semibold">Signature:</span> {selectedRecord.doctorSignature ? 'Signed' : 'Not signed'}</p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpdRegister;
import { useEffect, useEffectEvent, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  BedDouble,
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronRight,
  Clock3,
  FlaskConical,
  HeartPulse,
  Info,
  Search,
  Share2,
  Siren,
  Users,
  UserRoundCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import StaffAnnouncements from '../ClinicStudentHead/StaffAnnouncements.jsx';
import PatientExamination from './PatientExamination.jsx';
import ExaminationPatientQueue from './ExaminationPatientQueue.jsx';
import LabRequestForm from './LabRequestForm.jsx';
import PrescriptionPaper from './PrescriptionPaper.jsx';
import OpdRegister from './OpdRegister.jsx';
import PatientReferrals from './PatientReferrals.jsx';

const parseFormList = (formData, fieldName) => {
  const value = formData.get(fieldName);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`Unable to read the ${fieldName} form data. Please review the form and try again.`);
  }
};
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};
const formatActivityTime = (value) => {
  if (!value) return 'Today';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Today'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const formatClinicDate = (value) => {
  if (!value) return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};
const getConsultationPayload = (form) => {
  const formData = new FormData(form);
  const referred = formData.get('isReferred') === 'on';
  const duration = String(formData.get('duration') || '').trim();
  const physicalExamination = [
    ['General Appearance', formData.get('generalAppearance')],
    ['System Examination', formData.get('systemExamination')],
    ['Physical Findings', formData.get('physicalFindings')],
  ]
    .filter(([, value]) => String(value || '').trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join('\n');
  return {
    chiefComplaint: formData.get('chiefComplaint'),
    historyOfPresentIllness: [
      String(formData.get('historyOfPresentIllness') || '').trim(),
      duration ? `Duration: ${duration}` : '',
    ].filter(Boolean).join('\n'),
    physicalExamination,
    reviewOfSystem: formData.get('reviewOfSystem'),
    diagnosis: formData.get('diagnosis'),
    otherDiagnosis: formData.get('otherDiagnosis'),
    hmisDiagnosis: formData.get('hmisDiagnosis'),
    doctorNotes: formData.get('doctorNotes'),
    patientCondition: formData.get('patientCondition') || '',
    disposition: formData.get('disposition') || '',
    followUpDate: formData.get('followUpDate') || '',
    prescriptionPatientType: formData.get('prescriptionPatientType') || 'outpatient',
    vitals: {
      bloodPressure: formData.get('bloodPressure'),
      temperature: formData.get('temperature'),
      pulse: formData.get('pulse'),
      respiratoryRate: formData.get('rr'),
      weight: formData.get('weight'),
    },
    labRequests: parseFormList(formData, 'labRequests').map((request) => ({
      ...request,
      priority: formData.get('labPriority') || 'normal',
      clinicalNote: formData.get('labClinicalNote') || '',
    })),
    prescriptions: parseFormList(formData, 'prescriptions'),
    opd: {
      rtaType: formData.get('rtaType') || 'None',
      roadTrafficAccident: Boolean(formData.get('rtaType') && formData.get('rtaType') !== 'None'),
      hivTestOffered: formData.get('hivTestOffered') === 'on',
      hivTestPerformed: formData.get('hivTestPerformed') === 'on',
      hivTargetCode: formData.get('hivTargetCode'),
      hivTestResult: formData.get('hivTestResult'),
      screenedForTb: formData.get('screenedForTb') === 'on',
      tbScreened: formData.get('screenedForTb') === 'on',
      tbScreeningResult: formData.get('tbScreeningResult'),
      tbDiagnosticCode: formData.get('tbDiagnosticCode'),
      tbResultCode: formData.get('tbResultCode'),
      referredCode: formData.get('referredCode'),
      died: formData.get('died') === 'on',
    },
    referral: referred ? {
      department: formData.get('referralDepartment'),
      reason: formData.get('referralReason'),
      referredBy: formData.get('referredBy'),
      qualification: formData.get('qualification'),
      signature: formData.get('referralSignature'),
      emergency: formData.get('emergencyReferral') === 'on',
      ambulanceDriver: formData.get('ambulanceDriver'),
      takeOffTime: formData.get('takeOffTime'),
      remark: formData.get('remark'),
    } : { department: '', reason: '' },
    sickLeaveDays: Number(formData.get('sickLeaveDays') || 0),
  };
};

function PanelTitle({ icon: Icon, children, action }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-t-lg bg-[#0b4e9a] px-3 text-white">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold">
        <Icon size={17} aria-hidden="true" />
        <span className="truncate">{children}</span>
      </h2>
      {action}
    </div>
  );
}

function ExaminationDashboardContent({ activeItem = 'Dashboard', onNavigate, onQueueSummaryChange }) {
  const { token, user, expireSession } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [labVisits, setLabVisits] = useState([]);
  const [referralRecords, setReferralRecords] = useState([]);
  const [referralSearch, setReferralSearch] = useState('');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyQueueId, setBusyQueueId] = useState('');
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatus, setQueueStatus] = useState('all');
  const [queuePriority, setQueuePriority] = useState('all');
  const [queueVisitType, setQueueVisitType] = useState('all');
  const [queueSort, setQueueSort] = useState('queueNumber');
  const [queuePage, setQueuePage] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [activePatientHistoryState, setActivePatientHistory] = useState({ patientId: '', data: null });
  const [selectedQueueHistoryState, setSelectedQueueHistory] = useState({ patientId: '', data: null, loading: false });
  const [savingVisit, setSavingVisit] = useState(false);
  const [selectedPrescriptionHistoryId, setSelectedPrescriptionHistoryId] = useState('');
  const canProcessLabResults = [
    user?.activeRole,
    user?.role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
  ].some((role) => String(role || '').toLowerCase().includes('lab'));

  const request = async (path, options = {}) => {
    const response = await fetch(`/api/examination${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401) expireSession();
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || `Request failed (${response.status}).`);
    }
    return result.data;
  };
  const requestOpd = async (path, options = {}) => {
    const response = await fetch(`/api/opd${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401) expireSession();
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || `OPD request failed (${response.status}).`);
    }
    return result.data;
  };

  const loadDashboard = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!dashboard) setLoading(true);
    try {
      const [data, labData, referralData] = await Promise.all([
        request('/dashboard'),
        ['Lab Requests', 'Lab Results', 'Laboratory Requests', 'Laboratory Results'].includes(activeItem)
          ? request('/lab-requests')
          : Promise.resolve(null),
        activeItem === 'Patient Referrals' ? request('/referrals') : Promise.resolve(null),
      ]);
      setDashboard(data);
      if (labData) setLabVisits(labData);
      if (referralData) setReferralRecords(referralData);
      const nextQueue = data.queue || [];
      setQueue(nextQueue);
      setSelectedQueueId((current) => nextQueue.some((patient) => patient.id === current)
        ? current
        : (nextQueue.find((patient) => patient.status === 'in_progress')?.id
          || nextQueue.find((patient) => patient.status === 'sent_to_examination')?.id
          || nextQueue[0]?.id
          || ''));
      onQueueSummaryChange?.({
        queueCount: nextQueue.filter((patient) => ['sent_to_examination', 'in_progress'].includes(patient.status)).length,
        labRequestsCount: data.metrics?.labRequests?.pending ?? 0,
      });
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load examination data.');
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboard = useEffectEvent(loadDashboard);

  const getCurrentQueueVisit = () => queue.find((patient) => (
    patient.id === selectedQueueId && patient.status === 'in_progress'
  )) || queue.find((patient) => patient.status === 'in_progress');
  const activeConsultation = getCurrentQueueVisit();
  const activePatientRecordId = activeConsultation?.patientRecordId || '';
  const activePatientHistory = activePatientHistoryState.patientId === activePatientRecordId
    ? activePatientHistoryState.data
    : null;

  useEffect(() => {
    const refresh = () => void refreshDashboard();
    refresh();
    const timer = window.setInterval(refresh, 30000);
    const socket = token ? io('/', { path: '/socket.io', auth: { token } }) : null;
    const handleConnect = () => setLiveConnected(true);
    const handleDisconnect = () => setLiveConnected(false);
    socket?.on('connect', handleConnect);
    socket?.on('disconnect', handleDisconnect);
    socket?.on('clinic:queue-updated', refresh);
    socket?.on('clinic:lab-request-updated', refresh);
    socket?.on('clinic:referral-updated', refresh);
    return () => {
      window.clearInterval(timer);
      socket?.off('connect', handleConnect);
      socket?.off('disconnect', handleDisconnect);
      socket?.off('clinic:queue-updated', refresh);
      socket?.off('clinic:lab-request-updated', refresh);
      socket?.off('clinic:referral-updated', refresh);
      socket?.disconnect();
    };
  }, [token, activeItem]);

  const loadActiveHistory = useEffectEvent(async (patientRecordId) => {
    try {
      const result = await request(`/patients/${patientRecordId}/history`);
      setActivePatientHistory({ patientId: patientRecordId, data: result });
    } catch (historyError) {
      setError(historyError.message || 'Unable to load the active patient history.');
    }
  });

  useEffect(() => {
    if (!token || !activePatientRecordId) return undefined;
    const timer = window.setTimeout(() => void loadActiveHistory(activePatientRecordId), 0);
    return () => window.clearTimeout(timer);
  }, [token, activePatientRecordId]);

  const visits = dashboard?.visits || [];
  const metricsData = dashboard?.metrics || {};
  const newVisits = metricsData.newVisits ?? 0;
  const repeatVisits = metricsData.followUpVisits ?? 0;
  const visitTotal = metricsData.totalVisits ?? visits.length;
  const newVisitPercent = visitTotal ? Math.round((newVisits / visitTotal) * 100) : 0;
  const repeatVisitPercent = visitTotal ? Math.round((repeatVisits / visitTotal) * 100) : 0;
  const metrics = [
    { value: loading ? '…' : (metricsData.waiting ?? 0), label: 'Waiting', icon: Users, tone: 'blue' },
    { value: loading ? '…' : (metricsData.inConsultation ?? 0), label: 'In Consultation', icon: HeartPulse, tone: 'green' },
    { value: loading ? '…' : (metricsData.completedToday ?? 0), label: 'Completed Today', icon: Check, tone: 'mint' },
    { value: loading ? '…' : (metricsData.emergency ?? 0), label: 'Emergency', icon: Siren, tone: 'rose' },
  ];
  const dashboardMetrics = [
    { value: loading ? '…' : (metricsData.totalVisits ?? visits.length), label: "Today's Patients", icon: Users, tone: 'teal' },
    { value: loading ? '…' : (metricsData.waiting ?? 0), label: 'Waiting Patients', icon: Clock3, tone: 'orange' },
    { value: loading ? '…' : (metricsData.completedToday ?? 0), label: 'Completed', icon: Check, tone: 'green' },
    { value: loading ? '…' : (metricsData.labRequests?.resultsReady ?? 0), label: 'Pending Lab Results', icon: FlaskConical, tone: 'blue' },
  ];
  const labRequests = labVisits.flatMap((visit) => (visit.examination?.labRequests || []).map((item) => ({
    ...item,
    patientName: visit.patientRecordId?.fullName || visit.patientName,
    patientId: visit.patientId,
    mrn: visit.patientRecordId?.cardNumber || visit.patientId,
    age: visit.patientRecordId?.age,
    gender: visit.patientRecordId?.sex,
    visitId: String(visit._id),
    visitDate: visit.visitDate,
    department: visit.department,
    labRequestNumber: visit.examination?.labRequestNumber || '',
    labStatus: visit.examination?.labStatus || item.status || 'Pending',
    labRequestedBy: visit.examination?.labRequestedBy || '',
    labRequestedAt: visit.examination?.labRequestedAt || null,
    labTestedBy: visit.examination?.labTestedBy || '',
    labTechnicianSignature: visit.examination?.labTechnicianSignature || '',
    labEnteredAt: visit.examination?.labEnteredAt || null,
    labTechnicianNotes: visit.examination?.labTechnicianNotes || '',
    labDateOfReport: visit.examination?.labDateOfReport || null,
    labResultReadyAt: visit.examination?.labResultReadyAt || null,
    labApprovedBy: visit.examination?.labApprovedBy || '',
    labReviewedAt: visit.examination?.labReviewedAt || null,
    labApprovedAt: visit.examination?.labApprovedAt || null,
  })));
  const activeQueueVisit = getCurrentQueueVisit();
  const activeSavedVisit = activeQueueVisit
    ? visits.find((visit) => String(visit._id) === activeQueueVisit.visitId)
    : null;
  const activePrescriptionVisit = activeSavedVisit
    ? {
      ...activeSavedVisit,
      name: activeSavedVisit.patientName || activeQueueVisit.name,
      cardNumber: activeSavedVisit.patientRecordId?.cardNumber || activeQueueVisit.cardNumber,
      studentId: activeSavedVisit.patientRecordId?.universityIdNumber || activeQueueVisit.studentId,
      governmentIdNumber: activeSavedVisit.patientRecordId?.governmentIdNumber || activeQueueVisit.governmentIdNumber,
      telephone: activeSavedVisit.patientRecordId?.phoneNumber || activeQueueVisit.telephone,
      region: activeSavedVisit.patientRecordId?.region || activeQueueVisit.region,
      town: activeSavedVisit.patientRecordId?.town || activeQueueVisit.town,
      woreda: activeSavedVisit.patientRecordId?.woreda || activeQueueVisit.woreda,
      kebele: activeSavedVisit.patientRecordId?.kebele || activeQueueVisit.kebele,
      patientRecordId: activeSavedVisit.patientRecordId || activePatientHistory?.patient || activeQueueVisit.patientRecordId,
      age: activeSavedVisit.patientRecordId?.age ?? activeQueueVisit.age,
      sex: activeSavedVisit.patientRecordId?.sex || activeQueueVisit.sex,
    }
    : activeQueueVisit;
  const prescriptionHistorySource = activePatientHistory?.visits || visits;
  const prescriptionHistory = prescriptionHistorySource
    .filter((visit) => (visit.examination?.prescriptions || []).length > 0
      && String(visit._id) !== activeQueueVisit?.visitId)
    .map((visit) => ({
      ...visit,
      name: visit.patientName,
      patientRecordId: activePatientHistory?.patient || visit.patientRecordId,
      cardNumber: activePatientHistory?.patient?.cardNumber || visit.patientRecordId?.cardNumber || visit.patientId,
    }));
  const selectedPrescriptionHistory = prescriptionHistory.find((visit) => String(visit._id) === selectedPrescriptionHistoryId);
  const referrals = visits.filter((visit) => visit.referred || visit.examination?.referral?.department);
  const activeQueue = queue.filter((patient) => ['sent_to_examination', 'in_progress'].includes(patient.status));
  const alerts = [
    ...activeQueue.filter((patient) => patient.emergency).map((patient) => ({ tone: 'rose', icon: Siren, text: `Emergency patient: ${patient.name} (${patient.queueNumber || patient.patientId})`, time: 'In queue' })),
    ...labRequests.filter((item) => item.status === 'Results Ready').slice(0, 3).map((item) => ({ tone: 'blue', icon: FlaskConical, text: `Lab result ready: ${item.testName} · ${item.patientName}`, time: 'Ready' })),
  ].slice(0, 3);
  const recentActivities = [
    ...visits
      .filter((visit) => String(visit.status || '').toLowerCase() === 'completed')
      .map((visit) => ({
        id: `completed-${visit._id}`,
        title: 'Patient examination completed',
        detail: visit.patientName || visit.patientRecordId?.fullName || 'Patient',
        date: visit.updatedAt || visit.visitDate,
      })),
    ...visits.flatMap((visit) => (visit.examination?.labRequests || []).flatMap((labRequest, index) => {
      const detail = `${labRequest.testName || 'Laboratory test'} · ${visit.patientName || visit.patientRecordId?.fullName || 'Patient'}`;
      const orderActivity = {
        id: `lab-order-${visit._id}-${index}`,
        title: 'New laboratory order sent',
        detail,
        date: labRequest.createdAt || visit.visitDate,
      };
      return labRequest.status === 'Results Ready'
        ? [
          orderActivity,
          {
            id: `lab-result-${visit._id}-${index}`,
            title: 'Lab result received',
            detail,
            date: labRequest.dateOfReport || labRequest.updatedAt || visit.visitDate,
          },
        ]
        : [orderActivity];
    })),
  ]
    .sort((first, second) => new Date(second.date || 0) - new Date(first.date || 0))
    .slice(0, 5);
  const filteredQueue = queue.filter((patient) => {
    const search = queueSearch.trim().toLowerCase();
    const matchesSearch = !search || [patient.name, patient.patientId, patient.cardNumber, patient.studentId, patient.queueNumber]
      .some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = queueStatus === 'all'
      || (queueStatus === 'waiting' && patient.status === 'sent_to_examination')
      || (queueStatus === 'in_progress' && patient.status === 'in_progress')
      || (queueStatus === 'completed' && patient.status === 'completed');
    const matchesPriority = queuePriority === 'all'
      || (queuePriority === 'emergency' && patient.emergency)
      || (queuePriority === 'urgent' && !patient.emergency && patient.priority?.toLowerCase() === 'urgent')
      || (queuePriority === 'normal' && !patient.emergency && patient.priority?.toLowerCase() === 'normal');
    const matchesVisitType = queueVisitType === 'all' || patient.visitType === queueVisitType;
    return matchesSearch && matchesStatus && matchesPriority && matchesVisitType;
  });
  const matchingQueue = [...filteredQueue].sort((first, second) => {
    if (queueSort === 'priority') {
      const priorityRank = (patient) => patient.emergency ? 0
        : patient.priority === 'Urgent' ? 1
          : 2;
      return priorityRank(first) - priorityRank(second)
        || String(first.queueNumber || '').localeCompare(String(second.queueNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
    }
    return String(first.queueNumber || '').localeCompare(String(second.queueNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
  });
  const queuePageSize = 10;
  const queuePageCount = Math.max(1, Math.ceil(matchingQueue.length / queuePageSize));
  const queuePageRows = matchingQueue.slice((queuePage - 1) * queuePageSize, queuePage * queuePageSize);
  const selectedQueuePatient = queue.find((patient) => patient.id === selectedQueueId)
    || activeQueue[0]
    || queue[0]
    || null;
  const emergencyPatient = activeQueue.find((patient) => patient.emergency) || null;
  const selectedPatientRecordId = String(selectedQueuePatient?.patientRecordId?._id || selectedQueuePatient?.patientRecordId || '');
  const selectedQueueHistory = selectedQueueHistoryState.patientId === selectedPatientRecordId
    ? selectedQueueHistoryState.data
    : null;
  const selectedPatientVisits = selectedQueueHistory?.visits || (selectedPatientRecordId
    ? visits.filter((visit) => String(visit.patientRecordId?._id || visit.patientRecordId || '') === selectedPatientRecordId)
    : []);
  const selectedVisit = selectedPatientVisits.find((visit) => String(visit._id) === String(selectedQueuePatient?.visitId))
    || selectedPatientVisits[0]
    || null;
  const previousPatientVisits = selectedPatientVisits
    .filter((visit) => String(visit._id) !== String(selectedVisit?._id))
    .slice(0, 3);
  const loadSelectedQueueHistory = useEffectEvent(async (patientRecordId) => {
    setSelectedQueueHistory({ patientId: patientRecordId, data: null, loading: true });
    try {
      const data = await request(`/patients/${patientRecordId}/history`);
      setSelectedQueueHistory({ patientId: patientRecordId, data, loading: false });
    } catch (historyError) {
      setSelectedQueueHistory({ patientId: patientRecordId, data: null, loading: false });
      setError(historyError.message || 'Unable to load the selected patient history.');
    }
  });

  useEffect(() => {
    if (!['Patient Queue', 'OPD Register'].includes(activeItem) || !token || !selectedPatientRecordId) return undefined;
    const timer = window.setTimeout(() => void loadSelectedQueueHistory(selectedPatientRecordId), 0);
    return () => window.clearTimeout(timer);
  }, [activeItem, token, selectedPatientRecordId]);

  const runQueueAction = async (patient, action) => {
    if (action === 'call') setSelectedQueueId(patient.id);
    setBusyQueueId(patient.id);
    setError('');
    setNotice('');
    try {
      await request(`/queue/${patient.id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      setNotice(action === 'call' ? `${patient.name} called for consultation.` : action === 'skip' ? `${patient.name} moved to the end of the queue.` : `${patient.name} returned to the queue.`);
      await loadDashboard();
      if (action === 'call') onNavigate?.('Patient Examination');
    } catch (actionError) {
      setError(actionError.message || 'Unable to update the queue.');
    } finally {
      setBusyQueueId('');
    }
  };

  const callNextPatient = () => {
    const nextPatient = queue.find((patient) => patient.status === 'sent_to_examination');
    if (nextPatient) void runQueueAction(nextPatient, 'call');
    else setNotice('There are no patients waiting for examination.');
  };

  const startSelectedConsultation = (patient = selectedQueuePatient) => {
    if (!patient) {
      setNotice('There is no patient selected.');
      return;
    }
    setSelectedQueueId(patient.id);
    if (patient.status === 'sent_to_examination') {
      void runQueueAction(patient, 'call');
      return;
    }
    if (patient.status === 'in_progress') {
      onNavigate?.('Patient Examination');
      return;
    }
    setNotice('This examination is already completed.');
  };

  const searchPatients = async (event) => {
    event.preventDefault();
    setPatientHistory(null);
    try {
      const data = await request(`/patients?search=${encodeURIComponent(patientSearch)}`);
      setPatientResults(data || []);
    } catch (searchError) {
      setError(searchError.message || 'Unable to search patients.');
    }
  };

  const loadPatientHistory = async (patient) => {
    try {
      const result = await request(`/patients/${patient._id}/history`);
      setSelectedPatient(result.patient);
      setPatientHistory(result);
    } catch (historyError) {
      setError(historyError.message || 'Unable to load patient history.');
    }
  };

  const viewQueueMedicalHistory = async (patient) => {
    const patientRecordId = String(patient?.patientRecordId?._id || patient?.patientRecordId || '');
    if (!patientRecordId) {
      setError('This queue entry has no linked medical record.');
      return;
    }
    try {
      const result = await request(`/patients/${patientRecordId}/history`);
      setSelectedPatient(result.patient);
      setPatientHistory(result);
      onNavigate?.('Patient Records / History');
    } catch (historyError) {
      setError(historyError.message || 'Unable to load patient history.');
    }
  };

  const handleSaveExamination = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const visit = getCurrentQueueVisit();
    if (!visit) {
      setError('Call a patient into consultation before saving an examination.');
      return;
    }
    setSavingVisit(true);
    setError('');
    setNotice('');
    try {
      await request(`/visits/${visit.visitId}/examination`, {
        method: 'POST',
        body: JSON.stringify(getConsultationPayload(form)),
      });
      let syncError = '';
      try {
        await requestOpd('/sync', {
          method: 'POST',
          body: JSON.stringify({ visitId: visit.visitId }),
        });
      } catch (error) {
        syncError = error.message || 'OPD register synchronization failed.';
      }
      if (syncError) {
        setError(`Examination completed, but OPD register sync failed: ${syncError}`);
        setNotice(`Examination saved for ${visit.name}.`);
      } else {
        setNotice(`Examination saved and OPD register updated for ${visit.name}.`);
      }
      await loadDashboard();
      onNavigate?.('Patient Queue');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the examination.');
    } finally {
      setSavingVisit(false);
    }
  };

  const handleSaveDraft = async (form) => {
    const visit = getCurrentQueueVisit();
    if (!visit || !form) return false;
    setSavingVisit(true);
    setError('');
    try {
      await request(`/visits/${visit.visitId}/examination/draft`, {
        method: 'PATCH',
        body: JSON.stringify(getConsultationPayload(form)),
      });
      setNotice(`Draft saved for ${visit.name}.`);
      await loadDashboard();
      return true;
    } catch (draftError) {
      setError(draftError.message || 'Unable to save the examination draft.');
      return false;
    } finally {
      setSavingVisit(false);
    }
  };

  const handleSubmitPrescription = async (prescription) => {
    const visit = getCurrentQueueVisit();
    if (!visit) {
      setError('Call a patient into consultation before submitting a prescription.');
      return;
    }
    setSavingVisit(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/visits/${visit.visitId}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify(prescription),
      });
      setNotice(result?.message || `Prescription submitted for ${visit.name}.`);
      await loadDashboard();
      return true;
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit the prescription.');
      return false;
    } finally {
      setSavingVisit(false);
    }
  };

  const handleCheckMedicineStock = async (search) => {
    const data = await request(`/medicines/availability?search=${encodeURIComponent(search)}`);
    return data?.items || [];
  };

  const handleLabFormSubmit = async ({ tests, clinicalNote, priority }) => {
    const visit = getCurrentQueueVisit();
    if (!visit) {
      setError('Call a patient into consultation before submitting a lab request.');
      return false;
    }

    const visitRecord = visits.find((record) => String(record._id) === visit.visitId);
    const examination = visitRecord?.examination || visit.examination || {};
    const existingRequests = examination.labRequests || [];
    const newRequests = tests.map(({ testCode, testName, category }) => {
      const previous = existingRequests.find((item) => item.testCode === testCode);
      return {
        ...(previous || {}),
        testCode,
        testName,
        category,
        priority,
        clinicalNote,
      };
    });
    const requestCodes = new Set(newRequests.map((item) => item.testCode));

    setSavingVisit(true);
    setError('');
    setNotice('');
    try {
      await request(`/visits/${visit.visitId}/examination/draft`, {
        method: 'PATCH',
        body: JSON.stringify({
          chiefComplaint: examination.chiefComplaint || '',
          historyOfPresentIllness: examination.historyOfPresentIllness || '',
          physicalExamination: examination.physicalExamination || '',
          reviewOfSystem: examination.reviewOfSystem || '',
          diagnosis: visitRecord?.diagnosis || '',
          otherDiagnosis: examination.otherDiagnosis || '',
          hmisDiagnosis: examination.hmisDiagnosis || '',
          doctorNotes: examination.doctorNotes || '',
          patientCondition: examination.patientCondition || '',
          disposition: examination.disposition || '',
          followUpDate: examination.followUpDate || '',
          prescriptionPatientType: examination.prescriptionPatientType || 'outpatient',
          vitals: examination.vitals || {},
          prescriptions: examination.prescriptions || [],
          labRequests: [
            ...existingRequests.filter((item) => !requestCodes.has(item.testCode)),
            ...newRequests,
          ],
          opd: examination.opd || {},
          referral: examination.referral || {},
          sickLeaveDays: examination.sickLeaveDays || 0,
        }),
      });
      setNotice(`Laboratory request saved for ${visit.name}.`);
      await loadDashboard();
      return true;
    } catch (labError) {
      setError(labError.message || 'Unable to submit the laboratory request.');
      return false;
    } finally {
      setSavingVisit(false);
    }
  };

  const handleLabProcessingUpdate = async ({ visitId, action }) => {
    setSavingVisit(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/visits/${visitId}/lab-status`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      setNotice(result?.message || 'Laboratory status updated.');
      await loadDashboard();
    } catch (labError) {
      setError(labError.message || 'Unable to update laboratory status.');
    } finally {
      setSavingVisit(false);
    }
  };

  const handleSaveLabResults = async ({
    visitId,
    results,
    dateOfReport,
    technicianNotes,
    technicianSignature,
  }) => {
    setSavingVisit(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/visits/${visitId}/lab-results`, {
        method: 'PUT',
        body: JSON.stringify({ results, dateOfReport, technicianNotes, technicianSignature }),
      });
      setNotice(result?.message || 'Laboratory results saved.');
      await loadDashboard();
    } catch (labError) {
      setError(labError.message || 'Unable to save laboratory results.');
    } finally {
      setSavingVisit(false);
    }
  };

  const handleApproveLabResults = async (visitId) => {
    setSavingVisit(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/visits/${visitId}/lab-results/approve`, { method: 'POST' });
      setNotice(result?.message || 'Laboratory results approved.');
      await loadDashboard();
    } catch (labError) {
      setError(labError.message || 'Unable to approve laboratory results.');
    } finally {
      setSavingVisit(false);
    }
  };

  if (activeItem === 'OPD Register') {
    return <OpdRegister />;
  }

  if (activeItem === 'Patient Referrals') {
    return (
      <PatientReferrals
        referrals={referralRecords}
        search={referralSearch}
        onSearchChange={setReferralSearch}
        activePatient={activeQueueVisit}
        loading={loading}
        error={error}
        notice={notice}
        onOpenConsultation={() => onNavigate?.('Patient Examination')}
      />
    );
  }

  if (activeItem === 'Patient Queue') {
    return (
      <ExaminationPatientQueue
        error={error}
        notice={notice}
        queue={queue}
        queuePageRows={queuePageRows}
        matchingQueue={matchingQueue}
        loading={loading}
        liveConnected={liveConnected}
        onRefresh={() => void loadDashboard()}
        queueSearch={queueSearch}
        setQueueSearch={setQueueSearch}
        queueStatus={queueStatus}
        setQueueStatus={setQueueStatus}
        queuePriority={queuePriority}
        setQueuePriority={setQueuePriority}
        queueVisitType={queueVisitType}
        setQueueVisitType={setQueueVisitType}
        queueSort={queueSort}
        setQueueSort={setQueueSort}
        queuePage={queuePage}
        queuePageCount={queuePageCount}
        queuePageSize={queuePageSize}
        setQueuePage={setQueuePage}
        selectedQueueId={selectedQueueId}
        onSelectQueuePatient={setSelectedQueueId}
        selectedQueuePatient={selectedQueuePatient}
        selectedQueueHistory={selectedQueueHistory}
        selectedQueueHistoryLoading={selectedQueueHistoryState.patientId === selectedPatientRecordId && selectedQueueHistoryState.loading}
        previousPatientVisits={previousPatientVisits}
        emergencyPatient={emergencyPatient}
        busyQueueId={busyQueueId}
        onViewMedicalHistory={viewQueueMedicalHistory}
        onStartSelectedConsultation={startSelectedConsultation}
      />
    );
  }

  if (['Current Consultation', 'Patient Examination', 'Treatment & Procedures'].includes(activeItem)) {
    const currentVisit = activeQueueVisit;
    const consultationPatient = currentVisit ? {
      ...currentVisit,
      ...activeSavedVisit,
      visitId: currentVisit.visitId,
      patientRecordId: activeSavedVisit?.patientRecordId || currentVisit.patientRecordId,
      examination: activeSavedVisit?.examination || currentVisit.examination || {},
      name: currentVisit.name,
      patientId: activeSavedVisit?.patientRecordId?.cardNumber || currentVisit.cardNumber || currentVisit.patientId,
    } : null;
    return (
      <PatientExamination
        key={currentVisit?.visitId || currentVisit?.id || 'no-active-consultation'}
        patient={consultationPatient}
        history={activePatientHistory}
        alerts={alerts}
        onSave={handleSaveExamination}
        onDraft={handleSaveDraft}
        onNavigate={onNavigate}
        onCallPatient={(patient) => void runQueueAction(patient, 'call')}
        doctor={user}
        prescriptionVisit={activePrescriptionVisit}
        onCheckMedicineStock={handleCheckMedicineStock}
        onSubmitPrescription={handleSubmitPrescription}
        labRequestsForVisit={(activeSavedVisit?.examination?.labRequests || []).map((item) => ({
          ...item,
          patientName: activeSavedVisit.patientName || activeQueueVisit.name,
          patientId: activeSavedVisit.patientId || activeQueueVisit.patientId,
          mrn: activeSavedVisit.patientRecordId?.cardNumber || activeQueueVisit.cardNumber || activeSavedVisit.patientId,
          age: activeSavedVisit.patientRecordId?.age ?? activeQueueVisit.age,
          gender: activeSavedVisit.patientRecordId?.sex || activeQueueVisit.sex || activeQueueVisit.gender,
          department: activeSavedVisit.department || activeQueueVisit.department,
          visitId: activeQueueVisit.visitId,
          visitDate: activeSavedVisit.visitDate || activeQueueVisit.visitDate,
          labStatus: activeSavedVisit.examination?.labStatus || item.status || 'Pending',
          labRequestNumber: activeSavedVisit.examination?.labRequestNumber || '',
          labRequestedBy: activeSavedVisit.examination?.labRequestedBy || '',
          labRequestedAt: activeSavedVisit.examination?.labRequestedAt || null,
          labTestedBy: activeSavedVisit.examination?.labTestedBy || '',
          labTechnicianSignature: activeSavedVisit.examination?.labTechnicianSignature || '',
          labEnteredAt: activeSavedVisit.examination?.labEnteredAt || null,
          labTechnicianNotes: activeSavedVisit.examination?.labTechnicianNotes || '',
          labDateOfReport: activeSavedVisit.examination?.labDateOfReport || null,
          labResultReadyAt: activeSavedVisit.examination?.labResultReadyAt || null,
          labApprovedBy: activeSavedVisit.examination?.labApprovedBy || '',
          labReviewedAt: activeSavedVisit.examination?.labReviewedAt || null,
          labApprovedAt: activeSavedVisit.examination?.labApprovedAt || null,
        }))}
        onLabSubmit={handleLabFormSubmit}
        onLabUpdateProcessing={handleLabProcessingUpdate}
        onLabSaveResults={handleSaveLabResults}
        onLabApproveResults={handleApproveLabResults}
        waitingPatients={queue.filter((patient) => patient.status === 'sent_to_examination')}
        busyQueueId={busyQueueId}
        loading={loading}
        saving={savingVisit}
        error={error}
        notice={notice}
      />
    );
  }

  if (['Patient Records / History', 'Patient Medical Records', 'Examination History'].includes(activeItem)) {
    const recordsTitle = activeItem === 'Examination History' ? 'Examination History' : 'Patient Medical Records';
    return (
      <section className="space-y-4">
        <div><h1 className="text-2xl font-bold text-slate-900">{recordsTitle}</h1><p className="mt-1 text-sm text-slate-500">Search by name, patient ID, university ID, or card number.</p></div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <form onSubmit={searchPatients} className="flex max-w-2xl gap-2"><input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} minLength="2" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2" placeholder="Search patient records" /><button className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white">Search</button></form>
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {patientResults.map((patient) => <button key={patient._id} type="button" onClick={() => void loadPatientHistory(patient)} className="block w-full px-4 py-3 text-left hover:bg-blue-50"><span className="block font-semibold">{patient.fullName}</span><span className="text-xs text-slate-500">{patient.patientId} · {patient.cardNumber}</span></button>)}
            {!patientResults.length && <p className="p-4 text-sm text-slate-500">Search results will appear here.</p>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {selectedPatient ? <><h2 className="font-bold">{selectedPatient.fullName}</h2><p className="mt-1 text-xs text-slate-500">{selectedPatient.patientId} · {selectedPatient.cardNumber}</p><div className="mt-4 space-y-3">{patientHistory?.visits?.map((visit) => <article key={visit._id} className="border-t border-slate-100 pt-3 text-sm"><p className="font-semibold">{visit.diagnosis || 'No diagnosis recorded'}</p><p className="text-xs text-slate-500">{new Date(visit.visitDate).toLocaleString()} · {visit.department} · {visit.status}</p><p className="mt-1 text-xs text-slate-600">{visit.examination?.chiefComplaint}</p></article>)}{patientHistory?.legacy?.map((record) => <article key={record._id} className="border-t border-slate-100 pt-3 text-sm"><p className="font-semibold">{record.diagnosis || 'Historical record'}</p><p className="text-xs text-slate-500">{new Date(record.createdAt).toLocaleDateString()} · {record.department} · {record.doctorName}</p></article>)}</div></> : <p className="text-sm text-slate-500">Select a patient to view visit history.</p>}
          </div>
        </div>
      </section>
    );
  }

  if (['Lab Requests', 'Lab Results', 'Laboratory Requests', 'Laboratory Results'].includes(activeItem)) {
    const activeLabPatient = activeQueueVisit ? {
      ...activeQueueVisit,
      patientName: activeQueueVisit.name,
      visitDate: activeQueueVisit.arrivedAt,
    } : null;
    return (
      <LabRequestForm
        key={activeItem}
        patient={activeLabPatient}
        requestBy={user?.name || ''}
        requests={labRequests}
        initialTab={activeItem === 'Laboratory Results' ? 'results' : undefined}
        onSubmit={handleLabFormSubmit}
        onUpdateProcessing={handleLabProcessingUpdate}
        onSaveResults={handleSaveLabResults}
        onApproveResults={handleApproveLabResults}
        canProcessResults={canProcessLabResults}
        onOpenQueue={() => onNavigate?.('Patient Queue')}
        submitting={savingVisit}
        error={error}
        notice={notice}
      />
    );
  }

  if (['Prescriptions', 'Referrals', 'Patient Referrals', 'Reports', 'Medical Reports'].includes(activeItem)) {
    const reportItems = ['Reports', 'Medical Reports'].includes(activeItem);
    if (activeItem === 'Prescriptions') {
      return (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Prescriptions &amp; Dispensing</h1>
              <p className="mt-1 text-sm text-slate-500">Complete a prescription for the active consultation and review previous prescriptions.</p>
            </div>
            <button type="button" onClick={() => onNavigate?.('Patient Queue')} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Open Patient Queue</button>
          </div>
          <section aria-labelledby="prescription-workflow-title" className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <h2 id="prescription-workflow-title" className="font-bold text-sky-950">የመድኃኒት ማዘዣ እና ማደል ሂደት</h2>
            <ol className="mt-3 grid gap-3 md:grid-cols-3">
              <li className="rounded-md border border-sky-100 bg-white p-3">
                <h3 className="text-sm font-bold text-slate-900">1. Pending Prescriptions Queue</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">ዶክተሩ ከታካሚው ምርመራ በኋላ ማዘዣውን ሲያስገባ ወደ ፋርማሲ ወረፋ ይላካል። ፋርማሲስቱ የታካሚውን ስም፣ MRN፣ Student ID፣ መድኃኒቶችን፣ መጠንና ቆይታ ይመለከታል፤ አለርጂ ካለም የጥንቃቄ ማስጠንቀቂያ ይታያል።</p>
              </li>
              <li className="rounded-md border border-sky-100 bg-white p-3">
                <h3 className="text-sm font-bold text-slate-900">2. Stock Availability Check</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">ትዕዛዙ ሲከፈት የመድኃኒቱ ክምችት ይመረመራል። ከክምችት ውጭ ከሆነ <strong>Out of stock</strong> የሚል ማሳወቂያ ይታያል።</p>
              </li>
              <li className="rounded-md border border-sky-100 bg-white p-3">
                <h3 className="text-sm font-bold text-slate-900">3. Dispensing &amp; History</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">ፋርማሲስቱ ትዕዛዙን ካረጋገጠ በኋላ መድኃኒቱን ይሰጣል። ሁኔታው <strong>Pending</strong> ከሚለው ወደ <strong>Dispensed</strong> ይቀየራል፣ እና ሂደቱ በታካሚው የሕክምና ታሪክ ውስጥ ይመዘገባል።</p>
              </li>
            </ol>
          </section>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {loading && !dashboard && <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading prescription records…</p>}
          {!activePrescriptionVisit ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div>
                <h2 className="font-bold text-amber-950">Call a patient into Current Consultation before submitting a request.</h2>
                <p className="mt-1 text-sm text-amber-900">Select a patient from the Examination Room queue to create a prescription.</p>
              </div>
              <button type="button" onClick={() => onNavigate?.('Patient Queue')} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Open Patient Queue</button>
            </div>
          ) : (
            <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,2.2fr)_minmax(280px,0.8fr)]">
              <PrescriptionPaper
                key={`${activePrescriptionVisit._id || activePrescriptionVisit.visitId}:${JSON.stringify(activePrescriptionVisit.examination?.prescriptions || [])}:${activePrescriptionVisit.examination?.vitals?.weight || ''}:${activePrescriptionVisit.diagnosis || ''}:${activePrescriptionVisit.examination?.prescriptionPatientType || ''}`}
                visit={activePrescriptionVisit}
                doctor={user}
                onCheckMedicineStock={handleCheckMedicineStock}
                onSubmit={!['Dispensed', 'Partially dispensed', 'Cancelled'].includes(activePrescriptionVisit.examination?.prescriptionStatus)
                  ? handleSubmitPrescription
                  : undefined}
                saving={savingVisit}
              />
              <aside className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div>
                  <h2 className="font-bold text-slate-900">Previous prescriptions</h2>
                  <p className="mt-1 text-xs text-slate-500">{activePrescriptionVisit.name} · current status and history</p>
                </div>
                {prescriptionHistory.map((visit) => (
                  <article key={visit._id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{formatDate(visit.visitDate)}</p>
                        <p className="text-xs text-slate-500">{visit.diagnosis || 'Diagnosis not recorded'}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800">{visit.examination?.prescriptionStatus || 'Pending'}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {visit.examination.prescriptions.map((item, index) => <li key={item._id || `${item.medicine}-${index}`}>{item.medicine} {item.strength} · {item.frequency} · {item.duration}</li>)}
                    </ul>
                    <button type="button" onClick={() => setSelectedPrescriptionHistoryId(String(visit._id))} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">View / Print paper</button>
                  </article>
                ))}
                {!prescriptionHistory.length && <p className="rounded bg-slate-50 p-3 text-xs text-slate-500">No previous prescriptions are recorded for this patient.</p>}
              </aside>
            </div>
          )}
          {selectedPrescriptionHistory && <PrescriptionPaper
            key={String(selectedPrescriptionHistory._id)}
            visit={selectedPrescriptionHistory}
            doctor={user}
          />}
        </section>
      );
    }
    const showReferrals = ['Referrals', 'Patient Referrals'].includes(activeItem);
    const records = showReferrals ? referrals : metricsData.topDiagnoses || [];
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">{activeItem}</h1><p className="mt-1 text-sm text-slate-500">{dashboard?.department || 'Examination Room'} · today</p></div>{!reportItems && <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Add from consultation</button>}</div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {records.map((record, index) => <article key={record._id || `${record.patientId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"><div><p className="font-semibold">{reportItems ? record.name : record.examination?.referral?.department}</p><p className="mt-1 text-xs text-slate-500">{reportItems ? `${record.count} visits` : `${record.patientName || record.patientId} · ${record.examination?.referral?.reason || ''}`}</p></div>{showReferrals && <span className="text-xs text-slate-500">{record.examination?.referral?.reason}</span>}</article>)}
          {!records.length && <p className="p-6 text-sm text-slate-500">No {activeItem.toLowerCase()} recorded today.</p>}
        </div>
      </section>
    );
  }

  if (activeItem === 'Dashboard') {
    return (
      <div className="mx-auto max-w-[1440px] space-y-4 text-slate-900">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Clinical overview · Live data</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#183442]">Examination Room Dashboard</h1>
            <p className="mt-1 text-xs text-slate-500">A clear view of today’s examination workflow.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-800">
            <CalendarDays size={13} aria-hidden="true" />
            {formatClinicDate(dashboard?.clinicDate)}
          </div>
        </header>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

        <section aria-label="Today's examination summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map(({ value, label, icon: Icon, tone }) => (
            <article key={label} className="relative overflow-hidden rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <span className={`absolute -right-4 -top-5 h-16 w-16 rounded-full ${
                tone === 'teal' ? 'bg-teal-50' :
                tone === 'orange' ? 'bg-orange-50' :
                tone === 'green' ? 'bg-emerald-50' : 'bg-blue-50'
              }`} />
              <div className="relative flex items-center justify-between">
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                  tone === 'teal' ? 'bg-teal-50 text-teal-700' :
                  tone === 'orange' ? 'bg-orange-50 text-orange-600' :
                  tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <ArrowRight size={13} className="rotate-[-45deg] text-slate-300" aria-hidden="true" />
              </div>
              <p className="mt-2.5 text-2xl font-bold leading-none text-[#183442]">{value}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-slate-700">{label}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.9fr)_minmax(230px,0.9fr)]">
          <article className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-3">
              <div>
                <h2 className="text-sm font-bold text-[#183442]">Patient Queue</h2>
                <p className="mt-0.5 text-[10px] text-slate-500">Patients waiting for or currently in examination</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('Patient Queue')}
                className="shrink-0 rounded-md bg-teal-50 px-2.5 py-1.5 text-[10px] font-bold text-teal-800 hover:bg-teal-100"
              >
                Show all
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-left text-[10px]">
                <thead className="bg-slate-50 text-[8px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Student ID</th>
                    <th className="px-3 py-2 font-semibold">Student Name</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeQueue.slice(0, 4).map((patient) => {
                    const isWaiting = patient.status === 'sent_to_examination';
                    const status = patient.labReturn
                      ? 'Lab Pending'
                      : isWaiting
                        ? 'Waiting'
                        : patient.status === 'in_progress'
                          ? 'In Progress'
                          : String(patient.status || 'Waiting').replaceAll('_', ' ');
                    return (
                      <tr key={patient.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-teal-800">
                          {patient.studentId || patient.patientId || patient.cardNumber || '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">{patient.name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[8px] font-bold ${
                            isWaiting ? 'bg-amber-100 text-amber-800' :
                            patient.labReturn ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            disabled={Boolean(busyQueueId)}
                            onClick={() => startSelectedConsultation(patient)}
                            className="rounded-md bg-teal-50 px-2.5 py-1.5 text-[9px] font-bold text-teal-800 hover:bg-teal-100 disabled:opacity-50"
                          >
                            {isWaiting
                              ? patient.emergency ? 'Start Emergency Examination' : 'Start Examination'
                              : 'Continue Examination'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && !activeQueue.length && (
                    <tr><td colSpan="4" className="px-3 py-8 text-center text-slate-500">No patients are currently in the examination queue.</td></tr>
                  )}
                  {loading && !activeQueue.length && (
                    <tr><td colSpan="4" className="px-3 py-8 text-center text-slate-500">Loading patient queue…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
              <div>
                <h2 className="text-sm font-bold text-[#183442]">Recent Activities</h2>
                <p className="mt-0.5 text-[10px] text-slate-500">Latest examination and laboratory updates</p>
              </div>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <Activity size={14} aria-hidden="true" />
              </span>
            </div>
            <div className="p-3.5">
              {recentActivities.length ? (
                <ol className="space-y-4">
                  {recentActivities.map((activity) => (
                    <li key={activity.id} className="relative flex gap-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold leading-4 text-slate-800">{activity.title}</p>
                        <p className="mt-0.5 truncate text-[9px] text-slate-500">{activity.detail}</p>
                        <time className="mt-0.5 block text-[8px] text-slate-400">{formatActivityTime(activity.date)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-4 text-center text-[10px] text-slate-500">
                  {loading ? 'Loading recent activities…' : 'No recent activities.'}
                </p>
              )}
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 text-slate-900">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-blue-700">MAU Clinic · OPD Patient Flow</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102b56]">Examination Room Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${error ? 'text-rose-700' : loading ? 'text-amber-700' : 'text-emerald-700'}`}>
            <span className={`h-2 w-2 rounded-full ${error ? 'bg-rose-500' : loading ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {error ? 'Unavailable' : loading ? 'Updating' : 'Live data'}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <CalendarDays size={15} aria-hidden="true" />
            {dashboard?.clinicDate || 'Loading clinic date'}
          </span>
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <section aria-label="Today's examination summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(({ value, label, icon: Icon, tone }) => (
          <article key={label} className={`flex min-h-[76px] items-center justify-between gap-3 rounded-lg border p-3 shadow-sm ${
            tone === 'blue' ? 'border-blue-200 bg-blue-100' :
            tone === 'green' ? 'border-emerald-200 bg-emerald-100' :
            tone === 'mint' ? 'border-green-200 bg-green-50' : 'border-rose-200 bg-rose-100'
          }`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
              tone === 'blue' ? 'bg-blue-600 text-white' :
              tone === 'green' ? 'bg-emerald-600 text-white' :
              tone === 'mint' ? 'bg-green-600 text-white' : 'bg-rose-600 text-white'
            }`}>
              <Icon size={23} aria-hidden="true" />
            </span>
            <div className="min-w-0 text-right">
              <p className="text-2xl font-extrabold leading-none text-[#102b56]">{value}</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-700">{label}</p>
            </div>
          </article>
        ))}
      </section>

      <section aria-label="Additional examination metrics" className="grid gap-3 sm:grid-cols-3">
        <article className="flex min-h-14 items-center justify-between rounded-lg border border-purple-200 bg-purple-100 px-4 py-2.5">
          <div className="flex items-center gap-3"><Clock3 className="text-purple-700" size={23} /><strong className="text-xl text-[#102b56]">{metricsData.avgWaitingTime ?? 0} min</strong></div>
          <span className="text-xs font-semibold text-slate-700">Avg Waiting Time</span>
          <ChartNoAxesColumnIncreasing className="text-purple-600" size={19} />
        </article>
        <article className="flex min-h-14 items-center justify-between rounded-lg border border-cyan-200 bg-cyan-100 px-4 py-2.5">
          <div className="flex items-center gap-3"><ArrowRightLeft className="text-cyan-700" size={23} /><strong className="text-xl text-[#102b56]">{metricsData.referralsToday ?? 0}</strong></div>
          <span className="text-xs font-semibold text-slate-700">Referrals Today</span>
          <ArrowRight className="text-cyan-700" size={18} />
        </article>
        <article className="flex min-h-14 items-center justify-between rounded-lg border border-orange-200 bg-orange-100 px-4 py-2.5">
          <div className="flex items-center gap-3"><BedDouble className="text-orange-700" size={23} /><strong className="text-xl text-[#102b56]">{metricsData.sickLeaveGiven ?? 0}</strong></div>
          <span className="text-xs font-semibold text-slate-700">Sick Leave Given</span>
          <ArrowRight className="text-orange-600" size={18} />
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle
            icon={Users}
            action={<span className="inline-flex items-center gap-2 text-xs font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Live</span>}
          >Patient Queue</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[690px] text-left text-xs">
              <thead className="bg-blue-50 text-[#102b56]">
                <tr>
                  <th className="px-3 py-2.5">#</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Student ID</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Wait Time</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeQueue.slice(0, 5).map((patient) => (
                  <tr key={patient.id} className="hover:bg-blue-50/60">
                    <td className="px-3 py-2.5 font-semibold text-blue-800">{patient.queueNumber || '—'}</td>
                    <td className="px-3 py-2.5 font-semibold">{patient.name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{patient.studentId}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${patient.emergency ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>{patient.status.replaceAll('_', ' ')}</span></td>
                    <td className="px-3 py-2.5 text-slate-700">{patient.waitMinutes} min</td>
                    <td className={`px-3 py-2.5 font-semibold ${patient.priority === 'Emergency' || patient.priority === 'Urgent' ? 'text-rose-700' : 'text-slate-600'}`}>{patient.priority}</td>
                    <td className="px-3 py-2.5">
                      <button type="button" disabled={Boolean(busyQueueId)} onClick={() => startSelectedConsultation(patient)} className="rounded-md bg-blue-50 px-2.5 py-1.5 text-[9px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50">
                        {patient.status === 'sent_to_examination'
                          ? patient.emergency ? 'Start Emergency Examination' : 'Start Examination'
                          : 'Continue Examination'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !activeQueue.length && <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No patients currently in the Examination Room queue.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5 text-xs">
            <span className="font-medium text-slate-600">Showing {Math.min(queue.length, 5)} of {queue.length} patients</span>
            <button type="button" onClick={() => onNavigate?.('Patient Queue')} className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700">View All Queue <ChevronRight size={14} /></button>
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
            <PanelTitle icon={Bell} action={<span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold">{alerts.length}</span>}>Real-time Alerts</PanelTitle>
            <div className="space-y-2 p-2.5">
              {alerts.map(({ tone, icon: Icon, text, time }) => (
                <div key={text} className={`flex items-center gap-2 rounded-md border p-2 ${tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-800' : tone === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <Icon size={17} className="shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-[11px] font-semibold leading-4">{text}</p>
                  <span className="shrink-0 text-[10px]">{time}</span>
                </div>
              ))}
              {!alerts.length && <p className="p-3 text-xs text-slate-500">No active alerts.</p>}
            </div>
          </article>

          <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
            <PanelTitle icon={FlaskConical} action={<button type="button" onClick={() => onNavigate?.('Lab Requests')} className="inline-flex items-center gap-1 text-[10px] font-semibold hover:underline">View All <ArrowRight size={13} /></button>}>Lab Requests Status</PanelTitle>
            <div className="grid grid-cols-3 divide-x divide-white p-1">
              <div className="rounded-l-md bg-blue-100 p-2 text-center"><Clock3 className="mx-auto text-blue-700" size={18} /><p className="mt-1 text-[10px] font-semibold">Pending</p><strong className="text-lg">{metricsData.labRequests?.pending ?? 0}</strong></div>
              <div className="bg-emerald-100 p-2 text-center"><Activity className="mx-auto text-emerald-700" size={18} /><p className="mt-1 text-[10px] font-semibold">In Progress</p><strong className="text-lg">{metricsData.labRequests?.inProgress ?? 0}</strong></div>
              <div className="rounded-r-md bg-green-100 p-2 text-center"><Check className="mx-auto text-green-700" size={18} /><p className="mt-1 text-[10px] font-semibold">Results Ready</p><strong className="text-lg">{metricsData.labRequests?.resultsReady ?? 0}</strong></div>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr_0.85fr]">
        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle icon={ChartNoAxesColumnIncreasing}>OPD Statistics (Today)</PanelTitle>
          <div className="grid min-h-[150px] grid-cols-[0.85fr_1.15fr] items-center gap-3 p-3">
            <div className="flex justify-center">
              <div className="grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb 0 ${newVisitPercent}%, #9333ea ${newVisitPercent}% 100%)` }}>
                <div className="grid h-[76px] w-[76px] place-content-center rounded-full bg-white text-center"><span className="text-[10px] font-semibold text-slate-500">Total</span><strong className="text-xl leading-5">{visitTotal}</strong></div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <p className="flex justify-between border-b border-slate-100 pb-1.5"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />New Visit</span><strong>{newVisits} ({newVisitPercent}%)</strong></p>
              <p className="flex justify-between"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-purple-600" />Repeat Visit</span><strong>{repeatVisits} ({repeatVisitPercent}%)</strong></p>
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-2">
              <p className="mb-1.5 text-[10px] font-bold text-slate-600">Top 5 Diagnoses (Today)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                {(metricsData.topDiagnoses || []).map((diagnosis, index) => <span key={diagnosis.name}>{index + 1}. {diagnosis.name} <b className="float-right">{diagnosis.count}</b></span>)}
                {!metricsData.topDiagnoses?.length && <span className="col-span-2 text-slate-500">No diagnoses recorded today.</span>}
              </div>
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle icon={Zap}>Quick Actions</PanelTitle>
          <div className="grid grid-cols-2 gap-2 p-3">
            <button type="button" onClick={callNextPatient} disabled={Boolean(busyQueueId)} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-blue-600 p-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><UserRoundCheck size={19} />Call Next Patient</button>
            <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-emerald-600 p-2 text-xs font-bold text-white hover:bg-emerald-700"><FlaskConical size={19} />New Lab Request</button>
            <button type="button" onClick={() => onNavigate?.('Current Consultation')} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 p-2 text-xs font-bold text-white hover:bg-violet-700"><Share2 size={19} />New Referral</button>
            <button type="button" onClick={() => onNavigate?.('Patient Records / History')} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-orange-500 p-2 text-xs font-bold text-white hover:bg-orange-600"><Search size={19} />Search Patient (MRN)</button>
          </div>
        </article>

        <article className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
          <PanelTitle icon={Info}>Quick Info</PanelTitle>
          <div className="divide-y divide-slate-100 px-3">
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><Users size={16} className="text-blue-600" />Total Visits Today</span><strong>{visitTotal}</strong></p>
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><HeartPulse size={16} className="text-emerald-600" />Active Consultations</span><strong>{metricsData.inConsultation ?? 0}</strong></p>
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><Share2 size={16} className="text-blue-600" />Referrals Today</span><strong>{metricsData.referralsToday ?? 0}</strong></p>
            <p className="flex items-center justify-between gap-2 py-2 text-xs"><span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-blue-600" />Average Wait Time</span><strong>{metricsData.avgWaitingTime ?? 0} min</strong></p>
          </div>
        </article>
      </section>

    </div>
  );
}

const ExaminationDashboard = (props) => (
  props.activeItem === 'Announcements'
    ? <StaffAnnouncements />
    : <ExaminationDashboardContent {...props} />
);

export default ExaminationDashboard;
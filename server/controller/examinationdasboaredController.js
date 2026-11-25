import mongoose from 'mongoose';
import { Queue } from '../module/AdminDashboardModels.js';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicVisit from '../module/ClinicVisit.js';
import Department from '../module/Department.js';
import Patient from '../module/Patient.js';
import QueueCounter from '../module/QueueCounter.js';
import ReferralLog from '../module/referralLogBook.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
const activeQueueStatuses = ['sent_to_examination', 'in_progress'];
const priorityOrder = { Emergency: 0, Urgent: 1, Normal: 2 };
const trimString = (value, limit = 500) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const choice = (value, values) => values.includes(value) ? value : '';
const validateOpdFields = (opd = {}) => {
  if (opd === null || opd === undefined) return '';
  if (typeof opd !== 'object' || Array.isArray(opd)) {
    return 'OPD register fields must be provided as an object.';
  }
  const choices = [
    ['rtaType', ['None', '1. Pedestrian', '2. Motorcyclist', '3. Vehicle occupant'], 'Select a valid road traffic accident type.'],
    ['hivTargetCode', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 'Select a valid HIV target population category.'],
    ['hivTestResult', ['N/A', 'P', 'N'], 'Select a valid HIV test result.'],
    ['tbScreeningResult', ['N/A', 'P', 'N'], 'Select a valid TB screening result.'],
    ['tbDiagnosticCode', ['1', '2', '3', '4', '5', '6'], 'Select a valid TB diagnostic code.'],
    ['tbResultCode', ['TB', 'No TB', 'ND'], 'Select a valid TB result code.'],
    ['referredCode', ['1', '2', '3', '4', '5', '6', '7', '8', '9'], 'Select a valid referral code.'],
  ];
  for (const [field, values, message] of choices) {
    if (opd[field] !== undefined && opd[field] !== '' && !values.includes(opd[field])) return message;
  }
  for (const field of ['roadTrafficAccident', 'hivTestOffered', 'hivTestPerformed', 'screenedForTb', 'tbScreened', 'died']) {
    if (opd[field] !== undefined && typeof opd[field] !== 'boolean') {
      return `The ${field} value must be true or false.`;
    }
  }
  return '';
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cleanList = (value, fields, limit, maxEntries = 30) => (Array.isArray(value) ? value.slice(0, maxEntries).map((entry) => {
  if (typeof entry === 'string') return { [fields[0]]: trimString(entry, limit) };
  if (!entry || typeof entry !== 'object') return null;
  return Object.fromEntries(fields.map((field) => [field, trimString(entry[field], limit)]));
}).filter((entry) => entry && Object.values(entry).some(Boolean)) : []);

const getExaminationData = (body = {}, user = {}) => {
  const referral = body.referral || {};
  const opd = body.opd || {};
  return {
    chiefComplaint: trimString(body.chiefComplaint, 1000),
    historyOfPresentIllness: trimString(body.historyOfPresentIllness, 3000),
    physicalExamination: trimString(body.physicalExamination, 3000),
    reviewOfSystem: trimString(body.reviewOfSystem, 3000),
    otherDiagnosis: trimString(body.otherDiagnosis, 500),
    hmisDiagnosis: trimString(body.hmisDiagnosis, 100).toUpperCase(),
    doctorNotes: trimString(body.doctorNotes, 3000),
    patientCondition: trimString(body.patientCondition, 40),
    disposition: trimString(body.disposition, 40),
    followUpDate: trimString(body.followUpDate, 20),
    prescriptionPatientType: body.prescriptionPatientType === 'inpatient' ? 'inpatient' : 'outpatient',
    prescriber: {},
    vitals: {
      bloodPressure: trimString(body.vitals?.bloodPressure, 30),
      temperature: trimString(body.vitals?.temperature, 30),
      pulse: trimString(body.vitals?.pulse, 30),
      respiratoryRate: trimString(body.vitals?.respiratoryRate, 30),
      weight: trimString(body.vitals?.weight, 30),
    },
    labRequests: cleanList(body.labRequests, ['testName', 'testCode', 'category', 'priority', 'clinicalNote'], 1000, 60)
      .map((item) => ({
        ...item,
        isRequested: true,
        priority: item.priority === 'urgent' ? 'urgent' : 'normal',
        status: 'Pending',
      })),
    prescriptions: cleanList(body.prescriptions, [
      'medicine', 'strength', 'form', 'dose', 'dosage', 'frequency', 'duration', 'quantity', 'quantityUnit', 'instructions',
    ], 300),
    opd: {
      roadTrafficAccident: Boolean(opd.roadTrafficAccident) || Boolean(opd.rtaType && opd.rtaType !== 'None'),
      accidentType: trimString(opd.rtaType || opd.accidentType, 100),
      rtaType: choice(opd.rtaType, ['None', '1. Pedestrian', '2. Motorcyclist', '3. Vehicle occupant']),
      hivTestOffered: Boolean(opd.hivTestOffered),
      hivTestPerformed: Boolean(opd.hivTestPerformed),
      hivResult: trimString(opd.hivTestResult || opd.hivResult, 100),
      targetPopulation: trimString(opd.hivTargetCode || opd.targetPopulation, 200),
      hivTargetCode: choice(opd.hivTargetCode, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
      hivTestResult: choice(opd.hivTestResult || opd.hivResult, ['N/A', 'P', 'N']),
      tbScreened: Boolean(opd.screenedForTb || opd.tbScreened),
      screenedForTb: Boolean(opd.screenedForTb || opd.tbScreened),
      tbResult: trimString(opd.tbResultCode || opd.tbScreeningResult || opd.tbResult, 200),
      tbScreeningResult: choice(opd.tbScreeningResult, ['N/A', 'P', 'N']),
      tbDiagnosticCode: choice(opd.tbDiagnosticCode, ['1', '2', '3', '4', '5', '6']),
      tbResultCode: choice(opd.tbResultCode, ['TB', 'No TB', 'ND']),
      diagnosticEvaluation: trimString(opd.tbDiagnosticCode || opd.diagnosticEvaluation, 200),
      referredTo: trimString(opd.referredCode || opd.referredTo, 200),
      referredCode: choice(opd.referredCode, ['1', '2', '3', '4', '5', '6', '7', '8', '9']),
      died: Boolean(opd.died),
    },
    referral: {
      department: trimString(referral.department, 120),
      reason: trimString(referral.reason, 1000),
      referredBy: trimString(referral.referredBy || user?.name, 120),
      qualification: trimString(referral.qualification || user?.qualification, 120),
      signature: trimString(referral.signature, 200),
      emergency: Boolean(referral.emergency),
      ambulanceDriver: trimString(referral.ambulanceDriver, 120),
      takeOffTime: trimString(referral.takeOffTime, 20),
      remark: trimString(referral.remark, 1000),
      referredAt: referral.department ? new Date() : null,
    },
    sickLeaveDays: Number(body.sickLeaveDays || 0),
  };
};
const preserveLabResults = (existingRequests = [], requestedRequests = []) => {
  const identity = (request) => request.testCode || request.testName;
  const requestedIds = new Set(requestedRequests.map(identity));
  const preserved = existingRequests.filter((request) => request.status && request.status !== 'Pending'
    && !requestedIds.has(identity(request)));
  const mergedRequests = requestedRequests.map((request) => {
    const previous = existingRequests.find((item) => identity(item) === identity(request));
    return previous && previous.status !== 'Pending'
      ? {
        ...previous.toObject?.(),
        ...request,
        status: previous.status,
        result: previous.result || '',
        unit: previous.unit || '',
        referenceRange: previous.referenceRange || '',
        flag: previous.flag || '',
      }
      : request;
  });
  return [...preserved, ...mergedRequests];
};
const preserveLabWorkflow = (visit, examinationData, user) => {
  const previous = visit.examination || {};
  const previousRequests = previous.labRequests || [];
  const labRequests = preserveLabResults(previousRequests, examinationData.labRequests);
  const hasRequests = labRequests.length > 0;
  const previousCodes = new Set(previousRequests.map((item) => item.testCode || item.testName));
  const addedTests = examinationData.labRequests.some((item) => !previousCodes.has(item.testCode || item.testName));
  const startNewBatch = previousRequests.length > 0 && addedTests
    && previous.labStatus && previous.labStatus !== 'Pending';
  const requestNumber = startNewBatch
    ? `LR-${getClinicDateKey(visit.visitDate).replace(/-/g, '')}-${String(visit._id).slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`
    : previous.labRequestNumber
      || `LR-${getClinicDateKey(visit.visitDate).replace(/-/g, '')}-${String(visit._id).slice(-6).toUpperCase()}`;
  const workflow = startNewBatch ? {} : previous;
  return {
    ...examinationData,
    labRequests,
    labRequestNumber: hasRequests ? requestNumber : '',
    labStatus: hasRequests ? (workflow.labStatus || 'Pending') : '',
    labRequestedBy: hasRequests
      ? (startNewBatch ? trimString(user?.name, 120) : workflow.labRequestedBy || trimString(user?.name, 120))
      : '',
    labRequestedAt: hasRequests ? (workflow.labRequestedAt || new Date()) : null,
    labSampleCollectedAt: workflow.labSampleCollectedAt || null,
    labInProgressAt: workflow.labInProgressAt || null,
    labResultReadyAt: workflow.labResultReadyAt || null,
    labReviewedAt: workflow.labReviewedAt || null,
    labTestedBy: workflow.labTestedBy || '',
    labTechnicianSignature: workflow.labTechnicianSignature || '',
    labEnteredAt: workflow.labEnteredAt || null,
    labTechnicianNotes: workflow.labTechnicianNotes || '',
    labDateOfReport: workflow.labDateOfReport || null,
    labApprovedBy: workflow.labApprovedBy || '',
    labApprovedAt: workflow.labApprovedAt || null,
  };
};
const preservePrescriptionWorkflow = (visit, examinationData, user) => {
  const previous = visit.examination || {};
  const existingPrescriptions = previous.prescriptions || [];
  const previousPrescriber = previous.prescriber?.toObject?.() || previous.prescriber || {};
  const submittedPrescriptions = previous.prescriptionStatus
    && previous.prescriptionStatus !== 'Pending'
    ? existingPrescriptions.map((item) => item.toObject?.() || item)
    : examinationData.prescriptions;
  const prescriptions = submittedPrescriptions.map((item) => {
    const previousItem = existingPrescriptions.find((entry) => (
      entry.medicine?.trim().toLowerCase() === item.medicine?.trim().toLowerCase()
      && entry.strength?.trim().toLowerCase() === item.strength?.trim().toLowerCase()
      && entry.form?.trim().toLowerCase() === item.form?.trim().toLowerCase()
    ));
    return { ...item, priceCents: previousItem?.priceCents || 0 };
  });
  const hasPrescriptions = prescriptions.length > 0;
  return {
    ...examinationData,
    prescriptions,
    prescriptionStatus: hasPrescriptions
      ? previous.prescriptionStatus || 'Pending'
      : previous.prescriptionStatus || '',
    prescriber: hasPrescriptions ? {
      name: trimString(user?.name, 120),
      qualification: trimString(user?.qualification, 120),
      registration: trimString(user?.registrationNo || user?.registration || user?.licenseNumber, 120),
      signedAt: new Date(),
    } : previousPrescriber,
    prescriptionEvaluatedBy: previous.prescriptionEvaluatedBy || '',
    prescriptionEvaluatedAt: previous.prescriptionEvaluatedAt || null,
    prescriptionDispensedBy: previous.prescriptionDispensedBy || '',
    prescriptionDispensedAt: previous.prescriptionDispensedAt || null,
  };
};
const sortQueueByPriority = (entries) => entries.sort((left, right) => (
  Number(Boolean(right.isEmergency)) - Number(Boolean(left.isEmergency))
  || (priorityOrder[left.priority] ?? 2) - (priorityOrder[right.priority] ?? 2)
  || new Date(left.arrivedAt || 0) - new Date(right.arrivedAt || 0)
));

const getClinicDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getClinicDayBounds = (date = new Date()) => {
  const clinicDate = getClinicDateKey(date);
  const start = new Date(`${clinicDate}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const getExaminationDepartment = async (req) => {
  const userDepartment = trimString(req.user?.department, 120);
  if (userDepartment) return userDepartment;
  const department = await Department.findOne({
    status: 'Active',
    name: { $regex: 'examination', $options: 'i' },
  }).select('name').sort({ name: 1 }).lean();
  return department?.name || '';
};

const populateQueueVisits = (query) => query.populate({
  path: 'visitId',
  select: 'visitId patientRecordId patientId patientName visitDate visitType priority status diagnosis examination emergency referred',
  populate: { path: 'patientRecordId', select: 'cardNumber fullName age sex universityIdNumber academicDepartment governmentIdNumber phoneNumber region town woreda kebele address dormBlock allergies chronicConditions' },
});

const toQueueItem = (queue, now = Date.now()) => {
  const visit = queue.visitId && typeof queue.visitId === 'object' ? queue.visitId : null;
  const arrivedAt = queue.arrivedAt ? new Date(queue.arrivedAt).getTime() : now;
  const waitFinishedAt = queue.inProgressAt || queue.completedAt || (queue.status === 'completed' ? queue.updatedAt : null);
  const waitUntil = waitFinishedAt ? new Date(waitFinishedAt).getTime() : now;
  return {
    id: String(queue._id),
    visitId: visit?._id ? String(visit._id) : '',
    visitDate: visit?.visitDate || queue.arrivedAt || null,
    queueNumber: queue.queueNumber || '',
    patientId: queue.patientId || visit?.patientId || '',
    name: queue.patientName || visit?.patientName || 'Patient',
    studentId: visit?.patientRecordId?.universityIdNumber || queue.patientId || visit?.patientId || '',
    cardNumber: visit?.patientRecordId?.cardNumber || '',
    patientRecordId: visit?.patientRecordId?._id ? String(visit.patientRecordId._id) : '',
    age: visit?.patientRecordId?.age ?? '',
    sex: visit?.patientRecordId?.sex || '',
    academicDepartment: visit?.patientRecordId?.academicDepartment || '',
    telephone: visit?.patientRecordId?.phoneNumber || '',
    governmentIdNumber: visit?.patientRecordId?.governmentIdNumber || '',
    region: visit?.patientRecordId?.region || '',
    town: visit?.patientRecordId?.town || '',
    woreda: visit?.patientRecordId?.woreda || '',
    kebele: visit?.patientRecordId?.kebele || '',
    address: visit?.patientRecordId?.address || '',
    woredaKebele: [visit?.patientRecordId?.woreda, visit?.patientRecordId?.kebele].filter(Boolean).join(' / '),
    age: visit?.patientRecordId?.age ?? null,
    sex: visit?.patientRecordId?.sex || '',
    visitType: visit?.visitType || queue.visitType || '',
    labReturn: Boolean(queue.labReturn),
    department: queue.department || visit?.department || '',
    source: visit ? 'Card Room' : 'Clinic Queue',
    status: queue.status,
    priority: queue.priority,
    emergency: queue.isEmergency || visit?.emergency || queue.priority === 'Emergency',
    waitMinutes: Math.max(0, Math.floor((waitUntil - arrivedAt) / 60000)),
    arrivedAt: queue.arrivedAt,
    examination: visit?.examination || null,
  };
};

export const getExaminationDashboard = async (req, res) => {
  try {
    const department = await getExaminationDepartment(req);
    const clinicDate = getClinicDateKey();
    const queueFilter = { clinicDate, ...(department ? { department } : {}) };
    const { start, end } = getClinicDayBounds();
    const visitFilter = { visitDate: { $gte: start, $lt: end }, ...(department ? { department } : {}) };
    const [waiting, inConsultation, completedToday, emergency, activeQueue, completedQueue, visits, diagnosisRows, labRows, overviewRows] = await Promise.all([
      Queue.countDocuments({ ...queueFilter, status: 'sent_to_examination' }),
      Queue.countDocuments({ ...queueFilter, status: 'in_progress' }),
      Queue.countDocuments({ ...queueFilter, status: 'completed' }),
      Queue.countDocuments({ ...queueFilter, status: { $in: activeQueueStatuses }, $or: [{ priority: 'Emergency' }, { isEmergency: true }] }),
      populateQueueVisits(Queue.find({ ...queueFilter, status: { $in: activeQueueStatuses } }).limit(250)).lean(),
      populateQueueVisits(Queue.find({ ...queueFilter, status: 'completed' }).sort({ completedAt: -1 }).limit(250)).lean(),
      ClinicVisit.find(visitFilter)
        .select('patientRecordId patientId patientName visitId visitDate diagnosis referred examination status visitType priority')
        .populate({
          path: 'patientRecordId',
          select: 'cardNumber fullName age sex universityIdNumber academicDepartment governmentIdNumber phoneNumber region town woreda kebele address dormBlock allergies chronicConditions',
        })
        .sort({ visitDate: -1 })
        .limit(100)
        .lean(),
      ClinicVisit.aggregate([
        { $match: { ...visitFilter, diagnosis: { $type: 'string', $regex: /\S/ } } },
        { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 5 },
      ]),
      ClinicVisit.aggregate([
        { $match: visitFilter },
        { $unwind: { path: '$examination.labRequests', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$examination.labRequests.status', count: { $sum: 1 } } },
      ]),
      ClinicVisit.aggregate([
        { $match: visitFilter },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            newVisits: { $sum: { $cond: [{ $eq: ['$visitType', 'New Visit'] }, 1, 0] } },
            followUpVisits: { $sum: { $cond: [{ $eq: ['$visitType', 'Follow-up Visit'] }, 1, 0] } },
            sickLeaveGiven: { $sum: { $cond: [{ $gt: ['$examination.sickLeaveDays', 0] }, 1, 0] } },
          },
        },
      ]),
    ]);
    const pendingWaitMinutes = activeQueue
      .filter(({ status }) => status === 'sent_to_examination')
      .map(({ arrivedAt }) => Math.max(0, (Date.now() - new Date(arrivedAt || Date.now()).getTime()) / 60000));
    const labCounts = Object.fromEntries(labRows.map(({ _id, count }) => [_id, count]));
    const overview = overviewRows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        department,
        clinicDate,
        metrics: {
          waiting,
          inConsultation,
          completedToday,
          emergency,
          avgWaitingTime: pendingWaitMinutes.length ? Math.round(pendingWaitMinutes.reduce((sum, minutes) => sum + minutes, 0) / pendingWaitMinutes.length) : 0,
          referralsToday: visits.filter(({ referred, examination }) => referred || examination?.referral?.department).length,
          sickLeaveGiven: overview.sickLeaveGiven || 0,
          totalVisits: overview.totalVisits || 0,
          newVisits: overview.newVisits || 0,
          followUpVisits: overview.followUpVisits || 0,
          labRequests: {
            pending: labCounts.Pending || 0,
            inProgress: labCounts['In Progress'] || 0,
            resultsReady: labCounts['Results Ready'] || 0,
          },
          topDiagnoses: diagnosisRows.map(({ _id, count }) => ({ name: _id, count })),
        },
        queue: [
          ...sortQueueByPriority(activeQueue),
          ...completedQueue,
        ].map((entry) => toQueueItem(entry)),
        visits,
      },
    });
  } catch (error) {
    console.error('Failed to load Examination Room dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load the Examination Room dashboard.' });
  }
};

export const getExaminationLabRequests = async (req, res) => {
  try {
    const department = await getExaminationDepartment(req);
    const roles = [
      req.user?.activeRole,
      req.user?.role,
      ...(Array.isArray(req.user?.roles) ? req.user.roles : []),
    ].map((role) => String(role || '').toLowerCase());
    const isLabStaff = roles.some((role) => role.includes('lab'));
    const { start, end } = getClinicDayBounds();
    const visits = await ClinicVisit.find({
      'examination.labRequests.0': { $exists: true },
      ...(department && !isLabStaff ? { department } : {}),
      $or: [
        { 'examination.labStatus': { $in: ['Pending', 'Sample Collected', 'In Progress', 'Results Ready'] } },
        { 'examination.labRequests.status': { $in: ['Pending', 'Sample Collected', 'In Progress', 'Results Ready'] } },
        { visitDate: { $gte: start, $lt: end } },
      ],
    })
      .select([
        'patientRecordId',
        'patientId',
        'patientName',
        'visitDate',
        'examination.labRequests',
        'examination.labRequestNumber',
        'examination.labStatus',
        'examination.labRequestedBy',
        'examination.labRequestedAt',
        'examination.labTestedBy',
        'examination.labTechnicianSignature',
        'examination.labEnteredAt',
        'examination.labTechnicianNotes',
        'examination.labDateOfReport',
        'examination.labResultReadyAt',
        'examination.labApprovedBy',
        'examination.labReviewedAt',
        'examination.labApprovedAt',
      ].join(' '))
      .populate({
        path: 'patientRecordId',
        select: 'cardNumber fullName age sex universityIdNumber governmentIdNumber phoneNumber region town woreda kebele address',
      })
      .sort({ visitDate: -1 })
      .limit(200)
      .lean();
    return res.status(200).json({ success: true, data: visits });
  } catch (error) {
    console.error('Failed to load examination laboratory requests:', error);
    return res.status(500).json({ success: false, message: 'Unable to load laboratory requests.' });
  }
};

export const getExaminationReferrals = async (req, res) => {
  try {
    const department = await getExaminationDepartment(req);
    const search = trimString(req.query.search, 120);
    const referralFilter = {
      ...(department ? { department } : {}),
      $or: [
        { referred: true },
        { 'examination.referral.department': { $type: 'string', $regex: /\S/ } },
      ],
    };
    const visits = await ClinicVisit.find(referralFilter)
      .select('patientRecordId patientId patientName visitId visitDate visitType priority status diagnosis department referred examination')
      .populate({
        path: 'patientRecordId',
        select: 'cardNumber fullName age sex universityIdNumber governmentIdNumber address dormBlock woreda kebele',
      })
      .sort({ visitDate: -1 })
      .limit(500)
      .lean();
    const expression = search ? new RegExp(escapeRegex(search), 'i') : null;
    const data = visits.filter((visit) => !expression || [
      visit.patientName,
      visit.patientId,
      visit.patientRecordId?.cardNumber,
      visit.patientRecordId?.fullName,
      visit.patientRecordId?.universityIdNumber,
      visit.patientRecordId?.governmentIdNumber,
      visit.examination?.referral?.department,
      visit.examination?.referral?.reason,
      visit.diagnosis,
    ].some((value) => expression.test(String(value || ''))));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Failed to load examination referrals:', error);
    return res.status(500).json({ success: false, message: 'Unable to load examination referrals.' });
  }
};

export const listExaminationQueue = async (req, res) => {
  try {
    const department = await getExaminationDepartment(req);
    const clinicDate = getClinicDateKey();
    const search = trimString(req.query.search, 100);
    const status = trimString(req.query.status, 20);
    const filter = {
      clinicDate,
      ...(department ? { department } : {}),
      ...(status === 'in_progress'
        ? { status: 'in_progress' }
        : status === 'completed'
          ? { status: 'completed' }
          : status === 'all'
            ? { status: { $in: [...activeQueueStatuses, 'completed'] } }
            : { status: 'sent_to_examination' }),
    };
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ patientId: expression }, { patientName: expression }, { queueNumber: expression }];
    }
    const entries = await populateQueueVisits(Queue.find(filter).limit(250)).lean();
    return res.status(200).json({ success: true, data: sortQueueByPriority(entries).map((entry) => toQueueItem(entry)) });
  } catch (error) {
    console.error('Failed to load Examination Room queue:', error);
    return res.status(500).json({ success: false, message: 'Unable to load the Examination Room queue.' });
  }
};

export const updateExaminationQueue = async (req, res) => {
  const { id } = req.params;
  const action = trimString(req.body?.action, 20);
  if (!mongoose.isValidObjectId(id) || !['call', 'skip', 'recall'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Choose a valid queue action.' });
  }
  try {
    const department = await getExaminationDepartment(req);
    const baseFilter = { _id: id, clinicDate: getClinicDateKey(), ...(department ? { department } : {}) };
    const currentStatus = action === 'recall' ? 'in_progress' : 'sent_to_examination';
    const set = action === 'call'
      ? { status: 'in_progress', inProgressAt: new Date() }
      : action === 'recall'
        ? { status: 'sent_to_examination', inProgressAt: null, arrivedAt: new Date() }
        : { arrivedAt: new Date() };
    const queue = await Queue.findOneAndUpdate(
      { ...baseFilter, status: currentStatus },
      { $set: set },
      { new: true, runValidators: true },
    );
    if (!queue) {
      return res.status(409).json({ success: false, message: 'This queue entry has changed. Refresh the dashboard and try again.' });
    }
    if (queue.visitId && action !== 'skip') {
      await ClinicVisit.updateOne({ _id: queue.visitId }, {
        $set: { status: action === 'call' ? 'In Service' : 'Sent to Examination' },
      });
    }
    await writeAuditEvent({
      req,
      action: `EXAMINATION_QUEUE_${action.toUpperCase()}`,
      entityType: 'queue',
      entityId: queue._id,
      details: `Queue entry ${queue.queueNumber || queue.patientId} was ${action === 'skip' ? 'moved to the end of the queue' : action === 'call' ? 'called for consultation' : 'recalled to the queue'}.`,
    });
    req.app.get('io')?.emit('clinic:queue-updated');
    return res.status(200).json({ success: true, message: 'Queue updated.', data: toQueueItem(queue) });
  } catch (error) {
    console.error('Failed to update Examination Room queue:', error);
    return res.status(500).json({ success: false, message: 'Unable to update the queue.' });
  }
};

export const searchExaminationPatients = async (req, res) => {
  const search = trimString(req.query.search, 100);
  if (search.length < 2) return res.status(200).json({ success: true, data: [] });
  try {
    const expression = new RegExp(escapeRegex(search), 'i');
    const patients = await Patient.find({
      $or: [
        { patientId: expression },
        { cardNumber: expression },
        { fullName: expression },
        { universityIdNumber: expression },
        { governmentIdNumber: expression },
      ],
    }).select('patientId cardNumber fullName firstName fatherName grandfatherName age sex dateOfBirth createdAt patientCategory universityIdNumber academicDepartment governmentIdNumber phoneNumber region town woreda kebele address').sort({ fullName: 1 }).limit(25).lean();
    return res.status(200).json({ success: true, data: patients });
  } catch (error) {
    console.error('Failed to search Examination Room patients:', error);
    return res.status(500).json({ success: false, message: 'Unable to search patient records.' });
  }
};

export const getExaminationPatientHistory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Patient reference is invalid.' });
  try {
    const patient = await Patient.findById(req.params.id).select('patientId cardNumber fullName firstName fatherName grandfatherName age sex dateOfBirth createdAt patientCategory universityIdNumber academicDepartment governmentIdNumber phoneNumber region town woreda kebele address dormBlock houseNumber allergies chronicConditions').lean();
    if (!patient) return res.status(404).json({ success: false, message: 'Patient record not found.' });
    const visits = await ClinicVisit.find({ $or: [{ patientRecordId: patient._id }, { patientId: patient.patientId }] })
      .select('visitId patientId patientName visitDate department visitType priority status diagnosis examination')
      .sort({ visitDate: -1 }).limit(100).lean();
    const legacy = await mongoose.connection.collection('patientrecords')
      .find({ patientId: patient.patientId }, { projection: { diagnosis: 1, department: 1, doctorName: 1, createdAt: 1 } })
      .sort({ createdAt: -1 }).limit(100).toArray();
    return res.status(200).json({ success: true, data: { patient, visits, legacy } });
  } catch (error) {
    console.error('Failed to load Examination Room patient history:', error);
    return res.status(500).json({ success: false, message: 'Unable to load patient history.' });
  }
};

const returnVisitToExaminationQueue = async (req, visit) => {
  const now = new Date();
  const clinicDate = getClinicDateKey(now);
  const existingQueue = await Queue.findOne({ visitId: visit._id, clinicDate }).sort({ createdAt: -1 });
  let queue;

  if (existingQueue) {
    queue = await Queue.findOneAndUpdate(
      { _id: existingQueue._id },
      {
        $set: {
          status: 'sent_to_examination',
          labReturn: true,
          arrivedAt: now,
          inProgressAt: null,
          completedAt: null,
        },
      },
      { new: true, runValidators: true },
    );
  } else {
    let department = await Department.findOne({
      status: 'Active',
      name: visit.department,
    }).select('name code').lean();
    if (!department) {
      department = await Department.findOne({
        status: 'Active',
        name: { $regex: 'examination', $options: 'i' },
      }).select('name code').sort({ name: 1 }).lean();
    }
    if (!department) throw new Error('No active Examination department is configured for lab returns.');

    const prefix = String(department.code || 'EXAM').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'EXAM';
    const counter = await QueueCounter.findOneAndUpdate(
      { _id: `department-queue-${prefix}-${clinicDate}` },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    queue = await Queue.create({
      patientId: visit.patientId,
      patientName: visit.patientName,
      visitId: visit._id,
      queueNumber: `${prefix}-${String(counter.sequence).padStart(3, '0')}`,
      clinicDate,
      visitType: visit.visitType,
      priority: visit.priority,
      department: department.name,
      status: 'sent_to_examination',
      labReturn: true,
      arrivedAt: now,
      isEmergency: Boolean(visit.emergency || visit.priority === 'Emergency'),
      createdBy: req.user?._id || null,
    });
  }

  if (!queue) throw new Error('Unable to return the patient to the Examination queue.');
  visit.status = 'Sent to Examination';
  await visit.save();
  await writeAuditEvent({
    req,
    action: 'LAB_RESULTS_RETURNED_TO_EXAMINATION',
    entityType: 'queue',
    entityId: queue._id,
    details: `Approved laboratory results returned visit ${visit.visitId || visit.patientId} to the Examination queue.`,
  });
  return queue;
};

const createReferralLogEntry = async ({ visit, examinationData, user }) => {
  const referralDepartment = trimString(examinationData.referral.department, 120);
  const sickLeaveDays = Number(examinationData.sickLeaveDays || 0);
  const isSickLeave = examinationData.patientCondition === 'Sick Leave' || sickLeaveDays > 0;
  if (!referralDepartment && !isSickLeave) return null;

  const existing = await ReferralLog.findOne({ examinationVisitId: visit._id });
  if (existing) return existing;

  let patientCardNumber = '';
  if (visit.patientRecordId) {
    const patient = await Patient.findById(visit.patientRecordId).select('cardNumber').lean();
    patientCardNumber = trimString(patient?.cardNumber, 80);
  }
  if (!patientCardNumber) {
    const patient = await Patient.findOne({ patientId: visit.patientId }).select('cardNumber').lean();
    patientCardNumber = trimString(patient?.cardNumber, 80);
  }
  if (!patientCardNumber) patientCardNumber = trimString(visit.patientId, 80);

  let patientCondition = 'Non emergency';
  if (isSickLeave) patientCondition = 'Sick leave';
  else if (examinationData.patientCondition === 'Emergency' || examinationData.referral.emergency) patientCondition = 'Emergency';

  const lastRecord = await ReferralLog.findOne().sort({ serialNo: -1 });
  const now = new Date();
  const logDate = visit.visitDate ? new Date(visit.visitDate) : now;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return ReferralLog.create({
    examinationVisitId: visit._id,
    serialNo: lastRecord ? lastRecord.serialNo + 1 : 1,
    date: logDate,
    patientCardNumber,
    diseaseHmisClassification: trimString(examinationData.hmisDiagnosis || visit.diagnosis, 500),
    patientCondition,
    referredByHealthProfession: trimString(examinationData.referral.referredBy || user?.name, 120),
    referredOrAmbulanceDriver: trimString(
      examinationData.referral.ambulanceDriver || referralDepartment,
      120,
    ),
    time: examinationData.referral.takeOffTime || time,
    remark: trimString(
      examinationData.referral.remark
        || (isSickLeave ? `${sickLeaveDays} day${sickLeaveDays === 1 ? '' : 's'} sick leave` : examinationData.referral.reason),
      1000,
    ),
  });
};

export const submitExamination = async (req, res) => {
  const { visitId } = req.params;
  const examinationData = getExaminationData(req.body, req.user);
  const diagnosis = trimString(req.body?.diagnosis, 500);
  const opdValidationError = validateOpdFields(req.body?.opd);
  if (opdValidationError) {
    return res.status(400).json({ success: false, message: opdValidationError });
  }
  if (!mongoose.isValidObjectId(visitId) || !diagnosis || !examinationData.hmisDiagnosis
    || !['Outpatient', 'Emergency', 'Non-emergency', 'Sick Leave'].includes(examinationData.patientCondition)
    || !Number.isInteger(examinationData.sickLeaveDays) || examinationData.sickLeaveDays < 0 || examinationData.sickLeaveDays > 365) {
    return res.status(400).json({ success: false, message: 'Enter the main diagnosis, HMIS diagnosis, patient condition, and a valid sick-leave duration.' });
  }
  const referralDepartment = examinationData.referral.department;
  const referralReason = examinationData.referral.reason;
  if (Boolean(referralDepartment) !== Boolean(referralReason)) {
    return res.status(400).json({ success: false, message: 'Provide both a referral department and reason.' });
  }
  try {
    const department = await getExaminationDepartment(req);
    const queueFilter = { visitId, clinicDate: getClinicDateKey(), status: 'in_progress', ...(department ? { department } : {}) };
    const queue = await Queue.findOne(queueFilter);
    if (!queue) return res.status(409).json({ success: false, message: 'Call this patient into consultation before completing the examination.' });
    const visit = await ClinicVisit.findById(visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Clinic visit not found.' });
    visit.diagnosis = diagnosis;
    visit.referred = Boolean(referralDepartment);
    visit.status = 'Completed';
    visit.examination = preservePrescriptionWorkflow(
      visit,
      preserveLabWorkflow(visit, examinationData, req.user),
      req.user,
    );
    visit.examination.examiner = {
      name: trimString(req.user?.name, 120),
      qualification: trimString(req.user?.qualification, 120),
      registration: trimString(req.user?.registrationNo || req.user?.registration || req.user?.licenseNumber, 120),
      signedAt: new Date(),
    };
    const savedVisit = await visit.save();
    try {
      await createReferralLogEntry({
        visit: savedVisit,
        examinationData,
        user: req.user,
      });
    } catch (logError) {
      console.error('Failed to create referral log entry for completed examination:', logError);
      return res.status(500).json({
        success: false,
        message: 'Examination data was saved, but its Referral Log Book entry failed. Retry completing the examination.',
      });
    }
    const completedQueue = await Queue.findOneAndUpdate(
      { _id: queue._id, status: 'in_progress' },
      { $set: { status: 'completed', completedAt: new Date() } },
      { new: true },
    );
    if (!completedQueue) return res.status(409).json({ success: false, message: 'The queue changed while saving. Refresh and check this visit.' });
    await writeAuditEvent({
      req,
      action: 'EXAMINATION_COMPLETED',
      entityType: 'clinic_visit',
      entityId: savedVisit._id,
      details: `Examination completed for visit ${savedVisit.visitId || savedVisit.patientId}.`,
    });
    req.app.get('io')?.emit('clinic:queue-updated');
    if (savedVisit.examination.referral?.department) {
      req.app.get('io')?.emit('clinic:referral-updated', { visitId: String(savedVisit._id) });
    }
    if (savedVisit.examination.prescriptions?.length) {
      req.app.get('io')?.emit('clinic:prescription-updated', { visitId: String(savedVisit._id) });
    }
    return res.status(200).json({ success: true, message: 'Examination saved and queue completed.', data: savedVisit });
  } catch (error) {
    console.error('Failed to submit Examination Room record:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the examination.' });
  }
};

export const saveExaminationDraft = async (req, res) => {
  const { visitId } = req.params;
  if (!mongoose.isValidObjectId(visitId)) {
    return res.status(400).json({ success: false, message: 'Clinic visit reference is invalid.' });
  }
  const examinationData = getExaminationData(req.body, req.user);
  const opdValidationError = validateOpdFields(req.body?.opd);
  if (opdValidationError) {
    return res.status(400).json({ success: false, message: opdValidationError });
  }
  if (!Number.isInteger(examinationData.sickLeaveDays) || examinationData.sickLeaveDays < 0 || examinationData.sickLeaveDays > 365) {
    return res.status(400).json({ success: false, message: 'Enter a valid sick-leave duration.' });
  }
  try {
    const department = await getExaminationDepartment(req);
    const queue = await Queue.findOne({
      visitId,
      clinicDate: getClinicDateKey(),
      status: 'in_progress',
      ...(department ? { department } : {}),
    });
    if (!queue) return res.status(409).json({ success: false, message: 'Call this patient into consultation before saving a draft.' });
    const visit = await ClinicVisit.findById(visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Clinic visit not found.' });
    visit.diagnosis = trimString(req.body?.diagnosis, 500);
    visit.referred = Boolean(examinationData.referral.department);
    visit.examination = preservePrescriptionWorkflow(
      visit,
      preserveLabWorkflow(visit, examinationData, req.user),
      req.user,
    );
    const savedVisit = await visit.save();
    await writeAuditEvent({
      req,
      action: 'EXAMINATION_DRAFT_SAVED',
      entityType: 'clinic_visit',
      entityId: savedVisit._id,
      details: `Examination draft saved for visit ${savedVisit.visitId || savedVisit.patientId}.`,
    });
    if (savedVisit.examination.prescriptions?.length) {
      req.app.get('io')?.emit('clinic:prescription-updated', { visitId: String(savedVisit._id) });
    }
    if (savedVisit.examination.referral?.department) {
      req.app.get('io')?.emit('clinic:referral-updated', { visitId: String(savedVisit._id) });
    }
    return res.status(200).json({ success: true, message: 'Examination draft saved.', data: savedVisit });
  } catch (error) {
    console.error('Failed to save Examination Room draft:', error);
    const message = process.env.NODE_ENV === 'production' || !(error instanceof Error)
      ? 'Unable to save the examination draft.'
      : `Unable to save the examination draft: ${error.name}: ${error.message}`;
    return res.status(500).json({ success: false, message });
  }
};

export const submitPrescription = async (req, res) => {
  const { visitId } = req.params;
  if (!mongoose.isValidObjectId(visitId)) {
    return res.status(400).json({ success: false, message: 'Clinic visit reference is invalid.' });
  }
  const prescriptions = cleanList(req.body?.prescriptions, [
    'medicine', 'strength', 'form', 'dose', 'frequency', 'duration', 'quantity', 'quantityUnit', 'instructions',
  ], 300, 30);
  if (!prescriptions.length || prescriptions.some((item) => !item.medicine)) {
    return res.status(400).json({ success: false, message: 'Add at least one medicine with a drug name before submitting.' });
  }
  const weight = trimString(req.body?.weight, 30);
  const diagnosis = trimString(req.body?.diagnosis, 500);
  const patientType = req.body?.prescriptionPatientType === 'inpatient' ? 'inpatient' : 'outpatient';
  try {
    const department = await getExaminationDepartment(req);
    const queue = await Queue.findOne({
      visitId,
      clinicDate: getClinicDateKey(),
      status: 'in_progress',
      ...(department ? { department } : {}),
    });
    if (!queue) {
      return res.status(409).json({ success: false, message: 'Call this patient into consultation before submitting a prescription.' });
    }
    const visit = await ClinicVisit.findById(visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Clinic visit not found.' });
    if (visit.examination?.prescriptionStatus
      && visit.examination.prescriptionStatus !== 'Pending') {
      return res.status(409).json({ success: false, message: 'This prescription has already been processed by the pharmacy and cannot be changed.' });
    }

    const examination = visit.examination || (visit.examination = {});
    examination.prescriptions = prescriptions.map((item) => ({
      ...item,
      priceCents: 0,
    }));
    examination.prescriptionStatus = 'Pending';
    examination.prescriptionPatientType = patientType;
    examination.vitals = examination.vitals || {};
    examination.vitals.weight = weight || examination.vitals.weight || '';
    examination.prescriber = {
      name: trimString(req.user?.name, 120),
      qualification: trimString(req.user?.qualification, 120),
      registration: trimString(req.user?.registrationNo || req.user?.registration || req.user?.licenseNumber, 120),
      signedAt: new Date(),
    };
    if (diagnosis) visit.diagnosis = diagnosis;
    const savedVisit = await visit.save();
    await writeAuditEvent({
      req,
      action: 'PRESCRIPTION_SUBMITTED',
      entityType: 'clinic_visit',
      entityId: savedVisit._id,
      details: `Prescription submitted to the pharmacy for visit ${savedVisit.visitId || savedVisit.patientId}.`,
    });
    req.app.get('io')?.emit('clinic:prescription-updated', { visitId: String(savedVisit._id) });
    return res.status(200).json({ success: true, message: 'Prescription submitted to the pharmacy queue.', data: savedVisit });
  } catch (error) {
    console.error('Failed to submit prescription:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit the prescription.' });
  }
};

export const getPrescriptionMedicineAvailability = async (req, res) => {
  const search = trimString(req.query?.search, 150);
  const searchTerms = search.split(/\s+/).filter((term) => term.length >= 2);
  if (search.length < 2 || !searchTerms.length) {
    return res.status(400).json({ success: false, message: 'Enter a medicine name to check dispensary stock.' });
  }
  try {
    const inventory = await ClinicInventory.find({
      $and: searchTerms.map((term) => ({
        itemName: { $regex: escapeRegex(term), $options: 'i' },
      })),
    })
      .select('itemName quantity unit batches')
      .sort({ itemName: 1 })
      .limit(8)
      .lean();
    const now = new Date();
    const items = inventory.map((item) => {
      const availableFromBatches = (item.batches || [])
        .filter((batch) => (
          Number(batch.quantity) > 0
          && String(batch.batchNumber || '').trim()
          && batch.expiryDate
          && new Date(batch.expiryDate) >= now
        ))
        .reduce((sum, batch) => sum + Number(batch.quantity), 0);
      const availableQuantity = Math.min(availableFromBatches, Number(item.quantity) || 0);
      return {
        id: String(item._id),
        itemName: item.itemName,
        availableQuantity,
        unit: item.unit || 'units',
        inStock: availableQuantity > 0,
      };
    });
    return res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    console.error('Failed to check prescription medicine availability:', error);
    return res.status(500).json({ success: false, message: 'Unable to check dispensary stock.' });
  }
};

export const updateLabProcessingStatus = async (req, res) => {
  const { visitId } = req.params;
  const action = trimString(req.body?.action, 40);
  if (!mongoose.isValidObjectId(visitId) || !['collect-sample', 'start-processing'].includes(action)) {
    return res.status(400).json({ success: false, message: 'A valid visit and lab processing action are required.' });
  }
  try {
    const visit = await ClinicVisit.findById(visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Clinic visit not found.' });
    const examination = visit.examination;
    if (!examination?.labRequests?.length) {
      return res.status(409).json({ success: false, message: 'This visit has no laboratory requests to process.' });
    }

    const now = new Date();
    if (action === 'collect-sample') {
      if (examination.labStatus && examination.labStatus !== 'Pending') {
        return res.status(409).json({ success: false, message: 'The sample has already moved past the requested stage.' });
      }
      examination.labStatus = 'Sample Collected';
      examination.labSampleCollectedAt = now;
      examination.labRequests.forEach((request) => {
        if (request.status === 'Pending') request.status = 'Sample Collected';
      });
    } else {
      if (examination.labStatus !== 'Sample Collected') {
        return res.status(409).json({ success: false, message: 'Collect the sample before starting laboratory processing.' });
      }
      examination.labStatus = 'In Progress';
      examination.labInProgressAt = now;
      examination.labRequests.forEach((request) => {
        if (request.status === 'Sample Collected') request.status = 'In Progress';
      });
    }

    const savedVisit = await visit.save();
    await writeAuditEvent({
      req,
      action: action === 'collect-sample' ? 'LAB_SAMPLE_COLLECTED' : 'LAB_PROCESSING_STARTED',
      entityType: 'clinic_visit',
      entityId: savedVisit._id,
      details: `${action === 'collect-sample' ? 'Sample collected for' : 'Laboratory processing started for'} request ${examination.labRequestNumber}.`,
    });
    req.app.get('io')?.emit('clinic:lab-request-updated', { visitId: String(savedVisit._id) });
    return res.status(200).json({ success: true, message: 'Laboratory status updated.', data: savedVisit });
  } catch (error) {
    console.error('Failed to update laboratory processing status:', error);
    return res.status(500).json({ success: false, message: 'Unable to update laboratory processing status.' });
  }
};

export const saveLabResults = async (req, res) => {
  const { visitId } = req.params;
  const results = req.body?.results;
  if (!mongoose.isValidObjectId(visitId) || !Array.isArray(results) || results.length > 60) {
    return res.status(400).json({ success: false, message: 'Provide a valid visit and laboratory results.' });
  }
  const cleanResults = results.map((item) => ({
    testCode: trimString(item?.testCode, 100),
    result: trimString(item?.result, 500),
    unit: trimString(item?.unit, 40),
    referenceRange: trimString(item?.referenceRange, 100),
    flag: trimString(item?.flag, 20),
  }));
  if (cleanResults.some((item) => !item.testCode || !item.result)
    || new Set(cleanResults.map((item) => item.testCode)).size !== cleanResults.length) {
    return res.status(400).json({ success: false, message: 'Enter a result for each submitted test without duplicate test codes.' });
  }
  if (req.body?.technicianNotes !== undefined && typeof req.body.technicianNotes !== 'string') {
    return res.status(400).json({ success: false, message: 'Laboratory technician notes must be text.' });
  }
  if (req.body?.technicianSignature !== undefined && typeof req.body.technicianSignature !== 'string') {
    return res.status(400).json({ success: false, message: 'Laboratory technician signature must be text.' });
  }
  const technicianNotes = trimString(req.body?.technicianNotes, 1000);
  const technicianSignature = trimString(req.body?.technicianSignature, 120);
  const reportDate = req.body?.dateOfReport ? new Date(req.body.dateOfReport) : new Date();
  if (Number.isNaN(reportDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Enter a valid laboratory report date.' });
  }
  try {
    const visit = await ClinicVisit.findById(visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Clinic visit not found.' });
    const examination = visit.examination;
    if (!examination?.labRequests?.length || !['In Progress', 'Results Ready'].includes(examination.labStatus)) {
      return res.status(409).json({ success: false, message: 'Start processing this laboratory request before entering results.' });
    }
    const requestedCodes = new Set(examination.labRequests.map((item) => item.testCode || item.testName));
    if (cleanResults.some((item) => !requestedCodes.has(item.testCode))) {
      return res.status(400).json({ success: false, message: 'A result references a test that was not requested.' });
    }

    const resultsByCode = new Map(cleanResults.map((item) => [item.testCode, item]));
    examination.labRequests.forEach((request) => {
      const result = resultsByCode.get(request.testCode || request.testName);
      if (!result) return;
      request.result = result.result;
      request.unit = result.unit;
      request.referenceRange = result.referenceRange;
      request.flag = result.flag;
      request.status = 'Results Ready';
    });
    const allResultsEntered = examination.labRequests.every((request) => Boolean(request.result?.trim()));
    examination.labStatus = allResultsEntered ? 'Results Ready' : 'In Progress';
    examination.labResultReadyAt = allResultsEntered ? new Date() : null;
    examination.labTestedBy = trimString(req.user?.name, 120);
    examination.labTechnicianSignature = technicianSignature;
    examination.labEnteredAt = new Date();
    examination.labTechnicianNotes = technicianNotes;
    examination.labDateOfReport = reportDate;

    const savedVisit = await visit.save();
    await writeAuditEvent({
      req,
      action: 'LAB_RESULTS_SAVED',
      entityType: 'clinic_visit',
      entityId: savedVisit._id,
      details: `Laboratory results saved for request ${examination.labRequestNumber}.`,
    });
    req.app.get('io')?.emit('clinic:lab-request-updated', { visitId: String(savedVisit._id) });
    return res.status(200).json({
      success: true,
      message: allResultsEntered ? 'Results saved and ready for approval.' : 'Partial results saved.',
      data: savedVisit,
    });
  } catch (error) {
    console.error('Failed to save laboratory results:', error);
    return res.status(500).json({ success: false, message: 'Unable to save laboratory results.' });
  }
};

export const approveLabResults = async (req, res) => {
  const { visitId } = req.params;
  if (!mongoose.isValidObjectId(visitId)) {
    return res.status(400).json({ success: false, message: 'Clinic visit reference is invalid.' });
  }
  try {
    const visit = await ClinicVisit.findById(visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Clinic visit not found.' });
    const examination = visit.examination;
    const alreadyReviewed = examination?.labStatus === 'Reviewed';
    if ((!alreadyReviewed && examination?.labStatus !== 'Results Ready')
      || !examination?.labRequests?.length
      || examination.labRequests.some((request) => !request.result?.trim())) {
      return res.status(409).json({ success: false, message: 'All requested test results must be saved before approval.' });
    }
    if (!alreadyReviewed) {
      examination.labStatus = 'Reviewed';
      examination.labReviewedAt = new Date();
      examination.labApprovedAt = examination.labReviewedAt;
      examination.labApprovedBy = trimString(req.user?.name, 120);
      examination.labRequests.forEach((request) => { request.status = 'Reviewed'; });
      await visit.save();
      await writeAuditEvent({
        req,
        action: 'LAB_RESULTS_APPROVED',
        entityType: 'clinic_visit',
        entityId: visit._id,
        details: `Laboratory results approved for request ${examination.labRequestNumber}.`,
      });
    }
    await returnVisitToExaminationQueue(req, visit);
    req.app.get('io')?.emit('clinic:queue-updated');
    req.app.get('io')?.emit('clinic:lab-request-updated', { visitId: String(visit._id) });
    return res.status(200).json({ success: true, message: 'Laboratory results approved and patient returned to the Examination queue.', data: visit });
  } catch (error) {
    console.error('Failed to approve laboratory results:', error);
    return res.status(500).json({ success: false, message: 'Unable to approve laboratory results.' });
  }
};
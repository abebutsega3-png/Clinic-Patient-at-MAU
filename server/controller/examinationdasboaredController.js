import mongoose from 'mongoose';
import { Queue } from '../module/AdminDashboardModels.js';
import ClinicVisit from '../module/ClinicVisit.js';
import Department from '../module/Department.js';
import Patient from '../module/Patient.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
const activeQueueStatuses = ['sent_to_examination', 'in_progress'];
const priorityOrder = { Emergency: 0, Urgent: 1, Normal: 2 };
const trimString = (value, limit = 500) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cleanList = (value, fields, limit, maxEntries = 30) => (Array.isArray(value) ? value.slice(0, maxEntries).map((entry) => {
  if (typeof entry === 'string') return { [fields[0]]: trimString(entry, limit) };
  if (!entry || typeof entry !== 'object') return null;
  return Object.fromEntries(fields.map((field) => [field, trimString(entry[field], limit)]));
}).filter((entry) => entry && Object.values(entry).some(Boolean)) : []);

const getExaminationData = (body = {}) => {
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
    labRequests: cleanList(body.labRequests, ['testName', 'testCode', 'priority', 'clinicalNote'], 1000, 60)
      .map((item) => ({ ...item, priority: item.priority === 'urgent' ? 'urgent' : 'normal', status: 'Pending' })),
    prescriptions: cleanList(body.prescriptions, [
      'medicine', 'strength', 'form', 'dose', 'dosage', 'frequency', 'duration', 'quantity', 'quantityUnit', 'instructions',
    ], 300),
    opd: {
      roadTrafficAccident: Boolean(opd.roadTrafficAccident),
      accidentType: trimString(opd.accidentType, 100),
      hivTestOffered: Boolean(opd.hivTestOffered),
      hivTestPerformed: Boolean(opd.hivTestPerformed),
      hivResult: trimString(opd.hivResult, 100),
      targetPopulation: trimString(opd.targetPopulation, 200),
      tbScreened: Boolean(opd.tbScreened),
      tbResult: trimString(opd.tbResult, 200),
      diagnosticEvaluation: trimString(opd.diagnosticEvaluation, 200),
      referredTo: trimString(opd.referredTo, 200),
    },
    referral: {
      department: trimString(referral.department, 120),
      reason: trimString(referral.reason, 1000),
      qualification: trimString(referral.qualification, 120),
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
const preserveLabWorkflow = (visit, examinationData) => {
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
    labRequestedAt: hasRequests ? (workflow.labRequestedAt || new Date()) : null,
    labSampleCollectedAt: workflow.labSampleCollectedAt || null,
    labInProgressAt: workflow.labInProgressAt || null,
    labResultReadyAt: workflow.labResultReadyAt || null,
    labReviewedAt: workflow.labReviewedAt || null,
    labTestedBy: workflow.labTestedBy || '',
    labDateOfReport: workflow.labDateOfReport || null,
    labApprovedBy: workflow.labApprovedBy || '',
    labApprovedAt: workflow.labApprovedAt || null,
  };
};
const preservePrescriptionWorkflow = (visit, examinationData, user) => {
  const previous = visit.examination || {};
  const existingPrescriptions = previous.prescriptions || [];
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
    } : previous.prescriber || {},
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
  populate: { path: 'patientRecordId', select: 'cardNumber fullName age sex universityIdNumber governmentIdNumber phoneNumber region town woreda kebele address' },
});

const toQueueItem = (queue, now = Date.now()) => {
  const visit = queue.visitId && typeof queue.visitId === 'object' ? queue.visitId : null;
  const arrivedAt = queue.arrivedAt ? new Date(queue.arrivedAt).getTime() : now;
  return {
    id: String(queue._id),
    visitId: visit?._id ? String(visit._id) : '',
    queueNumber: queue.queueNumber || '',
    patientId: queue.patientId || visit?.patientId || '',
    name: queue.patientName || visit?.patientName || 'Patient',
    studentId: visit?.patientRecordId?.universityIdNumber || queue.patientId || visit?.patientId || '',
    cardNumber: visit?.patientRecordId?.cardNumber || '',
    patientRecordId: visit?.patientRecordId?._id ? String(visit.patientRecordId._id) : '',
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
    department: queue.department || visit?.department || '',
    source: visit ? 'Card Room' : 'Clinic Queue',
    status: queue.status,
    priority: queue.priority,
    emergency: queue.isEmergency || visit?.emergency || queue.priority === 'Emergency',
    waitMinutes: Math.max(0, Math.floor((now - arrivedAt) / 60000)),
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
    const [waiting, inConsultation, completedToday, emergency, activeQueue, visits, diagnosisRows, labRows, overviewRows] = await Promise.all([
      Queue.countDocuments({ ...queueFilter, status: 'sent_to_examination' }),
      Queue.countDocuments({ ...queueFilter, status: 'in_progress' }),
      Queue.countDocuments({ ...queueFilter, status: 'completed' }),
      Queue.countDocuments({ ...queueFilter, status: { $in: activeQueueStatuses }, $or: [{ priority: 'Emergency' }, { isEmergency: true }] }),
      populateQueueVisits(Queue.find({ ...queueFilter, status: { $in: activeQueueStatuses } }).limit(250)).lean(),
      ClinicVisit.find(visitFilter)
        .select('patientRecordId patientId patientName visitId visitDate diagnosis referred examination status visitType priority')
        .populate({
          path: 'patientRecordId',
          select: 'cardNumber fullName age sex universityIdNumber governmentIdNumber phoneNumber region town woreda kebele address',
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
        queue: sortQueueByPriority(activeQueue).map((entry) => toQueueItem(entry)),
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
        'examination.labTestedBy',
        'examination.labDateOfReport',
        'examination.labApprovedBy',
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

export const listExaminationQueue = async (req, res) => {
  try {
    const department = await getExaminationDepartment(req);
    const clinicDate = getClinicDateKey();
    const search = trimString(req.query.search, 100);
    const status = trimString(req.query.status, 20);
    const filter = {
      clinicDate,
      ...(department ? { department } : {}),
      ...(status === 'in_progress' ? { status: 'in_progress' } : status === 'all' ? { status: { $in: activeQueueStatuses } } : { status: 'sent_to_examination' }),
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
    }).select('patientId cardNumber fullName age sex universityIdNumber governmentIdNumber phoneNumber region town woreda kebele address').sort({ fullName: 1 }).limit(25).lean();
    return res.status(200).json({ success: true, data: patients });
  } catch (error) {
    console.error('Failed to search Examination Room patients:', error);
    return res.status(500).json({ success: false, message: 'Unable to search patient records.' });
  }
};

export const getExaminationPatientHistory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Patient reference is invalid.' });
  try {
    const patient = await Patient.findById(req.params.id).select('patientId cardNumber fullName age sex universityIdNumber governmentIdNumber phoneNumber region town woreda kebele address').lean();
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

export const submitExamination = async (req, res) => {
  const { visitId } = req.params;
  const examinationData = getExaminationData(req.body);
  const diagnosis = trimString(req.body?.diagnosis, 500);
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
      preserveLabWorkflow(visit, examinationData),
      req.user,
    );
    const savedVisit = await visit.save();
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
  const examinationData = getExaminationData(req.body);
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
      preserveLabWorkflow(visit, examinationData),
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
    return res.status(200).json({ success: true, message: 'Examination draft saved.', data: savedVisit });
  } catch (error) {
    console.error('Failed to save Examination Room draft:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the examination draft.' });
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
    if (examination?.labStatus !== 'Results Ready'
      || !examination.labRequests?.length
      || examination.labRequests.some((request) => !request.result?.trim())) {
      return res.status(409).json({ success: false, message: 'All requested test results must be saved before approval.' });
    }
    examination.labStatus = 'Reviewed';
    examination.labReviewedAt = new Date();
    examination.labApprovedAt = examination.labReviewedAt;
    examination.labApprovedBy = trimString(req.user?.name, 120);
    examination.labRequests.forEach((request) => { request.status = 'Reviewed'; });

    const savedVisit = await visit.save();
    await writeAuditEvent({
      req,
      action: 'LAB_RESULTS_APPROVED',
      entityType: 'clinic_visit',
      entityId: savedVisit._id,
      details: `Laboratory results approved for request ${examination.labRequestNumber}.`,
    });
    req.app.get('io')?.emit('clinic:lab-request-updated', { visitId: String(savedVisit._id) });
    return res.status(200).json({ success: true, message: 'Laboratory results approved.', data: savedVisit });
  } catch (error) {
    console.error('Failed to approve laboratory results:', error);
    return res.status(500).json({ success: false, message: 'Unable to approve laboratory results.' });
  }
};
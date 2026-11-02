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
  populate: { path: 'patientRecordId', select: 'cardNumber age sex universityIdNumber' },
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
      ClinicVisit.find(visitFilter).select('patientId patientName visitId visitDate diagnosis referred examination status visitType priority').sort({ visitDate: -1 }).limit(100).lean(),
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
    }).select('patientId cardNumber fullName age sex universityIdNumber').sort({ fullName: 1 }).limit(25).lean();
    return res.status(200).json({ success: true, data: patients });
  } catch (error) {
    console.error('Failed to search Examination Room patients:', error);
    return res.status(500).json({ success: false, message: 'Unable to search patient records.' });
  }
};

export const getExaminationPatientHistory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Patient reference is invalid.' });
  try {
    const patient = await Patient.findById(req.params.id).select('patientId cardNumber fullName age sex universityIdNumber').lean();
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
  const diagnosis = trimString(req.body?.diagnosis, 500);
  const chiefComplaint = trimString(req.body?.chiefComplaint, 1000);
  const historyOfPresentIllness = trimString(req.body?.historyOfPresentIllness, 3000);
  const sickLeaveDays = Number(req.body?.sickLeaveDays || 0);
  if (!mongoose.isValidObjectId(visitId) || !diagnosis || !chiefComplaint || !Number.isInteger(sickLeaveDays) || sickLeaveDays < 0 || sickLeaveDays > 365) {
    return res.status(400).json({ success: false, message: 'Enter the chief complaint, diagnosis, and a valid sick-leave duration.' });
  }
  const cleanList = (value, fields, limit) => (Array.isArray(value) ? value.slice(0, 30).map((entry) => {
    if (typeof entry === 'string') return { [fields[0]]: trimString(entry, limit) };
    if (!entry || typeof entry !== 'object') return null;
    return Object.fromEntries(fields.map((field) => [field, trimString(entry[field], limit)]));
  }).filter((entry) => entry && Object.values(entry).some(Boolean)) : []);
  const labRequests = cleanList(req.body?.labRequests, ['testName'], 120).map((request) => ({ ...request, status: 'Pending' }));
  const prescriptions = cleanList(req.body?.prescriptions, ['medicine', 'dosage', 'instructions'], 300);
  const referralDepartment = trimString(req.body?.referral?.department, 120);
  const referralReason = trimString(req.body?.referral?.reason, 1000);
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
    visit.examination = {
      chiefComplaint,
      historyOfPresentIllness,
      vitals: {
        bloodPressure: trimString(req.body?.vitals?.bloodPressure, 30),
        temperature: trimString(req.body?.vitals?.temperature, 30),
        pulse: trimString(req.body?.vitals?.pulse, 30),
      },
      labRequests,
      prescriptions,
      referral: {
        department: referralDepartment,
        reason: referralReason,
        referredAt: referralDepartment ? new Date() : null,
      },
      sickLeaveDays,
    };
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
    return res.status(200).json({ success: true, message: 'Examination saved and queue completed.', data: savedVisit });
  } catch (error) {
    console.error('Failed to submit Examination Room record:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the examination.' });
  }
};
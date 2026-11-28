import mongoose from 'mongoose';
import { Queue } from '../module/AdminDashboardModels.js';
import ClinicVisit from '../module/ClinicVisit.js';
import Patient from '../module/Patient.js';
import QueueCounter from '../module/QueueCounter.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
const activeQueueStatuses = ['waiting', 'called', 'routed', 'sent_to_examination', 'in_progress'];
const triagePriorities = ['Immediate', 'Very Urgent', 'Urgent', 'Standard', 'Non-Urgent'];
const patientCategories = ['Student', 'Staff', 'Other Authorized Patient'];
const validObjectId = (value) => mongoose.isValidObjectId(value);
const trim = (value, limit = 1000) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const clinicDateKey = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const clinicDayBounds = (date = new Date()) => {
  const [year, month, day] = clinicDateKey(date).split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - 3 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};
const nextSequence = async (key) => {
  const counter = await QueueCounter.findOneAndUpdate(
    { _id: key },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return counter.sequence;
};
const recordAudit = async (req, action, visit, details) => {
  try {
    await writeAuditEvent({
      req,
      action,
      details,
      entityType: 'ClinicVisit',
      entityId: visit._id,
    });
    return true;
  } catch (error) {
    console.error('Emergency care was saved, but its audit event could not be recorded:', error);
    return false;
  }
};
const patientFields = 'patientId cardNumber fullName age sex phoneNumber patientCategory universityIdNumber allergies chronicConditions';
const visitQuery = () => ClinicVisit.find({ emergency: true, department: /^emergency/i })
  .populate('patientRecordId', patientFields);

export const getEmergencyDashboard = async (req, res) => {
  try {
    const now = new Date();
    const { start, end } = clinicDayBounds(now);
    const clinicDate = clinicDateKey(now);
    const emergencyVisitsToday = { emergency: true, visitDate: { $gte: start, $lt: end } };
    const erQueueToday = { clinicDate, department: /^emergency/i };
    const [arrivalsToday, activeQueue, waitingForTriage, highPriority, referralsToday, pendingLabRows] = await Promise.all([
      ClinicVisit.countDocuments(emergencyVisitsToday),
      Queue.countDocuments({ ...erQueueToday, status: { $in: activeQueueStatuses } }),
      ClinicVisit.countDocuments({ ...emergencyVisitsToday, 'emergencyCare.triagePriority': 'Pending' }),
      ClinicVisit.countDocuments({
        ...emergencyVisitsToday,
        'emergencyCare.triagePriority': { $in: ['Immediate', 'Very Urgent'] },
        emergencyResolved: false,
      }),
      ClinicVisit.countDocuments({ ...emergencyVisitsToday, referred: true }),
      ClinicVisit.aggregate([
        { $match: emergencyVisitsToday },
        { $project: {
          pendingLabs: {
            $size: {
              $filter: {
                input: { $ifNull: ['$examination.labRequests', []] },
                as: 'request',
                cond: { $in: ['$$request.status', ['Pending', 'Sample Collected', 'In Progress']] },
              },
            },
          },
        } },
        { $group: { _id: null, count: { $sum: '$pendingLabs' } } },
      ]),
    ]);
    const pendingLabRequests = pendingLabRows[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data: { clinicDate, arrivalsToday, activeQueue, waitingForTriage, highPriority, referralsToday, pendingLabRequests },
    });
  } catch (error) {
    console.error('Failed to load Emergency Room dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Emergency Room dashboard data.' });
  }
};

export const getEmergencyQueue = async (req, res) => {
  try {
    const queue = await Queue.find({
      clinicDate: clinicDateKey(),
      department: /^emergency/i,
      status: { $in: activeQueueStatuses },
    })
      .limit(100)
      .populate({
        path: 'visitId',
        match: { emergency: true },
        select: 'visitId patientRecordId patientId patientName visitDate status emergencyCare examination.chiefComplaint diagnosis referred',
        populate: { path: 'patientRecordId', select: patientFields },
      })
      .lean();

    const priorityOrder = { Emergency: 0, Urgent: 1, Normal: 2 };
    queue.sort((left, right) => (
      Number(Boolean(right.isEmergency)) - Number(Boolean(left.isEmergency))
      || (priorityOrder[left.priority] ?? 2) - (priorityOrder[right.priority] ?? 2)
      || new Date(left.arrivedAt).getTime() - new Date(right.arrivedAt).getTime()
    ));

    return res.status(200).json({
      success: true,
      data: queue.filter((entry) => entry.visitId).map((entry) => ({
        ...entry,
        arrivalAt: entry.visitId.emergencyCare?.arrivalAt || entry.arrivedAt,
      })),
    });
  } catch (error) {
    console.error('Failed to load Emergency Room queue:', error);
    return res.status(500).json({ success: false, message: 'Unable to load the Emergency Room queue.' });
  }
};

export const getEmergencyHistory = async (req, res) => {
  try {
    const query = { emergency: true, department: /^emergency/i };
    const visits = await visitQuery()
      .find(query)
      .sort({ 'emergencyCare.arrivalAt': -1, visitDate: -1 })
      .limit(100)
      .select('visitId patientId patientName patientRecordId visitDate status priority emergencyResolved referred emergencyCare examination.chiefComplaint examination.diagnosis examination.referral')
      .lean();
    return res.status(200).json({ success: true, data: visits });
  } catch (error) {
    console.error('Failed to load Emergency Room history:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Emergency Room history.' });
  }
};

export const registerEmergencyArrival = async (req, res) => {
  const input = req.body || {};
  const arrivalAt = new Date();
  const patientRef = trim(input.patientReference, 100);
  const newPatient = input.patient || {};
  const fullName = trim(newPatient.fullName, 200);
  const patientCategory = trim(newPatient.patientCategory, 50);

  if ((!patientRef && (fullName.length < 2 || !patientCategories.includes(patientCategory)))
    || (patientRef && patientRef.length < 2)) {
    return res.status(400).json({
      success: false,
      message: 'Select an existing patient ID or provide a patient name and category to register an emergency arrival.',
    });
  }

  let createdPatient = null;
  let visit = null;
  let queue = null;
  try {
    let patient;
    if (patientRef) {
      const lookup = validObjectId(patientRef)
        ? { _id: patientRef }
        : { $or: [{ patientId: patientRef }, { cardNumber: patientRef }, { universityIdNumber: patientRef }] };
      patient = await Patient.findOne(lookup);
      if (!patient) return res.status(404).json({ success: false, message: 'No patient was found for that ID.' });
    } else {
      const year = Number(clinicDateKey(arrivalAt).slice(0, 4));
      const sequence = await nextSequence(`patient-${year}`);
      const suffix = String(sequence).padStart(6, '0');
      createdPatient = await Patient.create({
        patientId: `MAU-${year}-${suffix}`,
        cardNumber: `CARD-${year}-${suffix}`,
        fullName,
        patientType: 'New Patient',
        patientCategory,
        sex: ['Female', 'Male', 'Other'].includes(newPatient.sex) ? newPatient.sex : '',
        dateOfBirth: newPatient.dateOfBirth ? new Date(newPatient.dateOfBirth) : null,
        age: newPatient.age !== '' && Number.isInteger(Number(newPatient.age)) ? Number(newPatient.age) : null,
        phoneNumber: trim(newPatient.phoneNumber, 30),
        emergencyContactName: trim(newPatient.emergencyContactName, 120),
        emergencyContactPhone: trim(newPatient.emergencyContactPhone, 30),
        universityIdNumber: trim(newPatient.universityIdNumber, 80) || undefined,
        allergies: Array.isArray(newPatient.allergies) ? newPatient.allergies.map((value) => trim(value, 120)).filter(Boolean).slice(0, 30) : [],
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      patient = createdPatient;
    }

    const visitDateKey = clinicDateKey(arrivalAt).replaceAll('-', '');
    const visitSequence = await nextSequence(`visit-${visitDateKey}`);
    const visitId = `VIS-${visitDateKey}-${String(visitSequence).padStart(5, '0')}`;
    visit = await ClinicVisit.create({
      visitId,
      patientRecordId: patient._id,
      patientId: patient.patientId,
      patientName: patient.fullName,
      visitDate: arrivalAt,
      department: 'Emergency',
      visitType: 'Emergency Visit',
      priority: 'Emergency',
      status: 'Waiting',
      registeredBy: req.user._id,
      emergency: true,
      emergencyResolved: false,
      emergencyCare: { arrivalAt, triagePriority: 'Pending' },
      examination: { chiefComplaint: trim(input.chiefComplaint, 1000) },
    });
    const queueDate = clinicDateKey(arrivalAt);
    const queueSequence = await nextSequence(`department-queue-ER-${queueDate}`);
    queue = await Queue.create({
      patientId: patient.patientId,
      patientName: patient.fullName,
      visitId: visit._id,
      queueNumber: `ER-${String(queueSequence).padStart(3, '0')}`,
      clinicDate: queueDate,
      visitType: 'Emergency Visit',
      priority: 'Emergency',
      createdBy: req.user._id,
      department: 'Emergency Room',
      status: 'waiting',
      arrivedAt: arrivalAt,
      isEmergency: true,
    });
    const auditRecorded = await recordAudit(req, 'EMERGENCY_ARRIVAL_REGISTERED', visit, 'Registered an Emergency Room arrival without Card Room registration.');

    return res.status(201).json({
      success: true,
      message: auditRecorded ? 'Emergency arrival recorded and prioritized for immediate triage.' : 'Emergency arrival recorded; its audit event could not be recorded.',
      data: { visit, queue, patient: { patientId: patient.patientId, fullName: patient.fullName } },
    });
  } catch (error) {
    if (queue) await Queue.deleteOne({ _id: queue._id }).catch((cleanupError) => console.error('Failed to clean up incomplete Emergency Room queue entry:', cleanupError));
    if (visit) await ClinicVisit.deleteOne({ _id: visit._id }).catch((cleanupError) => console.error('Failed to clean up incomplete Emergency Room visit:', cleanupError));
    if (createdPatient) await Patient.deleteOne({ _id: createdPatient._id }).catch((cleanupError) => console.error('Failed to clean up incomplete Emergency Room patient:', cleanupError));
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A generated patient or visit ID already exists. Please retry the arrival.' });
    console.error('Failed to register Emergency Room arrival:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the Emergency Room arrival.' });
  }
};

const loadEmergencyVisit = async (visitId) => (
  validObjectId(visitId)
    ? ClinicVisit.findOne({ _id: visitId, emergency: true, department: /^emergency/i })
    : null
);

export const updateEmergencyTriage = async (req, res) => {
  const { triagePriority, triageNotes, oxygenSaturation, consciousness, bloodPressure, temperature, pulse, respiratoryRate, weight } = req.body || {};
  if (!triagePriorities.includes(triagePriority)) return res.status(400).json({ success: false, message: 'Select a valid triage priority.' });
  const values = { bloodPressure, temperature, pulse, respiratoryRate, weight, oxygenSaturation };
  if (Object.values(values).some((value) => value !== undefined && (typeof value !== 'string' || value.length > 40))) {
    return res.status(400).json({ success: false, message: 'Vital sign values must be text no longer than 40 characters.' });
  }
  try {
    const visit = await loadEmergencyVisit(req.params.visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Emergency visit not found.' });
    visit.emergencyCare = {
      ...visit.emergencyCare.toObject(),
      triagePriority,
      triageNotes: trim(triageNotes, 2000),
      oxygenSaturation: trim(oxygenSaturation, 40),
      consciousness: trim(consciousness, 100),
      triagedAt: new Date(),
      triagedBy: req.user._id,
    };
    visit.examination.vitals = {
      ...visit.examination.vitals.toObject(),
      bloodPressure: trim(bloodPressure, 40),
      temperature: trim(temperature, 40),
      pulse: trim(pulse, 40),
      respiratoryRate: trim(respiratoryRate, 40),
      weight: trim(weight, 40),
    };
    await visit.save();
    const queuePriority = ['Immediate', 'Very Urgent'].includes(triagePriority) ? 'Emergency' : triagePriority === 'Urgent' ? 'Urgent' : 'Normal';
    await Queue.updateMany({ visitId: visit._id, department: /^emergency/i, status: { $in: activeQueueStatuses } }, { $set: { priority: queuePriority, isEmergency: queuePriority === 'Emergency' } });
    const auditRecorded = await recordAudit(req, 'EMERGENCY_TRIAGE_RECORDED', visit, `Recorded ${triagePriority} triage and vital signs.`);
    return res.status(200).json({ success: true, message: auditRecorded ? 'Triage and vital signs saved.' : 'Triage saved; its audit event could not be recorded.', data: visit });
  } catch (error) {
    console.error('Failed to record Emergency Room triage:', error);
    return res.status(500).json({ success: false, message: 'Unable to save triage and vital signs.' });
  }
};

export const updateEmergencyExamination = async (req, res) => {
  const { chiefComplaint, history, findings, diagnosis, plan } = req.body || {};
  if (!trim(chiefComplaint, 1000) || !trim(findings, 4000)) {
    return res.status(400).json({ success: false, message: 'Enter the chief complaint and examination findings.' });
  }
  try {
    const visit = await loadEmergencyVisit(req.params.visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Emergency visit not found.' });
    visit.examination.chiefComplaint = trim(chiefComplaint, 1000);
    visit.examination.historyOfPresentIllness = trim(history, 4000);
    visit.examination.physicalExamination = trim(findings, 4000);
    visit.examination.doctorNotes = trim(plan, 4000);
    visit.diagnosis = trim(diagnosis, 500);
    if (visit.status === 'Waiting' || visit.status === 'Called') visit.status = 'In Service';
    await visit.save();
    await Queue.updateMany({ visitId: visit._id, department: /^emergency/i, status: { $in: ['waiting', 'called'] } }, { $set: { status: 'in_progress', inProgressAt: new Date() } });
    const auditRecorded = await recordAudit(req, 'EMERGENCY_EXAMINATION_RECORDED', visit, 'Recorded Emergency Room examination findings and plan.');
    return res.status(200).json({ success: true, message: auditRecorded ? 'Emergency examination saved.' : 'Examination saved; its audit event could not be recorded.', data: visit });
  } catch (error) {
    console.error('Failed to save Emergency Room examination:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the Emergency Room examination.' });
  }
};

export const updateEmergencyTreatment = async (req, res) => {
  const treatmentNotes = trim(req.body?.treatmentNotes, 4000);
  const disposition = trim(req.body?.disposition, 40) || 'Continue Monitoring';
  if (!treatmentNotes) return res.status(400).json({ success: false, message: 'Enter the treatment or stabilization provided.' });
  if (!['Continue Monitoring', 'Discharge', 'Admit'].includes(disposition)) {
    return res.status(400).json({ success: false, message: 'Select a valid emergency disposition.' });
  }
  try {
    const visit = await loadEmergencyVisit(req.params.visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Emergency visit not found.' });
    visit.emergencyCare.treatmentNotes = treatmentNotes;
    visit.examination.disposition = disposition === 'Continue Monitoring' ? '' : disposition;
    if (disposition !== 'Continue Monitoring') {
      visit.emergencyResolved = true;
      visit.status = 'Completed';
    }
    await visit.save();
    if (disposition !== 'Continue Monitoring') {
      await Queue.updateMany({ visitId: visit._id, department: /^emergency/i, status: { $in: activeQueueStatuses } }, { $set: { status: 'completed', completedAt: new Date() } });
    }
    const auditRecorded = await recordAudit(req, 'EMERGENCY_TREATMENT_RECORDED', visit, 'Recorded Emergency Room treatment or stabilization.');
    return res.status(200).json({ success: true, message: auditRecorded ? (disposition === 'Continue Monitoring' ? 'Emergency treatment saved.' : `Emergency visit marked ${disposition.toLowerCase()}.`) : 'Treatment saved; its audit event could not be recorded.', data: visit });
  } catch (error) {
    console.error('Failed to save Emergency Room treatment:', error);
    return res.status(500).json({ success: false, message: 'Unable to save Emergency Room treatment.' });
  }
};

export const createEmergencyLabRequest = async (req, res) => {
  const testName = trim(req.body?.testName, 160);
  if (!testName) return res.status(400).json({ success: false, message: 'Enter a laboratory test name.' });
  try {
    const visit = await loadEmergencyVisit(req.params.visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Emergency visit not found.' });
    visit.examination.labRequests.push({
      testName,
      category: trim(req.body?.category, 100),
      priority: req.body?.priority === 'urgent' ? 'urgent' : 'normal',
      clinicalNote: trim(req.body?.clinicalNote, 1000),
      status: 'Pending',
    });
    visit.examination.labRequestedBy = req.user.name || req.user.username;
    visit.examination.labRequestedAt = new Date();
    visit.examination.labStatus = 'Pending';
    await visit.save();
    const auditRecorded = await recordAudit(req, 'EMERGENCY_LAB_REQUEST_CREATED', visit, 'Created an Emergency Room laboratory request linked to the visit.');
    return res.status(201).json({ success: true, message: auditRecorded ? 'Laboratory request sent to the clinic laboratory queue.' : 'Laboratory request saved; its audit event could not be recorded.', data: visit });
  } catch (error) {
    console.error('Failed to create Emergency Room laboratory request:', error);
    return res.status(500).json({ success: false, message: 'Unable to create the laboratory request.' });
  }
};

export const createEmergencyPrescription = async (req, res) => {
  const medicine = trim(req.body?.medicine, 160);
  if (!medicine) return res.status(400).json({ success: false, message: 'Enter a medication name.' });
  try {
    const visit = await loadEmergencyVisit(req.params.visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Emergency visit not found.' });
    visit.examination.prescriptions.push({
      medicine,
      strength: trim(req.body?.strength, 80),
      dose: trim(req.body?.dose, 100),
      dosage: trim(req.body?.dose, 100),
      frequency: trim(req.body?.frequency, 100),
      duration: trim(req.body?.duration, 100),
      quantity: trim(req.body?.quantity, 40),
      instructions: trim(req.body?.instructions, 1000),
    });
    visit.examination.prescriptionStatus = 'Pending';
    visit.examination.prescriber.name = req.user.name || req.user.username;
    visit.examination.prescriber.signedAt = new Date();
    await visit.save();
    const auditRecorded = await recordAudit(req, 'EMERGENCY_PRESCRIPTION_CREATED', visit, 'Created a medication prescription linked to the Emergency Room visit.');
    return res.status(201).json({ success: true, message: auditRecorded ? 'Prescription sent to the clinic dispensary workflow.' : 'Prescription saved; its audit event could not be recorded.', data: visit });
  } catch (error) {
    console.error('Failed to create Emergency Room prescription:', error);
    return res.status(500).json({ success: false, message: 'Unable to create the prescription.' });
  }
};

export const createEmergencyProcedure = async (req, res) => {
  const type = trim(req.body?.type, 30);
  const name = trim(req.body?.name, 160);
  if (!['Injection', 'Dressing', 'Other'].includes(type) || !name) {
    return res.status(400).json({ success: false, message: 'Choose a procedure type and enter its name.' });
  }
  try {
    const visit = await loadEmergencyVisit(req.params.visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Emergency visit not found.' });
    const orderedAt = new Date();
    visit.emergencyCare.procedures.push({ type, name, notes: trim(req.body?.notes, 1000), orderedAt, orderedBy: req.user._id });
    await visit.save();
    if (type === 'Injection' || type === 'Dressing') {
      const queueDate = clinicDateKey(orderedAt);
      const sequence = await nextSequence(`department-queue-ID-${queueDate}`);
      await Queue.create({
        patientId: visit.patientId,
        patientName: visit.patientName,
        visitId: visit._id,
        queueNumber: `ID-${String(sequence).padStart(3, '0')}`,
        clinicDate: queueDate,
        visitType: 'Emergency Visit',
        priority: visit.priority,
        createdBy: req.user._id,
        department: 'Injection and Dressing Room',
        status: 'waiting',
        arrivedAt: orderedAt,
        isEmergency: true,
      });
    }
    const auditRecorded = await recordAudit(req, 'EMERGENCY_PROCEDURE_ORDERED', visit, `Ordered an Emergency Room ${type.toLowerCase()} service.`);
    return res.status(201).json({ success: true, message: auditRecorded ? `${type} order saved${type === 'Other' ? '.' : ' and sent to the Injection and Dressing Room queue.'}` : 'Procedure saved; its audit event could not be recorded.', data: visit });
  } catch (error) {
    console.error('Failed to order Emergency Room procedure:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the procedure order.' });
  }
};

export const createEmergencyReferral = async (req, res) => {
  const department = trim(req.body?.destination, 160);
  const reason = trim(req.body?.reason, 2000);
  if (!department || !reason) return res.status(400).json({ success: false, message: 'Enter the receiving hospital and referral reason.' });
  try {
    const visit = await loadEmergencyVisit(req.params.visitId);
    if (!visit) return res.status(404).json({ success: false, message: 'Emergency visit not found.' });
    const referredAt = new Date();
    visit.examination.referral = {
      department,
      reason,
      referredBy: req.user.name || req.user.username,
      emergency: true,
      ambulanceDriver: trim(req.body?.transportContact, 120),
      takeOffTime: trim(req.body?.transferTime, 80),
      remark: trim(req.body?.documentation, 2000),
      referredAt,
    };
    visit.referred = true;
    visit.emergencyResolved = true;
    visit.status = 'Completed';
    await visit.save();
    await Queue.updateMany({ visitId: visit._id, department: /^emergency/i, status: { $in: activeQueueStatuses } }, { $set: { status: 'completed', completedAt: referredAt } });
    const auditRecorded = await recordAudit(req, 'EMERGENCY_REFERRAL_CREATED', visit, 'Recorded external hospital referral and patient transfer documentation.');
    return res.status(201).json({ success: true, message: auditRecorded ? 'Referral and transfer documentation saved.' : 'Referral saved; its audit event could not be recorded.', data: visit });
  } catch (error) {
    console.error('Failed to save Emergency Room referral:', error);
    return res.status(500).json({ success: false, message: 'Unable to save the Emergency Room referral.' });
  }
};

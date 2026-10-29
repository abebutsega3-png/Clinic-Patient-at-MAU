import mongoose from 'mongoose';
import { Queue } from '../module/AdminDashboardModels.js';
import ClinicNotification from '../module/ClinicNotification.js';
import ClinicVisit from '../module/ClinicVisit.js';
import ClinicDepartmentReport from '../module/ClinicDepartmentReport.js';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import Department from '../module/Department.js';
import Patient from '../module/Patient.js';
import QueueCounter from '../module/QueueCounter.js';
import RolePermission from '../module/RolePermission.js';
import { Staff } from '../module/StaffAndRoster.js';
import User from '../module/User.js';
import { writeAuditEvent } from '../utils/auditLogger.js';
import { notifyEmergencyQueueArrival } from '../services/inventoryAlertService.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
const validCategories = new Set(['Student', 'Staff', 'Other Authorized Patient']);
const validSex = new Set(['', 'Female', 'Male', 'Other']);
const validPriorities = new Set(['Normal', 'Urgent', 'Emergency']);
const validVisitTypes = new Set(['New Visit', 'Follow-up Visit', 'Emergency Visit']);
const validVisitStatuses = new Set(['Registered', 'Waiting', 'Called', 'In Service', 'Routed', 'Sent to Examination', 'Completed', 'Cancelled', 'No-show']);
const validQueueStatuses = new Set(['waiting', 'called', 'routed', 'sent_to_examination', 'in_progress', 'completed', 'no_show', 'cancelled']);
const cardRoomRoleNames = ['Card Chief'];
const editablePatientFields = [
  'fullName',
  'firstName',
  'fatherName',
  'grandfatherName',
  'sex',
  'dateOfBirth',
  'age',
  'phoneNumber',
  'patientCategory',
  'campus',
  'academicDepartment',
  'region',
  'woreda',
  'kebele',
  'dormBlock',
  'houseNumber',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'governmentIdNumber',
  'universityIdNumber',
];

const getClinicDateParts = (date) => Object.fromEntries(new Intl.DateTimeFormat('en', {
  timeZone: clinicTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(date).map(({ type, value }) => [type, value]));

const getClinicDateKey = (date) => {
  const { year, month, day } = getClinicDateParts(date);
  return `${year}-${month}-${day}`;
};

const getClinicDayBounds = (date = new Date()) => {
  const { year, month, day } = getClinicDateParts(date);
  const start = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)) - 3 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const getClinicMonthBounds = (date = new Date()) => {
  const { year, month } = getClinicDateParts(date);
  const start = new Date(Date.UTC(Number(year), Number(month) - 1, 1) - 3 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(Number(year), Number(month), 1) - 3 * 60 * 60 * 1000);
  return { start, end };
};

const getCardRoomUserIds = async () => {
  const users = await User.find({
    $or: [
      { activeRole: { $in: cardRoomRoleNames } },
      { activeRole: { $exists: false }, role: { $in: cardRoomRoleNames } },
    ],
  }).select('_id').lean();
  return users.map(({ _id }) => _id);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validObjectId = (value) => mongoose.isValidObjectId(value);
const trimString = (value, limit = 500) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const patientSummary = (patient) => ({
  id: String(patient._id),
  patientId: patient.patientId,
  cardNumber: patient.cardNumber,
  fullName: patient.fullName,
  firstName: patient.firstName || '',
  fatherName: patient.fatherName || '',
  grandfatherName: patient.grandfatherName || '',
  sex: patient.sex || '',
  dateOfBirth: patient.dateOfBirth || null,
  age: patient.age ?? null,
  patientType: patient.patientType || 'Existing Patient',
  governmentIdNumber: patient.governmentIdNumber || '',
  universityIdNumber: patient.universityIdNumber || '',
  phoneNumber: patient.phoneNumber || '',
  patientCategory: patient.patientCategory,
  campus: patient.campus || '',
  academicDepartment: patient.academicDepartment || '',
  departmentFaculty: patient.academicDepartment || '',
  region: patient.region || '',
  woreda: patient.woreda || '',
  kebele: patient.kebele || '',
  dormBlock: patient.dormBlock || '',
  houseNumber: patient.houseNumber || '',
  address: patient.address || '',
  emergencyContactName: patient.emergencyContactName || '',
  emergencyContactPhone: patient.emergencyContactPhone || '',
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt,
});

const writeCardRoomAudit = async (req, action, entityType, entityId, details, changes = []) => {
  try {
    await writeAuditEvent({ req, action, entityType, entityId, details, changes });
    return true;
  } catch (error) {
    console.error(`Card Room action ${action} completed, but audit logging failed:`, error);
    return false;
  }
};

const emitQueueChanged = (req) => {
  const io = req.app.get('io');
  if (!io) {
    console.error('Queue change was saved, but Socket.IO is not configured on the application.');
    return;
  }
  io.emit('clinic:queue-updated');
};

const nextSequence = async (key) => {
  try {
    const counter = await QueueCounter.findOneAndUpdate(
      { _id: key },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return counter.sequence;
  } catch (error) {
    if (error.code === 11000) {
      const counter = await QueueCounter.findOneAndUpdate(
        { _id: key },
        { $inc: { sequence: 1 } },
        { new: true },
      ).lean();
      if (counter) return counter.sequence;
    }
    throw error;
  }
};

const generatePatientIdentifiers = async () => {
  const { year } = getClinicDateParts(new Date());
  const sequence = await nextSequence(`patient-${year}`);
  const suffix = String(sequence).padStart(6, '0');
  return { patientId: `MAU-${year}-${suffix}`, cardNumber: `CARD-${year}-${suffix}` };
};

const createVisitId = async (date) => {
  const dateKey = getClinicDateKey(date).replaceAll('-', '');
  const sequence = await nextSequence(`visit-${dateKey}`);
  return `VIS-${dateKey}-${String(sequence).padStart(5, '0')}`;
};

const createQueueNumber = async (department, date) => {
  const clinicDate = getClinicDateKey(date);
  const prefix = String(department.code || 'CARD').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'CARD';
  const sequence = await nextSequence(`department-queue-${prefix}-${clinicDate}`);
  return { clinicDate, queueNumber: `${prefix}-${String(sequence).padStart(3, '0')}` };
};

const pageParams = (query) => ({
  page: Math.max(1, Number.parseInt(query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20)),
});

export const getCardRoomDashboard = async (req, res) => {
  try {
    const now = new Date();
    const { start, end } = getClinicDayBounds(now);
    const clinicDate = getClinicDateKey(now);
    const cardRoomUserIds = await getCardRoomUserIds();
    const [
      registrationsToday,
      visitsToday,
      returningPatients,
      waitingInQueue,
      sentToExamination,
      emergencyVisits,
      recentPatients,
      todayVisits,
      queueStatusRows,
      departmentQueueRows,
    ] = await Promise.all([
      Patient.countDocuments({ createdAt: { $gte: start, $lt: end }, createdBy: { $in: cardRoomUserIds } }),
      ClinicVisit.countDocuments({ visitDate: { $gte: start, $lt: end }, registeredBy: { $in: cardRoomUserIds } }),
      ClinicVisit.aggregate([
        { $match: { visitDate: { $gte: start, $lt: end }, registeredBy: { $in: cardRoomUserIds } } },
        { $lookup: { from: Patient.collection.name, localField: 'patientRecordId', foreignField: '_id', as: 'patient' } },
        { $unwind: '$patient' },
        { $match: { 'patient.createdAt': { $lt: start } } },
        { $count: 'count' },
      ]).then(([row]) => row?.count || 0),
      Queue.countDocuments({ clinicDate, createdBy: { $in: cardRoomUserIds }, department: { $in: ['Card room', 'Emergency'] }, status: 'waiting' }),
      Queue.countDocuments({ clinicDate, createdBy: { $in: cardRoomUserIds }, status: 'sent_to_examination' }),
      ClinicVisit.countDocuments({ visitDate: { $gte: start, $lt: end }, registeredBy: { $in: cardRoomUserIds }, emergency: true }),
      Patient.find({ createdAt: { $gte: start, $lt: end }, createdBy: { $in: cardRoomUserIds } })
        .select('patientId cardNumber fullName patientCategory createdAt')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      ClinicVisit.find({ visitDate: { $gte: start, $lt: end }, registeredBy: { $in: cardRoomUserIds } })
        .select('visitId patientId patientName visitType priority status department visitDate emergency')
        .sort({ visitDate: -1 })
        .limit(8)
        .lean(),
      Queue.aggregate([
        { $match: { clinicDate, createdBy: { $in: cardRoomUserIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Queue.aggregate([
        { $match: { clinicDate, createdBy: { $in: cardRoomUserIds } } },
        {
          $group: {
            _id: '$department',
            waiting: { $sum: { $cond: [{ $in: ['$status', ['waiting', 'called']] }, 1, 0] } },
            active: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          },
        },
        { $sort: { waiting: -1, _id: 1 } },
      ]),
    ]);
    const visitQueues = await Queue.find({ visitId: { $in: todayVisits.map((visit) => visit._id) } })
      .select('visitId queueNumber status department priority')
      .lean();
    const queueByVisit = new Map(visitQueues.map((queue) => [String(queue.visitId), queue]));

    return res.status(200).json({
      success: true,
      data: {
        clinicDate,
        summary: { registrationsToday, visitsToday, returningPatients, waitingInQueue, sentToExamination, emergencyVisits },
        recentPatients,
        todayVisits: todayVisits.map((visit) => ({
          ...visit,
          queue: queueByVisit.get(String(visit._id)) || null,
        })),
        queueStatus: queueStatusRows.map(({ _id, count }) => ({ status: _id, count })),
        departmentQueues: departmentQueueRows.map(({ _id, waiting, active }) => ({
          department: _id || 'Unassigned',
          waiting,
          active,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to load Card Room dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Card Room dashboard.' });
  }
};

export const listCardRoomPatients = async (req, res) => {
  const { page, limit } = pageParams(req.query);
  const search = trimString(req.query.search, 100);
  const filter = {};
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { patientId: expression },
      { fullName: expression },
      { firstName: expression },
      { fatherName: expression },
      { grandfatherName: expression },
      { cardNumber: expression },
      { governmentIdNumber: expression },
      { universityIdNumber: expression },
      { phoneNumber: expression },
    ];
  }
  try {
    const [patients, total] = await Promise.all([
      Patient.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Patient.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: patients.map(patientSummary),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to search Card Room patients:', error);
    return res.status(500).json({ success: false, message: 'Unable to search patient records.' });
  }
};

export const createCardRoomPatient = async (req, res) => {
  const input = req.body || {};
  const firstName = trimString(input.firstName, 60);
  const fatherName = trimString(input.fatherName, 60);
  const grandfatherName = trimString(input.grandfatherName, 60);
  const fullName = [firstName, fatherName, grandfatherName].filter(Boolean).join(' ').slice(0, 200)
    || trimString(input.fullName, 200);
  const patientCategory = trimString(input.patientCategory, 50);
  const sex = trimString(input.sex, 20);
  const phoneNumber = trimString(input.phoneNumber, 30);
  const dateOfBirthValue = typeof input.dateOfBirth === 'string' ? input.dateOfBirth.trim() : '';
  const dateOfBirth = dateOfBirthValue ? new Date(`${dateOfBirthValue}T00:00:00.000Z`) : null;
  const validDateOfBirth = !dateOfBirthValue || (
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirthValue)
    && !Number.isNaN(dateOfBirth.getTime())
    && dateOfBirth.toISOString().slice(0, 10) === dateOfBirthValue
  );
  const governmentIdNumber = trimString(input.governmentIdNumber, 80).toUpperCase();
  const universityIdNumber = trimString(input.universityIdNumber, 80).toUpperCase();
  const nameIsValid = [firstName, fatherName, grandfatherName].every((part) => (
    part.length >= 2 && /^\p{L}[\p{L}\p{M} .'-]*$/u.test(part)
  ));
  if (!nameIsValid || fullName.length < 2 || patientCategory !== 'Student'
    || (input.patientType && input.patientType !== 'New Patient')
    || !['Female', 'Male'].includes(sex)
    || !/^[+()\d\s-]{6,30}$/.test(phoneNumber)
    || !universityIdNumber
    || !/^[\p{L}\p{N}./-]{3,80}$/u.test(universityIdNumber)
    || !trimString(input.academicDepartment || input.departmentFaculty, 120)
    || !dateOfBirth || !validDateOfBirth || Number.isNaN(dateOfBirth.getTime())
    || (dateOfBirth && dateOfBirth > new Date())
    || (governmentIdNumber && !/^[\p{L}\p{N}./-]{3,80}$/u.test(governmentIdNumber))
    || (universityIdNumber && !/^[\p{L}\p{N}./-]{3,80}$/u.test(universityIdNumber))) {
    return res.status(400).json({
      success: false,
      message: 'Provide valid patient names, sex, date of birth, category, phone number, and ID values.',
    });
  }
  try {
    const identityConditions = [];
    if (governmentIdNumber) identityConditions.push({ governmentIdNumber: { $regex: `^${escapeRegex(governmentIdNumber)}$`, $options: 'i' } });
    if (universityIdNumber) identityConditions.push({ universityIdNumber: { $regex: `^${escapeRegex(universityIdNumber)}$`, $options: 'i' } });
    identityConditions.push({
      fullName: { $regex: `^${escapeRegex(fullName)}$`, $options: 'i' },
      $or: [
        { dateOfBirth },
        ...(phoneNumber ? [{ phoneNumber }] : []),
      ],
    });
    const possibleDuplicate = await Patient.findOne({
      $or: identityConditions,
    }).lean();
    if (possibleDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'A possible matching patient record already exists. Review it before registering again.',
        existingPatient: patientSummary(possibleDuplicate),
      });
    }

    const identifiers = await generatePatientIdentifiers();
    const clinicDate = getClinicDateParts(new Date());
    const today = new Date(Date.UTC(Number(clinicDate.year), Number(clinicDate.month) - 1, Number(clinicDate.day)));
    const birthDate = new Date(Date.UTC(dateOfBirth.getUTCFullYear(), dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()));
    const age = today.getUTCFullYear() - birthDate.getUTCFullYear()
      - (today < new Date(Date.UTC(today.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate())) ? 1 : 0);
    if (age < 0 || age > 125) {
      return res.status(400).json({ success: false, message: 'Date of birth must produce an age between 0 and 125.' });
    }
    const region = trimString(input.region, 100);
    const woreda = trimString(input.woreda, 100);
    const kebele = trimString(input.kebele, 100);
    const dormBlock = trimString(input.dormBlock, 80);
    const houseNumber = trimString(input.houseNumber, 40);
    const campus = trimString(input.campus, 120);
    const academicDepartment = trimString(input.academicDepartment || input.departmentFaculty, 120);
    const address = [region, woreda, kebele, houseNumber].filter(Boolean).join(', ');
    const patient = await Patient.create({
      ...identifiers,
      fullName,
      firstName,
      fatherName,
      grandfatherName,
      sex,
      dateOfBirth,
      age,
      patientType: 'New Patient',
      governmentIdNumber: governmentIdNumber || undefined,
      universityIdNumber: universityIdNumber || undefined,
      phoneNumber,
      patientCategory,
      campus,
      academicDepartment,
      region,
      woreda,
      kebele,
      dormBlock,
      houseNumber,
      address,
      emergencyContactName: trimString(input.emergencyContactName, 120),
      emergencyContactPhone: trimString(input.emergencyContactPhone, 30),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    const auditRecorded = await writeCardRoomAudit(
      req,
      'CARD_ROOM_PATIENT_CREATED',
      'patients',
      patient._id,
      `Registered patient ${patient.patientId} in Card Room.`,
    );
    return res.status(201).json({
      success: true,
      message: auditRecorded ? 'Patient registered.' : 'Patient registered, but the audit event could not be recorded.',
      data: patientSummary(patient.toObject()),
      auditRecorded,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A patient or card identifier already exists. Retry registration.' });
    }
    console.error('Failed to register Card Room patient:', error);
    return res.status(500).json({ success: false, message: 'Unable to register patient.' });
  }
};

export const getCardRoomPatient = async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Patient reference is invalid.' });
  try {
    const patient = await Patient.findById(req.params.id).lean();
    if (!patient) return res.status(404).json({ success: false, message: 'Patient record not found.' });
    const visits = await ClinicVisit.find({ $or: [{ patientRecordId: patient._id }, { patientId: patient.patientId }] })
      .select('visitId patientRecordId patientId visitDate department visitType priority status emergency')
      .sort({ visitDate: -1 })
      .limit(100)
      .lean();
    const queues = await Queue.find({
      $or: [
        { patientId: patient.patientId },
        { visitId: { $in: visits.map((visit) => visit._id) } },
      ],
    }).select('visitId queueNumber clinicDate department status arrivedAt').sort({ arrivedAt: -1 }).lean();
    const queueByVisitId = new Map(queues.filter((queue) => queue.visitId).map((queue) => [String(queue.visitId), queue]));
    const latestQueue = queues[0] || null;
    return res.status(200).json({
      success: true,
      data: {
        ...patientSummary(patient),
        patientStatus: latestQueue?.status || visits[0]?.status || 'Registered',
        visits: visits.map((visit) => ({
          ...visit,
          queue: queueByVisitId.get(String(visit._id)) || null,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to load Card Room patient details:', error);
    return res.status(500).json({ success: false, message: 'Unable to load patient record.' });
  }
};

export const getCardRoomPatientClinicalRecords = async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Patient reference is invalid.' });
  try {
    const patient = await Patient.findById(req.params.id).select('_id patientId').lean();
    if (!patient) return res.status(404).json({ success: false, message: 'Patient record not found.' });

    const [legacyRecords, visitDiagnoses] = await Promise.all([
      mongoose.connection.collection('patientrecords')
        .find({ patientId: patient.patientId }, {
          projection: { patientId: 1, patientName: 1, department: 1, doctorName: 1, diagnosis: 1, isEmergency: 1, createdAt: 1 },
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      ClinicVisit.find({
        $or: [{ patientRecordId: patient._id }, { patientId: patient.patientId }],
        diagnosis: { $type: 'string', $regex: /\S/ },
      })
        .select('visitId visitDate department diagnosis attendedByStaffId')
        .sort({ visitDate: -1 })
        .limit(100)
        .populate({ path: 'attendedByStaffId', model: Staff, select: 'name' })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        records: [
          ...legacyRecords.map((record) => ({
            id: String(record._id),
            source: 'Patient record',
            date: record.createdAt || null,
            department: record.department || '',
            professional: record.doctorName || '',
            diagnosis: record.diagnosis || '',
          })),
          ...visitDiagnoses.map((visit) => ({
            id: String(visit._id),
            visitId: visit.visitId || '',
            source: 'Clinic visit',
            date: visit.visitDate || null,
            department: visit.department || '',
            professional: visit.attendedByStaffId?.name || '',
            diagnosis: visit.diagnosis,
          })),
        ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
      },
    });
  } catch (error) {
    console.error('Failed to load authorized patient clinical records:', error);
    return res.status(500).json({ success: false, message: 'Unable to load clinical records.' });
  }
};

export const updateCardRoomPatient = async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Patient reference is invalid.' });
  const input = req.body || {};
  const updates = {};
  for (const field of editablePatientFields) {
    if (input[field] === undefined) continue;
    if (field === 'age') {
      const age = input.age === '' || input.age === null ? null : Number(input.age);
      if (age !== null && (!Number.isInteger(age) || age < 0 || age > 125)) {
        return res.status(400).json({ success: false, message: 'Age must be a whole number between 0 and 125.' });
      }
      updates.age = age;
    } else if (field === 'dateOfBirth') {
      const dateValue = typeof input.dateOfBirth === 'string' ? input.dateOfBirth.trim() : '';
      const date = dateValue ? new Date(`${dateValue}T00:00:00.000Z`) : null;
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
        || Number.isNaN(date.getTime())
        || date.toISOString().slice(0, 10) !== dateValue
        || date > new Date())) {
        return res.status(400).json({ success: false, message: 'Date of birth is invalid.' });
      }
      updates.dateOfBirth = date;
      if (date) {
        const { year, month, day } = getClinicDateParts(new Date());
        const today = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        const birthDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const age = today.getUTCFullYear() - birthDate.getUTCFullYear()
          - (today < new Date(Date.UTC(today.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate())) ? 1 : 0);
        if (age < 0 || age > 125) return res.status(400).json({ success: false, message: 'Date of birth must produce an age between 0 and 125.' });
        updates.age = age;
      }
    } else {
      const max = field === 'address' ? 500
        : ['governmentIdNumber', 'universityIdNumber'].includes(field) ? 80
          : field === 'houseNumber' ? 40
            : field === 'phoneNumber' || field === 'emergencyContactPhone' ? 30
              : 120;
      const value = trimString(input[field], max);
      if (field === 'fullName' && value.length < 2) return res.status(400).json({ success: false, message: 'Full name is required.' });
      if (field === 'patientCategory' && !validCategories.has(value)) return res.status(400).json({ success: false, message: 'Select a valid patient category.' });
      if (field === 'sex' && !validSex.has(value)) return res.status(400).json({ success: false, message: 'Select a valid sex value.' });
      if (['phoneNumber', 'emergencyContactPhone'].includes(field) && value && !/^[+()\d\s-]{6,30}$/.test(value)) return res.status(400).json({ success: false, message: 'Phone number format is invalid.' });
      if (['governmentIdNumber', 'universityIdNumber'].includes(field) && value && !/^[\p{L}\p{N}./-]{3,80}$/u.test(value)) {
        return res.status(400).json({ success: false, message: 'Identification number format is invalid.' });
      }
      updates[field] = ['governmentIdNumber', 'universityIdNumber'].includes(field)
        ? (value ? value.toUpperCase() : undefined)
        : value;
    }
  }
  if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'Provide at least one demographic field to update.' });
  if (input.dateOfBirth && input.age !== undefined && input.age !== null && input.age !== '') {
    return res.status(400).json({ success: false, message: 'Provide date of birth or age, not both.' });
  }
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient record not found.' });
    if (updates.governmentIdNumber || updates.universityIdNumber) {
      const identityConditions = [
        ...(updates.governmentIdNumber ? [{ governmentIdNumber: updates.governmentIdNumber }] : []),
        ...(updates.universityIdNumber ? [{ universityIdNumber: updates.universityIdNumber }] : []),
      ];
      const duplicate = await Patient.exists({ _id: { $ne: patient._id }, $or: identityConditions });
      if (duplicate) return res.status(409).json({ success: false, message: 'That identification number is already assigned to another patient.' });
    }
    if (updates.age !== undefined && updates.age !== null && updates.dateOfBirth === undefined && patient.dateOfBirth) {
      updates.dateOfBirth = null;
    }
    const changes = Object.entries(updates)
      .filter(([field, value]) => String(patient[field] ?? '') !== String(value ?? ''))
      .map(([field, value]) => ({ field, from: patient[field] ?? '', to: value ?? '' }));
    Object.assign(patient, updates, { updatedBy: req.user._id });
    await patient.save();
    const auditRecorded = changes.length
      ? await writeCardRoomAudit(req, 'CARD_ROOM_PATIENT_UPDATED', 'patients', patient._id, `Updated demographic details for ${patient.patientId}.`, changes)
      : true;
    return res.status(200).json({
      success: true,
      message: auditRecorded ? 'Patient demographics updated.' : 'Patient demographics updated, but the audit event could not be recorded.',
      data: patientSummary(patient.toObject()),
      auditRecorded,
    });
  } catch (error) {
    console.error('Failed to update Card Room patient demographics:', error);
    return res.status(500).json({ success: false, message: 'Unable to update patient demographics.' });
  }
};

export const createCardRoomVisit = async (req, res) => {
  const {
    patientId,
    visitType,
    priority = 'Normal',
    departmentId,
    idempotencyKey,
  } = req.body || {};
  if (typeof patientId !== 'string' || !patientId.trim()
    || !validVisitTypes.has(visitType)
    || !validPriorities.has(priority)
    || (departmentId !== undefined && !validObjectId(departmentId))
    || typeof idempotencyKey !== 'string'
    || !/^[\w-]{16,100}$/.test(idempotencyKey)) {
    return res.status(400).json({ success: false, message: 'Select an existing patient, visit type, priority, and unique submission key.' });
  }
  try {
    const existing = await ClinicVisit.findOne({ idempotencyKey }).lean();
    if (existing) {
      const queue = await Queue.findOne({ visitId: existing._id }).select('queueNumber status department').lean();
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'This visit request was already registered.',
        data: { visit: existing, queue },
      });
    }
    const patient = await Patient.findOne({
      $or: [{ patientId: patientId.trim() }, { cardNumber: patientId.trim() }],
    }).lean();
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found. Search and select a registered patient.' });

    const emergency = visitType === 'Emergency Visit' || priority === 'Emergency';
    let destination;
    if (emergency) {
      destination = await Department.findOne({
        status: 'Active',
        usesQueue: true,
        $or: [{ code: /^ER$/i }, { name: /emergency/i }],
      }).sort({ code: 1 }).lean();
    } else if (departmentId) {
      destination = await Department.findOne({
        _id: departmentId,
        status: 'Active',
        usesQueue: true,
        code: { $not: /^CARD$/i },
      }).lean();
    } else {
      destination = await Department.findOne({
        status: 'Active',
        usesQueue: true,
        name: { $regex: 'examination', $options: 'i' },
      }).sort({ name: 1 }).lean();
    }
    if (!destination) {
      return res.status(409).json({
        success: false,
        message: emergency
          ? 'No active Emergency Room queue is configured. Configure it before registering emergency visits.'
          : 'Select an active department that supports patient queues.',
      });
    }

    const now = new Date();
    const visitId = await createVisitId(now);
    const { clinicDate, queueNumber } = await createQueueNumber(destination, now);
    const visit = await ClinicVisit.create({
      visitId,
      patientRecordId: patient._id,
      patientId: patient.patientId,
      patientName: patient.fullName,
      visitDate: now,
      department: destination.name,
      visitType,
      priority: emergency ? 'Emergency' : priority,
      status: 'Waiting',
      idempotencyKey,
      registeredBy: req.user._id,
      emergency,
    });
    try {
      const queue = await Queue.create({
        patientId: patient.patientId,
        patientName: patient.fullName,
        visitId: visit._id,
        queueNumber,
        clinicDate,
        visitType,
        priority: emergency ? 'Emergency' : priority,
        department: destination.name,
        status: 'waiting',
        arrivedAt: now,
        isEmergency: emergency,
        createdBy: req.user._id,
      });
      let emergencyNotificationWarning = '';
      if (emergency) {
        try {
          await notifyEmergencyQueueArrival(queue);
        } catch (notificationError) {
          console.error('Emergency queue registration succeeded, but Clinic Head notification failed:', notificationError);
          emergencyNotificationWarning = 'Emergency visit was registered, but the Clinic Head notification could not be created.';
        }
      }
      const auditRecorded = await writeCardRoomAudit(
        req,
        'CARD_ROOM_VISIT_REGISTERED',
        'clinic_visit',
        visit._id,
        `Registered ${visit.visitType} ${visit.visitId}; queue ${queue.queueNumber}.`,
      );
      emitQueueChanged(req);
      return res.status(201).json({
        success: true,
        message: emergency
          ? 'Emergency visit registered and placed at the top of the immediate-assessment queue.'
          : 'Visit registered and added to the Card Room queue.',
        data: { visit, queue },
        auditRecorded,
        ...(emergencyNotificationWarning ? { warning: emergencyNotificationWarning } : {}),
      });
    } catch (queueError) {
      await ClinicVisit.deleteOne({ _id: visit._id });
      throw queueError;
    }
  } catch (error) {
    if (error.code === 11000) {
      const existing = await ClinicVisit.findOne({ idempotencyKey }).lean();
      if (existing) {
        const queue = await Queue.findOne({ visitId: existing._id }).select('queueNumber status department').lean();
        return res.status(200).json({ success: true, duplicate: true, message: 'This visit request was already registered.', data: { visit: existing, queue } });
      }
      return res.status(409).json({ success: false, message: 'Visit or queue number conflict. Please retry the registration.' });
    }
    console.error('Failed to register Card Room visit:', error);
    return res.status(500).json({ success: false, message: 'Unable to register visit.' });
  }
};

export const listCardRoomVisits = async (req, res) => {
  const { page, limit } = pageParams(req.query);
  const { start, end } = getClinicDayBounds(new Date());
  const search = trimString(req.query.search, 100);
  try {
    const cardRoomUserIds = await getCardRoomUserIds();
    const filter = { visitDate: { $gte: start, $lt: end }, registeredBy: { $in: cardRoomUserIds } };
    if (typeof req.query.status === 'string' && validVisitStatuses.has(req.query.status)) filter.status = req.query.status;
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ patientId: expression }, { patientName: expression }, { visitId: expression }];
    }
    const [visits, total] = await Promise.all([
      ClinicVisit.find(filter)
        .select('visitId patientRecordId patientId patientName visitDate department visitType priority status emergency')
        .populate('patientRecordId', 'cardNumber')
        .sort({ visitDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ClinicVisit.countDocuments(filter),
    ]);
    const queues = await Queue.find({ visitId: { $in: visits.map((visit) => visit._id) } })
      .select('visitId queueNumber status')
      .lean();
    const queueByVisit = new Map(queues.map((queue) => [String(queue.visitId), queue]));
    return res.status(200).json({
      success: true,
      data: visits.map((visit) => ({
        ...visit,
        cardNumber: visit.patientRecordId?.cardNumber || '',
        patientRecordId: visit.patientRecordId?._id || null,
        queue: queueByVisit.get(String(visit._id)) || null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to load Card Room visits:', error);
    return res.status(500).json({ success: false, message: 'Unable to load today’s visits.' });
  }
};

export const listCardRoomQueue = async (req, res) => {
  const requestedDate = trimString(req.query.date, 10);
  const clinicDate = requestedDate || getClinicDateKey(new Date());
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(clinicDate)
    ? new Date(`${clinicDate}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== clinicDate) {
    return res.status(400).json({ success: false, message: 'Select a valid queue date.' });
  }
  const status = trimString(req.query.status, 40);
  const priority = trimString(req.query.priority, 20);
  const visitType = trimString(req.query.visitType, 40);
  const department = trimString(req.query.department, 120);
  const search = trimString(req.query.search, 100);
  const { page, limit } = pageParams(req.query);
  if (status && !validQueueStatuses.has(status) && !['in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Select a valid queue status.' });
  }
  if (priority && !validPriorities.has(priority)) {
    return res.status(400).json({ success: false, message: 'Select a valid queue priority.' });
  }
  if (visitType && !validVisitTypes.has(visitType)) {
    return res.status(400).json({ success: false, message: 'Select a valid visit type.' });
  }
  try {
    const cardRoomUserIds = await getCardRoomUserIds();
    const filter = { clinicDate, createdBy: { $in: cardRoomUserIds } };
    if (department) {
      const selectedDepartment = await Department.findOne({
        status: 'Active',
        usesQueue: true,
        name: department,
      }).select('name').lean();
      if (!selectedDepartment) {
        return res.status(400).json({ success: false, message: 'Select an active queue-enabled department.' });
      }
      filter.department = selectedDepartment.name;
    }
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (visitType) filter.visitType = visitType;
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      const matchingPatients = await Patient.find({ universityIdNumber: expression }).select('_id').lean();
      const matchingVisits = matchingPatients.length
        ? await ClinicVisit.find({ patientRecordId: { $in: matchingPatients.map(({ _id }) => _id) } }).select('_id').lean()
        : [];
      filter.$or = [
        { queueNumber: expression },
        { patientId: expression },
        { patientName: expression },
        ...(matchingVisits.length ? [{ visitId: { $in: matchingVisits.map(({ _id }) => _id) } }] : []),
      ];
    }

    const activeStatuses = ['waiting', 'called'];
    const { start, end } = getClinicDayBounds(new Date(`${clinicDate}T12:00:00+03:00`));
    const [queues, total, visitsToday, waitingPatients, calledPatients, sentToExamination, urgentEmergencyPatients] = await Promise.all([
      Queue.aggregate([
        { $match: filter },
        {
          $addFields: {
            priorityOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'Emergency'] }, then: 0 },
                  { case: { $eq: ['$priority', 'Urgent'] }, then: 1 },
                ],
                default: 2,
              },
            },
          },
        },
        { $sort: { isEmergency: -1, priorityOrder: 1, arrivedAt: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { priorityOrder: 0 } },
      ]),
      Queue.countDocuments(filter),
      ClinicVisit.countDocuments({ visitDate: { $gte: start, $lt: end }, registeredBy: { $in: cardRoomUserIds } }),
      Queue.countDocuments({ clinicDate, createdBy: { $in: cardRoomUserIds }, status: 'waiting' }),
      Queue.countDocuments({ clinicDate, createdBy: { $in: cardRoomUserIds }, status: 'called' }),
      Queue.countDocuments({ clinicDate, createdBy: { $in: cardRoomUserIds }, status: 'sent_to_examination' }),
      Queue.countDocuments({ clinicDate, createdBy: { $in: cardRoomUserIds }, status: { $in: activeStatuses }, priority: { $in: ['Urgent', 'Emergency'] } }),
    ]);
    const populatedQueues = await Queue.populate(queues, {
      path: 'visitId',
      select: 'visitId patientRecordId patientId patientName visitDate visitType priority status department emergency',
      populate: { path: 'patientRecordId', select: 'sex age phoneNumber patientCategory universityIdNumber' },
    });
    return res.status(200).json({
      success: true,
      data: populatedQueues,
      clinicDate,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: { visitsToday, waitingPatients, calledPatients, sentToExamination, urgentEmergencyPatients },
    });
  } catch (error) {
    console.error('Failed to load Card Room queue:', error);
    return res.status(500).json({ success: false, message: 'Unable to load queue.' });
  }
};

export const updateCardRoomQueue = async (req, res) => {
  const { id } = req.params;
  const { status, cancellationReason = '', priority, department } = req.body || {};
  if (!validObjectId(id)) return res.status(400).json({ success: false, message: 'Queue entry reference is invalid.' });
  if (status !== undefined && !validQueueStatuses.has(status)) return res.status(400).json({ success: false, message: 'Select a valid queue status.' });
  if (priority !== undefined && !validPriorities.has(priority)) return res.status(400).json({ success: false, message: 'Select a valid queue priority.' });
  const cleanDepartment = department === undefined ? '' : trimString(department, 120);
  if (department !== undefined && !cleanDepartment) return res.status(400).json({ success: false, message: 'Select a valid destination department.' });
  if (status === undefined && priority === undefined && department === undefined) {
    return res.status(400).json({ success: false, message: 'Choose a queue update to apply.' });
  }
  const cleanReason = trimString(cancellationReason, 300);
  if (status === 'cancelled' && cleanReason.length < 3) {
    return res.status(400).json({ success: false, message: 'Enter a cancellation reason of at least 3 characters.' });
  }
  try {
    const clinicDate = getClinicDateKey(new Date());
    const cardRoomUserIds = await getCardRoomUserIds();
    const currentStatusesByTransition = {
      called: ['waiting'],
      sent_to_examination: ['called'],
      routed: ['called'],
      in_progress: ['sent_to_examination', 'routed'],
      completed: ['in_progress', 'sent_to_examination', 'routed'],
      no_show: ['waiting', 'called'],
      cancelled: ['waiting', 'called'],
    };
    const currentStatuses = status ? currentStatusesByTransition[status] : null;
    if (status && !currentStatuses?.length) {
      return res.status(400).json({ success: false, message: 'This queue status transition is not supported.' });
    }
    const existing = await Queue.findOne({ _id: id, clinicDate, createdBy: { $in: cardRoomUserIds } });
    if (!existing) {
      const anyQueue = await Queue.exists({ _id: id });
      return anyQueue
        ? res.status(409).json({ success: false, message: 'Only today’s queue entries can be changed.' })
        : res.status(404).json({ success: false, message: 'Queue entry not found.' });
    }
    if (currentStatuses && !currentStatuses.includes(existing.status)) {
      return res.status(409).json({ success: false, message: 'The queue entry has already changed or cannot make that transition.' });
    }
    if (priority !== undefined && !['waiting', 'called'].includes(existing.status)) {
      return res.status(409).json({ success: false, message: 'Priority can only be changed before the patient is routed for care.' });
    }
    if (department !== undefined && !['waiting', 'called', 'routed', 'sent_to_examination'].includes(existing.status)) {
      return res.status(409).json({ success: false, message: 'The destination can only be changed before care has started.' });
    }
    let destinationDepartment = existing.department;
    if (department !== undefined) {
      const selectedDepartment = await Department.findOne({
        status: 'Active',
        usesQueue: true,
        name: cleanDepartment,
      }).select('name').lean();
      if (!selectedDepartment) {
        return res.status(400).json({ success: false, message: 'Select an active queue-enabled department.' });
      }
      destinationDepartment = selectedDepartment.name;
    }
    if (status === 'sent_to_examination') {
      const examination = await Department.findOne({
        status: 'Active',
        name: { $regex: 'examination', $options: 'i' },
      }).select('name').sort({ name: 1 }).lean();
      if (!examination) {
        return res.status(409).json({ success: false, message: 'No active Examination department is configured. Configure it before routing patients.' });
      }
      destinationDepartment = examination.name;
    }
    const update = {
      ...(status !== undefined ? { status } : {}),
      department: destinationDepartment,
      ...(status === 'called' ? { calledAt: new Date() } : {}),
      ...(status === 'in_progress' ? { inProgressAt: new Date() } : {}),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
      ...(priority !== undefined ? { priority, isEmergency: priority === 'Emergency' } : {}),
      ...(status === 'cancelled' ? {
        cancellationReason: cleanReason,
        cancelledBy: req.user._id,
        cancelledAt: new Date(),
      } : {}),
    };
    const queue = await Queue.findOneAndUpdate(
      {
        _id: id,
        clinicDate,
        createdBy: { $in: cardRoomUserIds },
        ...(currentStatuses ? { status: { $in: currentStatuses } } : { status: existing.status }),
      },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!queue) {
      return res.status(409).json({ success: false, message: 'The queue entry has already changed. Refresh the queue and try again.' });
    }
    if (queue.visitId) {
      const visitStatusByQueueStatus = {
        waiting: 'Waiting',
        called: 'Called',
        routed: 'Routed',
        sent_to_examination: 'Sent to Examination',
        in_progress: 'In Service',
        completed: 'Completed',
        no_show: 'No-show',
        cancelled: 'Cancelled',
      };
      await ClinicVisit.updateOne({ _id: queue.visitId }, {
        $set: {
          ...(status !== undefined ? { status: visitStatusByQueueStatus[status] } : {}),
          ...(priority !== undefined ? { priority, emergency: priority === 'Emergency' } : {}),
          department: queue.department,
        },
      });
    }
    const changes = [
      ...(status !== undefined ? [{ field: 'status', from: existing.status, to: status }] : []),
      ...(priority !== undefined && priority !== existing.priority ? [{ field: 'priority', from: existing.priority, to: priority }] : []),
      ...(destinationDepartment !== existing.department ? [{ field: 'department', from: existing.department, to: destinationDepartment }] : []),
    ];
    const auditRecorded = await writeCardRoomAudit(
      req,
      status === 'cancelled' ? 'CARD_ROOM_QUEUE_CANCELLED' : 'CARD_ROOM_QUEUE_UPDATED',
      'queue',
      queue._id,
      `Queue ${queue.queueNumber || queue.patientId} updated.${cleanReason ? ` Reason: ${cleanReason}` : ''}`,
      changes,
    );
    emitQueueChanged(req);
    const message = status === 'sent_to_examination' ? 'Patient routed to Examination.'
      : status === 'routed' ? `Patient routed to ${queue.department}.`
        : status !== undefined ? `Queue status changed to ${status.replaceAll('_', ' ')}.`
          : department !== undefined ? `Patient moved to ${queue.department}.`
            : `Priority changed to ${queue.priority}.`;
    return res.status(200).json({
      success: true,
      message,
      data: queue,
      auditRecorded,
    });
  } catch (error) {
    console.error('Failed to update Card Room queue:', error);
    return res.status(500).json({ success: false, message: 'Unable to update queue entry.' });
  }
};

export const getCardRoomReports = async (req, res) => {
  const { start: monthStart } = getClinicMonthBounds();
  const startDate = trimString(req.query.startDate, 10);
  const endDate = trimString(req.query.endDate, 10);
  const patientCategory = trimString(req.query.patientCategory, 50);
  const visitType = trimString(req.query.visitType, 30);
  const validReportVisitTypes = new Set(['New Visit', 'Follow-up Visit', 'Emergency Visit']);
  if (patientCategory && !validCategories.has(patientCategory)) {
    return res.status(400).json({ success: false, message: 'Select a valid patient category.' });
  }
  if (visitType && !validReportVisitTypes.has(visitType)) {
    return res.status(400).json({ success: false, message: 'Select a valid visit type.' });
  }
  const parse = (value, endOfDay = false) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const utcDay = new Date(`${value}T00:00:00.000Z`);
    if (utcDay.toISOString().slice(0, 10) !== value) return null;
    const date = new Date(utcDay.getTime() - (3 * 60 * 60 * 1000) + (endOfDay ? 24 * 60 * 60 * 1000 - 1 : 0));
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = startDate ? parse(startDate) : monthStart;
  const end = endDate ? parse(endDate, true) : new Date();
  if (!start || !end || start > end || end.getTime() - start.getTime() > 366 * 86400000) {
    return res.status(400).json({ success: false, message: 'Select a valid report range of no more than 366 days.' });
  }
  try {
    const cardRoomUserIds = await getCardRoomUserIds();
    const patientFilter = {
      createdAt: { $gte: start, $lte: end },
      createdBy: { $in: cardRoomUserIds },
      ...(patientCategory ? { patientCategory } : {}),
    };
    const patientIdsForCategory = patientCategory
      ? await Patient.distinct('patientId', { patientCategory })
      : null;
    const visitFilter = {
      visitDate: { $gte: start, $lte: end },
      registeredBy: { $in: cardRoomUserIds },
      ...(visitType ? { visitType } : {}),
      ...(patientIdsForCategory ? { patientId: { $in: patientIdsForCategory } } : {}),
    };
    const [registrations, visitsTotal, emergencyVisits, matchingVisitIds, visitTypeBreakdown, categoryBreakdown, visitsByDepartment, visitsByHour] = await Promise.all([
      Patient.countDocuments(patientFilter),
      ClinicVisit.countDocuments(visitFilter),
      ClinicVisit.countDocuments({ ...visitFilter, emergency: true }),
      ClinicVisit.distinct('_id', visitFilter),
      ClinicVisit.aggregate([
        { $match: { ...visitFilter, visitType: { $exists: true, $ne: '' } } },
        { $group: { _id: '$visitType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ClinicVisit.aggregate([
        { $match: visitFilter },
        {
          $lookup: {
            from: Patient.collection.name,
            localField: 'patientRecordId',
            foreignField: '_id',
            as: 'patient',
          },
        },
        { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              patient: { $ifNull: ['$patientRecordId', '$patientId'] },
              category: '$patient.patientCategory',
            },
          },
        },
        { $group: { _id: '$_id.category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ClinicVisit.aggregate([
        { $match: visitFilter },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      ClinicVisit.aggregate([
        { $match: visitFilter },
        { $group: { _id: { $hour: { date: '$visitDate', timezone: clinicTimeZone } }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 24 },
      ]),
    ]);
    const queueWaitStats = matchingVisitIds.length ? await Queue.aggregate([
        {
          $match: {
            createdBy: { $in: cardRoomUserIds },
            visitId: { $in: matchingVisitIds },
            arrivedAt: { $gte: start, $lte: end },
            inProgressAt: { $type: 'date' },
            status: { $ne: 'cancelled' },
            $expr: { $gte: ['$inProgressAt', '$arrivedAt'] },
          },
        },
        {
          $group: {
            _id: null,
            averageMinutes: {
              $avg: { $divide: [{ $subtract: ['$inProgressAt', '$arrivedAt'] }, 60000] },
            },
            measuredVisits: { $sum: 1 },
          },
        },
      ]) : [];
    const peakHour = visitsByHour[0];
    const waitStats = queueWaitStats[0];
    return res.status(200).json({
      success: true,
      data: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        summary: {
          newCards: registrations,
          registrations,
          visits: visitsTotal,
          newVisits: visitTypeBreakdown.find(({ _id }) => _id === 'New Visit')?.count || 0,
          repeatVisits: visitTypeBreakdown.find(({ _id }) => _id === 'Follow-up Visit')?.count || 0,
          emergencyVisits,
          routedPatients: visitsTotal,
          averageWaitingMinutes: waitStats?.averageMinutes == null ? null : Math.round(waitStats.averageMinutes * 10) / 10,
          measuredWaitingVisits: waitStats?.measuredVisits || 0,
          peakHour: peakHour ? `${String(peakHour._id).padStart(2, '0')}:00–${String((peakHour._id + 1) % 24).padStart(2, '0')}:00` : null,
          peakHourVisits: peakHour?.count || 0,
        },
        departmentBreakdown: visitsByDepartment.map(({ _id, count }) => ({ department: _id || 'Unassigned', count })),
        patientCategories: categoryBreakdown.map(({ _id, count }) => ({ category: _id || 'Unspecified', count })),
        visitTypes: visitTypeBreakdown.map(({ _id, count }) => ({ visitType: _id || 'Unspecified', count })),
        hourlyBreakdown: visitsByHour
          .map(({ _id, count }) => ({ hour: `${String(_id).padStart(2, '0')}:00–${String((_id + 1) % 24).padStart(2, '0')}:00`, count }))
          .sort((a, b) => a.hour.localeCompare(b.hour)),
        privacy: 'This report contains aggregate counts only; patient identifiers and clinical details are excluded.',
      },
    });
  } catch (error) {
    console.error('Failed to generate Card Room reports:', error);
    return res.status(500).json({ success: false, message: 'Unable to generate Card Room reports.' });
  }
};

export const submitCardRoomReport = async (req, res) => {
  const { startDate, endDate, summary } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') || startDate > endDate) {
    return res.status(400).json({ success: false, message: 'Select a valid report date range before submitting.' });
  }
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return res.status(400).json({ success: false, message: 'Report summary is required.' });
  }
  try {
    const department = trimString(req.user.department, 120) || 'Card Room';
    const aggregateRows = (rows, label) => (Array.isArray(rows) ? rows : [])
      .slice(0, 100)
      .map((row) => ({
        [label]: trimString(row?.[label], 120),
        count: Number.isSafeInteger(Number(row?.count)) && Number(row.count) >= 0 ? Number(row.count) : 0,
      }))
      .filter((row) => row[label]);
    const report = await ClinicDepartmentReport.create({
      reportType: 'Card Room Report',
      department,
      title: `Card Room patient-flow report · ${startDate} to ${endDate}`,
      submittedBy: req.user._id,
      content: JSON.stringify({
        period: { startDate, endDate },
        metrics: {
          newCards: Number(summary.newCards) || 0,
          registrations: Number(summary.registrations) || 0,
          newVisits: Number(summary.newVisits) || 0,
          repeatVisits: Number(summary.repeatVisits) || 0,
          emergencyVisits: Number(summary.emergencyVisits) || 0,
          routedPatients: Number(summary.routedPatients) || 0,
          visits: Number(summary.visits) || 0,
          averageWaitingMinutes: summary.averageWaitingMinutes == null
            ? null
            : Number.isFinite(Number(summary.averageWaitingMinutes)) ? Number(summary.averageWaitingMinutes) : null,
          measuredWaitingVisits: Number(summary.measuredWaitingVisits) || 0,
          peakHour: trimString(summary.peakHour, 30),
          peakHourVisits: Number(summary.peakHourVisits) || 0,
        },
        departmentBreakdown: aggregateRows(summary.departmentBreakdown, 'department'),
        patientCategories: aggregateRows(summary.patientCategories, 'category'),
        visitTypes: aggregateRows(summary.visitTypes, 'visitType'),
        hourlyBreakdown: aggregateRows(summary.hourlyBreakdown, 'hour'),
        note: 'Aggregated report only. Patient identifiers and clinical details are excluded.',
      }),
    });
    let notificationWarning = '';
    try {
      const clinicHeads = await User.find({
        status: 'Active',
        $or: [
          { activeRole: /^clinic head$/i },
          { role: /^clinic head$/i },
          { roles: /^clinic head$/i },
        ],
      }).select('_id').lean();
      if (clinicHeads.length) {
        await ClinicNotification.insertMany(clinicHeads.map(({ _id }) => ({
          recipient: _id,
          sender: req.user._id,
          departmentReport: report._id,
          title: 'New Card Room report submitted',
          message: `${req.user.name || req.user.username || 'Card Room staff'} submitted a report for ${startDate} to ${endDate}.`,
          notificationType: 'clinic_workflow',
          channel: 'in_app',
          priority: 'normal',
          recipientRole: 'Clinic Head',
        })));
      } else {
        notificationWarning = 'The report was saved, but no active Clinic Student Head account was found.';
      }
    } catch (notificationError) {
      console.error('Card Room report was saved, but Clinic Head notifications could not be created:', notificationError);
      notificationWarning = 'The report was saved, but in-app notification delivery failed.';
    }
    req.app.get('io')?.emit('clinic:department-report-submitted');
    const auditRecorded = await writeCardRoomAudit(
      req,
      'CARD_ROOM_REPORT_SUBMITTED',
      'department_report',
      report._id,
      `Submitted Card Room report for ${startDate} to ${endDate}.`,
    );
    return res.status(201).json({
      success: true,
      message: 'Card Room report submitted to the Clinic Student Head reports dashboard.',
      warning: notificationWarning,
      data: report,
      auditRecorded,
    });
  } catch (error) {
    console.error('Failed to submit Card Room report:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit the Card Room report.' });
  }
};

export const getCardRoomNotifications = async (req, res) => {
  try {
    const notifications = await ClinicNotification.find({ recipient: req.user._id })
      .select('title message notificationType priority deliveryStatus readAt createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({
      success: true,
      data: notifications.map((notification) => ({
        ...notification,
        read: Boolean(notification.readAt),
        deliveryStatus: notification.deliveryStatus || 'created',
      })),
    });
  } catch (error) {
    console.error('Failed to load Card Room notifications:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
  }
};

export const getCardRoomProfile = async (req, res) => {
  try {
    const [profile, role] = await Promise.all([
      User.findById(req.user._id)
      .select('name username email employeeId role activeRole department phoneNumber position status createdAt lastLogin')
      .lean(),
      RolePermission.findOne({
        roleName: {
          $regex: `^${String(req.user.activeRole || req.user.role || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
        $or: [{ status: 'Active' }, { status: { $exists: false } }],
      })
        .select('permissions')
        .lean(),
    ]);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile was not found.' });
    return res.status(200).json({ success: true, data: { ...profile, permissions: role?.permissions || [] } });
  } catch (error) {
    console.error('Failed to load Card Room profile:', error);
    return res.status(500).json({ success: false, message: 'Unable to load profile.' });
  }
};

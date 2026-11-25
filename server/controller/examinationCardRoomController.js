import mongoose from 'mongoose';
import ClinicVisit from '../module/ClinicVisit.js';
import ExaminationCardRoomTransfer from '../module/examinationCardRoomTransfer.js';
import Patient from '../module/Patient.js';

const patientFolderFields = [
  'patientId',
  'cardNumber',
  'fullName',
  'firstName',
  'fatherName',
  'grandfatherName',
  'sex',
  'dateOfBirth',
  'age',
  'createdAt',
  'governmentIdNumber',
  'universityIdNumber',
  'phoneNumber',
  'patientCategory',
  'campus',
  'academicDepartment',
  'region',
  'town',
  'woreda',
  'kebele',
  'address',
  'dormBlock',
  'houseNumber',
].join(' ');

const getLatestVisit = (patient) => ClinicVisit.findOne({
  $or: [
    { patientRecordId: patient._id },
    { patientId: patient.patientId },
  ],
}).sort({ visitDate: -1 });

const createTransferSnapshot = (patient, visit) => {
  const examination = visit?.examination || {};
  const laboratoryRequests = (examination.labRequests || []).map((request) => ({
    testName: request.testName || '',
    category: request.category || '',
    status: request.status || examination.labStatus || 'Not requested',
    result: request.result || '',
    unit: request.unit || '',
    referenceRange: request.referenceRange || '',
    flag: request.flag || '',
    clinicalNote: request.clinicalNote || '',
  }));

  return {
    individualFolder: {
      mrn: patient.cardNumber || patient.patientId,
      patientId: patient.patientId,
      dateOfRegistration: patient.createdAt || null,
      name: patient.fullName,
      firstName: patient.firstName || '',
      fatherName: patient.fatherName || '',
      grandfatherName: patient.grandfatherName || '',
      sex: patient.sex || '',
      age: patient.age ?? null,
      dateOfBirth: patient.dateOfBirth || null,
      address: patient.address || '',
      region: patient.region || '',
      woreda: patient.woreda || '',
      kebele: patient.kebele || '',
      department: patient.academicDepartment || patient.campus || '',
      idNumber: patient.governmentIdNumber || patient.universityIdNumber || '',
      governmentIdNumber: patient.governmentIdNumber || '',
      universityIdNumber: patient.universityIdNumber || '',
      phoneNumber: patient.phoneNumber || '',
      patientCategory: patient.patientCategory || '',
    },
    patientCard: visit ? {
      visitId: visit.visitId || String(visit._id),
      date: visit.visitDate,
      diagnosis: visit.diagnosis || examination.hmisDiagnosis || examination.otherDiagnosis || '',
      chiefComplaint: examination.chiefComplaint || '',
      encounterNotes: examination.doctorNotes || '',
      history: examination.historyOfPresentIllness || '',
      physicalExamination: examination.physicalExamination || '',
      treatment: (examination.prescriptions || []).map((prescription) => ({
        medicine: prescription.medicine || '',
        strength: prescription.strength || '',
        dose: prescription.dose || prescription.dosage || '',
        frequency: prescription.frequency || '',
        duration: prescription.duration || '',
        instructions: prescription.instructions || '',
      })),
      examinationStatus: visit.status || '',
    } : null,
    labRequestResult: visit ? {
      date: examination.labRequestedAt || visit.visitDate,
      requestNumber: examination.labRequestNumber || '',
      status: examination.labStatus || (laboratoryRequests.length ? 'Requested' : 'Not requested'),
      testedBy: examination.labTestedBy || '',
      dateOfReport: examination.labDateOfReport || null,
      approvedBy: examination.labApprovedBy || '',
      tests: laboratoryRequests,
    } : null,
  };
};

const sendToCardRoom = async (req, res) => {
  const { patientRecordId, visitId, documents = {}, remarks = '' } = req.body || {};
  if (!mongoose.isValidObjectId(patientRecordId)) {
    return res.status(400).json({ success: false, message: 'Select a valid patient record.' });
  }

  const selectedDocuments = {
    individualFolder: Boolean(documents.individualFolder),
    patientCard: Boolean(documents.patientCard),
    labRequestResult: Boolean(documents.labRequestResult),
  };
  if (!Object.values(selectedDocuments).some(Boolean)) {
    return res.status(400).json({ success: false, message: 'Select at least one document to send.' });
  }
  if (typeof remarks !== 'string' || remarks.length > 1000) {
    return res.status(400).json({ success: false, message: 'Remarks must be 1000 characters or fewer.' });
  }

  try {
    const patient = await Patient.findById(patientRecordId).select(patientFolderFields).lean();
    if (!patient) return res.status(404).json({ success: false, message: 'Patient record not found.' });

    let visit = null;
    if (visitId) {
      if (!mongoose.isValidObjectId(visitId)) {
        return res.status(400).json({ success: false, message: 'Selected examination visit is invalid.' });
      }
      visit = await ClinicVisit.findById(visitId).lean();
      if (!visit || (
        String(visit.patientRecordId || '') !== String(patient._id)
        && visit.patientId !== patient.patientId
      )) {
        return res.status(400).json({ success: false, message: 'Selected visit does not belong to this patient.' });
      }
    } else {
      visit = await getLatestVisit(patient).lean();
    }

    const snapshot = createTransferSnapshot(patient, visit);
    const transfer = await ExaminationCardRoomTransfer.create({
      patientRecordId: patient._id,
      patientId: patient.patientId,
      mrn: patient.cardNumber || patient.patientId,
      patientName: patient.fullName,
      visitId: visit?._id || null,
      documents: selectedDocuments,
      snapshot,
      remarks: remarks.trim(),
      sentBy: req.user?._id || null,
      sentByName: req.user?.name || req.user?.username || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Documents sent to Card Room.',
      data: transfer,
    });
  } catch (error) {
    console.error('Failed to send examination records to Card Room:', error);
    return res.status(500).json({ success: false, message: 'Unable to send records to Card Room.' });
  }
};

const listCardRoomTransfers = async (req, res) => {
  const filter = {};
  if (['SENT_TO_CARD_ROOM', 'RECEIVED_BY_CARD_ROOM'].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ mrn: expression }, { patientName: expression }, { patientId: expression }];
  }

  try {
    const transfers = await ExaminationCardRoomTransfer.find(filter)
      .sort({ sentAt: -1 })
      .limit(200)
      .lean();
    return res.status(200).json({ success: true, count: transfers.length, data: transfers });
  } catch (error) {
    console.error('Failed to load examination-to-Card Room transfers:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Card Room transfers.' });
  }
};

const markCardRoomTransferReceived = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Transfer reference is invalid.' });
  }

  try {
    const transfer = await ExaminationCardRoomTransfer.findOneAndUpdate(
      { _id: req.params.id, status: 'SENT_TO_CARD_ROOM' },
      {
        $set: {
          status: 'RECEIVED_BY_CARD_ROOM',
          receivedAt: new Date(),
          receivedBy: req.user?._id || null,
          receivedByName: req.user?.name || req.user?.username || '',
        },
      },
      { new: true, runValidators: true },
    );
    if (transfer) {
      return res.status(200).json({ success: true, message: 'Transfer received.', data: transfer });
    }

    const exists = await ExaminationCardRoomTransfer.exists({ _id: req.params.id });
    return res.status(exists ? 409 : 404).json({
      success: false,
      message: exists ? 'This transfer has already been received.' : 'Card Room transfer not found.',
    });
  } catch (error) {
    console.error('Failed to mark Card Room transfer as received:', error);
    return res.status(500).json({ success: false, message: 'Unable to update Card Room transfer status.' });
  }
};

export {
  listCardRoomTransfers,
  markCardRoomTransferReceived,
  sendToCardRoom,
};
import mongoose from 'mongoose';
import ClinicVisit from '../module/ClinicVisit.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const getDateRange = (value) => {
  const dateKey = value || getClinicDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const parsedDate = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateKey) return null;
  const start = new Date(`${dateKey}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const formatServiceDate = (value) => new Intl.DateTimeFormat('en-GB', {
  timeZone: clinicTimeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));

const mapVisitToOpdRecord = (visit) => {
  const patient = visit.patientRecordId || {};
  const opd = visit.examination?.opd || {};
  const serviceDate = formatServiceDate(visit.visitDate);
  const address = patient.address
    || [patient.dormBlock, patient.woreda, patient.kebele].filter(Boolean).join(', ');
  const rta = opd.rtaType || opd.accidentType;
  const visitType = String(visit.visitType || '').toLowerCase().startsWith('new') ? 'New' : 'Repeat';

  return {
    _id: String(visit._id),
    identification: patient.universityIdNumber || visit.patientId || '',
    mrn: patient.cardNumber || visit.patientId || '',
    patientName: patient.fullName || visit.patientName || '',
    diagnosis: visit.diagnosis || '',
    screening: `${opd.screenedForTb || opd.tbScreened ? 'Yes' : 'No'} · ${opd.tbScreeningResult || 'N/A'}`,
    serviceDate,
    ncodDiagnosis: visit.examination?.hmisDiagnosis || '',
    hivTbStatus: [
      `Offered: ${opd.hivTestOffered ? 'Yes' : 'No'}`,
      `Performed: ${opd.hivTestPerformed ? 'Yes' : 'No'}`,
      `Target: ${opd.hivTargetCode || opd.targetPopulation || '—'}`,
      `HIV: ${opd.hivTestResult || opd.hivResult || 'N/A'}`,
    ].join(' · '),
    visitType,
    testResults: `${opd.tbDiagnosticCode || '—'} / ${opd.tbResultCode || opd.tbResult || '—'}`,
    hivTestOffered: Boolean(opd.hivTestOffered),
    hivTestPerformed: Boolean(opd.hivTestPerformed),
    hivTargetCode: opd.hivTargetCode || opd.targetPopulation || '',
    hivTestResult: opd.hivTestResult || opd.hivResult || '',
    screenedForTb: Boolean(opd.screenedForTb || opd.tbScreened),
    tbScreeningResult: opd.tbScreeningResult || '',
    tbDiagnosticCode: opd.tbDiagnosticCode || '',
    tbResultCode: opd.tbResultCode || opd.tbResult || '',
    referredCode: opd.referredCode || '',
    age: patient.age ?? '',
    sex: patient.sex || '',
    roadTrafficAccident: rta && rta !== 'None' ? rta : 'No',
    referral: opd.referredCode || (visit.referred || visit.examination?.referral?.department ? 'Yes' : 'No'),
    died: opd.died ? 'Yes' : 'No',
    address,
    date: serviceDate,
    doctorName: visit.examination?.examiner?.name || visit.examination?.prescriber?.name || '',
    doctorSignature: visit.examination?.examiner?.signedAt ? 'Signed electronically' : '',
  };
};

const populatePatient = (query) => query.populate({
  path: 'patientRecordId',
  select: 'cardNumber fullName age sex universityIdNumber address dormBlock woreda kebele',
});

export const getOpdRegister = async (req, res) => {
  const range = getDateRange(String(req.query.date || ''));
  if (!range) {
    return res.status(400).json({ success: false, message: 'Enter the service date in YYYY-MM-DD format.' });
  }
  try {
    const visits = await populatePatient(ClinicVisit.find({
      status: 'Completed',
      visitDate: { $gte: range.start, $lt: range.end },
    }).sort({ visitDate: 1 }).limit(500)).lean();
    const search = String(req.query.search || '').trim().slice(0, 120);
    const matcher = search ? new RegExp(escapeRegex(search), 'i') : null;
    const data = visits
      .map(mapVisitToOpdRecord)
      .filter((record) => !matcher || [
        record.identification,
        record.mrn,
        record.patientName,
        record.diagnosis,
      ].some((value) => matcher.test(String(value || ''))));
    const summary = {
      totalPatients: data.length,
      newPatients: data.filter((record) => record.visitType === 'New').length,
      repeatPatients: data.filter((record) => record.visitType === 'Repeat').length,
      referralPatients: data.filter((record) => record.referral !== 'No').length,
    };
    return res.status(200).json({ success: true, summary, data });
  } catch (error) {
    console.error('Failed to load OPD register:', error);
    return res.status(500).json({ success: false, message: 'Unable to load the OPD register.' });
  }
};

export const syncOpdRegister = async (req, res) => {
  const { visitId } = req.body || {};
  if (!mongoose.isValidObjectId(visitId)) {
    return res.status(400).json({ success: false, message: 'Clinic visit reference is invalid.' });
  }
  try {
    const visit = await populatePatient(ClinicVisit.findById(visitId)).lean();
    if (!visit) return res.status(404).json({ success: false, message: 'Clinic visit not found.' });
    if (visit.status !== 'Completed') {
      return res.status(409).json({ success: false, message: 'Complete the examination before syncing it to the OPD register.' });
    }
    req.app.get('io')?.emit('opd-register-updated', { visitId: String(visit._id) });
    return res.status(200).json({
      success: true,
      message: 'Completed visit synchronized with the OPD register.',
      data: mapVisitToOpdRecord(visit),
    });
  } catch (error) {
    console.error('Failed to sync visit with OPD register:', error);
    return res.status(500).json({ success: false, message: 'Unable to sync the visit with the OPD register.' });
  }
};

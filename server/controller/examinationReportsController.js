import ClinicVisit from '../module/ClinicVisit.js';
import ReferralLog from '../module/referralLogBook.js';
import ClinicDepartmentReport from '../module/ClinicDepartmentReport.js';
import { notifyClinicHeads } from '../utils/clinicHeadAlert.js';

const reportTypes = ['All', 'Outpatient', 'Inpatient', 'Referral Log Book'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return { start: null, end: null };
  if (!datePattern.test(startDate || '') || !datePattern.test(endDate || '') || startDate > endDate) return null;

  const startCheck = new Date(`${startDate}T00:00:00.000Z`);
  const endCheck = new Date(`${endDate}T00:00:00.000Z`);
  if (
    Number.isNaN(startCheck.getTime())
    || Number.isNaN(endCheck.getTime())
    || startCheck.toISOString().slice(0, 10) !== startDate
    || endCheck.toISOString().slice(0, 10) !== endDate
  ) return null;

  return {
    start: new Date(`${startDate}T00:00:00+03:00`),
    end: new Date(`${endDate}T23:59:59.999+03:00`),
  };
};

const referralVisitPopulate = {
  path: 'examinationVisitId',
  select: 'patientRecordId patientName patientId diagnosis examination',
  populate: {
    path: 'patientRecordId',
    select: 'cardNumber fullName age sex',
  },
};

const getFilteredReportData = async ({ startDate = '', endDate = '', search = '' } = {}) => {
  const range = parseDateRange(startDate, endDate);
  if (!range) return { error: 'Choose a valid date range with a start date before or equal to the end date.' };

  const dateFilter = range.start ? { $gte: range.start, $lte: range.end } : undefined;
  const visits = await ClinicVisit.find({
    status: 'Completed',
    ...(dateFilter ? { visitDate: dateFilter } : {}),
  })
    .select('patientRecordId patientId patientName visitDate status diagnosis examination')
    .populate({ path: 'patientRecordId', select: 'cardNumber fullName age sex' })
    .sort({ visitDate: -1 })
    .limit(1000)
    .lean();

  const logs = await ReferralLog.find(dateFilter ? { date: dateFilter } : {})
    .populate(referralVisitPopulate)
    .sort({ date: -1, serialNo: -1 })
    .limit(1000)
    .lean();

  const matcher = search ? new RegExp(escapeRegex(search), 'i') : null;
  const matches = (values) => !matcher || values.some((value) => matcher.test(String(value || '')));
  const outpatientRecords = [];
  const inpatientRecords = [];

  for (const visit of visits) {
    const patient = visit.patientRecordId || {};
    const examination = visit.examination || {};
    const diagnosis = visit.diagnosis || examination.hmisDiagnosis || '';
    const notes = [examination.doctorNotes, examination.chiefComplaint].filter(Boolean).join(' · ');
    const isInpatient = examination.disposition === 'Admit'
      || examination.prescriptionPatientType === 'inpatient';
    const common = {
      date: visit.visitDate || null,
      mrn: patient.cardNumber || visit.patientId || '—',
      patientName: patient.fullName || visit.patientName || '—',
      ageSex: [patient.age, patient.sex].filter((value) => value !== null && value !== undefined && value !== '').join(' / ') || '—',
      diagnosisNotes: [diagnosis, notes].filter(Boolean).join(' — ') || '—',
      status: visit.status || '—',
    };

    if (!matches([common.mrn, common.patientName, diagnosis, notes])) continue;
    if (isInpatient) {
      inpatientRecords.push({
        admissionDate: common.date,
        mrn: common.mrn,
        patientName: common.patientName,
        ageSex: common.ageSex,
        wardOrStatus: examination.disposition === 'Admit'
          ? 'Admitted · Ward not recorded'
          : `Inpatient · ${common.status}`,
        diagnosisNotes: common.diagnosisNotes,
      });
    } else {
      outpatientRecords.push(common);
    }
  }

  const referralRecords = logs
    .map((log) => {
      const visit = log.examinationVisitId || {};
      const patient = visit.patientRecordId || {};
      const diagnosis = log.diseaseHmisClassification || visit.diagnosis || visit.examination?.hmisDiagnosis || '';
      const reason = visit.examination?.referral?.reason || log.remark || diagnosis;
      return {
        date: log.date || null,
        mrn: patient.cardNumber || log.patientCardNumber || visit.patientId || '—',
        patientName: patient.fullName || visit.patientName || '—',
        referredTo: visit.examination?.referral?.department || log.referredOrAmbulanceDriver || '—',
        reasonSummary: reason || '—',
        status: log.patientCondition || 'Recorded',
        diagnosis,
      };
    })
    .filter((record) => matches([
      record.mrn,
      record.patientName,
      record.diagnosis,
      record.referredTo,
      record.reasonSummary,
    ]));

  return {
    data: {
      outpatientRecords,
      inpatientRecords,
      referralRecords,
      summary: {
        outpatient: outpatientRecords.length,
        inpatient: inpatientRecords.length,
        referralLogBook: referralRecords.length,
      },
    },
  };
};

export const getExaminationReports = async (req, res) => {
  const filters = {
    startDate: String(req.query.startDate || ''),
    endDate: String(req.query.endDate || ''),
    search: String(req.query.search || '').trim().slice(0, 120),
  };
  try {
    const result = await getFilteredReportData(filters);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Failed to load Examination Reports:', error);
    return res.status(500).json({ success: false, message: 'Unable to load Examination Reports.' });
  }
};

export const sendExaminationReportToClinicHead = async (req, res) => {
  const reportType = String(req.body?.reportType || '');
  if (!reportTypes.includes(reportType)) {
    return res.status(400).json({ success: false, message: 'Choose All, Outpatient, Inpatient, or Referral Log Book.' });
  }
  const filters = {
    startDate: String(req.body?.startDate || ''),
    endDate: String(req.body?.endDate || ''),
    search: String(req.body?.search || '').trim().slice(0, 120),
  };

  try {
    const result = await getFilteredReportData(filters);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    const { data } = result;
    const reportRecords = reportType === 'Outpatient'
      ? { outpatientRecords: data.outpatientRecords }
      : reportType === 'Inpatient'
        ? { inpatientRecords: data.inpatientRecords }
        : reportType === 'Referral Log Book'
          ? { referralRecords: data.referralRecords }
          : data;
    const reportDate = filters.endDate
      ? new Date(`${filters.endDate}T12:00:00+03:00`)
      : new Date();
    const report = await ClinicDepartmentReport.create({
      reportType: `Examination Report · ${reportType}`,
      periodType: filters.startDate && filters.startDate !== filters.endDate ? 'weekly' : 'daily',
      reportDate,
      periodStart: filters.startDate ? new Date(`${filters.startDate}T00:00:00+03:00`) : null,
      periodEnd: filters.endDate ? new Date(`${filters.endDate}T23:59:59.999+03:00`) : null,
      department: String(req.user?.department || '').trim() || 'Examination Room',
      title: `Examination Report - ${reportType}`,
      content: `Report sent to Clinic Head. Outpatients: ${data.summary.outpatient}; Inpatients: ${data.summary.inpatient}; Referral Log Book entries: ${data.summary.referralLogBook}.`,
      patientsServed: data.summary.outpatient + data.summary.inpatient,
      completedServices: data.summary.outpatient + data.summary.inpatient + data.summary.referralLogBook,
      submittedBy: req.user._id,
      submittedAt: new Date(),
      status: 'submitted',
      deliveryStatus: 'SENT',
      reportFilters: filters,
      reportSummary: data.summary,
      reportRecords,
      reviewHistory: [{
        action: 'submitted',
        status: 'submitted',
        actorId: req.user._id,
        actorName: req.user.name || req.user.username || 'Examination Room',
        actedAt: new Date(),
      }],
    });

    let warning = '';
    try {
      await notifyClinicHeads({
        batchId: `examination-report-submitted:${report._id}`,
        title: 'Examination report submitted',
        message: `${report.department} sent an Examination ${reportType} report.`,
        targetPath: '/clinic-head/department-reports',
        priority: 'high',
        notificationType: 'clinic_workflow',
      });
      req.app.get('io')?.emit('clinic:department-report-submitted', { reportId: String(report._id) });
    } catch (notificationError) {
      console.error('Examination report was saved, but Clinic Head notification failed:', notificationError);
      warning = 'The report was saved, but the Clinic Head notification could not be sent.';
    }

    return res.status(201).json({
      success: true,
      message: 'Report sent to the Clinic Head.',
      data: { id: report._id, status: report.deliveryStatus, submittedAt: report.submittedAt },
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    console.error('Failed to send Examination Report to Clinic Head:', error);
    return res.status(500).json({ success: false, message: 'Unable to send the report to the Clinic Head.' });
  }
};

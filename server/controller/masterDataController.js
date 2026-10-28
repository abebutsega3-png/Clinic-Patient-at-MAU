import mongoose from 'mongoose';
import Department from '../module/Department.js';
import MasterDataRecord from '../module/MasterDataRecord.js';
import { AuditLog } from '../module/AdminDashboardModels.js';
import { writeAuditEvent } from '../utils/auditLogger.js';
import { masterDataCategories, masterDataRecordCategories } from '../module/masterDataCatalog.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const departmentRequiredCategories = new Set(['service', 'lab_test']);
const categoryFields = {
  job_title: ['description', 'departmentId'],
  service: ['description', 'departmentId', 'durationMinutes'],
  patient_category: ['description'],
  visit_type: ['description'],
  priority: ['description'],
  queue_prefix: ['description'],
  queue_status: ['description'],
  medicine: ['description', 'strength', 'dosageForm', 'unit'],
  lab_test: ['description', 'departmentId'],
  unit: ['description'],
  campus_location: ['description', 'location'],
  academic_department: ['description', 'location'],
  referral_reason: ['description'],
  cancellation_reason: ['description'],
  reference_status: ['description'],
};

const addAuditEntry = (req, { entityType, entityId, action, changes = [], name }) => writeAuditEvent({
  req,
  action,
  entityType,
  entityId,
  changes,
  details: `${action.replaceAll('_', ' ')}: ${name}.`,
});

const validateAndNormalize = async (body, existingCategory = '') => {
  const category = existingCategory || body.category;
  if (!masterDataRecordCategories.has(category)) {
    return { error: 'Select a supported master data category.' };
  }
  if (typeof body.code !== 'string' || typeof body.name !== 'string') {
    return { error: 'Code and name are required.' };
  }

  const code = body.code.trim().toUpperCase();
  const name = body.name.trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) {
    return { error: 'Use a unique code with 2–40 letters, numbers, hyphens, or underscores.' };
  }
  if (name.length < 2 || name.length > 120) {
    return { error: 'Name must contain 2–120 characters.' };
  }
  if (body.status !== undefined && !['Active', 'Inactive'].includes(body.status)) {
    return { error: 'Status must be Active or Inactive.' };
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    return { error: 'Description must be a text value.' };
  }

  const normalized = {
    category,
    code,
    name,
    nameKey: name.toLowerCase(),
    description: typeof body.description === 'string' ? body.description.trim() : '',
    status: body.status || 'Active',
  };
  if (normalized.description.length > 1000) {
    return { error: 'Description cannot exceed 1000 characters.' };
  }
  for (const field of categoryFields[category]) {
    if (field === 'description' || field === 'durationMinutes') continue;
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return { error: `${field} must be a text value.` };
    }
    if (typeof body[field] === 'string') normalized[field] = body[field].trim();
    if (normalized[field] && normalized[field].length > 120) {
      return { error: `${field} cannot exceed 120 characters.` };
    }
  }

  if (category === 'service') {
    const duration = Number(body.durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      return { error: 'Estimated duration must be between 1 and 1440 minutes.' };
    }
    normalized.durationMinutes = duration;
  }

  if (category === 'medicine') {
    if (!normalized.strength || !normalized.dosageForm || !normalized.unit) {
      return { error: 'Medicine strength, dosage form, and catalog unit are required.' };
    }
    const unit = await MasterDataRecord.findOne({
      category: 'unit',
      status: 'Active',
      nameKey: normalized.unit.toLowerCase(),
    }).select('name').lean();
    if (!unit) return { error: 'Choose an active unit of measurement from the catalog.' };
    normalized.unit = unit.name;
  }

  if (departmentRequiredCategories.has(category) || (category === 'job_title' && normalized.departmentId)) {
    if (!mongoose.isValidObjectId(normalized.departmentId)) {
      return { error: 'Choose a valid department or unit.' };
    }
    const department = await Department.findOne({
      _id: normalized.departmentId,
      status: 'Active',
    }).select('name').lean();
    if (!department) return { error: 'Choose an active department or unit.' };
    normalized.departmentName = department.name;
  } else {
    normalized.departmentId = null;
    normalized.departmentName = '';
  }

  return { data: normalized };
};

const recordChanges = (before, after) => (
  Object.keys(after)
    .filter((field) => ['code', 'name', 'description', 'departmentName', 'location', 'durationMinutes', 'strength', 'dosageForm', 'unit', 'status'].includes(field))
    .filter((field) => String(before[field] ?? '') !== String(after[field] ?? ''))
    .map((field) => ({
      field,
      from: String(before[field] ?? ''),
      to: String(after[field] ?? ''),
    }))
);

export const getMasterData = async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (category && category !== 'all' && !masterDataCategories.some((item) => item.value === category)) {
      return res.status(400).json({ success: false, message: 'Select a supported category filter.' });
    }
    if (status && !['all', 'All Status', 'Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Select a supported status filter.' });
    }

    const recordFilter = {};
    if (category && category !== 'all' && category !== 'department') recordFilter.category = category;
    if (status && status !== 'all' && status !== 'All Status') recordFilter.status = status;
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      recordFilter.$or = [
        { name: expression },
        { code: expression },
        { description: expression },
        { departmentName: expression },
      ];
    }

    const departmentFilter = {};
    if (category && category !== 'all' && category !== 'department') {
      departmentFilter._id = null;
    }
    if (status && status !== 'all' && status !== 'All Status') departmentFilter.status = status;
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      departmentFilter.$or = [
        { name: expression },
        { code: expression },
        { description: expression },
        { location: expression },
      ];
    }

    const [records, departments, allDepartmentsCount, recordCounts, activeRecords, activeDepartments] = await Promise.all([
      category === 'department'
        ? Promise.resolve([])
        : MasterDataRecord.find(recordFilter).sort({ category: 1, name: 1 }).limit(2000).lean(),
      category && category !== 'all' && category !== 'department'
        ? Promise.resolve([])
        : Department.find(departmentFilter).sort({ name: 1 }).limit(1000).lean(),
      Department.countDocuments(),
      MasterDataRecord.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      MasterDataRecord.countDocuments({ status: 'Active' }),
      Department.countDocuments({ status: 'Active' }),
    ]);

    const departmentRows = departments.map((department) => ({
      ...department,
      category: 'department',
      recordType: 'department',
      departmentName: '',
    }));
    const recordRows = records.map((record) => ({ ...record, recordType: 'master_data' }));
    const data = [...departmentRows, ...recordRows];
    const counts = Object.fromEntries(recordCounts.map(({ _id, count }) => [_id, count]));
    const summary = {
      departments: allDepartmentsCount,
      jobTitles: counts.job_title || 0,
      services: counts.service || 0,
      patientCategories: counts.patient_category || 0,
      activeRecords: activeRecords + activeDepartments,
      totalRecords: allDepartmentsCount + Object.values(counts).reduce((total, count) => total + count, 0),
    };

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
      summary,
      categories: masterDataCategories,
    });
  } catch (error) {
    console.error('Failed to load master data:', error);
    return res.status(500).json({ success: false, message: 'Unable to load master data.' });
  }
};

export const getActiveMasterDataCatalog = async (req, res) => {
  const { category } = req.params;
  if (!masterDataCategories.some((item) => item.value === category)) {
    return res.status(400).json({ success: false, message: 'Select a supported master data category.' });
  }
  try {
    const data = category === 'department'
      ? await Department.find({ status: 'Active' })
        .select('name code description departmentType location status usesQueue')
        .sort({ name: 1 })
        .lean()
      : await MasterDataRecord.find({ category, status: 'Active' })
        .select('category code name description departmentId departmentName location durationMinutes strength dosageForm unit status')
        .sort({ name: 1 })
        .lean();
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Failed to load active master data catalog:', error);
    return res.status(500).json({ success: false, message: 'Unable to load the requested reference catalog.' });
  }
};

export const createMasterDataRecord = async (req, res) => {
  try {
    const validation = await validateAndNormalize(req.body || {});
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const record = await MasterDataRecord.create(validation.data);
    await addAuditEntry(req, {
      entityType: 'master_data',
      entityId: record._id,
      action: 'MASTER_DATA_CREATED',
      changes: Object.entries(validation.data)
        .filter(([field, value]) => (
          ['code', 'name', 'description', 'departmentName', 'location', 'durationMinutes', 'strength', 'dosageForm', 'unit', 'status'].includes(field)
          && value !== ''
          && value !== null
          && value !== undefined
        ))
        .map(([field, value]) => ({ field, from: '', to: String(value) })),
      name: record.name,
    });
    return res.status(201).json({ success: true, message: 'Master data record created.', data: { ...record.toObject(), recordType: 'master_data' } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A record with this code or name already exists in this category.' });
    console.error('Failed to create master data record:', error);
    return res.status(500).json({ success: false, message: 'Unable to create master data record.' });
  }
};

export const updateMasterDataRecord = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Master data record ID is invalid.' });
  }
  try {
    const record = await MasterDataRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Master data record not found.' });
    const validation = await validateAndNormalize({ ...req.body, category: record.category }, record.category);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const before = record.toObject();
    Object.assign(record, validation.data);
    const changes = recordChanges(before, validation.data);
    await record.save();
    if (changes.length) {
      await addAuditEntry(req, {
        entityType: 'master_data',
        entityId: record._id,
        action: 'MASTER_DATA_UPDATED',
        changes,
        name: record.name,
      });
    }
    return res.status(200).json({ success: true, message: 'Master data record updated.', data: { ...record.toObject(), recordType: 'master_data' } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A record with this code or name already exists in this category.' });
    console.error('Failed to update master data record:', error);
    return res.status(500).json({ success: false, message: 'Unable to update master data record.' });
  }
};

export const updateMasterDataStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Master data record ID is invalid.' });
  }
  const { status } = req.body || {};
  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be Active or Inactive.' });
  }
  try {
    const record = await MasterDataRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Master data record not found.' });
    if (record.status === status) {
      return res.status(200).json({ success: true, message: `Record is already ${status.toLowerCase()}.`, data: { ...record.toObject(), recordType: 'master_data' } });
    }
    const previousStatus = record.status;
    record.status = status;
    await record.save();
    await addAuditEntry(req, {
      entityType: 'master_data',
      entityId: record._id,
      action: 'MASTER_DATA_STATUS_CHANGED',
      changes: [{ field: 'status', from: previousStatus, to: status }],
      name: record.name,
    });
    return res.status(200).json({ success: true, message: `Record ${status.toLowerCase()} successfully.`, data: { ...record.toObject(), recordType: 'master_data' } });
  } catch (error) {
    console.error('Failed to update master data status:', error);
    return res.status(500).json({ success: false, message: 'Unable to update master data status.' });
  }
};

export const getMasterDataAuditHistory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Master data record ID is invalid.' });
  }
  const entityType = req.query.entityType === 'department' ? 'department' : 'master_data';
  try {
    const history = await AuditLog.find({ entityType, entityId: req.params.id })
      .select('userName action changes details createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Failed to load master data audit history:', error);
    return res.status(500).json({ success: false, message: 'Unable to load audit history.' });
  }
};

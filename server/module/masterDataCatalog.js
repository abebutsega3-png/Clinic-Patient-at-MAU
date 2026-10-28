import Department from './Department.js';
import MasterDataRecord from './MasterDataRecord.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

export const masterDataCategories = [
  { value: 'department', label: 'Departments / Units', group: 'Clinic setup' },
  { value: 'job_title', label: 'Staff Job Titles', group: 'Staff reference' },
  { value: 'service', label: 'Clinic Services', group: 'Clinic services' },
  { value: 'patient_category', label: 'Patient Categories', group: 'Patient flow' },
  { value: 'visit_type', label: 'Visit Types', group: 'Patient flow' },
  { value: 'priority', label: 'Queue Priorities', group: 'Queue configuration' },
  { value: 'queue_prefix', label: 'Queue Prefixes', group: 'Queue configuration' },
  { value: 'queue_status', label: 'Queue Statuses', group: 'Queue configuration' },
  { value: 'medicine', label: 'Medicine Catalog', group: 'Clinical catalogs' },
  { value: 'lab_test', label: 'Laboratory Test Catalog', group: 'Clinical catalogs' },
  { value: 'unit', label: 'Units of Measurement', group: 'Clinical catalogs' },
  { value: 'campus_location', label: 'Campus / Location', group: 'General reference' },
  { value: 'academic_department', label: 'Academic Departments', group: 'General reference' },
  { value: 'referral_reason', label: 'Referral Reasons', group: 'General reference' },
  { value: 'cancellation_reason', label: 'Cancellation Reasons', group: 'General reference' },
  { value: 'reference_status', label: 'Reference Statuses', group: 'General reference' },
];

const departmentDefaults = [
  { code: 'CARD', name: 'Card Room', departmentType: 'Clinical Care', usesQueue: true, entryPoint: true },
  { code: 'EXAM', name: 'Examination Room', departmentType: 'Clinical Care', usesQueue: true },
  { code: 'LAB', name: 'Laboratory Room', departmentType: 'Laboratory Services', usesQueue: true },
  { code: 'DISP', name: 'Dispensary Room', departmentType: 'Pharmacy Services', usesQueue: true },
  { code: 'DRUG', name: 'Drug Store', departmentType: 'Pharmacy Inventory' },
  { code: 'ER', name: 'Emergency Room', departmentType: 'Emergency Care', usesQueue: true, entryPoint: true },
  { code: 'INJ', name: 'Injection & Dressing Room', departmentType: 'Treatment / Nursing Services', usesQueue: true },
];

const catalogDefaults = [
  ...[
    ['DOCTOR', 'Doctor', 'EXAM', 'Clinical assessment and care.'],
    ['NURSE', 'Nurse', 'INJ', 'Nursing care and patient support.'],
    ['LAB-TECH', 'Laboratory Technician', 'LAB', 'Laboratory specimen and test support.'],
    ['PHARMACIST', 'Pharmacist', 'DISP', 'Medicine catalog and dispensing support.'],
    ['CARD-STAFF', 'Card Room Staff', 'CARD', 'Patient registration and card room support.'],
    ['CLINIC-HEAD', 'Clinic Head', '', 'Clinic operational oversight.'],
    ['ER-STAFF', 'Emergency Room Staff', 'ER', 'Emergency room patient flow support.'],
    ['DISP-STAFF', 'Dispensary Staff', 'DISP', 'Dispensary workflow support.'],
    ['SYS-ADMIN', 'System Administrator', '', 'System administration reference title.'],
  ].map(([code, name, departmentCode, description]) => ({
    category: 'job_title', code, name, description, defaultDepartmentCode: departmentCode,
  })),
  ...[
    ['MED-EXAM', 'Medical Examination', 'EXAM'],
    ['LAB-TEST', 'Laboratory Test', 'LAB'],
    ['INJECTION', 'Injection', 'INJ'],
    ['WOUND-DRESSING', 'Wound Dressing', 'INJ'],
    ['PRESC-DISP', 'Prescription & Dispensing', 'DISP'],
    ['EMERGENCY-CARE', 'Emergency Care', 'ER'],
  ].map(([code, name, departmentCode]) => ({
    category: 'service', code, name, description: `${name} clinic service.`, defaultDepartmentCode: departmentCode,
  })),
  ...[
    ['STUDENT', 'Student'],
    ['STAFF', 'Staff'],
    ['OTHER-AUTH', 'Other Authorized Patient'],
  ].map(([code, name]) => ({ category: 'patient_category', code, name })),
  ...[
    ['NEW', 'New Visit'],
    ['FOLLOW-UP', 'Follow-up Visit'],
    ['EMERGENCY', 'Emergency Visit'],
  ].map(([code, name]) => ({ category: 'visit_type', code, name })),
  ...[
    ['NORMAL', 'Normal'],
    ['URGENT', 'Urgent'],
    ['EMERGENCY', 'Emergency'],
  ].map(([code, name]) => ({ category: 'priority', code, name })),
  ...[
    ['CARD', 'CARD'],
    ['EXAM', 'EXAM'],
    ['LAB', 'LAB'],
    ['ER', 'ER'],
    ['DISP', 'DISP'],
    ['INJ', 'INJ'],
  ].map(([code, name]) => ({ category: 'queue_prefix', code, name })),
  ...[
    ['WAITING', 'Waiting'],
    ['CALLED', 'Called'],
    ['IN-SERVICE', 'In Service'],
    ['COMPLETED', 'Completed'],
    ['CANCELLED', 'Cancelled'],
    ['NO-SHOW', 'No-show'],
  ].map(([code, name]) => ({ category: 'queue_status', code, name })),
  ...[
    ['TABLET', 'tablet'],
    ['CAPSULE', 'capsule'],
    ['ML', 'ml'],
    ['MG', 'mg'],
    ['GRAM', 'g'],
    ['LITER', 'liter'],
    ['VIAL', 'vial'],
    ['AMPOULE', 'ampoule'],
    ['PIECE', 'piece'],
  ].map(([code, name]) => ({ category: 'unit', code, name })),
  ...[
    ['CAMPUS-MAU', 'Mekdela Amba University'],
  ].map(([code, name]) => ({ category: 'campus_location', code, name })),
  ...[
    ['REF-CLINICAL', 'Clinical assessment required'],
    ['REF-SPECIALIST', 'Specialist consultation required'],
    ['REF-DIAGNOSTIC', 'Further diagnostic evaluation required'],
  ].map(([code, name]) => ({ category: 'referral_reason', code, name })),
  ...[
    ['CANCEL-REQUEST', 'Patient request'],
    ['CANCEL-DUPLICATE', 'Duplicate registration'],
    ['CANCEL-UNAVAILABLE', 'Service unavailable'],
  ].map(([code, name]) => ({ category: 'cancellation_reason', code, name })),
  ...[
    ['ACTIVE', 'Active'],
    ['INACTIVE', 'Inactive'],
  ].map(([code, name]) => ({ category: 'reference_status', code, name })),
];

export const seedMasterDataDefaults = async () => {
  for (const department of departmentDefaults) {
    const existing = await Department.findOne({
      $or: [
        { code: department.code },
        { name: new RegExp(`^${department.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    }).select('_id');
    if (!existing) {
      const created = await Department.create({ ...department, status: 'Active' });
      await writeAuditEvent({
        action: 'DEPARTMENT_SEEDED',
        details: `Initial department reference created: ${created.name} (${created.code}).`,
        entityType: 'department',
        entityId: created._id,
        actorName: 'System Setup',
        actorRole: 'System',
        changes: [
          { field: 'name', from: '', to: created.name },
          { field: 'code', from: '', to: created.code },
          { field: 'status', from: '', to: created.status },
        ],
      });
    }
  }

  const departments = await Department.find({ status: 'Active' }).select('_id code name').lean();
  const departmentsByCode = new Map(departments.map((department) => [department.code.toUpperCase(), department]));
  const departmentsByName = new Map(departments.map((department) => [department.name.trim().toLowerCase(), department]));
  const departmentNamesByCode = new Map(departmentDefaults.map(({ code, name }) => [code, name.toLowerCase()]));

  for (const record of catalogDefaults) {
    const exists = await MasterDataRecord.exists({ category: record.category, code: record.code });
    if (exists) continue;

    const defaultDepartmentName = departmentNamesByCode.get(record.defaultDepartmentCode);
    const department = departmentsByCode.get(record.defaultDepartmentCode)
      || (defaultDepartmentName ? departmentsByName.get(defaultDepartmentName) : null);
    const { defaultDepartmentCode, defaultDepartment, ...data } = record;
    const created = await MasterDataRecord.create({
      ...data,
      departmentId: department?._id || null,
      departmentName: department?.name || '',
      nameKey: data.name.toLowerCase(),
      status: 'Active',
      isSeeded: true,
    });
    await writeAuditEvent({
      action: 'MASTER_DATA_SEEDED',
      details: `Initial ${created.category} reference created: ${created.name} (${created.code}).`,
      entityType: 'master_data',
      entityId: created._id,
      actorName: 'System Setup',
      actorRole: 'System',
      changes: [
        { field: 'name', from: '', to: created.name },
        { field: 'code', from: '', to: created.code },
        { field: 'status', from: '', to: created.status },
      ],
    });
  }
};

export const masterDataRecordCategories = new Set(
  masterDataCategories.map(({ value }) => value).filter((value) => value !== 'department'),
);

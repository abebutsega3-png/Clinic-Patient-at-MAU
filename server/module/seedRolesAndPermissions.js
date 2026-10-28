import RolePermission from './RolePermission.js';

export const allClinicPermissions = [
  'dashboard:view',
  'patients:view', 'patients:create', 'patients:edit',
  'visits_queue:view', 'visits_queue:create', 'visits_queue:send', 'visits_queue:process',
  'department_routing:view', 'department_routing:send', 'department_routing:process',
  'departments_overview:view',
  'clinical_records:view', 'clinical_records:create', 'clinical_records:edit',
  'emergency_care:view', 'emergency_care:create', 'emergency_care:edit', 'emergency_care:process',
  'prescriptions:view', 'prescriptions:create', 'prescriptions:edit',
  'referrals:view', 'referrals:create', 'referrals:edit', 'referrals:export',
  'lab_requests:view', 'lab_requests:create',
  'lab_results:view', 'lab_results:create', 'lab_results:edit', 'lab_results:process',
  'dispensing:view', 'dispensing:create', 'dispensing:process',
  'pharmacy_stock:view', 'pharmacy_stock:create', 'pharmacy_stock:edit', 'pharmacy_stock:process',
  'injection_dressing:view', 'injection_dressing:create', 'injection_dressing:process',
  'reports:own:view', 'reports:own:export', 'reports:all:view', 'reports:all:export',
  'users:view', 'users:create', 'users:edit', 'users:delete',
  'roles:view', 'roles:create', 'roles:edit', 'roles:delete',
  'departments:view', 'departments:create', 'departments:edit', 'departments:delete',
  'master_data:view', 'master_data:create', 'master_data:edit', 'master_data:delete',
  'audit_logs:view', 'audit_logs:export',
  'system_settings:view', 'system_settings:edit', 'system_settings:process',
];

export const defaultRolesAndPermissions = [
  {
    roleName: 'Admin',
    displayName: 'System Admin',
    description: 'Manages system accounts, roles, clinic configuration, reports, and audit logs without access to clinical details.',
    responsibilities: 'Manages users, roles, departments, master data, settings, backups, and system audit logs.',
    reports: 'All-department reports and audit exports; no clinical records, prescriptions, lab results, or patient treatment details.',
    isLocked: true,
    permissions: [
      'dashboard:view',
      'patients:view',
      'pharmacy_stock:view',
      'reports:all:view', 'reports:all:export',
      'users:view', 'users:create', 'users:edit', 'users:delete',
      'roles:view', 'roles:create', 'roles:edit', 'roles:delete',
      'departments:view', 'departments:create', 'departments:edit', 'departments:delete',
      'master_data:view', 'master_data:create', 'master_data:edit', 'master_data:delete',
      'audit_logs:view', 'audit_logs:export',
      'system_settings:view', 'system_settings:edit', 'system_settings:process',
    ],
  },
  {
    roleName: 'Clinic Head',
    displayName: 'Clinic Student Head',
    description: 'Oversees clinic units and reviews consolidated clinic reports.',
    responsibilities: 'Monitors departments, queue totals, pharmacy stock, and consolidated reports without viewing individual clinical records.',
    reports: 'All-department reports and summary exports.',
    isLocked: true,
    permissions: [
      'dashboard:view',
      'departments:view',
      'departments_overview:view',
      'visits_queue:view',
      'pharmacy_stock:view',
      'reports:all:view', 'reports:all:export',
      'audit_logs:view',
    ],
  },
  {
    roleName: 'Card Chief',
    displayName: 'Card Room Staff',
    description: 'Registers patients, opens patient cards, and routes arrivals to the correct clinic unit.',
    responsibilities: 'Registers patients, edits basic patient details, and sends arrivals to examination or emergency.',
    reports: 'Own-department reports and exports.',
    isLocked: false,
    permissions: [
      'dashboard:view',
      'patients:view', 'patients:create', 'patients:edit',
      'visits_queue:view', 'visits_queue:create', 'visits_queue:send',
      'department_routing:view', 'department_routing:send',
      'reports:own:view', 'reports:own:export',
    ],
  },
  {
    roleName: 'Doctor',
    displayName: 'Medical Doctor',
    description: 'Examines patients and records diagnoses, prescriptions, laboratory requests, referrals, and ordered services.',
    responsibilities: 'Reviews patient records, diagnoses and treats patients, and requests laboratory and injection/dressing services.',
    reports: 'Own-department reports and exports.',
    isLocked: false,
    permissions: [
      'dashboard:view',
      'patients:view',
      'visits_queue:view', 'visits_queue:send',
      'department_routing:view', 'department_routing:send',
      'clinical_records:view', 'clinical_records:create', 'clinical_records:edit',
      'prescriptions:view', 'prescriptions:create', 'prescriptions:edit',
      'lab_requests:view', 'lab_requests:create',
      'lab_results:view',
      'injection_dressing:view', 'injection_dressing:create',
      'referrals:view', 'referrals:create',
      'reports:own:view', 'reports:own:export',
    ],
  },
  {
    roleName: 'Lab Technician',
    displayName: 'Laboratory Technician',
    description: 'Reviews laboratory requests, processes samples, and records results for the ordering clinician.',
    responsibilities: 'Views basic patient details and lab requests, enters and processes results, and returns results to clinicians.',
    reports: 'Own-department reports and exports.',
    isLocked: false,
    permissions: [
      'dashboard:view',
      'patients:view',
      'visits_queue:view', 'visits_queue:send',
      'lab_requests:view',
      'lab_results:view', 'lab_results:create', 'lab_results:edit', 'lab_results:process',
      'reports:own:view', 'reports:own:export',
    ],
  },
  {
    roleName: 'Pharmacist',
    displayName: 'Dispensary Pharmacist',
    description: 'Dispenses medicines only against valid prescriptions.',
    responsibilities: 'Views prescriptions, dispenses prescribed medicines, and checks pharmacy stock without editing prescriptions.',
    reports: 'Own-department reports and exports.',
    isLocked: false,
    permissions: [
      'dashboard:view',
      'patients:view',
      'visits_queue:view', 'visits_queue:send',
      'prescriptions:view',
      'dispensing:view', 'dispensing:create', 'dispensing:process',
      'pharmacy_stock:view',
      'reports:own:view', 'reports:own:export',
    ],
  },
  {
    roleName: 'Drug Store Manager',
    displayName: 'Drug Store Officer',
    description: 'Receives and manages medicine stock and issues stock to the dispensary.',
    responsibilities: 'Receives, issues, and adjusts stock; views dispensary requests without patient or queue access.',
    reports: 'Own-department reports and exports.',
    isLocked: false,
    permissions: [
      'dashboard:view',
      'pharmacy_stock:view', 'pharmacy_stock:create', 'pharmacy_stock:edit', 'pharmacy_stock:process',
      'dispensing:view',
      'reports:own:view', 'reports:own:export',
    ],
  },
  {
    roleName: 'Nurse',
    displayName: 'Injection & Dressing Nurse',
    description: 'Provides and records clinician-ordered injection and dressing services.',
    responsibilities: 'Views patient and visit details, routes visits, and processes ordered injection and dressing care.',
    reports: 'Own-department reports and exports.',
    isLocked: false,
    permissions: [
      'dashboard:view',
      'patients:view',
      'visits_queue:view', 'visits_queue:send',
      'injection_dressing:view', 'injection_dressing:process',
      'reports:own:view', 'reports:own:export',
    ],
  },
  {
    roleName: 'Emergency Staff',
    displayName: 'Emergency Room Staff',
    description: 'Registers emergency patients, provides urgent care, and coordinates laboratory work and referrals.',
    responsibilities: 'Performs emergency patient registration, clinical documentation, orders, treatment, and referral work.',
    reports: 'Own-department reports and exports.',
    isLocked: false,
    permissions: [
      'dashboard:view',
      'patients:view', 'patients:create', 'patients:edit',
      'visits_queue:view', 'visits_queue:create', 'visits_queue:send', 'visits_queue:process',
      'department_routing:view', 'department_routing:send', 'department_routing:process',
      'clinical_records:view', 'clinical_records:create', 'clinical_records:edit',
      'emergency_care:view', 'emergency_care:create', 'emergency_care:edit', 'emergency_care:process',
      'prescriptions:view', 'prescriptions:create',
      'lab_requests:view', 'lab_requests:create',
      'lab_results:view',
      'injection_dressing:view', 'injection_dressing:create',
      'referrals:view', 'referrals:create', 'referrals:edit', 'referrals:export',
      'reports:own:view', 'reports:own:export',
    ],
  },
];

export const getDefaultRolePermissions = (roleName) => (
  defaultRolesAndPermissions.find((role) => role.roleName === roleName) || null
);

const legacyPermissionKeys = new Set([
  'patients:register', 'patients:search', 'patients:edit_basic', 'history:view',
  'diagnosis:write', 'prescription:write', 'prescription:view', 'referral:write',
  'lab:request', 'lab:view', 'lab:result_write', 'lab:result_view',
  'medicine:dispense', 'stock:view', 'stock:receive', 'stock:issue', 'stock:adjust',
  'service:order', 'service:view', 'service:record', 'queue:view', 'queue:send',
  'queue:configure', 'reports:own', 'reports:all', 'users:manage', 'roles:manage',
  'departments:manage', 'master_data:manage', 'audit:view', 'settings:manage',
]);

export const seedRolesAndPermissions = async () => {
  for (const roleData of defaultRolesAndPermissions) {
    const { responsibilities, reports, ...roleDefaults } = roleData;
    const existingRole = await RolePermission.findOne({ roleName: roleData.roleName })
      .select('permissions')
      .lean();
    if (existingRole?.permissions?.some((permission) => legacyPermissionKeys.has(permission))) {
      await RolePermission.updateOne(
        { roleName: roleData.roleName },
        { $set: { permissions: roleData.permissions } },
      );
    }
    await RolePermission.findOneAndUpdate(
      { roleName: roleData.roleName },
      {
        $setOnInsert: roleDefaults,
        $set: { responsibilities, reports },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  await RolePermission.updateOne(
    { roleName: 'Card Chief' },
    {
      $addToSet: {
        permissions: {
          $each: [
            'dashboard:view',
            'patients:view', 'patients:create', 'patients:edit',
            'reports:own:view', 'reports:own:export',
          ],
        },
      },
    },
  );
  console.log('Roles and permissions are ready.');
};

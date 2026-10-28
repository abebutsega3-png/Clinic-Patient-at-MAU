import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Ambulance,
  ClipboardList,
  Copy,
  Database,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  MoreVertical,
  Package,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const permissionModules = [
  {
    name: 'General',
    rows: [
      { name: 'Dashboard', cells: { View: 'dashboard:view' } },
    ],
  },
  {
    name: 'Patient care',
    rows: [
      { name: 'Patients', cells: { View: 'patients:view', Create: 'patients:create', Edit: 'patients:edit' } },
      { name: 'Visits & Queue', cells: { View: 'visits_queue:view', Create: 'visits_queue:create', Send: 'visits_queue:send', Process: 'visits_queue:process' } },
      { name: 'Department Routing', cells: { View: 'department_routing:view', Send: 'department_routing:send', Process: 'department_routing:process' } },
      { name: 'Department Overview', cells: { View: 'departments_overview:view' } },
      { name: 'Clinical Records', clinical: true, cells: { View: 'clinical_records:view', Create: 'clinical_records:create', Edit: 'clinical_records:edit' } },
      { name: 'Prescriptions', clinical: true, cells: { View: 'prescriptions:view', Create: 'prescriptions:create', Edit: 'prescriptions:edit' } },
      { name: 'Referrals', cells: { View: 'referrals:view', Create: 'referrals:create', Edit: 'referrals:edit', Export: 'referrals:export' } },
    ],
  },
  {
    name: 'Emergency Care',
    rows: [
      { name: 'Emergency Care', clinical: true, cells: { View: 'emergency_care:view', Create: 'emergency_care:create', Edit: 'emergency_care:edit', Process: 'emergency_care:process' } },
    ],
  },
  {
    name: 'Laboratory',
    rows: [
      { name: 'Lab Requests', cells: { View: 'lab_requests:view', Create: 'lab_requests:create' } },
      { name: 'Lab Results', clinical: true, cells: { View: 'lab_results:view', Create: 'lab_results:create', Edit: 'lab_results:edit', Process: 'lab_results:process' } },
    ],
  },
  {
    name: 'Pharmacy',
    rows: [
      { name: 'Dispensing', cells: { View: 'dispensing:view', Create: 'dispensing:create', Process: 'dispensing:process' } },
      { name: 'Pharmacy Stock', cells: { View: 'pharmacy_stock:view', Create: 'pharmacy_stock:create', Edit: 'pharmacy_stock:edit', Process: 'pharmacy_stock:process' } },
    ],
  },
  {
    name: 'Services',
    rows: [
      { name: 'Injection/Dressing', cells: { View: 'injection_dressing:view', Create: 'injection_dressing:create', Process: 'injection_dressing:process' } },
    ],
  },
  {
    name: 'Reporting',
    rows: [
      {
        name: 'Reports',
        cells: { View: 'reports:own:view', Export: 'reports:own:export' },
        adminCells: { View: 'reports:all:view', Export: 'reports:all:export' },
      },
    ],
  },
  {
    name: 'System (Admin only)',
    adminOnly: true,
    rows: [
      { name: 'Users', cells: { View: 'users:view', Create: 'users:create', Edit: 'users:edit', Delete: 'users:delete' } },
      { name: 'Roles & Permissions', cells: { View: 'roles:view', Create: 'roles:create', Edit: 'roles:edit', Delete: 'roles:delete' } },
      { name: 'Departments/Units', cells: { View: 'departments:view', Create: 'departments:create', Edit: 'departments:edit', Delete: 'departments:delete' } },
      { name: 'Master Data', cells: { View: 'master_data:view', Create: 'master_data:create', Edit: 'master_data:edit', Delete: 'master_data:delete' } },
      { name: 'Audit Logs', cells: { View: 'audit_logs:view', Export: 'audit_logs:export' } },
      { name: 'System Settings', cells: { View: 'system_settings:view', Edit: 'system_settings:edit', Process: 'system_settings:process' } },
    ],
  },
];

const permissionColumns = ['View', 'Create', 'Edit', 'Delete', 'Send', 'Process', 'Export'];
const clinicalDeleteRows = new Set(['Clinical Records', 'Prescriptions', 'Lab Results']);
const normalizeRoleCode = (value) => value.trim().toUpperCase().replace(/[\s-]+/g, '_');
const roleTileConfig = [
  { roleName: 'Card Chief', title: 'Card Room', icon: UserRound, color: 'bg-sky-500' },
  { roleName: 'Doctor', title: 'Examination Room (Doctor)', icon: Stethoscope, color: 'bg-teal-600' },
  { roleName: 'Lab Technician', title: 'Laboratory Room', icon: FlaskConical, color: 'bg-violet-600' },
  { roleName: 'Pharmacist', title: 'Dispensary Room', icon: Pill, color: 'bg-orange-500' },
  { roleName: 'Drug Store Manager', title: 'Drug Store', icon: Package, color: 'bg-cyan-600' },
  { roleName: 'Nurse', title: 'Injection & Dressing Room', icon: Syringe, color: 'bg-pink-500' },
  { roleName: 'Emergency Staff', title: 'Emergency Room', icon: Ambulance, color: 'bg-rose-600' },
  { roleName: 'Clinic Head', title: 'Student Head', icon: GraduationCap, color: 'bg-blue-700' },
  { roleName: 'Admin', title: 'System Admin', icon: ShieldCheck, color: 'bg-slate-600' },
];
const newRoleTemplates = [
  { title: 'Card Room Staff', permissionRole: 'card room', icon: UserRound, color: 'bg-sky-500' },
  { title: 'Examination Room / Doctor', permissionRole: 'examination room', icon: Stethoscope, color: 'bg-teal-600' },
  { title: 'Laboratory Room Staff', permissionRole: 'laboratory room', icon: FlaskConical, color: 'bg-violet-600' },
  { title: 'Dispensary Room Staff', permissionRole: 'dispensary room', icon: Pill, color: 'bg-orange-500' },
  { title: 'Drug Store Staff', permissionRole: 'drug store', icon: Package, color: 'bg-cyan-600' },
  { title: 'Injection & Dressing Room Staff', permissionRole: 'injection & dressing room', icon: Syringe, color: 'bg-pink-500' },
  { title: 'Emergency Room Staff', permissionRole: 'emergency room', icon: Ambulance, color: 'bg-rose-600' },
  { title: 'Clinic Student Head', permissionRole: 'clinic student head', icon: GraduationCap, color: 'bg-blue-700' },
];
const rolePermissionDefaults = {
  'card room': [
    'dashboard:view',
    'patients:view', 'patients:create', 'patients:edit',
    'visits_queue:view', 'visits_queue:create', 'visits_queue:send',
    'reports:own:view', 'reports:own:export',
  ],
  'card chief': [
    'dashboard:view',
    'patients:view', 'patients:create', 'patients:edit',
    'visits_queue:view', 'visits_queue:create', 'visits_queue:send',
    'reports:own:view', 'reports:own:export',
  ],
  'examination room': [
    'dashboard:view', 'patients:view',
    'visits_queue:view', 'visits_queue:send',
    'clinical_records:view', 'clinical_records:create', 'clinical_records:edit',
    'prescriptions:view', 'prescriptions:create', 'prescriptions:edit',
    'lab_requests:view', 'lab_requests:create', 'lab_results:view',
    'injection_dressing:view', 'injection_dressing:create',
    'referrals:view', 'referrals:create',
    'reports:own:view', 'reports:own:export',
  ],
  doctor: [
    'dashboard:view', 'patients:view',
    'visits_queue:view', 'visits_queue:send',
    'clinical_records:view', 'clinical_records:create', 'clinical_records:edit',
    'prescriptions:view', 'prescriptions:create', 'prescriptions:edit',
    'lab_requests:view', 'lab_requests:create', 'lab_results:view',
    'injection_dressing:view', 'injection_dressing:create',
    'referrals:view', 'referrals:create',
    'reports:own:view', 'reports:own:export',
  ],
  'laboratory room': [
    'dashboard:view', 'patients:view', 'visits_queue:view', 'visits_queue:send',
    'lab_requests:view',
    'lab_results:view', 'lab_results:create', 'lab_results:edit', 'lab_results:process',
    'reports:own:view', 'reports:own:export',
  ],
  'lab technician': [
    'dashboard:view', 'patients:view', 'visits_queue:view', 'visits_queue:send',
    'lab_requests:view',
    'lab_results:view', 'lab_results:create', 'lab_results:edit', 'lab_results:process',
    'reports:own:view', 'reports:own:export',
  ],
  'dispensary room': [
    'dashboard:view', 'patients:view', 'visits_queue:view', 'visits_queue:send',
    'prescriptions:view',
    'dispensing:view', 'dispensing:create', 'dispensing:process',
    'pharmacy_stock:view', 'reports:own:view', 'reports:own:export',
  ],
  pharmacist: [
    'dashboard:view', 'patients:view', 'visits_queue:view', 'visits_queue:send',
    'prescriptions:view',
    'dispensing:view', 'dispensing:create', 'dispensing:process',
    'pharmacy_stock:view', 'reports:own:view', 'reports:own:export',
  ],
  'drug store': [
    'dashboard:view', 'pharmacy_stock:view', 'pharmacy_stock:create',
    'pharmacy_stock:edit', 'pharmacy_stock:process', 'dispensing:view',
    'reports:own:view', 'reports:own:export',
  ],
  'drug store manager': [
    'dashboard:view', 'pharmacy_stock:view', 'pharmacy_stock:create',
    'pharmacy_stock:edit', 'pharmacy_stock:process', 'dispensing:view',
    'reports:own:view', 'reports:own:export',
  ],
  'injection & dressing room': [
    'dashboard:view', 'patients:view', 'visits_queue:view', 'visits_queue:send',
    'injection_dressing:view', 'injection_dressing:process',
    'reports:own:view', 'reports:own:export',
  ],
  nurse: [
    'dashboard:view', 'patients:view', 'visits_queue:view', 'visits_queue:send',
    'injection_dressing:view', 'injection_dressing:process',
    'reports:own:view', 'reports:own:export',
  ],
  'emergency room': [
    'dashboard:view',
    'patients:view', 'patients:create', 'patients:edit',
    'visits_queue:view', 'visits_queue:create', 'visits_queue:send', 'visits_queue:process',
    'clinical_records:view', 'clinical_records:create', 'clinical_records:edit',
    'prescriptions:view', 'prescriptions:create',
    'lab_requests:view', 'lab_requests:create', 'lab_results:view',
    'injection_dressing:view', 'injection_dressing:create',
    'referrals:view', 'referrals:create', 'referrals:edit', 'referrals:export',
    'reports:own:view', 'reports:own:export',
  ],
  'emergency staff': [
    'dashboard:view',
    'patients:view', 'patients:create', 'patients:edit',
    'visits_queue:view', 'visits_queue:create', 'visits_queue:send', 'visits_queue:process',
    'clinical_records:view', 'clinical_records:create', 'clinical_records:edit',
    'prescriptions:view', 'prescriptions:create',
    'lab_requests:view', 'lab_requests:create', 'lab_results:view',
    'injection_dressing:view', 'injection_dressing:create',
    'referrals:view', 'referrals:create', 'referrals:edit', 'referrals:export',
    'reports:own:view', 'reports:own:export',
  ],
  'clinic student head': [
    'dashboard:view', 'departments:view', 'visits_queue:view', 'pharmacy_stock:view',
    'reports:all:view', 'reports:all:export', 'audit_logs:view',
  ],
  'clinic head': [
    'dashboard:view', 'departments:view', 'visits_queue:view', 'pharmacy_stock:view',
    'reports:all:view', 'reports:all:export', 'audit_logs:view',
  ],
  'student head': [
    'dashboard:view', 'departments:view', 'visits_queue:view', 'pharmacy_stock:view',
    'reports:all:view', 'reports:all:export', 'audit_logs:view',
  ],
  'system admin': [
    'dashboard:view', 'patients:view', 'pharmacy_stock:view',
    'reports:all:view', 'reports:all:export',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'roles:view', 'roles:create', 'roles:edit', 'roles:delete',
    'departments:view', 'departments:create', 'departments:edit', 'departments:delete',
    'master_data:view', 'master_data:create', 'master_data:edit', 'master_data:delete',
    'audit_logs:view', 'audit_logs:export',
    'system_settings:view', 'system_settings:edit', 'system_settings:process',
  ],
  admin: [
    'dashboard:view', 'patients:view', 'pharmacy_stock:view',
    'reports:all:view', 'reports:all:export',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'roles:view', 'roles:create', 'roles:edit', 'roles:delete',
    'departments:view', 'departments:create', 'departments:edit', 'departments:delete',
    'master_data:view', 'master_data:create', 'master_data:edit', 'master_data:delete',
    'audit_logs:view', 'audit_logs:export',
    'system_settings:view', 'system_settings:edit', 'system_settings:process',
  ],
};
const permissionsForRoleName = (name) => (
  rolePermissionDefaults[name.trim().toLowerCase()]
  || Object.entries(rolePermissionDefaults).find(([roleName]) => (
    name.trim().toLowerCase().includes(roleName)
  ))?.[1]
  || []
);
const permissionsForNewRoleTemplate = (template) => {
  const permissions = permissionsForRoleName(template.permissionRole)
    .filter((permission) => (
      permission !== 'departments:view'
      && !permission.startsWith('reports:all:')
      && !['users', 'roles', 'departments', 'master_data', 'audit_logs', 'system_settings']
        .includes(permission.split(':')[0])
    ));
  if (template.permissionRole === 'clinic student head') {
    permissions.push('departments_overview:view', 'reports:own:view', 'reports:own:export');
  }
  const additionalPermissions = {
    'card room': ['department_routing:view', 'department_routing:send'],
    'examination room': ['department_routing:view', 'department_routing:send', 'emergency_care:view'],
    'emergency room': [
      'department_routing:view', 'department_routing:send', 'department_routing:process',
      'emergency_care:view', 'emergency_care:create', 'emergency_care:edit', 'emergency_care:process',
    ],
  }[template.permissionRole] || [];
  return [...new Set([...permissions, ...additionalPermissions])];
};
const roleWorkflowGuides = [
  {
    name: 'Card room',
    matches: ['card room', 'card chief', 'registration'],
    access: 'Dashboard: View. Patients: View, Create, Edit. Visits & Queue: View, Create, Send. Own Reports: View, Export.',
    note: 'Registers basic patient details and routes patients to Examination or Emergency. Do not grant Clinical Records, Prescriptions, or Lab Results.',
  },
  {
    name: 'Examination room (Doctor)',
    matches: ['doctor', 'examination', 'exam room'],
    access: 'Dashboard: View. Patients: View. Visits & Queue: View, Send. Clinical Records and Prescriptions: View, Create, Edit. Lab Requests: View, Create. Lab Results: View only. Injection/Dressing: View, Create. Referrals: View, Create. Own Reports: View, Export.',
    note: 'Can diagnose, prescribe, request tests and ordered services. Do not grant Create or Edit on Lab Results.',
  },
  {
    name: 'Laboratory room',
    matches: ['laboratory', 'lab technician', 'lab room'],
    access: 'Dashboard: View. Patients: View (basic details). Visits & Queue: View, Send. Lab Requests: View. Lab Results: View, Create, Edit, Process. Own Reports: View, Export.',
    note: 'Processes test requests, records results and returns them to the clinician. Do not grant Clinical Records or Prescriptions.',
  },
  {
    name: 'Dispensary room',
    matches: ['dispensary', 'pharmacist'],
    access: 'Dashboard: View. Patients: View. Visits & Queue: View, Send. Prescriptions: View only. Dispensing: View, Create, Process. Pharmacy Stock: View. Own Reports: View, Export.',
    note: 'Dispense against an existing prescription only. Do not grant Create or Edit on Prescriptions.',
  },
  {
    name: 'Drug store',
    matches: ['drug store', 'drug-store', 'store manager'],
    access: 'Dashboard: View. Pharmacy Stock: View, Create, Edit, Process. Dispensing: View. Own Reports: View, Export.',
    note: 'Manages stock and sees dispensary requests. Do not grant Patients or Visits & Queue.',
  },
  {
    name: 'Injection & Dressing room',
    matches: ['injection', 'dressing', 'nurse'],
    access: 'Dashboard: View. Patients: View. Visits & Queue: View, Send. Injection/Dressing: View, Process. Own Reports: View, Export.',
    note: 'Records completion of clinician-ordered care. Do not grant Create for ordering services.',
  },
  {
    name: 'Emergency room',
    matches: ['emergency'],
    access: 'Dashboard: View. Patients: View, Create, Edit. Visits & Queue: View, Create, Send, Process. Clinical Records: View, Create, Edit. Prescriptions: View, Create. Lab Requests: View, Create. Lab Results: View only. Injection/Dressing: View, Create. Referrals: View, Create, Edit, Export. Own Reports: View, Export.',
    note: 'Supports urgent registration and most clinician workflows. Lab Results remain read-only; only lab staff enter or process results.',
  },
  {
    name: 'Clinic Student Head',
    matches: ['clinic student head', 'clinic head', 'student head'],
    access: 'Dashboard: View. Departments/Units: View. Visits & Queue: View (totals). Pharmacy Stock: View. All-department Reports: View, Export. Audit Logs: View.',
    note: 'Read-only oversight. Do not grant patient-level clinical access or Create, Edit, Send, or Process actions.',
  },
  {
    name: 'System Admin',
    matches: ['system admin', 'admin'],
    access: 'Dashboard: View. Patients: View (basic details). Pharmacy Stock: View. All-department Reports and Audit Logs: View, Export. Users, Roles, Departments, Master Data: View, Create, Edit, Delete. System Settings: View, Edit, Process.',
    note: 'System access only. Clinical Records, Prescriptions, Lab Results, referrals and treatment/queue workflows are blocked to protect patient privacy.',
  },
];
const validPermissionKeys = new Set(
  permissionModules.flatMap((module) => module.rows.flatMap(({ cells, adminCells }) => (
    [...Object.values(cells), ...Object.values(adminCells || {})]
  ))),
);
const adminRestrictedModules = new Set([
  'Visits & Queue',
  'Department Routing',
  'Clinical Records',
  'Prescriptions',
  'Referrals',
  'Lab Requests',
  'Lab Results',
  'Emergency Care',
  'Dispensing',
  'Injection/Dressing',
]);

const legacyPermissionMap = {
  'patients:register': ['patients:create'],
  'patients:search': ['patients:view'],
  'patients:edit_basic': ['patients:edit'],
  'history:view': ['clinical_records:view'],
  'diagnosis:write': ['clinical_records:create'],
  'prescription:write': ['prescriptions:create'],
  'prescription:view': ['prescriptions:view'],
  'referral:write': ['referrals:create'],
  'lab:request': ['lab_requests:view', 'lab_requests:create'],
  'lab:view': ['lab_requests:view'],
  'lab:result_write': ['lab_results:view', 'lab_results:create', 'lab_results:edit', 'lab_results:process'],
  'lab:result_view': ['lab_results:view'],
  'medicine:dispense': ['dispensing:view', 'dispensing:create', 'dispensing:process'],
  'stock:view': ['pharmacy_stock:view'],
  'stock:receive': ['pharmacy_stock:view', 'pharmacy_stock:create'],
  'stock:issue': ['pharmacy_stock:view', 'pharmacy_stock:process'],
  'stock:adjust': ['pharmacy_stock:view', 'pharmacy_stock:edit'],
  'service:order': ['injection_dressing:view', 'injection_dressing:create'],
  'service:view': ['injection_dressing:view'],
  'service:record': ['injection_dressing:view', 'injection_dressing:process'],
  'queue:view': ['visits_queue:view'],
  'queue:send': ['visits_queue:view', 'visits_queue:send'],
  'reports:own': ['reports:own:view'],
  'reports:all': ['reports:all:view'],
  'users:manage': ['users:view', 'users:create', 'users:edit', 'users:delete'],
  'roles:manage': ['roles:view', 'roles:create', 'roles:edit', 'roles:delete'],
  'departments:manage': ['departments:view', 'departments:create', 'departments:edit', 'departments:delete'],
  'master_data:manage': ['master_data:view', 'master_data:create', 'master_data:edit', 'master_data:delete'],
  'audit:view': ['audit_logs:view'],
  'settings:manage': ['system_settings:view', 'system_settings:edit', 'system_settings:process'],
};

const normalizePermissions = (permissions = []) => {
  const normalized = new Set(
    permissions.flatMap((permission) => legacyPermissionMap[permission] || [permission]),
  );
  for (const permission of normalized) {
    if (!validPermissionKeys.has(permission)) normalized.delete(permission);
  }
  for (const permission of [...normalized]) {
    const separator = permission.lastIndexOf(':');
    if (separator > -1 && permission.slice(separator + 1) !== 'view') {
      normalized.add(`${permission.slice(0, separator)}:view`);
    }
  }
  return [...normalized];
};

const emptyRoleForm = { displayName: '', description: '', sourceRoleId: '' };
const newRoleFormDefaults = {
  displayName: '',
  roleCode: '',
  departmentId: '',
  description: '',
  status: 'Active',
};

const RolesPermissions = () => {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [activePermissions, setActivePermissions] = useState([]);
  const [savedPermissions, setSavedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [roleUsers, setRoleUsers] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [activePageTab, setActivePageTab] = useState('roles');
  const [activeDetailTab, setActiveDetailTab] = useState('permissions');
  const [editingPermissions, setEditingPermissions] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState('');
  const [showRoleActions, setShowRoleActions] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [wizardStep, setWizardStep] = useState(1);
  const [newRoleForm, setNewRoleForm] = useState(newRoleFormDefaults);
  const [newRolePermissions, setNewRolePermissions] = useState([]);
  const [newRoleTemplate, setNewRoleTemplate] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState('');
  const isAddRolePage = location.pathname.endsWith('/roles-permissions/add');

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || `Request failed (${response.status}).`);
    }
    return result;
  }, [token]);

  useEffect(() => {
    let isCurrent = true;
    const loadRoles = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await request('/api/roles');
        if (!isCurrent) return;
        const normalizedRoles = result.data.map((role) => ({
          ...role,
          permissions: normalizePermissions(role.permissions || []),
        }));
        setRoles(normalizedRoles);
        if (normalizedRoles.length) {
          setSelectedRoleId(normalizedRoles[0]._id);
          const permissions = normalizedRoles[0].permissions;
          setActivePermissions(permissions);
          setSavedPermissions(permissions);
        }
      } catch (loadError) {
        if (isCurrent) setError(loadError.message || 'Unable to load roles.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    loadRoles();
    return () => {
      isCurrent = false;
    };
  }, [request, isAddRolePage]);

  useEffect(() => {
    if (!isAddRolePage) return undefined;
    let isCurrent = true;
    const loadDepartments = async () => {
      setDepartmentsLoading(true);
      setDepartmentsError('');
      try {
        const result = await request('/api/departments?status=Active');
        if (isCurrent) setDepartments(Array.isArray(result.data) ? result.data : []);
      } catch (loadError) {
        if (isCurrent) setDepartmentsError(loadError.message || 'Unable to load departments and units.');
      } finally {
        if (isCurrent) setDepartmentsLoading(false);
      }
    };
    void loadDepartments();
    return () => {
      isCurrent = false;
    };
  }, [isAddRolePage, request]);

  const selectedRole = roles.find((role) => role._id === selectedRoleId) || null;
  const isAdminRole = selectedRole?.roleName?.toLowerCase() === 'admin';
  const hasChanges = useMemo(
    () => activePermissions.length !== savedPermissions.length
      || activePermissions.some((permission) => !savedPermissions.includes(permission)),
    [activePermissions, savedPermissions],
  );
  const filteredRoles = roles.filter((role) => (
    role.displayName.toLowerCase().includes(roleSearch.trim().toLowerCase())
  ));
  const standardWorkspaceRoles = roleTileConfig
    .map((tile) => ({ tile, role: roles.find((item) => item.roleName === tile.roleName) }))
    .filter(({ role }) => role);
  const customWorkspaceRoles = roles.filter(
    (role) => !roleTileConfig.some((tile) => tile.roleName === role.roleName),
  );
  const visiblePermissionModules = permissionModules
    .map((module) => ({
      ...module,
      rows: module.rows.filter((row) => (
        !moduleSearch.trim()
        || module.name.toLowerCase().includes(moduleSearch.trim().toLowerCase())
        || row.name.toLowerCase().includes(moduleSearch.trim().toLowerCase())
      )),
    }))
    .filter((module) => module.rows.length > 0);
  const isAdminRestrictedCell = (row, column) => {
    const systemOnly = permissionModules.some(
      (module) => module.adminOnly && module.rows.includes(row),
    );
    return (systemOnly && !isAdminRole) || (isAdminRole && (
      adminRestrictedModules.has(row.name)
      || (row.name === 'Patients' && column !== 'View')
    ));
  };
  const permissionForCell = (row, column) => (
    row.adminCells && ['admin', 'clinic head'].includes(selectedRole?.roleName?.toLowerCase())
      ? row.adminCells[column]
      : row.cells[column]
  );

  const selectRole = (role) => {
    setSelectedRoleId(role._id);
    setActivePermissions(role.permissions || []);
    setSavedPermissions(role.permissions || []);
    setRoleUsers([]);
    setActiveDetailTab('permissions');
    setEditingPermissions(false);
    setShowRoleActions(false);
    setError('');
    setNotice('');
  };

  const togglePermission = (permission, row) => {
    const column = permissionColumns.find((action) => permissionForCell(row, action) === permission);
    if (!editingPermissions || isAdminRestrictedCell(row, column)) return;
    const viewPermission = permissionForCell(row, 'View');
    setActivePermissions((current) => {
      if (current.includes(permission)) {
        if (permission === viewPermission) {
          return current.filter((key) => !permissionColumns
            .map((action) => permissionForCell(row, action))
            .filter(Boolean)
            .includes(key));
        }
        return current.filter((key) => key !== permission);
      }
      return [...new Set([...current, ...(permission === viewPermission ? [] : [viewPermission]), permission])];
    });
    setNotice('');
  };

  const resetPermissions = () => {
    setActivePermissions(selectedRole?.permissions || []);
    setEditingPermissions(false);
    setError('');
    setNotice('');
  };

  const cancelWorkspaceChanges = () => {
    setActivePermissions(selectedRole?.permissions || []);
    setEditingPermissions(!isAdminRole);
    setError('');
    setNotice('');
  };

  const resetWorkspacePermissions = () => {
    setActivePermissions(normalizePermissions(selectedRole?.permissions || []));
    setEditingPermissions(!isAdminRole);
    setError('');
    setNotice('');
  };

  const selectWorkspaceRole = (role) => {
    if (hasChanges && !window.confirm('Discard unsaved permission changes and switch roles?')) return;
    selectRole(role);
    setActivePageTab('permissions');
    setEditingPermissions(role.roleName?.toLowerCase() !== 'admin');
  };

  const resetWorkspaceDefaults = async () => {
    if (selectedRole?.hasDefaults && !isAdminRole) {
      await resetToDefaults();
      setEditingPermissions(true);
      return;
    }
    resetWorkspacePermissions();
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    const removedPermissions = savedPermissions.filter((permission) => !activePermissions.includes(permission));
    if ((removedPermissions.length || selectedRole.userCount > 0)
      && !window.confirm(
        `Save permission changes for ${selectedRole.displayName}${removedPermissions.length ? `, including removal of ${removedPermissions.length} permission(s)` : ''}?${selectedRole.userCount ? ` ${selectedRole.userCount} user(s) are assigned to this role.` : ''}`,
      )) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/roles/${selectedRole._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          permissions: activePermissions,
          displayName: selectedRole.displayName,
          description: selectedRole.description,
        }),
      });
      setRoles((current) => current.map((role) => (
        role._id === result.data._id
          ? { ...role, ...result.data, userCount: role.userCount, hasDefaults: role.hasDefaults }
          : role
      )));
      setActivePermissions(result.data.permissions);
      setSavedPermissions(result.data.permissions);
      setEditingPermissions(false);
      setNotice(result.message);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!selectedRole || isAdminRole) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/roles/${selectedRole._id}/reset-defaults`, {
        method: 'PUT',
      });
      setRoles((current) => current.map((role) => (
        role._id === result.data._id ? { ...role, ...result.data } : role
      )));
      setActivePermissions(result.data.permissions);
      setSavedPermissions(result.data.permissions);
      setEditingPermissions(false);
      setNotice(result.message);
    } catch (resetError) {
      setError(resetError.message || 'Unable to restore default permissions.');
    } finally {
      setSaving(false);
    }
  };

  const loadRoleUsers = async () => {
    if (!selectedRole) return;
    setActiveDetailTab('users');
    setError('');
    try {
      const result = await request(`/api/roles/${selectedRole._id}/users`);
      setRoleUsers(result.data);
    } catch (usersError) {
      setError(usersError.message || 'Unable to load users assigned to this role.');
    }
  };

  const saveRole = async (event) => {
    event.preventDefault();
    const sourceRole = roles.find((role) => role._id === roleForm.sourceRoleId);
    const roleBeingEdited = roles.find((role) => role._id === editingRoleId);
    const roleCode = sourceRole
      ? `${sourceRole.roleCode || sourceRole.roleName}_COPY`.slice(0, 40).toUpperCase()
      : roleForm.displayName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    const roleName = roleCode.toLowerCase();
    setSaving(true);
    setError('');
    try {
      const result = await request(
        roleBeingEdited ? `/api/roles/${roleBeingEdited._id}` : '/api/roles',
        {
          method: roleBeingEdited ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...(roleBeingEdited ? {} : { roleName, roleCode }),
            displayName: roleForm.displayName.trim(),
            description: roleForm.description.trim(),
            ...(!roleBeingEdited && sourceRole?.departmentId ? { departmentId: sourceRole.departmentId } : {}),
            permissions: roleBeingEdited
              ? roleBeingEdited.permissions || []
              : sourceRole?.permissions || [],
          }),
        },
      );
      setRoles((current) => (
        roleBeingEdited
          ? current.map((role) => (
            role._id === result.data._id
              ? { ...role, ...result.data, userCount: role.userCount, hasDefaults: role.hasDefaults }
              : role
          ))
          : [...current, result.data]
      ));
      if (!roleBeingEdited) selectRole(result.data);
      setRoleDialog(false);
      setEditingRoleId('');
      setRoleForm(emptyRoleForm);
      setNotice(roleBeingEdited
        ? result.message
        : sourceRole ? 'Role cloned successfully.' : 'Role created successfully.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save role.');
    } finally {
      setSaving(false);
    }
  };

  const openNewRoleDialog = () => {
    setNewRoleForm(newRoleFormDefaults);
    setNewRolePermissions([]);
    setNewRoleTemplate('');
    setWizardStep(1);
    setDepartments([]);
    setDepartmentsError('');
    setError('');
    navigate('/admin/roles-permissions/add');
  };

  const closeAddRolePage = () => {
    setError('');
    navigate('/admin/roles-permissions');
  };

  const toggleNewRolePermission = (permission) => {
    const row = permissionModules.flatMap((module) => module.rows)
      .find(({ cells }) => Object.values(cells).includes(permission));
    const viewPermission = row?.cells.View;
    setNewRoleTemplate('');
    setNewRolePermissions((current) => {
      if (permission !== viewPermission && !current.includes(viewPermission)) return current;
      if (current.includes(permission)) {
        if (permission === viewPermission) {
          return current.filter((key) => !Object.values(row.cells).includes(key));
        }
        return current.filter((key) => key !== permission);
      }
      return [...new Set([...current, ...(permission === viewPermission ? [] : [viewPermission]), permission])];
    });
  };

  const createWizardRole = async (event) => {
    event.preventDefault();
    if (wizardStep !== 3) return;
    if (!window.confirm(`Create role "${newRoleForm.displayName.trim()}" (${newRoleForm.roleCode}) with ${newRolePermissions.length} permission(s)?`)) return;
    const roleName = newRoleForm.roleCode.trim().toLowerCase();
    setSaving(true);
    setError('');
    try {
      const result = await request('/api/roles', {
        method: 'POST',
        body: JSON.stringify({
          roleName,
          roleCode: newRoleForm.roleCode.trim().toUpperCase(),
          displayName: newRoleForm.displayName.trim(),
          description: newRoleForm.description.trim(),
          departmentId: newRoleForm.departmentId,
          status: newRoleForm.status,
          isClearanceOffice: false,
          permissions: newRolePermissions,
        }),
      });
      setRoles((current) => [...current, result.data]);
      setSelectedRoleId(result.data._id);
      setActivePermissions(result.data.permissions || []);
      setSavedPermissions(result.data.permissions || []);
      setActivePageTab('roles');
      setActiveDetailTab('permissions');
      setNotice(result.message || 'Role created successfully.');
      setNewRoleForm(newRoleFormDefaults);
      setNewRolePermissions([]);
      setNewRoleTemplate('');
      setWizardStep(1);
      navigate('/admin/roles-permissions', { replace: true });
    } catch (createError) {
      setError(createError.message || 'Unable to create role.');
    } finally {
      setSaving(false);
    }
  };

  const openCloneDialog = (role) => {
    setRoleForm({
      displayName: `${role.displayName} Copy`,
      description: role.description || '',
      sourceRoleId: role._id,
    });
    setEditingRoleId('');
    setShowRoleActions(false);
    setError('');
    setRoleDialog(true);
  };

  const openEditRoleDialog = () => {
    if (!selectedRole || isAdminRole) return;
    setRoleForm({
      displayName: selectedRole.displayName,
      description: selectedRole.description || '',
      sourceRoleId: '',
    });
    setEditingRoleId(selectedRole._id);
    setError('');
    setRoleDialog(true);
  };

  const removeRole = async () => {
    if (!selectedRole || !window.confirm(
      `Delete the "${selectedRole.displayName}" role? This is only allowed when no users are assigned.`,
    )) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/roles/${selectedRole._id}`, { method: 'DELETE' });
      const remainingRoles = roles.filter((role) => role._id !== selectedRole._id);
      setRoles(remainingRoles);
      setRoleUsers([]);
      if (remainingRoles.length) selectRole(remainingRoles[0]);
      setNotice(result.message);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete role.');
    } finally {
      setSaving(false);
    }
  };

  const renderPermissionTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th scope="col" className="w-[48%] px-5 py-3">Module / Feature</th>
            {permissionColumns.map((column) => (
              <th scope="col" key={column} className="px-3 py-3 text-center">{column}</th>
            ))}
          </tr>
        </thead>
        {permissionModules.map((module) => (
          <tbody key={module.name} className="divide-y divide-slate-100">
            <tr className="bg-slate-50/70">
              <th scope="colgroup" colSpan={permissionColumns.length + 1} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                {module.name}
              </th>
            </tr>
            {module.rows.map((row) => {
              const restricted = isAdminRestrictedCell(row, 'View');
              return (
                <tr key={row.name} className={`hover:bg-slate-50/70 ${restricted ? 'bg-slate-50/60' : ''}`}>
                  <th scope="row" className={`px-5 py-3 font-medium ${restricted ? 'text-slate-400' : 'text-slate-700'}`}>
                    {row.name}
                  </th>
                  {permissionColumns.map((column) => {
                    const permission = permissionForCell(row, column);
                    const checked = permission && activePermissions.includes(permission);
                    const cellRestricted = isAdminRestrictedCell(row, column);
                    const unavailableClinicalDelete = clinicalDeleteRows.has(row.name) && column === 'Delete';
                    return (
                      <td key={column} className="px-3 py-2 text-center">
                      {permission && !unavailableClinicalDelete ? (
                        <button
                          type="button"
                          onClick={() => togglePermission(permission, row)}
                          disabled={!editingPermissions || saving || cellRestricted || (column !== 'View' && !activePermissions.includes(permissionForCell(row, 'View')))}
                          aria-label={`${checked ? 'Revoke' : 'Grant'} ${column} for ${row.name}`}
                          title={cellRestricted
                            ? isAdminRole
                              ? 'Clinical access is blocked for System Admin'
                              : 'Reserved for System Admin'
                            : `${checked ? 'Granted' : 'Not granted'}: ${column} ${row.name}`}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${cellRestricted ? 'bg-slate-100 text-slate-300' : checked ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-400'} disabled:cursor-default`}
                        >
                          {checked ? <Check size={15} strokeWidth={2.5} /> : <X size={14} strokeWidth={2} />}
                        </button>
                      ) : (
                        <span
                          aria-hidden="true"
                          title={unavailableClinicalDelete
                            ? 'Delete is disabled for clinical records'
                            : `${column} is not available for ${row.name}`}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-300"
                        >
                          <X size={10} strokeWidth={2.5} />
                        </span>
                      )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );

  const renderWorkspaceMatrix = () => (
    <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
      {visiblePermissionModules.length === 0 ? (
        <p className="p-8 text-center text-xs text-slate-500">No permission modules match your search.</p>
      ) : (
      <table className="w-full min-w-[820px] border-collapse text-left text-[10px]">
        <thead className="bg-blue-50/70 text-[9px] font-bold text-slate-600">
          <tr>
            <th scope="col" colSpan={2} className="w-[25%] border-b border-r border-blue-100 px-3 py-2">Module / Feature</th>
            {permissionColumns.map((column) => (
              <th key={column} scope="col" className="border-b border-r border-blue-100 px-2 py-2 text-center last:border-r-0">{column}</th>
            ))}
          </tr>
        </thead>
        {visiblePermissionModules.map((module) => {
          const moduleIndex = permissionModules.findIndex(({ name }) => name === module.name);
          const moduleIcon = [
            LayoutDashboard,
            UsersRound,
            FlaskConical,
            Pill,
            Syringe,
            ClipboardList,
            Database,
          ][moduleIndex];
          const ModuleIcon = moduleIcon;
          const moduleTint = [
            'bg-sky-50 text-sky-600',
            'bg-rose-50 text-rose-600',
            'bg-violet-50 text-violet-600',
            'bg-teal-50 text-teal-600',
            'bg-pink-50 text-pink-600',
            'bg-cyan-50 text-cyan-600',
            'bg-slate-100 text-slate-500',
          ][moduleIndex];
          return (
            <tbody key={module.name} className="divide-y divide-blue-50">
              {module.rows.map((row, rowIndex) => {
                const rowRestricted = isAdminRestrictedCell(row, 'View');
                return (
                  <tr key={row.name} className="hover:bg-blue-50/40">
                    {rowIndex === 0 && (
                      <th
                        scope="rowgroup"
                        rowSpan={module.rows.length}
                        className={`w-[10%] border-r border-blue-100 px-2 py-1.5 align-middle text-center ${moduleTint}`}
                      >
                        <ModuleIcon size={14} className="mx-auto" />
                        <span className="mt-1 block text-[8px] font-bold leading-3">{module.name.replace(' (Admin only)', '')}</span>
                        {module.adminOnly && <span className="block text-[7px]">(Admin only)</span>}
                      </th>
                    )}
                    <th scope="row" className={`w-[15%] border-r border-blue-100 px-2 py-1.5 font-medium ${rowRestricted ? 'text-slate-400' : 'text-slate-700'}`}>
                      {row.name}
                    </th>
                    {permissionColumns.map((column) => {
                      const permission = permissionForCell(row, column);
                      const checked = permission && activePermissions.includes(permission);
                      const cellRestricted = isAdminRestrictedCell(row, column);
                      const unavailableClinicalDelete = clinicalDeleteRows.has(row.name) && column === 'Delete';
                      const unavailable = !permission || unavailableClinicalDelete;
                      return (
                        <td key={column} className="border-r border-blue-50 px-2 py-1 text-center last:border-r-0">
                          <input
                            type="checkbox"
                            checked={Boolean(checked)}
                            disabled={!permission || unavailableClinicalDelete || cellRestricted || saving || !editingPermissions || (column !== 'View' && !activePermissions.includes(permissionForCell(row, 'View')))}
                            onChange={() => permission && togglePermission(permission, row)}
                            aria-label={`${column} ${row.name}`}
                            title={unavailableClinicalDelete
                              ? 'Delete is disabled for clinical records'
                              : cellRestricted
                                ? 'This action is disabled for the selected role'
                                : unavailable ? `${column} is not applicable` : `${column} ${row.name}`}
                            className={`h-3 w-3 rounded-sm accent-blue-600 disabled:cursor-not-allowed ${unavailable || cellRestricted ? 'opacity-30' : ''}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
      )}
    </div>
  );

  const renderPermissionActions = () => (
    <div className="flex flex-wrap items-center gap-2">
      {editingPermissions ? (
        <>
          <button
            type="button"
            onClick={cancelWorkspaceChanges}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={savePermissions}
            disabled={!hasChanges || saving || isAdminRole}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setEditingPermissions(true)}
          disabled={saving || isAdminRole}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3.5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil size={14} />
          Edit Permissions
        </button>
      )}
    </div>
  );

  if (isAddRolePage) {
    const normalizedRoleName = newRoleForm.displayName.trim().toLowerCase();
    const normalizedRoleCode = newRoleForm.roleCode.trim().toUpperCase();
    const roleName = normalizedRoleCode.toLowerCase();
    const duplicateRoleName = roles.some((role) => (
      role.displayName.trim().toLowerCase() === normalizedRoleName
    ));
    const duplicateRoleCode = roles.some((role) => (
      normalizeRoleCode(role.roleCode || role.roleName) === normalizeRoleCode(normalizedRoleCode)
    ));
    const reservedRoleCode = ['ADMIN', 'SYSTEM_ADMIN'].includes(normalizeRoleCode(normalizedRoleCode));
    const canContinue = /^[a-z][a-z0-9_-]{1,39}$/.test(roleName)
      && /^[A-Z][A-Z0-9_-]{1,39}$/.test(normalizedRoleCode)
      && normalizedRoleName.length > 0
      && !reservedRoleCode
      && !duplicateRoleName
      && !duplicateRoleCode
      && Boolean(newRoleForm.departmentId)
      && !loading
      && !departmentsLoading
      && !departmentsError;
    const suggestedRoleGuide = roleWorkflowGuides.find((guide) => (
      guide.matches.some((match) => normalizedRoleName.includes(match))
    ));

    return (
      <div className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <button type="button" onClick={() => navigate('/admin')} className="text-blue-600 hover:underline">
            Dashboard
          </button>
          <span aria-hidden="true">›</span>
          <button type="button" onClick={closeAddRolePage} className="text-blue-600 hover:underline">
            Role &amp; Permissions
          </button>
          <span aria-hidden="true">›</span>
          <span>Add New Role</span>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-2 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {[
              ['Add Role', 'Create new role information'],
              ['Set Permissions', 'Assign permissions to this role'],
              ['Review & Save', 'Review and save the role'],
            ].map(([title, subtitle], index) => {
              const step = index + 1;
              const complete = wizardStep > step;
              const current = wizardStep === step;
              return (
                <div
                  key={title}
                  className={`relative flex min-h-[68px] items-center gap-3 border-b-2 px-3 py-3 sm:px-5 ${current ? 'border-blue-600' : 'border-transparent'}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${current ? 'bg-blue-600' : complete ? 'bg-emerald-600' : 'bg-slate-400'}`}>
                    {complete ? <Check size={15} /> : step}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-bold sm:text-sm ${current ? 'text-slate-800' : 'text-slate-600'}`}>{title}</span>
                    <span className="mt-0.5 hidden text-[10px] text-slate-500 sm:block">{subtitle}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <form onSubmit={createWizardRole}>
            <section className="min-h-[280px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
              {wizardStep === 1 && (
                <>
                  <h1 className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">1</span>
                    Add Role Information
                  </h1>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Role Name <span className="text-rose-500">*</span>
                        <input
                          required
                          maxLength={60}
                          value={newRoleForm.displayName}
                          onChange={(event) => {
                            const displayName = event.target.value;
                            setNewRoleForm((current) => ({ ...current, displayName }));
                          }}
                          placeholder="Enter role name"
                          className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-xs font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        {duplicateRoleName ? (
                          <span role="alert" className="mt-1.5 block text-[10px] font-normal text-rose-600">A role with this name already exists.</span>
                        ) : (
                          <span className="mt-1.5 block text-[10px] font-normal text-slate-500">Enter a unique name for the role.</span>
                        )}
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Role Code <span className="text-rose-500">*</span>
                        <input
                          required
                          maxLength={40}
                          value={newRoleForm.roleCode}
                          onChange={(event) => setNewRoleForm((current) => ({
                            ...current,
                            roleCode: event.target.value.toUpperCase().replace(/\s+/g, '_'),
                          }))}
                          placeholder="e.g. CLINIC_ASSISTANT"
                          className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-xs font-normal uppercase outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        {duplicateRoleCode ? (
                          <span role="alert" className="mt-1.5 block text-[10px] font-normal text-rose-600">A role with this code already exists.</span>
                        ) : (
                          <span className="mt-1.5 block text-[10px] font-normal text-slate-500">Use 2–40 letters, numbers, underscores, or hyphens.</span>
                        )}
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Department / Unit <span className="text-rose-500">*</span>
                        <select
                          required
                          value={newRoleForm.departmentId}
                          onChange={(event) => setNewRoleForm((current) => ({ ...current, departmentId: event.target.value }))}
                          disabled={departmentsLoading || Boolean(departmentsError)}
                          className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                        >
                          <option value="">
                            {departmentsLoading ? 'Loading departments...' : 'Select department / unit'}
                          </option>
                          {departments.map((department) => (
                            <option key={department._id} value={department._id}>{department.name}</option>
                          ))}
                        </select>
                        {departmentsError && <span role="alert" className="mt-1.5 block text-[10px] font-normal text-rose-600">{departmentsError}</span>}
                        {!departmentsLoading && !departmentsError && departments.length === 0 && (
                          <span className="mt-1.5 block text-[10px] font-normal text-amber-700">Create an active department or unit before adding a role.</span>
                        )}
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Status <span className="text-rose-500">*</span>
                        <select
                          required
                          value={newRoleForm.status}
                          onChange={(event) => setNewRoleForm((current) => ({ ...current, status: event.target.value }))}
                          className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                        <span className="mt-1.5 block text-[10px] font-normal text-slate-500">Select the role status.</span>
                      </label>
                    </div>
                    <div className="space-y-5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description
                        <textarea
                          maxLength={300}
                          rows={3}
                          value={newRoleForm.description}
                          onChange={(event) => setNewRoleForm((current) => ({ ...current, description: event.target.value }))}
                          placeholder="Enter role description (optional)"
                          className="mt-2 block min-h-20 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 text-xs font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <span className="mt-1.5 block text-[10px] font-normal text-slate-500">Briefly describe what this role is responsible for.</span>
                      </label>
                    </div>
                  </div>
                  {newRoleForm.displayName.trim() && !canContinue && !duplicateRoleName && !duplicateRoleCode && (
                    <p role="alert" className="mt-4 text-xs text-rose-700">
                      Enter a valid unique name and code (System Admin is reserved), select an active department / unit, and wait for required data to load.
                    </p>
                  )}
                </>
              )}

              {wizardStep === 2 && (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">2</span>
                        Set Permissions
                      </h1>
                      <p className="mt-1 pl-7 text-xs text-slate-500">
                        Choose a clinic template or customize access for {newRoleForm.displayName || 'this role'} ({newRoleForm.roleCode || 'no code'}).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewRolePermissions(permissionModules
                            .filter((module) => !module.adminOnly)
                            .flatMap((module) => module.rows.flatMap(({ cells }) => Object.values(cells))));
                          setNewRoleTemplate('');
                        }}
                        className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewRolePermissions([]);
                          setNewRoleTemplate('');
                        }}
                        className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <section className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-xs font-bold text-slate-800">Permission templates</h2>
                        <p className="text-[10px] text-slate-500">
                          Applying a template changes permissions only; your role name stays the same.
                        </p>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500">
                        {newRoleForm.displayName || 'New role'} · {newRoleForm.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {newRoleTemplates.map(({ title, permissionRole, icon: Icon, color }) => {
                        const isActive = newRoleTemplate === title;
                        return (
                          <button
                            key={title}
                            type="button"
                            aria-pressed={isActive}
                            aria-label={`Apply ${title} permissions template`}
                            onClick={() => {
                              setNewRolePermissions(permissionsForNewRoleTemplate({ permissionRole }));
                              setNewRoleTemplate(title);
                            }}
                            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-center transition hover:-translate-y-0.5 hover:shadow-sm ${isActive ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                            title={`Apply ${title} permissions`}
                          >
                            <span className={`flex h-6 w-6 items-center justify-center rounded ${color} text-white`}>
                              <Icon size={14} aria-hidden="true" />
                            </span>
                            <span className="text-[9px] font-semibold leading-tight text-slate-700">{title}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      No template selected? Permissions start unchecked. System Admin is a separate privileged role and is not available as a template.
                    </p>
                  </section>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[670px] border-collapse text-left text-[10px]">
                      <thead className="bg-slate-50 text-[9px] font-semibold text-slate-600">
                        <tr>
                          <th scope="col" className="w-[32%] px-3 py-2">Module / Feature</th>
                          {permissionColumns.map((column) => (
                            <th scope="col" key={column} className="px-2 py-2 text-center">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      {permissionModules.map((module) => (
                        <tbody key={module.name} className="divide-y divide-slate-100">
                          <tr className="bg-slate-50/80">
                            <th
                              scope="colgroup"
                              colSpan={permissionColumns.length + 1}
                              className="px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500"
                            >
                              {module.name}
                            </th>
                          </tr>
                          {module.rows.map((row) => (
                            <tr key={row.name} className={module.adminOnly ? 'bg-slate-50/60' : 'hover:bg-blue-50/40'}>
                              <th scope="row" className={`px-3 py-1 font-medium ${module.adminOnly ? 'text-slate-400' : 'text-slate-700'}`}>
                                {row.name}
                              </th>
                              {permissionColumns.map((column) => {
                                const permission = row.cells[column];
                                const unavailableClinicalDelete = clinicalDeleteRows.has(row.name) && column === 'Delete';
                                const disabled = module.adminOnly
                                  || unavailableClinicalDelete
                                  || !permission
                                  || (column !== 'View' && !newRolePermissions.includes(row.cells.View));
                                return (
                                  <td key={column} className="px-2 py-1 text-center">
                                    <input
                                      type="checkbox"
                                      checked={permission ? newRolePermissions.includes(permission) : false}
                                      disabled={disabled}
                                      onChange={() => permission && toggleNewRolePermission(permission)}
                                      aria-label={`${column} ${row.name}`}
                                      title={unavailableClinicalDelete
                                        ? 'Delete is disabled for clinical records'
                                        : module.adminOnly
                                          ? 'System permissions are reserved for System Admin'
                                          : !permission ? `${column} is not available for ${row.name}` : undefined}
                                      className="h-3 w-3 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <section className="rounded-md border border-blue-100 bg-blue-50/70 p-2.5">
                      <h2 className="text-[10px] font-bold text-blue-800">Role information</h2>
                      <p className="mt-1 text-[9px] leading-4 text-slate-600">
                        <span className="font-semibold">Name:</span> {newRoleForm.displayName || 'Not set'}<br />
                        <span className="font-semibold">Code:</span> {newRoleForm.roleCode || 'Not set'}<br />
                        <span className="font-semibold">Department / Unit:</span> {departments.find(({ _id }) => _id === newRoleForm.departmentId)?.name || 'Not set'}<br />
                        <span className="font-semibold">Status:</span> {newRoleForm.status}<br />
                        {newRoleForm.description || 'No description provided.'}
                      </p>
                    </section>
                    <section className="rounded-md border border-rose-100 bg-rose-50/70 p-2.5">
                      <h2 className="text-[10px] font-bold text-rose-800">Important rules</h2>
                      <ul className="mt-1 space-y-0.5 text-[9px] leading-4 text-slate-600">
                        <li>View is required before other actions.</li>
                        <li>Delete is unavailable for clinical records.</li>
                        <li>System permissions are reserved for System Admin.</li>
                      </ul>
                    </section>
                    <section className="rounded-md border border-violet-100 bg-violet-50/70 p-2.5">
                      <h2 className="text-[10px] font-bold text-violet-800">Selected permissions</h2>
                      <p className="mt-1 text-lg font-bold leading-5 text-slate-800">{newRolePermissions.length}</p>
                      <p className="text-[9px] leading-4 text-slate-600">
                        across {permissionModules.filter((module) => module.rows.some((row) => (
                          Object.values(row.cells).some((permission) => newRolePermissions.includes(permission))
                        ))).length} modules
                      </p>
                    </section>
                    <section className="rounded-md border border-emerald-100 bg-emerald-50/70 p-2.5">
                      <h2 className="text-[10px] font-bold text-emerald-800">How to choose</h2>
                      <p className="mt-1 text-[9px] leading-4 text-slate-600">
                        View records · Create · Edit · Send work · Process work · Export reports
                      </p>
                    </section>
                  </div>

                  <details className="group mt-3 rounded-md border border-slate-200 bg-white">
                    <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-semibold text-blue-700">
                      Read the role-by-role clinic workflow guide
                      <span className="float-right text-slate-400 group-open:rotate-90" aria-hidden="true">›</span>
                    </summary>
                    <div className="grid gap-2 border-t border-slate-100 p-3 md:grid-cols-2">
                      {suggestedRoleGuide && (
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 md:col-span-2">
                          <h3 className="text-xs font-bold text-blue-800">
                            Suggested guide for {suggestedRoleGuide.name}
                          </h3>
                          <p className="mt-1 text-[10px] leading-4 text-slate-700">{suggestedRoleGuide.access}</p>
                          <p className="mt-1 text-[10px] leading-4 text-slate-600">{suggestedRoleGuide.note}</p>
                          <p className="mt-1 text-[10px] font-semibold text-blue-700">
                            This is guidance only; review the selected permissions before saving.
                          </p>
                        </div>
                      )}
                      {roleWorkflowGuides.map((guide) => (
                        <article key={guide.name} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                          <h3 className="text-[11px] font-bold text-slate-800">{guide.name}</h3>
                          <p className="mt-1 text-[10px] leading-4 text-slate-600">{guide.access}</p>
                          <p className="mt-1 text-[10px] leading-4 text-slate-500">{guide.note}</p>
                        </article>
                      ))}
                      <p className="text-[10px] leading-4 text-slate-500 md:col-span-2">
                        Confirm patient-detail visibility with clinic staff before assigning real users.
                      </p>
                    </div>
                  </details>
                </>
              )}

              {wizardStep === 3 && (
                <>
                  <h1 className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">3</span>
                    Review &amp; Save
                  </h1>
                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-xs font-bold text-slate-700">Role Information</h2>
                        <button type="button" onClick={() => setWizardStep(1)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button>
                      </div>
                      <dl className="space-y-3 text-xs">
                        <div>
                          <dt className="text-slate-500">Role Name</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800">{newRoleForm.displayName}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Role Code</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800">{newRoleForm.roleCode}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Department / Unit</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800">
                            {departments.find(({ _id }) => _id === newRoleForm.departmentId)?.name || 'Not selected'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Description</dt>
                          <dd className="mt-0.5 text-slate-700">{newRoleForm.description || 'No description provided.'}</dd>
                        </div>
                        <div>
                          <div>
                            <dt className="text-slate-500">Status</dt>
                            <dd className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${newRoleForm.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{newRoleForm.status}</dd>
                          </div>
                        </div>
                      </dl>
                    </section>
                    <section className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-xs font-bold text-slate-700">Assigned Permissions ({newRolePermissions.length})</h2>
                        <button type="button" onClick={() => setWizardStep(2)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button>
                      </div>
                      {newRolePermissions.length ? (
                        <div className="max-h-52 space-y-2 overflow-y-auto">
                          {permissionModules.map((module) => {
                            const selected = module.rows.flatMap((row) => (
                              Object.entries(row.cells)
                                .filter(([, key]) => newRolePermissions.includes(key))
                                .map(([action]) => `${row.name}: ${action}`)
                            ));
                            if (!selected.length) return null;
                            return (
                              <div key={module.name}>
                                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{module.name}</h3>
                                <ul className="mt-1 space-y-1">
                                  {selected.map((label) => (
                                    <li key={label} className="flex items-center gap-1.5 text-xs text-slate-700">
                                      <Check size={12} className="text-emerald-600" />{label}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No permissions selected.</p>
                      )}
                    </section>
                  </div>
                </>
              )}
              {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
            </section>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <button
                type="button"
                onClick={closeAddRolePage}
                className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={() => { setError(''); setWizardStep((step) => step - 1); }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Back
                  </button>
                )}
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1 && !canContinue) {
                        setError('Enter a valid role name before continuing.');
                        return;
                      }
                      setError('');
                      setWizardStep((step) => step + 1);
                    }}
                    disabled={wizardStep === 1 && !canContinue}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next: {wizardStep === 1 ? 'Set Permissions' : 'Review & Save'}
                    <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save Role'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            <span>Dashboard</span>
            <span aria-hidden="true">›</span>
            <span className="text-slate-500">Roles &amp; Permissions</span>
            {activePageTab === 'permissions' && (
              <>
                <span aria-hidden="true">›</span>
                <span className="text-slate-700">Set Permissions</span>
              </>
            )}
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <ShieldCheck className="text-teal-600" size={25} aria-hidden="true" />
            {activePageTab === 'permissions' ? 'Set Permissions' : 'Roles & Permissions'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage roles, access rights and system security.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewRoleDialog}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus size={17} />
          Add New Role
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Total Roles', value: roles.length, icon: UsersRound, style: 'border-blue-100 bg-blue-50/40 text-blue-600' },
          { label: 'Active Roles', value: roles.filter((role) => role.status !== 'Inactive').length, icon: ShieldCheck, style: 'border-emerald-100 bg-emerald-50/40 text-emerald-600' },
          { label: 'Total Users', value: roles.reduce((total, role) => total + (role.userCount || 0), 0), icon: UserRound, style: 'border-violet-100 bg-violet-50/40 text-violet-600' },
          { label: 'Permission Groups', value: permissionModules.length, icon: LockKeyhole, style: 'border-orange-100 bg-orange-50/40 text-orange-600' },
        ].map(({ label, value, icon: Icon, style }) => (
          <section key={label} className={`flex items-center gap-3 rounded-xl border p-3 sm:p-4 ${style}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80">
              <Icon size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold leading-5 text-slate-800">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="mb-4 flex gap-8 border-b border-slate-200">
        {[
          ['roles', 'Roles List', ShieldCheck],
          ['permissions', 'Permission Matrix', LockKeyhole],
        ].map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActivePageTab(tab);
              setEditingPermissions(tab === 'permissions' && !isAdminRole);
              setError('');
              setNotice('');
            }}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold transition ${activePageTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activePageTab === 'permissions' ? (
        loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading roles and permissions...
          </div>
        ) : (
          <div className="space-y-3">
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <span className="text-[10px] font-medium text-amber-700">Unsaved permission changes</span>
                  )}
                  <button
                    type="button"
                    onClick={savePermissions}
                    disabled={!selectedRole || !hasChanges || saving || isAdminRole}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save Permissions'}
                  </button>
                  <button
                    type="button"
                    onClick={resetWorkspaceDefaults}
                    disabled={!selectedRole || saving || isAdminRole || (!hasChanges && !selectedRole.hasDefaults)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                </div>
              </div>
              {error && <p role="alert" className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              {notice && <p role="status" className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}

              {selectedRole && (
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <label className="block min-w-56 flex-1 text-[10px] font-semibold text-slate-600">
                    Search modules
                    <span className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-slate-400 focus-within:border-blue-400">
                      <Search size={14} aria-hidden="true" />
                      <input
                        type="search"
                        value={moduleSearch}
                        onChange={(event) => setModuleSearch(event.target.value)}
                        placeholder="Filter modules or features..."
                        className="min-w-0 flex-1 bg-transparent text-xs font-normal text-slate-700 outline-none placeholder:text-slate-400"
                      />
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!editingPermissions || saving || isAdminRole || visiblePermissionModules.length === 0}
                      onClick={() => {
                        const selected = visiblePermissionModules.flatMap((module) => (
                          module.rows.flatMap((row) => permissionColumns
                            .map((column) => permissionForCell(row, column))
                            .filter((permission) => permission && !isAdminRestrictedCell(
                              row,
                              permissionColumns.find((column) => permissionForCell(row, column) === permission),
                            ))
                          )
                        ));
                        setActivePermissions((current) => [...new Set([...current, ...selected])]);
                        setNotice('');
                      }}
                      className="rounded-md border border-blue-200 px-3 py-2 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      disabled={!editingPermissions || saving || isAdminRole || visiblePermissionModules.length === 0}
                      onClick={() => {
                        const visible = new Set(visiblePermissionModules.flatMap((module) => (
                          module.rows.flatMap((row) => permissionColumns
                            .map((column) => permissionForCell(row, column))
                            .filter(Boolean))
                        )));
                        setActivePermissions((current) => current.filter((permission) => !visible.has(permission)));
                        setNotice('');
                      }}
                      className="rounded-md border border-slate-300 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
              {selectedRole && (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                    Role
                    <select
                      value={selectedRoleId}
                      onChange={(event) => {
                        const role = roles.find((item) => item._id === event.target.value);
                        if (role) selectWorkspaceRole(role);
                      }}
                      className="min-w-40 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                    >
                      {roles.map((role) => (
                        <option key={role._id} value={role._id}>{role.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <span className="text-[10px] text-slate-500">Code: <strong className="text-slate-700">{selectedRole.roleName}</strong></span>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${selectedRole.status === 'Inactive' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selectedRole.status || 'Active'}
                  </span>
                  {hasChanges && (
                    <span role="status" className="ml-auto text-[10px] font-semibold text-amber-700">
                      Unsaved changes
                    </span>
                  )}
                  {hasChanges && (
                    <button
                      type="button"
                      onClick={resetPermissions}
                      disabled={saving}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Cancel / Reset Changes
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
                {standardWorkspaceRoles.map(({ tile, role }, index) => {
                  const TileIcon = tile.icon;
                  const selected = selectedRoleId === role._id;
                  return (
                    <button
                      key={role._id}
                      type="button"
                      onClick={() => selectWorkspaceRole(role)}
                      aria-pressed={selected}
                      className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-center text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${tile.color} ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                    >
                      <TileIcon size={17} />
                      <span className="text-[9px] font-bold leading-3">
                        {index + 1}. {tile.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedRole ? (
              <>
                {isAdminRole && (
                  <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                    <span>System Admin is locked. Clinical records, prescriptions, lab results, and treatment workflows remain unavailable.</span>
                  </div>
                )}
                {renderWorkspaceMatrix()}
                <div className="grid gap-2 xl:grid-cols-[1fr_1.7fr_2fr_1fr]">
                  <section className="rounded-lg border border-blue-100 bg-white p-3">
                    <h2 className="mb-2 text-[10px] font-bold text-blue-800">Legend</h2>
                    <div className="space-y-1.5 text-[9px] text-slate-600">
                      <p className="flex items-center gap-2"><span className="flex h-4 w-4 items-center justify-center rounded-sm bg-blue-600 text-white"><Check size={11} /></span> Allowed</p>
                      <p className="flex items-center gap-2"><span className="h-4 w-4 rounded-sm border border-slate-300 bg-white" /> Not allowed</p>
                      <p className="flex items-center gap-2"><span className="h-4 w-4 rounded-sm bg-slate-200" /> Disabled (not applicable)</p>
                    </div>
                  </section>
                  <section className="rounded-lg border border-rose-100 bg-rose-50/70 p-3">
                    <h2 className="mb-2 text-[10px] font-bold text-rose-700">Important Rules</h2>
                    <ol className="space-y-1 text-[9px] leading-3.5 text-slate-600">
                      <li>1. View must be selected before any other action.</li>
                      <li>2. Delete is disabled for Clinical Records, Prescriptions and Lab Results.</li>
                      <li>3. Non-applicable actions are disabled in gray (Dashboard View only; Reports View and Export only).</li>
                      <li>4. System Admin cannot access clinical modules; medical actions are blocked.</li>
                    </ol>
                  </section>
                  <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                    <h2 className="mb-2 text-[10px] font-bold text-blue-800">Module Categories</h2>
                    <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                      {permissionModules.map((module, index) => {
                        const CategoryIcon = [
                          LayoutDashboard,
                          UsersRound,
                          FlaskConical,
                          Pill,
                          Syringe,
                          ClipboardList,
                          ShieldCheck,
                        ][index];
                        return (
                          <p key={module.name} className="flex items-start gap-1.5 text-[8px] leading-3 text-slate-600">
                            <CategoryIcon size={11} className="mt-px shrink-0 text-blue-600" />
                            <span><strong>{module.name.replace(' (Admin only)', '')}:</strong> {module.rows.map((row) => row.name).join(' · ')}</span>
                          </p>
                        );
                      })}
                    </div>
                  </section>
                  <section className="rounded-lg border border-blue-100 bg-white p-3">
                    <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-800">
                      <UsersRound size={13} /> {roles.length} Roles in Total
                    </h2>
                    <ol className="space-y-0.5 pl-5 text-[8px] leading-3 text-slate-600">
                      {standardWorkspaceRoles.map(({ tile }, index) => (
                        <li key={tile.roleName}>{index + 1}. {tile.title}</li>
                      ))}
                      {customWorkspaceRoles.map((role, index) => (
                        <li key={role._id}>{standardWorkspaceRoles.length + index + 1}. {role.displayName}</li>
                      ))}
                    </ol>
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Create or configure a role to see its permissions here.
              </div>
            )}
          </div>
        )
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading roles and permissions...
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[256px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-3 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800">Roles ({roles.length})</h2>
                <button
                  type="button"
                  onClick={openNewRoleDialog}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700"
                >
                  <Plus size={12} aria-hidden="true" />
                  Add Role
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-slate-400 focus-within:border-blue-400">
                <Search size={15} aria-hidden="true" />
                <span className="sr-only">Search roles</span>
                <input
                  type="search"
                  value={roleSearch}
                  onChange={(event) => setRoleSearch(event.target.value)}
                  placeholder="Search roles..."
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>
            </div>
            <div className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
              {filteredRoles.map((role) => {
                const selected = selectedRoleId === role._id;
                return (
                  <button
                    key={role._id}
                    type="button"
                    onClick={() => selectRole(role)}
                    aria-current={selected ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      <UsersRound size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-700">
                        {role.displayName}
                        {role.isLocked && <LockKeyhole size={11} className="ml-1 inline text-slate-400" aria-label="Locked role" />}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {role.roleCode || role.roleName} · {role.userCount || 0} {role.userCount === 1 ? 'user' : 'users'}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-semibold ${role.status === 'Inactive' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                      {role.status || 'Active'}
                    </span>
                  </button>
                );
              })}
              {!filteredRoles.length && (
                <p className="px-3 py-6 text-center text-xs text-slate-500">
                  {roles.length ? 'No roles match your search.' : 'No roles are configured.'}
                </p>
              )}
            </div>
          </aside>

          <main className="min-w-0">
            {selectedRole ? (
              activePageTab === 'roles' ? (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-4 sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <ShieldCheck size={21} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-800">Permissions</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">{selectedRole.displayName}</span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${selectedRole.status === 'Inactive' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                            {selectedRole.status || 'Active'}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Code: {selectedRole.roleCode || selectedRole.roleName}
                        </p>
                        {selectedRole.department && (
                          <p className="mt-1 text-[10px] text-slate-400">Department / Unit: {selectedRole.department}</p>
                        )}
                        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
                          {selectedRole.description || 'No description provided.'}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <UsersRound size={12} />
                          Users with this role: {selectedRole.userCount || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {renderPermissionActions()}
                      <div className="flex items-center gap-2">
                        {!isAdminRole && (
                          <button
                            type="button"
                            onClick={openEditRoleDialog}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil size={13} />
                            Edit Role
                          </button>
                        )}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowRoleActions((current) => !current)}
                            aria-label="More role actions"
                            aria-expanded={showRoleActions}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {showRoleActions && (
                            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                              {!isAdminRole && (
                                <button type="button" onClick={() => openCloneDialog(selectedRole)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">
                                  <Copy size={14} /> Clone role
                                </button>
                              )}
                              {selectedRole.hasDefaults && !isAdminRole && (
                                <button type="button" onClick={() => { setShowRoleActions(false); resetToDefaults(); }} disabled={saving} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                  <RotateCcw size={14} /> Reset to default
                                </button>
                              )}
                              {!selectedRole.isLocked && !selectedRole.userCount && (
                                <button type="button" onClick={() => { setShowRoleActions(false); removeRole(); }} disabled={saving} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                                  <Trash2 size={14} /> Delete role
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isAdminRole && (
                    <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:mx-5">
                      <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                  <p>System Admin is locked. Clinical records, prescriptions, lab results, and treatment modules are unavailable; patient access is limited to basic details.</p>
                    </div>
                  )}

                  <div className="flex gap-6 border-b border-slate-200 px-4 pt-3 sm:px-5">
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab('permissions')}
                      className={`-mb-px border-b-2 px-1 pb-3 text-xs font-semibold ${activeDetailTab === 'permissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Permissions ({activePermissions.length})
                    </button>
                    <button
                      type="button"
                      onClick={loadRoleUsers}
                      disabled={saving}
                      className={`-mb-px border-b-2 px-1 pb-3 text-xs font-semibold ${activeDetailTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Users with this role ({selectedRole.userCount || 0})
                    </button>
                  </div>

                  {activeDetailTab === 'permissions' ? (
                    <>
                      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                        <h3 className="text-xs font-bold text-slate-700">Permission matrix</h3>
                        <p className="mt-0.5 text-[11px] text-slate-400">Granted access is shown with a check.</p>
                      </div>
                      {renderPermissionTable()}
                    </>
                  ) : (
                    <div className="p-4 sm:p-5">
                      {roleUsers.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[500px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500">
                              <tr>
                                <th className="px-3 py-2.5">Name</th>
                                <th className="px-3 py-2.5">Username</th>
                                <th className="px-3 py-2.5">Department</th>
                                <th className="px-3 py-2.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {roleUsers.map((user) => (
                                <tr key={user._id}>
                                  <td className="px-3 py-3 font-medium">{user.name}</td>
                                  <td className="px-3 py-3">{user.username || '—'}</td>
                                  <td className="px-3 py-3">{user.department || '—'}</td>
                                  <td className="px-3 py-3">{user.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="py-8 text-center text-sm text-slate-500">No users are assigned to this role.</p>
                      )}
                    </div>
                  )}
                </section>
              ) : (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Permissions</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Configure access for <span className="font-semibold text-slate-700">{selectedRole.displayName}</span>.
                      </p>
                    </div>
                    {renderPermissionActions()}
                  </div>
                  {isAdminRole && (
                    <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:mx-5">
                      <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                  <p>System Admin is locked. Clinical records, prescriptions, lab results, and treatment modules are unavailable; patient access is limited to basic details.</p>
                    </div>
                  )}
                  {renderPermissionTable()}
                </section>
              )
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Select a role to view its details and permissions.
              </div>
            )}
          </main>
        </div>
      )}

      {roleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={saveRole} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingRoleId ? 'Edit Role' : roleForm.sourceRoleId ? 'Clone Role' : 'Create Role'}
              </h2>
              <button
                type="button"
                onClick={() => { setRoleDialog(false); setEditingRoleId(''); }}
                aria-label="Close role dialog"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <label className="block text-sm font-medium">
              Display name
              <input
                required
                maxLength={60}
                value={roleForm.displayName}
                onChange={(event) => setRoleForm((current) => ({ ...current, displayName: event.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                placeholder="e.g. Triage Nurse"
              />
            </label>
            <label className="block text-sm font-medium">
              Description
              <textarea
                maxLength={300}
                value={roleForm.description}
                onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                rows={3}
                placeholder="Describe this role's responsibilities."
              />
            </label>
            {!editingRoleId && (
              <label className="block text-sm font-medium">
                Clone permissions from (optional)
                <select
                  value={roleForm.sourceRoleId}
                  onChange={(event) => setRoleForm((current) => ({ ...current, sourceRoleId: event.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                >
                  <option value="">Start with no permissions</option>
                  {roles.map((role) => (
                    <option key={role._id} value={role._id}>{role.displayName}</option>
                  ))}
                </select>
              </label>
            )}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => { setRoleDialog(false); setEditingRoleId(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingRoleId ? 'Save Role' : roleForm.sourceRoleId ? 'Clone Role' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RolesPermissions;

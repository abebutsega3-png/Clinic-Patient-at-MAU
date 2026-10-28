import mongoose from 'mongoose';
import RolePermission from '../module/RolePermission.js';
import Department from '../module/Department.js';
import User from '../module/User.js';
import { writeAuditEvent } from '../utils/auditLogger.js';
import {
  allClinicPermissions,
  getDefaultRolePermissions,
} from '../module/seedRolesAndPermissions.js';

const allowedPermissions = new Set(allClinicPermissions);
const clinicalDeletePermissions = new Set([
  'clinical_records:delete',
  'prescriptions:delete',
  'lab_results:delete',
]);
const privilegedPermissionPrefixes = new Set([
  'users',
  'roles',
  'master_data',
  'audit_logs',
  'system_settings',
]);
const isSystemRoleName = (roleName) => (
  ['admin', 'system_admin'].includes(roleName.trim().toLowerCase().replace(/[\s-]+/g, '_'))
);
const isReservedSystemRole = (roleName, displayName, roleCode) => (
  isSystemRoleName(roleName)
  || (typeof displayName === 'string' && isSystemRoleName(displayName))
  || (typeof roleCode === 'string' && isSystemRoleName(roleCode))
);
const normalizeRoleCode = (value) => value.trim().toUpperCase().replace(/[\s-]+/g, '_');
const hasSystemManagementPermissions = (permissions) => (
  permissions.some((permission) => {
    const [module, action] = permission.split(':');
    return privilegedPermissionPrefixes.has(module)
      || (module === 'departments' && action !== 'view');
  })
);
const hasValidRoleId = (id) => mongoose.isValidObjectId(id);

const permissionsAreValid = (permissions) => (
  Array.isArray(permissions)
  && permissions.every((permission) => (
    typeof permission === 'string'
    && allowedPermissions.has(permission)
    && !clinicalDeletePermissions.has(permission)
  ))
  && permissions.every((permission) => {
    const separator = permission.lastIndexOf(':');
    if (separator < 0 || permission.slice(separator + 1) === 'view') return true;
    return permissions.includes(`${permission.slice(0, separator)}:view`);
  })
);

export const getRoles = async (req, res) => {
  try {
    const [roles, userCounts] = await Promise.all([
      RolePermission.find().sort({ createdAt: 1, roleName: 1 }).lean(),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);
    const countByRole = new Map(userCounts.map(({ _id, count }) => [_id, count]));
    const rolesWithCounts = roles.map((role) => ({
      ...role,
      userCount: countByRole.get(role.roleName) || 0,
      hasDefaults: Boolean(getDefaultRolePermissions(role.roleName)),
    }));
    return res.status(200).json({ success: true, data: rolesWithCounts });
  } catch (error) {
    console.error('Failed to load roles and permissions:', error);
    return res.status(500).json({ success: false, message: 'Unable to load roles and permissions.' });
  }
};

export const createRole = async (req, res) => {
  const {
    roleName,
    roleCode,
    displayName,
    description = '',
    departmentId,
    permissions = [],
    status = 'Active',
    isClearanceOffice = false,
  } = req.body;
  const normalizedName = typeof roleName === 'string' ? roleName.trim().toLowerCase() : '';
  const normalizedCode = typeof roleCode === 'string' ? roleCode.trim().toUpperCase() : '';
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(normalizedName)
    || !/^[A-Z][A-Z0-9_-]{1,39}$/.test(normalizedCode)
    || normalizedName !== normalizedCode.toLowerCase()
    || isReservedSystemRole(normalizedName, normalizedDisplayName, normalizedCode)
    || !normalizedDisplayName
    || typeof description !== 'string'
    || !['Active', 'Inactive'].includes(status)
    || typeof isClearanceOffice !== 'boolean'
    || !permissionsAreValid(permissions)
    || hasSystemManagementPermissions(permissions)
    || (departmentId && !mongoose.isValidObjectId(departmentId))) {
    return res.status(400).json({ success: false, message: 'Provide a valid role name, unique role code, department, status, and permissions.' });
  }

  try {
    const duplicateRole = await RolePermission.findOne({
      $or: [
        { roleName: { $regex: `^${normalizedName}$`, $options: 'i' } },
        { roleName: { $regex: `^${normalizedCode.replace(/[-_]+/g, '[_\\s-]+')}$`, $options: 'i' } },
        { roleCode: normalizedCode },
        { roleCode: normalizeRoleCode(normalizedCode) },
        { displayNameKey: normalizedDisplayName.toLowerCase() },
        { displayName: { $regex: `^${normalizedDisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      ],
    }).select('_id');
    if (duplicateRole) {
      return res.status(409).json({ success: false, message: 'A role with this name or code already exists.' });
    }

    let department = null;
    if (departmentId) {
      department = await Department.findOne({ _id: departmentId, status: 'Active' }).select('name').lean();
      if (!department) {
        return res.status(400).json({ success: false, message: 'Select an active department or unit.' });
      }
    }

    const role = await RolePermission.create({
      roleName: normalizedName,
      roleCode: normalizedCode,
      displayName: normalizedDisplayName,
      displayNameKey: normalizedDisplayName.toLowerCase(),
      description: description.trim(),
      department: department?.name || '',
      departmentId: department?._id || null,
      status,
      isClearanceOffice,
      permissions: [...new Set(permissions)],
      isLocked: false,
    });
    await writeAuditEvent({
      req,
      action: 'ROLE_CREATED',
      details: `Created role ${role.roleName} (${role.roleCode}) for ${role.department || 'no department'}.`,
      entityType: 'roles',
      entityId: role._id,
      changes: [
        { field: 'roleName', from: '', to: role.roleName },
        { field: 'roleCode', from: '', to: role.roleCode },
        { field: 'permissions', from: '', to: role.permissions.join(', ') },
      ],
    });
    return res.status(201).json({
      success: true,
      message: 'Role created.',
      data: { ...role.toObject(), userCount: 0, hasDefaults: false },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A role with this name or code already exists.' });
    console.error('Failed to create role:', error);
    return res.status(500).json({ success: false, message: 'Unable to create role.' });
  }
};

export const getRoleUsers = async (req, res) => {
  if (!hasValidRoleId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Role ID is invalid.' });
  }
  try {
    const role = await RolePermission.findById(req.params.id).select('roleName').lean();
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    const users = await User.find({ role: role.roleName })
      .select('name username department status lastLogin')
      .sort({ name: 1 })
      .limit(100)
      .lean();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Failed to load users for role:', error);
    return res.status(500).json({ success: false, message: 'Unable to load users for this role.' });
  }
};

export const updateRolePermissions = async (req, res) => {
  const { permissions, displayName, description } = req.body;
  if (!hasValidRoleId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Role ID is invalid.' });
  }
  if (!permissionsAreValid(permissions)) {
    return res.status(400).json({
      success: false,
      message: 'Every permission must be valid, must include View before other actions, and cannot delete clinical records.',
    });
  }

  try {
    const role = await RolePermission.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    if (role.roleName.toLowerCase() === 'admin') {
      return res.status(403).json({ success: false, message: 'The System Admin role is locked and cannot be edited.' });
    }
    if (hasSystemManagementPermissions(permissions)) {
      return res.status(403).json({
        success: false,
        message: 'System management permissions can only be assigned to the locked System Admin role.',
      });
    }
    const previousPermissions = role.permissions || [];
    const grantedPermissions = permissions.filter((permission) => !previousPermissions.includes(permission));
    const removedPermissions = previousPermissions.filter((permission) => !permissions.includes(permission));
    const previousDisplayName = role.displayName;
    const previousDescription = role.description;
    role.permissions = [...new Set(permissions)];
    if (typeof displayName === 'string' && displayName.trim()) {
      const cleanDisplayName = displayName.trim();
      if (isSystemRoleName(cleanDisplayName)) {
        return res.status(403).json({ success: false, message: 'System Admin is a reserved role.' });
      }
      const displayNameKey = cleanDisplayName.toLowerCase();
      const duplicateName = await RolePermission.findOne({
        _id: { $ne: role._id },
        $or: [
          { displayNameKey },
          { displayName: { $regex: `^${cleanDisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        ],
      }).select('_id');
      if (duplicateName) {
        return res.status(409).json({ success: false, message: 'That role name is already in use.' });
      }
      role.displayName = cleanDisplayName;
      role.displayNameKey = displayNameKey;
    }
    if (typeof description === 'string') role.description = description.trim();
    await role.save();

    await writeAuditEvent({
      req,
      action: 'ROLE_PERMISSIONS_UPDATED',
      details: `Updated permissions for role ${role.roleName}. Granted: ${grantedPermissions.join(', ') || 'none'}. Removed: ${removedPermissions.join(', ') || 'none'}.`,
      entityType: 'roles',
      entityId: role._id,
      changes: [
        ...(grantedPermissions.length || removedPermissions.length ? [{
          field: 'permissions',
          from: previousPermissions.join(', '),
          to: role.permissions.join(', '),
        }] : []),
        ...(previousDisplayName !== role.displayName ? [{ field: 'displayName', from: previousDisplayName, to: role.displayName }] : []),
        ...(previousDescription !== role.description ? [{ field: 'description', from: previousDescription, to: role.description }] : []),
      ],
    });
    return res.status(200).json({ success: true, message: 'Role permissions updated.', data: role });
  } catch (error) {
    console.error('Failed to update role permissions:', error);
    return res.status(500).json({ success: false, message: 'Unable to update role permissions.' });
  }
};

export const resetRolePermissions = async (req, res) => {
  if (!hasValidRoleId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Role ID is invalid.' });
  }
  try {
    const role = await RolePermission.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    if (role.roleName.toLowerCase() === 'admin') {
      return res.status(403).json({ success: false, message: 'The System Admin role is locked.' });
    }
    const defaults = getDefaultRolePermissions(role.roleName);
    if (!defaults) {
      return res.status(400).json({ success: false, message: 'This custom role has no default permissions to restore.' });
    }
    const previousPermissions = role.permissions || [];
    role.permissions = defaults.permissions;
    role.displayName = defaults.displayName;
    role.description = defaults.description;
    role.responsibilities = defaults.responsibilities;
    role.reports = defaults.reports;
    await role.save();
    await writeAuditEvent({
      req,
      action: 'ROLE_PERMISSIONS_RESET',
      details: `Restored default permissions for role ${role.roleName}.`,
      entityType: 'roles',
      entityId: role._id,
      changes: [{ field: 'permissions', from: previousPermissions.join(', '), to: role.permissions.join(', ') }],
    });
    return res.status(200).json({ success: true, message: 'Role restored to its default permissions.', data: role });
  } catch (error) {
    console.error('Failed to reset role permissions:', error);
    return res.status(500).json({ success: false, message: 'Unable to restore default permissions.' });
  }
};

export const deleteRole = async (req, res) => {
  if (!hasValidRoleId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Role ID is invalid.' });
  }
  try {
    const role = await RolePermission.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    if (role.isLocked || role.roleName.toLowerCase() === 'admin') {
      return res.status(403).json({ success: false, message: 'System roles cannot be deleted.' });
    }
    const assignedUsers = await User.countDocuments({
      $or: [{ role: role.roleName }, { roles: role.roleName }],
    });
    if (assignedUsers) {
      return res.status(409).json({
        success: false,
        message: `This role is assigned to ${assignedUsers} user(s). Reassign them before deleting it.`,
      });
    }
    await role.deleteOne();
    await writeAuditEvent({
      req,
      action: 'ROLE_DELETED',
      details: `Deleted role ${role.roleName}.`,
      entityType: 'roles',
      entityId: role._id,
      changes: [
        { field: 'roleName', from: role.roleName, to: '' },
        { field: 'roleCode', from: role.roleCode, to: '' },
      ],
    });
    return res.status(200).json({ success: true, message: 'Role deleted.' });
  } catch (error) {
    console.error('Failed to delete role:', error);
    return res.status(500).json({ success: false, message: 'Unable to delete role.' });
  }
};

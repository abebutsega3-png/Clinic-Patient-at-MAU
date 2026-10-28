import bcrypt from 'bcrypt';
import User from '../module/User.js';
import Department from '../module/Department.js';
import RolePermission from '../module/RolePermission.js';
import { AuditLog } from '../module/AdminDashboardModels.js';
import { writeAuditEvent } from '../utils/auditLogger.js';
import { getSecurityPolicy, validatePasswordAgainstPolicy } from '../utils/securityPolicy.js';

const userFields = 'name username email employeeId phoneNumber alternativePhone role activeRole department departmentId status lastLogin createdAt failedLoginAttempts loginLockedUntil mustChangePassword position';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidId = (value) => /^[a-f\d]{24}$/i.test(value || '');

const writeAuditLog = async (req, action, details, entityId, changes = []) => {
  try {
    await writeAuditEvent({
      req,
      action,
      details,
      entityType: 'users',
      entityId,
      changes,
    });
    return true;
  } catch (error) {
    console.error(`User change ${action} succeeded, but its audit event could not be recorded:`, error);
    return false;
  }
};

const getActiveAdminCount = () => User.countDocuments({
  status: 'Active',
  $or: [{ role: 'Admin' }, { roles: 'Admin' }],
});

const validateRole = async (role) => (
  typeof role === 'string'
  && Boolean(role.trim())
  && Boolean(await RolePermission.exists({
    roleName: role.trim(),
    $or: [{ status: 'Active' }, { status: { $exists: false } }],
  }))
);

export const getUserManagementOptions = async (req, res) => {
  try {
    const [departments, seededRoles, passwordPolicy] = await Promise.all([
      Department.find({ $or: [{ status: 'Active' }, { status: { $exists: false } }] }).select('_id name code').sort({ name: 1 }).lean(),
      RolePermission.find({ $or: [{ status: 'Active' }, { status: { $exists: false } }] }).select('roleName').sort({ roleName: 1 }).lean(),
      getSecurityPolicy(),
    ]);
    const roles = seededRoles.map(({ roleName }) => roleName);

    return res.status(200).json({
      success: true,
      data: {
        roles,
        departments,
        passwordPolicy,
      },
    });
  } catch (error) {
    console.error('Failed to load user-management options:', error);
    return res.status(500).json({ success: false, message: 'Unable to load roles and departments.' });
  }
};

export const listManagedUsers = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const { role, department, status } = req.query;
  const sortBy = ['name', 'username', 'employeeId', 'role', 'department', 'status', 'createdAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'name';
  const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;
  const filter = {};

  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { name: expression },
      { username: expression },
      { email: expression },
      { employeeId: expression },
    ];
  }
  if (typeof role === 'string' && role) filter.role = role;
  if (typeof department === 'string' && department) filter.department = department;
  if (['Active', 'Inactive', 'On Leave'].includes(status)) filter.status = status;

  try {
    const [users, total, summaryRows] = await Promise.all([
      User.find(filter).select(userFields).sort({ [sortBy]: sortDirection, _id: sortDirection }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
      User.aggregate([{
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
          onLeave: { $sum: { $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0] } },
        },
      }]),
    ]);
    return res.status(200).json({
      success: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: { ...(summaryRows[0] || { total: 0, active: 0, inactive: 0, onLeave: 0 }), pending: null, pendingSupported: false },
    });
  } catch (error) {
    console.error('Failed to list managed users:', error);
    return res.status(500).json({ success: false, message: 'Unable to load users.' });
  }
};

export const getManagedUserDetails = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'User ID is invalid.' });
    }
    const user = await User.findById(req.params.id).select(userFields).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const recentActivities = await AuditLog.find({
      $or: [
        { entityType: 'users', entityId: user._id },
        { entityType: 'authentication', entityId: user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action details result userName userRole createdAt')
      .lean();
    return res.status(200).json({
      success: true,
      data: { ...user, recentActivities },
    });
  } catch (error) {
    console.error('Failed to load managed user details:', error);
    return res.status(500).json({ success: false, message: 'Unable to load user details.' });
  }
};

export const createManagedUser = async (req, res) => {
  const {
    name, username, email = '', employeeId = '', phoneNumber = '', role, departmentId, status = 'Active', password,
  } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanEmployeeId = typeof employeeId === 'string' ? employeeId.trim() : '';
  const cleanPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
  const cleanRole = typeof role === 'string' ? role.trim() : '';

  if (cleanName.length < 2 || cleanName.length > 120 || !/^[A-Za-z0-9._-]{3,50}$/.test(cleanUsername)
    || (!cleanEmail && !cleanPhone) || cleanEmail.length > 254
    || (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    || cleanEmployeeId.length > 50 || cleanPhone.length > 30
    || !['Active', 'Inactive', 'On Leave'].includes(status)
    || typeof departmentId !== 'string' || !isValidId(departmentId)) {
    return res.status(400).json({
      success: false,
      message: 'Provide a valid name, username, email or phone, employee ID, and active department.',
    });
  }
  try {
    const passwordError = validatePasswordAgainstPolicy(password || '', await getSecurityPolicy());
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (!(await validateRole(cleanRole))) {
      return res.status(400).json({ success: false, message: 'Choose a role from Roles & Permissions.' });
    }
    const department = await Department.findOne({
      _id: departmentId,
      $or: [{ status: 'Active' }, { status: { $exists: false } }],
    }).select('_id name').lean();
    if (!department) return res.status(400).json({ success: false, message: 'Choose an active department.' });
    const existingUsername = await User.findOne({
      username: { $regex: `^${escapeRegex(cleanUsername)}$`, $options: 'i' },
    }).select('_id');
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'That username is already in use.' });
    }
    if (cleanEmployeeId && await User.exists({ employeeId: { $regex: `^${escapeRegex(cleanEmployeeId)}$`, $options: 'i' } })) {
      return res.status(409).json({ success: false, message: 'That staff ID is already in use.' });
    }
    const user = await User.create({
      name: cleanName,
      username: cleanUsername,
      usernameNormalized: cleanUsername.toLowerCase(),
      email: cleanEmail || undefined,
      employeeId: cleanEmployeeId,
      phoneNumber: cleanPhone,
      role: cleanRole,
      roles: [cleanRole],
      activeRole: cleanRole,
      department: department.name,
      departmentId: department._id,
      status,
      password: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    });
    const auditLogRecorded = await writeAuditLog(req, 'USER_CREATED', `Created account for ${user.name} (${user.username}).`, user._id, [
      { field: 'name', from: '', to: user.name },
      { field: 'username', from: '', to: user.username },
      { field: 'role', from: '', to: user.role },
      { field: 'department', from: '', to: user.department },
      { field: 'status', from: '', to: user.status },
    ]);
    return res.status(201).json({
      success: true,
      message: auditLogRecorded ? 'User account created.' : 'User account created, but the audit event could not be recorded.',
      auditLogRecorded,
      data: await User.findById(user._id).select(userFields).lean(),
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = error.keyPattern?.usernameNormalized ? 'username' : 'email address';
      return res.status(409).json({ success: false, message: `That ${field} is already in use.` });
    }
    console.error('Failed to create managed user:', error);
    return res.status(500).json({ success: false, message: 'Unable to create user account.' });
  }
};

export const updateManagedUser = async (req, res) => {
  const { name, username, email = '', employeeId = '', phoneNumber = '', role, departmentId, status } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanEmployeeId = typeof employeeId === 'string' ? employeeId.trim() : '';
  const cleanPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
  const cleanRole = typeof role === 'string' ? role.trim() : '';

  if (cleanName.length < 2 || cleanName.length > 120 || !/^[A-Za-z0-9._-]{3,50}$/.test(cleanUsername)
    || (!cleanEmail && !cleanPhone) || cleanEmail.length > 254
    || (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    || cleanEmployeeId.length > 50 || cleanPhone.length > 30
    || typeof departmentId !== 'string' || !isValidId(departmentId)
    || !['Active', 'Inactive', 'On Leave'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Provide valid user details, an active department, and account status.' });
  }

  try {
    if (!(await validateRole(cleanRole))) {
      return res.status(400).json({ success: false, message: 'Choose a role from Roles & Permissions.' });
    }
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'User ID is invalid.' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    const department = await Department.findOne({
      _id: departmentId,
      $or: [{ status: 'Active' }, { status: { $exists: false } }],
    }).select('_id name').lean();
    if (!department) return res.status(400).json({ success: false, message: 'Choose an active department.' });
    const isSelf = target._id.equals(req.user._id);
    const isAdmin = target.role === 'Admin' || target.roles?.includes('Admin');
    if (isSelf && (cleanRole !== target.role || status !== target.status)) {
      return res.status(403).json({ success: false, message: 'You cannot change your own role or account status.' });
    }
    if (isAdmin && target.status === 'Active' && (cleanRole !== 'Admin' || status !== 'Active')
      && await getActiveAdminCount() <= 1) {
      return res.status(409).json({ success: false, message: 'The last active administrator cannot be demoted or deactivated.' });
    }

    const before = {
      name: target.name,
      username: target.username,
      email: target.email || '',
      employeeId: target.employeeId || '',
      phoneNumber: target.phoneNumber || '',
      role: target.role,
      department: target.department || '',
      status: target.status,
    };
    target.name = cleanName;
    target.username = cleanUsername;
    target.usernameNormalized = cleanUsername.toLowerCase();
    target.email = cleanEmail || undefined;
    target.employeeId = cleanEmployeeId;
    target.phoneNumber = cleanPhone;
    target.role = cleanRole;
    target.roles = [cleanRole];
    target.activeRole = cleanRole;
    target.department = department.name;
    target.departmentId = department._id;
    target.status = status;
    if (status !== 'Active' || cleanRole !== before.role || cleanUsername !== before.username) {
      target.tokenVersion = (target.tokenVersion || 0) + 1;
    }
    const duplicateUsername = await User.findOne({
      _id: { $ne: target._id },
      username: { $regex: `^${escapeRegex(cleanUsername)}$`, $options: 'i' },
    }).select('_id');
    if (duplicateUsername) return res.status(409).json({ success: false, message: 'That username is already in use.' });
    if (cleanEmployeeId && await User.exists({
      _id: { $ne: target._id },
      employeeId: { $regex: `^${escapeRegex(cleanEmployeeId)}$`, $options: 'i' },
    })) {
      return res.status(409).json({ success: false, message: 'That staff ID is already in use.' });
    }
    await target.save();
    const changes = Object.entries(before)
      .filter(([field, value]) => String(value) !== String(target[field] || ''))
      .map(([field, from]) => ({ field, from, to: String(target[field] || '') }));
    const auditAction = status !== before.status
      ? 'USER_STATUS_CHANGED'
      : cleanRole !== before.role
        ? 'USER_ROLE_CHANGED'
        : department.name !== before.department
          ? 'USER_DEPARTMENT_CHANGED'
          : 'USER_UPDATED';
    const auditLogRecorded = await writeAuditLog(req, auditAction,
      `Updated account for ${target.name} (${target.username}).`, target._id, changes);
    return res.status(200).json({
      success: true,
      message: auditLogRecorded ? 'User account updated.' : 'User account updated, but the audit event could not be recorded.',
      auditLogRecorded,
      data: await User.findById(target._id).select(userFields).lean(),
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = error.keyPattern?.usernameNormalized ? 'username' : 'email address';
      return res.status(409).json({ success: false, message: `That ${field} is already in use.` });
    }
    console.error('Failed to update managed user:', error);
    return res.status(500).json({ success: false, message: 'Unable to update user account.' });
  }
};

export const setManagedUserStatus = async (req, res) => {
  const { status } = req.body || {};
  if (!['Active', 'Inactive', 'On Leave'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Choose a valid account status.' });
  }

  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'User ID is invalid.' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    if (target._id.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You cannot change your own account status.' });
    }
    const isAdmin = target.role === 'Admin' || target.roles?.includes('Admin');
    if (isAdmin && target.status === 'Active' && status !== 'Active' && await getActiveAdminCount() <= 1) {
      return res.status(409).json({ success: false, message: 'The last active administrator cannot be deactivated.' });
    }

    const previousStatus = target.status;
    target.status = status;
    if (status !== 'Active') target.tokenVersion = (target.tokenVersion || 0) + 1;
    await target.save();
    const auditLogRecorded = await writeAuditLog(req, 'USER_STATUS_CHANGED', `Changed ${target.username} status to ${status}.`, target._id, [
      { field: 'status', from: previousStatus, to: status },
    ]);
    return res.status(200).json({
      success: true,
      message: auditLogRecorded
        ? `User account set to ${status}.`
        : `User account set to ${status}, but the audit event could not be recorded.`,
      auditLogRecorded,
      data: await User.findById(target._id).select(userFields).lean(),
    });
  } catch (error) {
    console.error('Failed to change managed user status:', error);
    return res.status(500).json({ success: false, message: 'Unable to change user status.' });
  }
};

export const resetManagedUserPassword = async (req, res) => {
  const { password } = req.body || {};
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'User ID is invalid.' });
    const passwordError = validatePasswordAgainstPolicy(password || '', await getSecurityPolicy());
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    target.password = await bcrypt.hash(password, 12);
    target.passwordChangedAt = new Date();
    target.mustChangePassword = true;
    target.failedLoginAttempts = 0;
    target.loginLockedUntil = null;
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    await target.save();
    const auditLogRecorded = await writeAuditLog(req, 'USER_PASSWORD_RESET', `Reset password for ${target.username}.`, target._id);
    return res.status(200).json({
      success: true,
      message: auditLogRecorded
        ? 'Temporary password set. The user must change it after signing in.'
        : 'Temporary password set and sessions revoked, but the audit event could not be recorded.',
      auditLogRecorded,
    });
  } catch (error) {
    console.error('Failed to reset managed user password:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset user password.' });
  }
};

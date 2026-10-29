import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import User from '../module/User.js';
import Department from '../module/Department.js';
import RolePermission from '../module/RolePermission.js';
import { AuditLog } from '../module/AdminDashboardModels.js';
import { writeAuditEvent } from '../utils/auditLogger.js';
import { getSecurityPolicy, validatePasswordAgainstPolicy } from '../utils/securityPolicy.js';

const userFields = 'name username email employeeId phoneNumber alternativePhone gender dateOfBirth role activeRole department departmentId status dateJoined lastLogin createdAt failedLoginAttempts loginLockedUntil mustChangePassword position';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidId = (value) => /^[a-f\d]{24}$/i.test(value || '');
const isSmtpConfigured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_USER
  && process.env.SMTP_PASS
  && (process.env.SMTP_FROM || process.env.SMTP_USER)
);

const generateTemporaryPassword = (policy) => {
  const characterSets = [
    'abcdefghijkmnopqrstuvwxyz',
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    '23456789',
    '!@#$%&*?',
  ];
  const requiredSets = [
    policy.requireLetter ? characterSets[0] + characterSets[1] : '',
    policy.requireUppercase ? characterSets[1] : '',
    policy.requireNumber ? characterSets[2] : '',
    policy.requireSpecialCharacter ? characterSets[3] : '',
  ].filter(Boolean);
  const allowedCharacters = [...new Set(characterSets.join(''))].join('');
  const characters = requiredSets.map((set) => set[randomInt(set.length)]);
  while (characters.length < Math.max(policy.minimumPasswordLength, 16)) {
    characters.push(allowedCharacters[randomInt(allowedCharacters.length)]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join('');
};

const sendWelcomeCredentials = async ({ email, name, username, password, mustChangePassword = true }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173/login';
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Your MAU Clinic System account',
    text: [
      `Hello ${name},`,
      '',
      'A clinic system account has been created for you.',
      `Username: ${username}`,
      `Temporary password: ${password}`,
      `Sign in: ${loginUrl}`,
      '',
      mustChangePassword
        ? 'You must change this temporary password immediately after your first sign-in. Do not share it.'
        : 'You may keep this password after your first sign-in. Do not share it.',
    ].join('\n'),
  });
};

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
      RolePermission.find({ $or: [{ status: 'Active' }, { status: { $exists: false } }] })
        .select('roleName displayName')
        .sort({ displayName: 1, roleName: 1 })
        .lean(),
      getSecurityPolicy(),
    ]);
    const roles = seededRoles.map(({ roleName, displayName }) => ({
      roleName,
      displayName: displayName || roleName,
    }));

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
    name, username, password, email = '', employeeId = '', phoneNumber = '', gender = '', dateOfBirth = '',
    role, departmentId, status = 'Active', sendWelcomeEmail: shouldSendWelcomeEmail = false,
    mustChangePassword = true,
  } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const cleanPassword = typeof password === 'string' ? password : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanEmployeeId = typeof employeeId === 'string' ? employeeId.trim() : '';
  const cleanPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
  const cleanRole = typeof role === 'string' ? role.trim() : '';
  const cleanGender = typeof gender === 'string' ? gender.trim() : '';
  const cleanDateOfBirth = typeof dateOfBirth === 'string' ? dateOfBirth.trim() : '';
  const validDateOfBirth = !cleanDateOfBirth
    || (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateOfBirth)
      && !Number.isNaN(Date.parse(`${cleanDateOfBirth}T00:00:00.000Z`))
      && new Date(`${cleanDateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) === cleanDateOfBirth
      && new Date(`${cleanDateOfBirth}T00:00:00.000Z`) <= new Date());
  const adultBirthDateLimit = new Date();
  adultBirthDateLimit.setUTCHours(0, 0, 0, 0);
  adultBirthDateLimit.setUTCFullYear(adultBirthDateLimit.getUTCFullYear() - 18);
  const meetsMinimumAge = cleanDateOfBirth <= adultBirthDateLimit.toISOString().slice(0, 10);

  if (!/^\p{L}+(?:\s+\p{L}+)*$/u.test(cleanName) || cleanName.length < 3 || cleanName.length > 120) {
    return res.status(400).json({ success: false, message: 'Full name must be at least 3 letters and contain only letters and spaces.' });
  }
  if (!/^MAU_\d+$/.test(cleanEmployeeId)) {
    return res.status(400).json({ success: false, message: 'Employee ID must use the format MAU_ followed by digits (for example, MAU_1234).' });
  }
  if (cleanEmail && !/^[A-Za-z0-9]+(?:[._%+-][A-Za-z0-9]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address with letters or numbers before @ and a valid domain.' });
  }
  if (cleanPhone && !/^(?:09\d{8}|\+2519\d{8})$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Phone number must be 09 followed by 8 digits, or +2519 followed by 8 digits.' });
  }
  if (cleanDateOfBirth && validDateOfBirth && !meetsMinimumAge) {
    return res.status(400).json({ success: false, message: 'The user must be at least 18 years old.' });
  }
  if (cleanName.length < 2 || cleanName.length > 120
    || !/^[A-Za-z0-9._-]{3,50}$/.test(cleanUsername)
    || cleanPassword.length > 128
    || (!cleanEmail && !cleanPhone) || cleanEmail.length > 254
    || cleanEmployeeId.length > 50
    || !['Male', 'Female', 'Other'].includes(cleanGender) || !cleanDateOfBirth || !validDateOfBirth || !meetsMinimumAge
    || typeof shouldSendWelcomeEmail !== 'boolean'
    || typeof mustChangePassword !== 'boolean'
    || (shouldSendWelcomeEmail && !cleanEmail)
    || !['Active', 'Inactive', 'On Leave'].includes(status)
    || typeof departmentId !== 'string' || !isValidId(departmentId)) {
    return res.status(400).json({
      success: false,
      message: 'Provide valid account details, an active department, and an email address when sending the welcome message.',
    });
  }
  try {
    const passwordPolicy = await getSecurityPolicy();
    const passwordError = validatePasswordAgainstPolicy(cleanPassword, passwordPolicy);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }
    if (!(await validateRole(cleanRole))) {
      return res.status(400).json({ success: false, message: 'Choose a role from Roles & Permissions.' });
    }
    const department = await Department.findOne({
      _id: departmentId,
      $or: [{ status: 'Active' }, { status: { $exists: false } }],
    }).select('_id name').lean();
    if (!department) return res.status(400).json({ success: false, message: 'Choose an active department.' });
    if (await User.exists({ username: { $regex: `^${escapeRegex(cleanUsername)}$`, $options: 'i' } })) {
      return res.status(409).json({ success: false, message: 'That username is already in use.' });
    }
    if (cleanEmployeeId && await User.exists({ employeeId: { $regex: `^${escapeRegex(cleanEmployeeId)}$`, $options: 'i' } })) {
      return res.status(409).json({ success: false, message: 'That staff ID is already in use.' });
    }
    if (cleanEmail && await User.exists({ email: cleanEmail })) {
      return res.status(409).json({ success: false, message: 'That email address is already in use.' });
    }
    const user = await User.create({
      name: cleanName,
      username: cleanUsername,
      usernameNormalized: cleanUsername.toLowerCase(),
      email: cleanEmail || undefined,
      employeeId: cleanEmployeeId,
      phoneNumber: cleanPhone,
      gender: cleanGender,
      dateOfBirth: cleanDateOfBirth,
      dateJoined: new Date(),
      role: cleanRole,
      roles: [cleanRole],
      activeRole: cleanRole,
      department: department.name,
      departmentId: department._id,
      status,
      password: await bcrypt.hash(cleanPassword, 12),
      mustChangePassword,
    });
    let emailSent = false;
    if (shouldSendWelcomeEmail) {
      try {
        await sendWelcomeCredentials({
          email: cleanEmail,
          name: cleanName,
          username: cleanUsername,
          password: cleanPassword,
          mustChangePassword,
        });
        emailSent = true;
      } catch (mailError) {
        console.error(`Welcome email delivery failed for newly created user ${user._id}:`, mailError);
      }
    }
    const auditLogRecorded = await writeAuditLog(req, 'USER_CREATED', `Created account for ${user.name} (${user.username}). First-login password change ${mustChangePassword ? 'required' : 'not required'}. Welcome email ${shouldSendWelcomeEmail ? (emailSent ? 'sent' : 'failed') : 'not requested'}.`, user._id, [
      { field: 'name', from: '', to: user.name },
      { field: 'username', from: '', to: user.username },
      { field: 'employeeId', from: '', to: user.employeeId || '' },
      { field: 'email', from: '', to: user.email || '' },
      { field: 'role', from: '', to: user.role },
      { field: 'department', from: '', to: user.department },
      { field: 'status', from: '', to: user.status },
    ]);
    return res.status(201).json({
      success: true,
      message: [
        'User account created.',
        shouldSendWelcomeEmail ? (emailSent ? 'Welcome email sent.' : 'Welcome email could not be delivered. Share the password you entered through a secure channel.') : '',
        auditLogRecorded ? '' : 'The audit event could not be recorded.',
      ].filter(Boolean).join(' '),
      auditLogRecorded,
      emailRequested: shouldSendWelcomeEmail,
      emailSent,
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
  const { name, username, email = '', employeeId = '', phoneNumber = '', gender = '', dateOfBirth = '', role, departmentId, status } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanEmployeeId = typeof employeeId === 'string' ? employeeId.trim() : '';
  const cleanPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
  const cleanGender = typeof gender === 'string' ? gender.trim() : '';
  const cleanDateOfBirth = typeof dateOfBirth === 'string' ? dateOfBirth.trim() : '';
  const validDateOfBirth = !cleanDateOfBirth
    || (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateOfBirth)
      && !Number.isNaN(Date.parse(`${cleanDateOfBirth}T00:00:00.000Z`))
      && new Date(`${cleanDateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) === cleanDateOfBirth
      && new Date(`${cleanDateOfBirth}T00:00:00.000Z`) <= new Date());
  const cleanRole = typeof role === 'string' ? role.trim() : '';

  if (cleanName.length < 2 || cleanName.length > 120 || !/^[A-Za-z0-9._-]{3,50}$/.test(cleanUsername)
    || (!cleanEmail && !cleanPhone) || cleanEmail.length > 254
    || (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    || cleanEmployeeId.length > 50 || cleanPhone.length > 30
    || !['', 'Male', 'Female', 'Other'].includes(cleanGender) || !validDateOfBirth
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
      gender: target.gender || '',
      dateOfBirth: target.dateOfBirth || '',
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
    target.gender = cleanGender;
    target.dateOfBirth = cleanDateOfBirth;
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
      .map(([field, from]) => ({
        field,
        from: ['gender', 'dateOfBirth'].includes(field) ? '[redacted]' : from,
        to: ['gender', 'dateOfBirth'].includes(field) ? '[redacted]' : String(target[field] || ''),
      }));
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
  const { sendWelcomeEmail: shouldSendWelcomeEmail = true } = req.body || {};
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'User ID is invalid.' });
    if (typeof shouldSendWelcomeEmail !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Choose whether to email the temporary password.' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    if (shouldSendWelcomeEmail && (!target.email || !isSmtpConfigured())) {
      return res.status(503).json({
        success: false,
        message: target.email
          ? 'Email delivery is not configured. Turn off email delivery to show the temporary password once.'
          : 'This account has no email address. Turn off email delivery to show the temporary password once.',
      });
    }
    const passwordPolicy = await getSecurityPolicy();
    const temporaryPassword = generateTemporaryPassword(passwordPolicy);
    const passwordError = validatePasswordAgainstPolicy(temporaryPassword, passwordPolicy);
    if (passwordError) {
      console.error('Generated reset password does not satisfy the configured security policy:', passwordError);
      return res.status(500).json({ success: false, message: 'Unable to generate a password that satisfies the current security policy.' });
    }
    target.password = await bcrypt.hash(temporaryPassword, 12);
    target.passwordChangedAt = new Date();
    target.mustChangePassword = true;
    target.failedLoginAttempts = 0;
    target.loginLockedUntil = null;
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    await target.save();
    let emailSent = false;
    if (shouldSendWelcomeEmail) {
      try {
        await sendWelcomeCredentials({
          email: target.email,
          name: target.name,
          username: target.username,
          password: temporaryPassword,
        });
        emailSent = true;
      } catch (mailError) {
        console.error(`Password reset email delivery failed for user ${target._id}:`, mailError);
      }
    }
    const auditLogRecorded = await writeAuditLog(
      req,
      'USER_PASSWORD_RESET',
      `Reset password for ${target.username}. Email ${shouldSendWelcomeEmail ? (emailSent ? 'sent' : 'failed') : 'not requested'}.`,
      target._id
    );
    return res.status(200).json({
      success: true,
      message: auditLogRecorded
        ? `Temporary password set and existing sessions revoked. ${shouldSendWelcomeEmail ? (emailSent ? 'Email sent.' : 'Email could not be delivered; provide the password securely.') : 'Share it securely.'}`
        : 'Temporary password set and sessions revoked, but the audit event could not be recorded.',
      auditLogRecorded,
      emailRequested: shouldSendWelcomeEmail,
      emailSent,
      ...(!emailSent ? { temporaryPassword } : {}),
    });
  } catch (error) {
    console.error('Failed to reset managed user password:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset user password.' });
  }
};

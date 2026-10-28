import mongoose from 'mongoose';
import { AuditLog } from '../module/AdminDashboardModels.js';

const moduleFromAction = (action = '') => {
  if (/^(AUTH|LOGIN|LOGOUT)/i.test(action)) return 'authentication';
  if (/^USER_/i.test(action)) return 'users';
  if (/^ROLE_/i.test(action)) return 'roles';
  if (/^DEPARTMENT_/i.test(action)) return 'departments';
  if (/^MASTER_DATA_/i.test(action)) return 'master_data';
  return 'system';
};
const moduleFromEntity = (entityType = '') => {
  const aliases = {
    authentication: 'authentication',
    users: 'users',
    user: 'users',
    roles: 'roles',
    role: 'roles',
    department: 'departments',
    departments: 'departments',
    master_data: 'master_data',
    system_settings: 'system',
  };
  return aliases[entityType] || '';
};

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stringParam = (value, limit = 100) => (
  typeof value === 'string' ? value.trim().slice(0, limit) : ''
);
const moduleFilters = {
  authentication: { action: { $regex: '^(AUTH|LOGIN|LOGOUT|UNAUTHORIZED|ACCESS_DENIED)', $options: 'i' } },
  users: { action: { $regex: '^USER_', $options: 'i' } },
  roles: { action: { $regex: '^ROLE_', $options: 'i' } },
  departments: { $or: [{ entityType: 'department' }, { action: { $regex: '^DEPARTMENT_', $options: 'i' } }] },
  master_data: { $or: [{ entityType: 'master_data' }, { action: { $regex: '^MASTER_DATA_', $options: 'i' } }] },
  system: {
    $and: [
      { entityType: { $nin: ['authentication', 'users', 'user', 'roles', 'role', 'department', 'departments', 'master_data'] } },
      { action: { $not: /^(AUTH|LOGIN|LOGOUT|USER_|ROLE_|DEPARTMENT_|MASTER_DATA_)/i } },
    ],
  },
};

export const getAdminAuditLogs = async (req, res) => {
  const startDate = stringParam(req.query.startDate, 10);
  const endDate = stringParam(req.query.endDate, 10);
  const start = parseDate(startDate);
  const end = parseDate(endDate, true);
  if ((startDate && !start) || (endDate && !end) || (start && end && start > end)) {
    return res.status(400).json({ success: false, message: 'Enter a valid date range with the start on or before the end.' });
  }
  if (start && end && (end.getTime() - start.getTime()) / 86400000 > 366) {
    return res.status(400).json({ success: false, message: 'Audit date ranges cannot exceed 366 days.' });
  }

  const search = stringParam(req.query.search);
  const userId = stringParam(req.query.userId, 50);
  const role = stringParam(req.query.role, 80);
  const module = stringParam(req.query.module, 80);
  const action = stringParam(req.query.action, 80);
  const result = stringParam(req.query.result, 20).toLowerCase();
  const sortBy = stringParam(req.query.sortBy, 30);
  const sortDirection = req.query.sortDirection === 'asc' ? 1 : -1;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
  const sortableFields = new Set(['createdAt', 'userName', 'userRole', 'action', 'entityType', 'result', 'ipAddress']);

  if (userId && !mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: 'Select a valid audit actor.' });
  }
  if (result && !['success', 'failure'].includes(result)) {
    return res.status(400).json({ success: false, message: 'Select a valid event result.' });
  }
  if (module && !Object.prototype.hasOwnProperty.call(moduleFilters, module)) {
    return res.status(400).json({ success: false, message: 'Select a valid audit module.' });
  }

  const conditions = [];
  if (start || end) conditions.push({ createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } });
  if (userId) conditions.push({ userId: new mongoose.Types.ObjectId(userId) });
  if (role) conditions.push({ userRole: role });
  if (module) conditions.push(moduleFilters[module]);
  if (action) conditions.push({ action });
  if (result === 'failure') conditions.push({ result: 'failure' });
  if (result === 'success') conditions.push({ $or: [{ result: 'success' }, { result: { $exists: false } }] });
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    const textSearch = [
      { userName: expression },
      { userRole: expression },
      { action: expression },
      { details: expression },
      { entityType: expression },
      { ipAddress: expression },
    ];
    if (mongoose.isValidObjectId(search)) textSearch.push({ entityId: new mongoose.Types.ObjectId(search) });
    conditions.push({ $or: textSearch });
  }
  const filter = conditions.length ? { $and: conditions } : {};

  try {
    const [events, total, summary, actorOptions, roleOptions, actionOptions, moduleOptions] = await Promise.all([
      AuditLog.find(filter)
        .select('userId userName userRole action result details entityType entityId ipAddress createdAt')
        .sort({ [sortableFields.has(sortBy) ? sortBy : 'createdAt']: sortDirection, _id: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
      AuditLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            security: {
              $sum: {
                $cond: [
                  { $regexMatch: { input: '$action', regex: '^(AUTH|LOGIN|LOGOUT|ROLE_|USER_STATUS_CHANGED|USER_PASSWORD_RESET|UNAUTHORIZED|ACCESS_DENIED)', options: 'i' } },
                  1,
                  0,
                ],
              },
            },
            userChanges: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: '^USER_', options: 'i' } }, 1, 0] } },
            dataChanges: {
              $sum: {
                $cond: [
                  { $regexMatch: { input: '$action', regex: '^(MASTER_DATA_|DEPARTMENT_)', options: 'i' } },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      AuditLog.aggregate([
        { $match: { userName: { $exists: true, $ne: '' } } },
        { $group: { _id: '$userId', name: { $last: '$userName' } } },
        { $sort: { name: 1 } },
        { $limit: 1000 },
      ]),
      AuditLog.distinct('userRole', { userRole: { $exists: true, $nin: ['', 'Unknown'] } }),
      AuditLog.distinct('action'),
      AuditLog.distinct('entityType', { entityType: { $exists: true, $nin: ['', null] } }),
    ]);

    const actions = (actionOptions || []).filter(Boolean).sort();
    const modules = new Set((moduleOptions || []).map(moduleFromEntity).filter(Boolean));
    actions.forEach((value) => modules.add(moduleFromAction(value)));
    const counts = summary[0] || { total: 0, security: 0, userChanges: 0, dataChanges: 0 };

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalEvents: counts.total,
          securityEvents: counts.security,
          userChanges: counts.userChanges,
          dataChanges: counts.dataChanges,
        },
        events: events.map((event) => ({
          id: event._id,
          timestamp: event.createdAt,
          actor: event.userName || 'Unknown user',
          actorId: event.userId || null,
          role: event.userRole || 'Not recorded',
          action: event.action,
          module: moduleFromEntity(event.entityType) || moduleFromAction(event.action),
          recordReference: event.entityId ? String(event.entityId) : '—',
          details: event.details || '',
          result: event.result || 'success',
          ipAddress: event.ipAddress || '—',
        })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        options: {
          users: actorOptions.map(({ _id, name }) => ({ id: _id ? String(_id) : '', name })),
          roles: [...new Set(roleOptions)].sort(),
          actions,
          modules: [...modules].sort(),
        },
      },
    });
  } catch (error) {
    console.error('Failed to load System Admin audit logs:', error);
    return res.status(500).json({ success: false, message: 'Unable to load audit logs.' });
  }
};

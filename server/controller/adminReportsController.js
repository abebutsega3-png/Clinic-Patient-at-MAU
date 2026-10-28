import mongoose from 'mongoose';
import User from '../module/User.js';
import Department from '../module/Department.js';
import ClinicVisit from '../module/ClinicVisit.js';
import MasterDataRecord from '../module/MasterDataRecord.js';
import RolePermission from '../module/RolePermission.js';
import { AuditLog } from '../module/AdminDashboardModels.js';

const masterDataReportCategories = [
  { value: 'department', label: 'Department' },
  { value: 'job_title', label: 'Staff Job Title' },
  { value: 'service', label: 'Clinic Service' },
  { value: 'patient_category', label: 'Patient Category' },
  { value: 'visit_type', label: 'Visit Type' },
  { value: 'lab_test', label: 'Laboratory Test' },
  { value: 'medicine', label: 'Medicine Catalog Item' },
  { value: 'campus_location', label: 'Campus / Location' },
];

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeGroupRows = (rows) => rows.map(({ _id, count }) => ({ label: _id || 'Unassigned', count }));

const createDailyTrend = (start, end, rows) => {
  const countsByDay = new Map(rows.map(({ _id, count }) => [_id, count]));
  const days = [];
  const cursor = new Date(start);
  const last = new Date(end);
  cursor.setUTCHours(0, 0, 0, 0);
  last.setUTCHours(0, 0, 0, 0);
  while (cursor <= last && days.length < 367) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, label: key.slice(5), count: countsByDay.get(key) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

export const getAdminReports = async (req, res) => {
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';
  const start = parseDate(startDate);
  const end = parseDate(endDate, true);
  if ((startDate && !start) || (endDate && !end) || (start && end && start > end)) {
    return res.status(400).json({ success: false, message: 'Enter a valid date range with the start on or before the end.' });
  }
  if (start && end && (end.getTime() - start.getTime()) / 86400000 > 366) {
    return res.status(400).json({ success: false, message: 'Report date ranges cannot exceed 366 days.' });
  }

  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const department = typeof req.query.department === 'string' ? req.query.department.trim() : '';
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const moduleFilter = typeof req.query.module === 'string' ? req.query.module.trim() : '';
  const actionFilter = typeof req.query.action === 'string' ? req.query.action.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  if (userId && !mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: 'Select a valid user filter.' });
  }

  try {
    const userQuery = {};
    if (role === '__unassigned__') userQuery.role = { $in: ['', null] };
    else if (role) userQuery.role = role;
    if (department === '__unassigned__') userQuery.department = { $in: ['', null] };
    else if (department) userQuery.department = department;
    const actualEnd = end || new Date();
    const actualStart = start || new Date(actualEnd.getTime() - 29 * 86400000);
    const registrationMatch = { ...userQuery, createdAt: { $gte: actualStart, $lte: actualEnd } };
    const registrationTrendRows = await User.aggregate([
      { $match: registrationMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const [totalUsers, activeUsers, inactiveUsers, registeredPatients, clinicVisits, totalDepartments, activeDepartments, roleOptions, roleGroups, departmentGroups, statusGroups, loginCounters, usersForTable, matchingUserIds] = await Promise.all([
      User.countDocuments(userQuery),
      User.countDocuments({ ...userQuery, status: 'Active' }),
      User.countDocuments({ ...userQuery, status: 'Inactive' }),
      mongoose.connection.collection('patients').countDocuments(),
      ClinicVisit.countDocuments({
        ...(start || end ? { visitDate: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {}),
      }),
      Department.countDocuments(),
      Department.countDocuments({ status: 'Active' }),
      RolePermission.find().select('roleName displayName').sort({ displayName: 1 }).lean(),
      User.aggregate([{ $match: userQuery }, { $group: { _id: { $ifNull: ['$role', 'Unassigned'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      User.aggregate([{ $match: userQuery }, { $group: { _id: { $cond: [{ $or: [{ $eq: ['$department', ''] }, { $eq: ['$department', null] }] }, 'Unassigned', '$department'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      User.aggregate([{ $match: userQuery }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      User.aggregate([{ $match: userQuery }, { $group: { _id: null, counters: { $sum: { $ifNull: ['$failedLoginAttempts', 0] } }, locked: { $sum: { $cond: [{ $gt: ['$loginLockedUntil', new Date()] }, 1, 0] } } } }]),
      User.find(userQuery).select('name username role department status createdAt lastLogin').sort({ createdAt: -1 }).limit(1000).lean(),
      User.distinct('_id', userQuery),
    ]);
    const userIdStrings = new Set(matchingUserIds.map(String));
    const statusGroupCounts = new Map(statusGroups.map(({ _id, count }) => [_id, count]));
    const statusCounts = {
      active: statusGroupCounts.get('Active') || 0,
      inactive: statusGroupCounts.get('Inactive') || 0,
      onLeave: statusGroupCounts.get('On Leave') || 0,
    };

    const auditMatch = {};
    if (start || end) auditMatch.createdAt = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
    if (role || department) {
      auditMatch.userId = { $in: matchingUserIds };
    }
    if (userId) {
      auditMatch.userId = !role && !department || userIdStrings.has(userId)
        ? new mongoose.Types.ObjectId(userId)
        : { $in: [] };
    }
    if (actionFilter) auditMatch.action = actionFilter;
    if (moduleFilter) {
      const escapedModule = escapeRegex(moduleFilter);
      auditMatch.$or = [
        { entityType: moduleFilter },
        { action: { $regex: `^${escapedModule}[_:]`, $options: 'i' } },
      ];
    }
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      const searchConditions = [
        { userName: expression },
        { action: expression },
        { entityType: expression },
        { details: expression },
      ];
      if (auditMatch.$or) {
        auditMatch.$and = [{ $or: auditMatch.$or }, { $or: searchConditions }];
        delete auditMatch.$or;
      } else {
        auditMatch.$or = searchConditions;
      }
    }
    const failedLoginMatch = {
      $and: [
        auditMatch,
        { action: { $in: ['LOGIN_FAILED', 'AUTH_LOGIN_FAILED'] } },
      ],
    };
    const unauthorizedMatch = {
      $and: [
        auditMatch,
        { action: { $in: ['UNAUTHORIZED_ACCESS', 'ACCESS_DENIED'] } },
      ],
    };
    const auditOptionMatch = start || end
      ? { createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } }
      : {};

    const [auditLogs, auditTotalCount, auditOptionRows, masterDataCounts, masterDataStatusRows, failedLoginEvents, unauthorizedEvents] = await Promise.all([
      AuditLog.find(auditMatch)
        .select('userId userName action details entityType entityId changes createdAt')
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean(),
      AuditLog.countDocuments(auditMatch),
      AuditLog.aggregate([
        { $match: auditOptionMatch },
        { $group: { _id: '$action' } },
        { $sort: { _id: 1 } },
        { $limit: 100 },
      ]),
      MasterDataRecord.aggregate([
        { $group: { _id: '$category', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }, inactive: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } } } },
      ]),
      Department.aggregate([
        { $group: { _id: 'department', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }, inactive: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } } } },
      ]),
      AuditLog.countDocuments(failedLoginMatch),
      AuditLog.countDocuments(unauthorizedMatch),
    ]);

    const hasUserConstraint = Boolean(userId || role || department);
    const visibleAuditLogs = auditLogs.filter((log) => (
      !hasUserConstraint || (log.userId && userIdStrings.has(String(log.userId)))
    ));
    const categories = new Map(masterDataCounts.map((entry) => [entry._id, entry]));
    const departmentStatus = masterDataStatusRows[0] || { total: 0, active: 0, inactive: 0 };
    const masterData = masterDataReportCategories.map(({ value, label }) => {
      const item = value === 'department' ? departmentStatus : categories.get(value) || { total: 0, active: 0, inactive: 0 };
      return { category: value, label, total: item.total || 0, active: item.active || 0, inactive: item.inactive || 0 };
    });

    const securityActions = new Set([
      'ROLE_CREATED',
      'ROLE_DELETED',
      'ROLE_PERMISSIONS_UPDATED',
      'ROLE_PERMISSIONS_RESET',
      'USER_STATUS_CHANGED',
    ]);
    const securityEvents = visibleAuditLogs.filter((log) => securityActions.has(log.action));
    const roleFilterOptions = new Map(
      roleOptions.map(({ roleName, displayName }) => [roleName, { value: roleName, label: displayName || roleName }]),
    );
    roleGroups.forEach(({ _id }) => {
      const value = _id || '__unassigned__';
      if (!roleFilterOptions.has(value)) roleFilterOptions.set(value, { value, label: _id || 'Unassigned' });
    });
    roleFilterOptions.set('__unassigned__', { value: '__unassigned__', label: 'Unassigned' });

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      data: {
        overview: { totalUsers, activeUsers, inactiveUsers, registeredPatients, clinicVisits, totalDepartments, activeDepartments },
        userAnalytics: {
          byRole: normalizeGroupRows(roleGroups),
          byDepartment: normalizeGroupRows(departmentGroups),
          byStatus: [
            { label: 'Active', count: statusCounts.active },
            { label: 'Inactive', count: statusCounts.inactive },
            { label: 'On Leave', count: statusCounts.onLeave },
          ],
          registrationTrend: createDailyTrend(actualStart, actualEnd, registrationTrendRows),
          users: usersForTable.map((user) => ({
            id: user._id,
            name: user.name,
            username: user.username,
            role: user.role || 'Unassigned',
            department: user.department || 'Unassigned',
            status: user.status,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
          })),
          loginActivity: { available: false, message: 'Login timestamps are stored as a latest-login snapshot only; historical login events are not recorded.' },
        },
        audit: {
          totalCount: auditTotalCount,
          rows: visibleAuditLogs.map((log) => ({
            id: log._id,
            user: log.userName || 'Unknown user',
            action: log.action,
            module: log.entityType || (log.action.split(/[_:]/)[0] || 'system'),
            record: log.details || '—',
            date: log.createdAt,
            status: null,
          })),
          options: {
            users: await User.find({}).select('name username').sort({ name: 1 }).limit(2000).lean(),
            roles: [...roleFilterOptions.values()],
            departments: [...new Set(departmentGroups.map(({ _id }) => _id))],
            actions: auditOptionRows.map(({ _id }) => _id).filter(Boolean),
            modules: [...new Set(visibleAuditLogs.map((log) => log.entityType || log.action.split(/[_:]/)[0]).filter(Boolean))].sort(),
          },
        },
        masterData,
        security: {
          failedLoginAttempts: {
            available: failedLoginEvents > 0,
            events: failedLoginEvents,
            currentAccountCounters: loginCounters[0]?.counters || 0,
            lockedAccounts: loginCounters[0]?.locked || 0,
            message: failedLoginEvents
              ? 'Login failure event counts are based on recorded audit events.'
              : 'Historical failed-login events are not recorded. User account records expose only a resettable failed-attempt counter and current lockout state.',
          },
          unauthorizedAccess: {
            available: unauthorizedEvents > 0,
            events: unauthorizedEvents,
            message: unauthorizedEvents
              ? 'Events reflect matching records in the audit log.'
              : 'Unauthorized-access events are not currently written to the audit log.',
          },
          roleAndPermissionChanges: securityEvents.filter((log) => log.action.startsWith('ROLE_')).map((log) => ({
            id: log._id,
            user: log.userName || 'Unknown user',
            action: log.action,
            details: log.details || '—',
            date: log.createdAt,
          })),
          accountStatusChanges: securityEvents.filter((log) => log.action === 'USER_STATUS_CHANGED').map((log) => ({
            id: log._id,
            user: log.userName || 'Unknown user',
            action: log.action,
            details: log.details || '—',
            date: log.createdAt,
          })),
        },
      },
    });
  } catch (error) {
    console.error('Failed to generate System Admin reports:', error);
    return res.status(500).json({ success: false, message: 'Unable to load System Admin reports.' });
  }
};

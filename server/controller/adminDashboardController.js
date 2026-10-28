import { AuditLog } from '../module/AdminDashboardModels.js';
import Department from '../module/Department.js';
import User from '../module/User.js';

const securityActionPattern = '^(AUTH_LOGIN_FAILED|UNAUTHORIZED_ACCESS|ACCESS_DENIED)';
const recentActivityLimit = 8;
const securityAlertPeriodDays = 30;

const getActivityModule = (event) => {
  const entity = (event.entityType || '').toLowerCase();
  if (entity.includes('user') || /^USER_/i.test(event.action)) return 'User Management';
  if (entity.includes('role') || /^ROLE_/i.test(event.action)) return 'Roles & Permissions';
  if (entity.includes('department') || /^DEPARTMENT_/i.test(event.action)) return 'Departments';
  if (entity.includes('master_data') || /^MASTER_DATA_/i.test(event.action)) return 'Master Data';
  if (entity === 'authentication' || /^(AUTH|LOGIN|LOGOUT|UNAUTHORIZED|ACCESS_DENIED)/i.test(event.action)) return 'Security';
  if (entity === 'system_settings') return 'System Settings';
  return entity ? entity.replaceAll('_', ' ') : 'System';
};

export const getAdminDashboardData = async (req, res) => {
  try {
    const alertSince = new Date(Date.now() - securityAlertPeriodDays * 24 * 60 * 60 * 1000);
    const [
      userSummaryRows,
      departmentSummaryRows,
      departmentRecords,
      roleStatusRows,
      activeStaffByDepartment,
      recentActivities,
      securityAlerts,
    ] = await Promise.all([
      User.aggregate([{
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
        },
      }]),
      Department.aggregate([{
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
        },
      }]),
      Department.find()
        .select('name code status')
        .sort({ name: 1 })
        .lean(),
      User.aggregate([
        {
          $group: {
            _id: { role: { $ifNull: ['$role', 'Unassigned'] }, status: '$status' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.role': 1 } },
      ]),
      User.aggregate([
        { $match: { status: 'Active', role: { $ne: 'Admin' }, roles: { $nin: ['Admin'] } } },
        {
          $group: {
            _id: {
              departmentId: { $ifNull: ['$departmentId', null] },
              department: { $ifNull: ['$department', ''] },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      AuditLog.find()
        .select('userName userRole action result entityType createdAt')
        .sort({ createdAt: -1, _id: -1 })
        .limit(recentActivityLimit)
        .lean(),
      AuditLog.countDocuments({
        createdAt: { $gte: alertSince },
        action: { $regex: securityActionPattern, $options: 'i' },
      }),
    ]);

    const users = userSummaryRows[0] || { total: 0, active: 0 };
    const staffCountsById = new Map();
    const staffCountsByName = new Map();
    for (const { _id, count } of activeStaffByDepartment) {
      if (_id.departmentId) {
        const key = String(_id.departmentId);
        staffCountsById.set(key, (staffCountsById.get(key) || 0) + count);
      } else if (_id.department) {
        staffCountsByName.set(_id.department, (staffCountsByName.get(_id.department) || 0) + count);
      }
    }
    const roleStats = new Map();
    for (const { _id, count } of roleStatusRows) {
      const role = _id.role || 'Unassigned';
      const stats = roleStats.get(role) || { role, total: 0, active: 0, inactive: 0, onLeave: 0 };
      stats.total += count;
      if (_id.status === 'Active') stats.active += count;
      else if (_id.status === 'Inactive') stats.inactive += count;
      else if (_id.status === 'On Leave') stats.onLeave += count;
      roleStats.set(role, stats);
    }

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalUsers: users.total,
          activeUsers: users.active,
          totalDepartments: departmentSummaryRows[0]?.total || 0,
          securityAlerts,
          securityAlertPeriodDays,
        },
        departments: departmentRecords.map((department) => ({
          id: department._id,
          name: department.name,
          code: department.code,
          status: department.status || 'Unknown',
          activeStaffCount: (staffCountsById.get(String(department._id)) || 0)
            + (staffCountsByName.get(department.name) || 0),
        })),
        userRoleStats: [...roleStats.values()].sort((left, right) => right.total - left.total),
        recentActivities: recentActivities.map((event) => ({
          id: event._id,
          action: event.action,
          actor: event.userName || 'Unknown user',
          role: event.userRole || 'Not recorded',
          module: getActivityModule(event),
          result: event.result || 'success',
          createdAt: event.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to load System Admin dashboard data:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load System Admin dashboard data.',
    });
  }
};

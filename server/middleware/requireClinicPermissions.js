import RolePermission from '../module/RolePermission.js';

export const requireClinicPermissions = (...requiredPermissions) => async (req, res, next) => {
  const activeRole = String(req.user?.activeRole || req.user?.role || '').trim();
  if (!activeRole || !requiredPermissions.length) {
    return res.status(403).json({ success: false, message: 'Required role permissions are unavailable.' });
  }

  try {
    const normalizedRoleName = activeRole.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const escapedRoleName = normalizedRoleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizedRoleCode = activeRole.toUpperCase().replace(/[\s-]+/g, '_');
    const role = await RolePermission.findOne({
      $and: [
        {
          $or: [
            { roleName: { $regex: `^${escapedRoleName}$`, $options: 'i' } },
            { displayName: { $regex: `^${escapedRoleName}$`, $options: 'i' } },
            { roleCode: normalizedRoleCode },
          ],
        },
        { $or: [{ status: 'Active' }, { status: { $exists: false } }] },
      ],
    })
      .select('permissions')
      .lean();
    const granted = new Set(role?.permissions || []);
    const missing = requiredPermissions.filter((permission) => !granted.has(permission));
    if (missing.length) {
      return res.status(403).json({
        success: false,
        message: 'Your active role does not grant the required patient-record permissions.',
      });
    }
    return next();
  } catch (error) {
    console.error('Unable to verify clinic permissions:', error);
    return res.status(503).json({ success: false, message: 'Unable to verify your role permissions. Please try again.' });
  }
};

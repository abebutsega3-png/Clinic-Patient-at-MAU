const normalizeRole = (role) => String(role || '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getUserRoleNames = (user) => [
  user?.activeRole,
  user?.role,
  ...(Array.isArray(user?.roles) ? user.roles : []),
  user?.position,
  user?.department,
].map(normalizeRole).filter(Boolean);

const isExaminationRole = (role) => (
  role.includes('examination') || role.includes('exam room') || role.includes('doctor')
);
const isLaboratoryRole = (role) => role.includes('lab') || role.includes('laboratory');

const requireRole = (isAllowed, message) => (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      success: false,
      message: 'Change your temporary password before continuing.',
    });
  }

  const roleNames = getUserRoleNames(req.user);
  if (!roleNames.some(isAllowed)) {
    return res.status(403).json({
      success: false,
      message,
    });
  }

  return next();
};

export const requireExaminationRoomAccess = () => requireRole(
  isExaminationRole,
  'Examination Room access is required.',
);

export const requireExaminationOrLabAccess = () => requireRole(
  (role) => isExaminationRole(role) || isLaboratoryRole(role),
  'Examination Room or laboratory access is required.',
);

export const requireLabProcessingAccess = () => requireRole(
  isLaboratoryRole,
  'Laboratory staff access is required to process lab results.',
);

const cardRoomRoles = new Set(['card chief']);

export const requireCardRoomAccess = () => (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ success: false, message: 'Change your temporary password before continuing.' });
  }
  const activeRole = String(req.user?.activeRole || req.user?.role || '').trim();
  if (!cardRoomRoles.has(activeRole.toLowerCase())) {
    return res.status(403).json({ success: false, message: 'Card Room access is required.' });
  }

  return next();
};

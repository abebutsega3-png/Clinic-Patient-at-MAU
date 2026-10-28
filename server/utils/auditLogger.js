import { AuditLog } from '../module/AdminDashboardModels.js';

const limitText = (value, limit = 500) => (
  typeof value === 'string' ? value.trim().slice(0, limit) : ''
);

export const writeAuditEvent = ({
  req,
  action,
  result = 'success',
  details = '',
  entityType = '',
  entityId = null,
  changes = [],
  actor = req?.user,
  actorName,
  actorRole,
}) => AuditLog.create({
  userId: actor?._id || undefined,
  userName: limitText(actorName || actor?.name || actor?.username || 'Unknown user', 120),
  userRole: limitText(actorRole || actor?.activeRole || actor?.role || 'Unknown', 80),
  action: limitText(action, 80),
  result,
  details: limitText(details),
  entityType: limitText(entityType, 80),
  entityId: entityId || undefined,
  ipAddress: limitText(req?.ip || '', 64),
  changes: (Array.isArray(changes) ? changes : []).slice(0, 100).map(({ field, from, to }) => ({
    field: limitText(field, 80),
    from: limitText(String(from ?? ''), 500),
    to: limitText(String(to ?? ''), 500),
  })),
});

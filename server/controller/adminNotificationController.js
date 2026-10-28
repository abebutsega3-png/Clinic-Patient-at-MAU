import mongoose from 'mongoose';
import ClinicNotification from '../module/ClinicNotification.js';
import Department from '../module/Department.js';
import RolePermission from '../module/RolePermission.js';
import SystemSettings from '../module/SystemSettings.js';
import User from '../module/User.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const notificationTypes = new Set([
  'system_announcement',
  'user_account_update',
  'security_alert',
  'maintenance_announcement',
]);
const priorities = new Set(['low', 'normal', 'high', 'urgent']);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

const defaultNotificationSettings = () => ({
  inAppEnabled: true,
  categories: Object.fromEntries([...notificationTypes].map((type) => [type, true])),
});

const notificationSettingsForApi = (settings) => ({
  inAppEnabled: settings?.notificationSettings?.inAppEnabled ?? true,
  categories: {
    ...defaultNotificationSettings().categories,
    ...(settings?.notificationSettings?.categories?.toObject?.()
      || settings?.notificationSettings?.categories
      || {}),
  },
  emailEnabled: false,
});

const getSettingsDocument = async () => {
  let settings = await SystemSettings.findOne({ key: 'system' });
  if (!settings) {
    settings = await SystemSettings.create({ key: 'system' });
  }
  return settings;
};

const serializeNotification = (notification) => ({
  id: notification._id,
  title: notification.title,
  message: notification.message,
  notificationType: notification.notificationType || 'clinic_workflow',
  channel: notification.channel || 'in_app',
  priority: notification.priority || 'normal',
  deliveryStatus: notification.deliveryStatus || 'created',
  recipient: notification.recipient ? {
    id: notification.recipient._id || notification.recipient,
    name: notification.recipient.name || 'Unknown user',
    username: notification.recipient.username || '',
    role: notification.recipientRole || notification.recipient.role || 'Not recorded',
    department: notification.recipientDepartment || notification.recipient.department || 'Not recorded',
  } : null,
  sender: notification.sender || null,
  requestId: notification.request || null,
  batchId: notification.batchId || '',
  createdAt: notification.createdAt,
  readAt: notification.readAt,
  deliveryAttempts: notification.deliveryAttempts || [],
});

const buildNotificationFilter = (query) => {
  const startDate = typeof query.startDate === 'string' ? query.startDate : '';
  const endDate = typeof query.endDate === 'string' ? query.endDate : '';
  const start = parseDate(startDate);
  const end = parseDate(endDate, true);
  if ((startDate && !start) || (endDate && !end) || (start && end && start > end)) {
    return { error: 'Enter a valid date range with the start on or before the end.' };
  }
  if (start && end && (end.getTime() - start.getTime()) / 86400000 > 366) {
    return { error: 'Notification date ranges cannot exceed 366 days.' };
  }

  const conditions = [];
  if (start || end) conditions.push({ createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } });
  if (query.userId) {
    if (typeof query.userId !== 'string' || !mongoose.isValidObjectId(query.userId)) {
      return { error: 'Select a valid recipient.' };
    }
    conditions.push({ recipient: new mongoose.Types.ObjectId(query.userId) });
  }
  if (typeof query.role === 'string' && query.role) conditions.push({ recipientRole: query.role });
  if (typeof query.department === 'string' && query.department) conditions.push({ recipientDepartment: query.department });
  if (typeof query.type === 'string' && query.type) conditions.push({ notificationType: query.type });
  if (typeof query.channel === 'string' && query.channel) {
    if (!['in_app', 'email'].includes(query.channel)) return { error: 'Select a valid notification channel.' };
    conditions.push({ channel: query.channel });
  }
  if (typeof query.priority === 'string' && query.priority) {
    if (!priorities.has(query.priority)) return { error: 'Select a valid notification priority.' };
    conditions.push({ priority: query.priority });
  }
  if (typeof query.status === 'string' && query.status) {
    if (query.status === 'unread') conditions.push({ readAt: null });
    else if (query.status === 'read') conditions.push({ readAt: { $ne: null } });
    else if (query.status === 'created') conditions.push({ $or: [{ deliveryStatus: 'created' }, { deliveryStatus: { $exists: false } }] });
    else if (['queued', 'sent', 'delivered', 'failed'].includes(query.status)) conditions.push({ deliveryStatus: query.status });
    else return { error: 'Select a valid notification status.' };
  }
  if (typeof query.search === 'string' && query.search.trim()) {
    const expression = new RegExp(escapeRegex(query.search.trim().slice(0, 100)), 'i');
    const searchConditions = [{ title: expression }, { message: expression }, { recipientRole: expression }, { recipientDepartment: expression }];
    conditions.push({ $or: searchConditions });
  }
  return { filter: conditions.length ? { $and: conditions } : {} };
};

export const getAdminNotifications = async (req, res) => {
  const parsed = buildNotificationFilter(req.query);
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
  const sortBy = ['createdAt', 'title', 'deliveryStatus', 'priority', 'notificationType', 'channel', 'recipientRole', 'recipientDepartment'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'createdAt';
  const direction = req.query.sortDirection === 'asc' ? 1 : -1;

  try {
    const [notifications, total, summary, recipients, roles, departments, settings, channels] = await Promise.all([
      ClinicNotification.find(parsed.filter)
        .populate('recipient', 'name username role department')
        .sort({ [sortBy]: direction, _id: direction })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ClinicNotification.countDocuments(parsed.filter),
      ClinicNotification.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$readAt', null] }, null] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$deliveryStatus', 'created'] }, 'delivered'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'failed'] }, 1, 0] } },
            created: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$deliveryStatus', 'created'] }, 'created'] }, 1, 0] } },
            queued: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'queued'] }, 1, 0] } },
            sent: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'sent'] }, 1, 0] } },
            read: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$readAt', null] }, null] }, 1, 0] } },
          },
        },
      ]),
      User.find({ status: 'Active' }).select('name username role department').sort({ name: 1 }).limit(2000).lean(),
      RolePermission.find({ status: 'Active' }).select('roleName displayName').sort({ roleName: 1 }).lean(),
      Department.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean(),
      SystemSettings.findOne({ key: 'system' }).select('notificationSettings').lean(),
      ClinicNotification.distinct('channel'),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || { total: 0, unread: 0, delivered: 0, failed: 0, created: 0, queued: 0, sent: 0, read: 0 },
        notifications: notifications.map(serializeNotification),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        options: {
          recipients: recipients.map(({ _id, name, username, role, department }) => ({
            id: String(_id), name, username: username || '', role: role || 'Unassigned', department: department || 'Unassigned',
          })),
          roles: roles.map(({ roleName, displayName }) => ({ value: roleName, label: displayName || roleName })),
          departments: departments.map(({ name }) => name),
          types: [...notificationTypes],
          priorities: [...priorities],
          channels: [...new Set(['in_app', ...channels])].map((value) => ({
            value,
            label: value === 'in_app' ? 'In-app' : value === 'email' ? 'Email (historical)' : value,
          })),
        },
        settings: notificationSettingsForApi(settings),
      },
    });
  } catch (error) {
    console.error('Failed to load System Admin notifications:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
  }
};

export const getAdminNotificationDetails = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Notification ID is invalid.' });
  }
  try {
    const notification = await ClinicNotification.findById(req.params.id)
      .populate('recipient', 'name username role department')
      .lean();
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    return res.status(200).json({ success: true, data: serializeNotification(notification) });
  } catch (error) {
    console.error('Failed to load notification details:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notification details.' });
  }
};

export const getAdminNotificationSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne({ key: 'system' }).select('notificationSettings').lean();
    return res.status(200).json({ success: true, data: notificationSettingsForApi(settings) });
  } catch (error) {
    console.error('Failed to load notification settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notification settings.' });
  }
};

export const updateAdminNotificationSettings = async (req, res) => {
  const incoming = req.body?.settings;
  const categoryKeys = [...notificationTypes];
  if (!incoming || typeof incoming.inAppEnabled !== 'boolean'
    || !incoming.categories || typeof incoming.categories !== 'object'
    || categoryKeys.some((key) => typeof incoming.categories[key] !== 'boolean')
    || Object.keys(incoming.categories).some((key) => !categoryKeys.includes(key))
    || Object.keys(incoming).some((key) => !['inAppEnabled', 'categories'].includes(key))) {
    return res.status(400).json({ success: false, message: 'Provide valid in-app notification settings for each supported category.' });
  }
  try {
    const settings = await getSettingsDocument();
    const previous = notificationSettingsForApi(settings);
    settings.notificationSettings = {
      inAppEnabled: incoming.inAppEnabled,
      categories: incoming.categories,
    };
    await settings.save();
    await writeAuditEvent({
      req,
      action: 'NOTIFICATION_SETTINGS_UPDATED',
      details: 'Updated System Admin notification preferences.',
      entityType: 'system_settings',
      entityId: settings._id,
      changes: [
        { field: 'inAppEnabled', from: String(previous.inAppEnabled), to: String(incoming.inAppEnabled) },
        ...categoryKeys.map((key) => ({
          field: `categories.${key}`,
          from: String(previous.categories[key]),
          to: String(incoming.categories[key]),
        })).filter((change) => change.from !== change.to),
      ],
    });
    return res.status(200).json({
      success: true,
      message: 'Notification settings saved.',
      data: notificationSettingsForApi(settings),
    });
  } catch (error) {
    console.error('Failed to save notification settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to save notification settings.' });
  }
};

export const sendAdminNotification = async (req, res) => {
  const {
    title,
    message,
    recipientType,
    recipientId = '',
    notificationType,
    priority = 'normal',
    channel = 'in_app',
    idempotencyKey,
  } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 160
    || typeof message !== 'string' || !message.trim() || message.trim().length > 4000) {
    return res.status(400).json({ success: false, message: 'Title (1–160 characters) and message (1–4,000 characters) are required.' });
  }
  if (!notificationTypes.has(notificationType)) {
    return res.status(400).json({ success: false, message: 'Choose a supported notification type.' });
  }
  if (!priorities.has(priority)) return res.status(400).json({ success: false, message: 'Choose a supported priority.' });
  if (channel !== 'in_app') {
    return res.status(400).json({ success: false, message: 'Email delivery is not configured. Only in-app notifications can be sent.' });
  }
  if (!['user', 'role', 'department', 'all'].includes(recipientType)) {
    return res.status(400).json({ success: false, message: 'Choose a valid recipient type.' });
  }
  if (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(idempotencyKey)) {
    return res.status(400).json({ success: false, message: 'A valid unique send request key is required.' });
  }

  try {
    const existingBatch = await ClinicNotification.findOne({ batchId: idempotencyKey }).select('batchId').lean();
    if (existingBatch) {
      const batch = await ClinicNotification.find({ batchId: idempotencyKey }).select('_id').lean();
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'This send request was already processed; no duplicate notification was created.',
        data: { batchId: idempotencyKey, created: batch.length },
      });
    }

    const systemSettings = await SystemSettings.findOne({ key: 'system' }).select('notificationSettings').lean();
    const notificationSettings = notificationSettingsForApi(systemSettings);
    if (!notificationSettings.inAppEnabled) {
      return res.status(409).json({ success: false, message: 'In-app notifications are disabled by System Settings.' });
    }
    if (!notificationSettings.categories[notificationType]) {
      return res.status(409).json({ success: false, message: 'This notification category is disabled by System Settings.' });
    }

    let users;
    if (recipientType === 'user') {
      if (!mongoose.isValidObjectId(recipientId)) return res.status(400).json({ success: false, message: 'Select a valid user.' });
      users = await User.find({ _id: recipientId, status: 'Active' }).select('name username role department').lean();
    } else if (recipientType === 'role') {
      const role = await RolePermission.findOne({ roleName: recipientId, status: 'Active' }).select('roleName').lean();
      if (!role) return res.status(400).json({ success: false, message: 'Select an active role.' });
      users = await User.find({
        status: 'Active',
        $or: [{ role: role.roleName }, { roles: role.roleName }],
      }).select('name username role department').lean();
    } else if (recipientType === 'department') {
      const department = await Department.findOne({ name: recipientId, status: 'Active' }).select('name').lean();
      if (!department) return res.status(400).json({ success: false, message: 'Select an active department.' });
      users = await User.find({ status: 'Active', department: department.name })
        .select('name username role department')
        .lean();
    } else {
      users = await User.find({ status: 'Active', _id: { $ne: req.user._id } })
        .select('name username role department')
        .limit(2001)
        .lean();
    }

    const uniqueUsers = [...new Map(users.map((user) => [String(user._id), user])).values()];
    if (!uniqueUsers.length) return res.status(404).json({ success: false, message: 'No active eligible recipients matched this selection.' });
    if (uniqueUsers.length > 2000) {
      return res.status(413).json({ success: false, message: 'This audience exceeds the 2,000-recipient limit. Select a smaller role or department audience.' });
    }

    try {
      const created = await ClinicNotification.insertMany(uniqueUsers.map((user) => ({
        recipient: user._id,
        title: title.trim(),
        message: message.trim(),
        notificationType,
        channel: 'in_app',
        priority,
        deliveryStatus: 'created',
        recipientRole: user.role || 'Unassigned',
        recipientDepartment: user.department || 'Unassigned',
        sender: req.user._id,
        batchId: idempotencyKey,
        deliveryAttempts: [{ channel: 'in_app', status: 'created', attemptedAt: new Date() }],
      })), { ordered: true });

      let auditLogStatus = 'recorded';
      try {
        await writeAuditEvent({
          req,
          action: 'NOTIFICATION_SENT',
          details: `Created ${created.length} in-app ${notificationType} notification(s) for ${recipientType} audience.`,
          entityType: 'notifications',
          entityId: created[0]?._id,
        });
      } catch (auditError) {
        auditLogStatus = 'failed';
        console.error('Notification batch was stored but its audit event could not be recorded:', auditError);
      }
      return res.status(201).json({
        success: true,
        message: `Notification stored for ${created.length} eligible recipient(s). In-app availability is recorded; device delivery is not confirmed.${auditLogStatus === 'failed' ? ' The audit event could not be recorded.' : ''}`,
        data: { batchId: idempotencyKey, created: created.length, deliveryStatus: 'created', auditLogStatus },
      });
    } catch (error) {
      if (error.code === 11000) {
        const duplicateBatch = await ClinicNotification.find({ batchId: idempotencyKey }).select('_id').lean();
        if (duplicateBatch.length) {
          return res.status(200).json({
            success: true,
            duplicate: true,
            message: 'This send request was already processed; no duplicate notification was created.',
            data: { batchId: idempotencyKey, created: duplicateBatch.length },
          });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Failed to create System Admin notifications:', error);
    return res.status(500).json({ success: false, message: 'Unable to create notifications. Check delivery records before retrying.' });
  }
};

export const retryAdminNotification = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Notification ID is invalid.' });
  }
  try {
    const notification = await ClinicNotification.findById(req.params.id).select('channel deliveryStatus').lean();
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    if (notification.deliveryStatus !== 'failed') {
      return res.status(409).json({ success: false, message: 'Only failed notification deliveries can be retried.' });
    }
    if (notification.channel !== 'email') {
      return res.status(409).json({ success: false, message: 'This in-app notification is already stored and is not eligible for delivery retry.' });
    }
    return res.status(503).json({ success: false, message: 'Email delivery is not configured; this notification cannot be retried.' });
  } catch (error) {
    console.error('Failed to inspect notification retry:', error);
    return res.status(500).json({ success: false, message: 'Unable to inspect notification retry eligibility.' });
  }
};

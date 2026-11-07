import mongoose from 'mongoose';
import Department from '../module/Department.js';
import RolePermission from '../module/RolePermission.js';
import StaffAnnouncement from '../module/StaffAnnouncement.js';
import User from '../module/User.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
const priorities = new Set(['normal', 'important', 'urgent']);
const audienceTypes = new Set(['all', 'role', 'department']);
const parseDate = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

const userRoles = (user) => [
  user.activeRole,
  user.role,
  ...(Array.isArray(user.roles) ? user.roles : []),
].map(normalizeRole).filter(Boolean);

const isClinicHead = (user) => userRoles(user).includes('clinic head');
const isEligibleStaff = (user) => !userRoles(user).some((role) => ['admin', 'system admin'].includes(role));

const getRecipients = async ({ audienceType, targetRole, targetDepartment }) => {
  const [activeUsers, department] = await Promise.all([
    User.find({ status: 'Active' }).select('activeRole role roles department departmentId').lean(),
    audienceType === 'department'
      ? Department.findById(targetDepartment).select('name').lean()
      : Promise.resolve(null),
  ]);
  return activeUsers.filter((user) => {
    if (!isEligibleStaff(user)) return false;
    if (audienceType === 'all') return true;
    if (audienceType === 'role') return userRoles(user).includes(normalizeRole(targetRole));
    return String(user.departmentId || '') === String(targetDepartment)
      || Boolean(department && normalizeRole(user.department) === normalizeRole(department.name));
  });
};

const parseAnnouncementInput = async (body) => {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const audienceType = typeof body?.audienceType === 'string' ? body.audienceType.trim() : '';
  const targetRole = typeof body?.targetRole === 'string' ? body.targetRole.trim() : '';
  const targetDepartment = typeof body?.targetDepartment === 'string' ? body.targetDepartment.trim() : '';
  const priority = typeof body?.priority === 'string' ? body.priority.trim() : 'normal';

  if (!title || title.length > 160 || !message || message.length > 10000) {
    return { error: 'Enter a title (up to 160 characters) and message (up to 10,000 characters).' };
  }
  if (!['all', 'role', 'department'].includes(audienceType) || !priorities.has(priority)) {
    return { error: 'Choose a valid audience and priority.' };
  }
  if (audienceType === 'role' && !targetRole) return { error: 'Choose the recipient role.' };
  if (audienceType === 'department' && !mongoose.isValidObjectId(targetDepartment)) {
    return { error: 'Choose a valid department.' };
  }
  if (audienceType === 'role') {
    const role = await RolePermission.findOne({
      status: 'Active',
      roleName: { $regex: `^${targetRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    }).select('roleName').lean();
    if (!role) return { error: 'The selected role is not active.' };
    return { value: { title, message, audienceType, targetRole: role.roleName, targetDepartment: null, priority } };
  }
  if (audienceType === 'department') {
    const department = await Department.findOne({ _id: targetDepartment, status: 'Active' }).select('_id').lean();
    if (!department) return { error: 'The selected department is not active.' };
    return { value: { title, message, audienceType, targetRole: '', targetDepartment: department._id, priority } };
  }
  return { value: { title, message, audienceType, targetRole: '', targetDepartment: null, priority } };
};

const serializeAnnouncement = (announcement, includeReadStatus) => {
  const recipients = announcement.recipients || [];
  const readCount = recipients.filter((recipient) => recipient.readAt).length;
  return {
    id: String(announcement._id),
    title: announcement.title,
    message: announcement.message,
    audienceType: announcement.audienceType,
    targetRole: announcement.targetRole || '',
    targetDepartment: announcement.targetDepartment
      ? {
        id: String(announcement.targetDepartment._id || announcement.targetDepartment),
        name: announcement.targetDepartment.name || '',
      }
      : null,
    priority: announcement.priority,
    status: announcement.status,
    createdAt: announcement.createdAt,
    createdBy: announcement.createdBy?.name || '',
    readCount,
    recipientCount: recipients.length,
    unreadRecipients: includeReadStatus
      ? recipients.filter((recipient) => !recipient.readAt).map((recipient) => ({
        id: String(recipient.user?._id || recipient.user),
        name: recipient.user?.name || 'Unknown staff member',
        role: recipient.user?.activeRole || recipient.user?.role || '',
        department: recipient.user?.department || '',
      }))
      : [],
    recipients: includeReadStatus
      ? recipients.map((recipient) => ({
        id: String(recipient.user?._id || recipient.user),
        name: recipient.user?.name || 'Unknown staff member',
        role: recipient.user?.activeRole || recipient.user?.role || '',
        department: recipient.user?.department || '',
        readAt: recipient.readAt,
        acknowledgedAt: recipient.acknowledgedAt,
      }))
      : [],
    readAt: includeReadStatus
      ? null
      : recipients.find((recipient) => String(recipient.user?._id || recipient.user) === String(announcement.currentUserId))?.readAt || null,
    acknowledgedAt: includeReadStatus
      ? null
      : recipients.find((recipient) => String(recipient.user?._id || recipient.user) === String(announcement.currentUserId))?.acknowledgedAt || null,
  };
};

export const getAnnouncementOptions = async (req, res) => {
  try {
    const [roles, departments] = await Promise.all([
      RolePermission.find({ status: 'Active' }).select('roleName displayName').sort({ displayName: 1 }).lean(),
      Department.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean(),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        roles: roles.filter(({ roleName }) => !['admin', 'system admin'].includes(normalizeRole(roleName))),
        departments,
      },
    });
  } catch (error) {
    console.error('Failed to load announcement audience options:', error);
    return res.status(500).json({ success: false, message: 'Unable to load announcement audience options.' });
  }
};

export const listAnnouncements = async (req, res) => {
  const manager = isClinicHead(req.user);
  const conditions = [{ status: 'sent' }];
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : '';
  const audienceType = typeof req.query.audienceType === 'string' ? req.query.audienceType.trim() : '';
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';
  const start = startDate ? parseDate(startDate) : null;
  const end = endDate ? parseDate(endDate, true) : null;
  if (priority && !priorities.has(priority)) {
    return res.status(400).json({ success: false, message: 'Choose a valid priority filter.' });
  }
  if (audienceType && !audienceTypes.has(audienceType)) {
    return res.status(400).json({ success: false, message: 'Choose a valid audience filter.' });
  }
  if ((startDate && !start) || (endDate && !end) || (start && end && start > end)) {
    return res.status(400).json({ success: false, message: 'Enter a valid announcement date range.' });
  }
  if (priority) conditions.push({ priority });
  if (audienceType) conditions.push({ audienceType });
  if (start || end) conditions.push({ createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } });
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ $or: [{ title: { $regex: escapedSearch, $options: 'i' } }, { message: { $regex: escapedSearch, $options: 'i' } }] });
  }
  if (!manager) conditions.push({ 'recipients.user': req.user._id });

  try {
    let announcements = await StaffAnnouncement.find({ $and: conditions })
      .populate('createdBy', 'name')
      .populate('targetDepartment', 'name')
      .populate({
        path: 'recipients.user',
        select: 'name role activeRole department',
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    announcements = announcements.map((announcement) => ({
      ...announcement,
      currentUserId: req.user._id,
    }));
    return res.status(200).json({
      success: true,
      data: announcements.map((announcement) => serializeAnnouncement(announcement, manager)),
    });
  } catch (error) {
    console.error('Failed to load staff announcements:', error);
    return res.status(500).json({ success: false, message: 'Unable to load announcements.' });
  }
};

export const createAnnouncement = async (req, res) => {
  if (!isClinicHead(req.user)) {
    return res.status(403).json({ success: false, message: 'Clinic Head access is required to publish announcements.' });
  }
  try {
    const parsed = await parseAnnouncementInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const recipients = await getRecipients(parsed.value);
    if (!recipients.length) return res.status(409).json({ success: false, message: 'The selected audience has no active staff members.' });
    const announcement = await StaffAnnouncement.create({
      ...parsed.value,
      createdBy: req.user._id,
      recipients: recipients.map(({ _id }) => ({ user: _id })),
    });
    await writeAuditEvent({
      req,
      action: 'STAFF_ANNOUNCEMENT_CREATED',
      entityType: 'staff_announcement',
      entityId: announcement._id,
      details: `Published ${parsed.value.priority} announcement "${parsed.value.title}" to ${recipients.length} staff members.`,
    });
    req.app.get('io')?.emit('clinic:announcement-updated');
    return res.status(201).json({ success: true, message: 'Announcement published.', data: { id: String(announcement._id) } });
  } catch (error) {
    console.error('Failed to publish staff announcement:', error);
    return res.status(500).json({ success: false, message: 'Unable to publish announcement.' });
  }
};

export const updateAnnouncement = async (req, res) => {
  if (!isClinicHead(req.user)) {
    return res.status(403).json({ success: false, message: 'Clinic Head access is required to edit announcements.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Choose a valid announcement.' });
  }
  try {
    const parsed = await parseAnnouncementInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const announcement = await StaffAnnouncement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    const users = await getRecipients(parsed.value);
    if (!users.length) return res.status(409).json({ success: false, message: 'The selected audience has no active staff members.' });
    const previousRecipients = new Map(announcement.recipients.map((recipient) => [String(recipient.user), recipient]));
    Object.assign(announcement, parsed.value);
    announcement.recipients = users.map(({ _id }) => {
      const previous = previousRecipients.get(String(_id));
      return {
        user: _id,
        readAt: previous?.readAt || null,
        acknowledgedAt: previous?.acknowledgedAt || null,
      };
    });
    await announcement.save();
    await writeAuditEvent({
      req,
      action: 'STAFF_ANNOUNCEMENT_UPDATED',
      entityType: 'staff_announcement',
      entityId: announcement._id,
      details: `Updated staff announcement "${announcement.title}".`,
    });
    req.app.get('io')?.emit('clinic:announcement-updated');
    return res.status(200).json({ success: true, message: 'Announcement updated.' });
  } catch (error) {
    console.error('Failed to update staff announcement:', error);
    return res.status(500).json({ success: false, message: 'Unable to update announcement.' });
  }
};

export const deleteAnnouncement = async (req, res) => {
  if (!isClinicHead(req.user)) {
    return res.status(403).json({ success: false, message: 'Clinic Head access is required to delete announcements.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Choose a valid announcement.' });
  }
  try {
    const announcement = await StaffAnnouncement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    await writeAuditEvent({
      req,
      action: 'STAFF_ANNOUNCEMENT_DELETED',
      entityType: 'staff_announcement',
      entityId: announcement._id,
      details: `Deleted staff announcement "${announcement.title}".`,
    });
    req.app.get('io')?.emit('clinic:announcement-updated');
    return res.status(200).json({ success: true, message: 'Announcement deleted.' });
  } catch (error) {
    console.error('Failed to delete staff announcement:', error);
    return res.status(500).json({ success: false, message: 'Unable to delete announcement.' });
  }
};

export const updateAnnouncementReadStatus = async (req, res) => {
  const requestedAction = req.body?.action;
  if (!['read', 'acknowledge'].includes(requestedAction)) {
    return res.status(400).json({ success: false, message: 'Choose read or acknowledge as the announcement action.' });
  }
  const action = requestedAction === 'acknowledge' ? 'acknowledgedAt' : 'readAt';
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Choose a valid announcement.' });
  }
  try {
    const announcement = await StaffAnnouncement.findOne({
      _id: req.params.id,
      'recipients.user': req.user._id,
    });
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found for this account.' });
    const recipient = announcement.recipients.find((entry) => String(entry.user) === String(req.user._id));
    const now = new Date();
    if (action === 'acknowledgedAt') {
      recipient.acknowledgedAt = now;
      recipient.readAt ||= now;
    } else {
      recipient.readAt ||= now;
    }
    await announcement.save();
    req.app.get('io')?.emit('clinic:announcement-updated');
    return res.status(200).json({ success: true, message: action === 'readAt' ? 'Announcement marked as read.' : 'Announcement acknowledged.' });
  } catch (error) {
    console.error('Failed to update announcement read status:', error);
    return res.status(500).json({ success: false, message: 'Unable to update announcement status.' });
  }
};

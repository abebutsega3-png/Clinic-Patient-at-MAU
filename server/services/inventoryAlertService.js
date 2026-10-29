import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicNotification from '../module/ClinicNotification.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import { Queue } from '../module/AdminDashboardModels.js';
import StaffAttendance from '../module/StaffAttendance.js';
import { Roster, Staff } from '../module/StaffAndRoster.js';
import User from '../module/User.js';
import { notifyClinicHeads } from '../utils/clinicHeadAlert.js';

const clinicTimeZone = 'Africa/Addis_Ababa';
let smtpConfigurationWarningLogged = false;

const getClinicDate = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: clinicTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getClinicDateKey = (date) => getClinicDate(date);

const getClinicShiftStart = (date, time) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
};

const getClinicDayBounds = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, -3));
  return { start, end: new Date(start.getTime() + 86400000) };
};

const getInventoryAlerts = (items, inventoryRules, now) => {
  const expiryWarningDate = new Date(now.getTime() + (inventoryRules.expiryWarningDays * 86400000));
  const categoryThresholds = new Map(
    (inventoryRules.categoryThresholds || [])
      .map(({ category, threshold }) => [category.trim().toLocaleLowerCase(), threshold])
  );
  const alerts = [];

  for (const item of items) {
    const quantity = Number(item.quantity);
    const categoryThreshold = categoryThresholds.get(String(item.category || '').trim().toLocaleLowerCase());
    const threshold = categoryThreshold ?? inventoryRules.defaultThreshold ?? Number(item.reorderLevel);
    if (Number.isFinite(quantity) && quantity <= threshold) {
      const outOfStock = quantity <= 0;
      alerts.push({
        type: outOfStock ? 'out_of_stock' : 'low_stock',
        key: `${outOfStock ? 'out-of-stock' : 'low-stock'}:${item._id}`,
        targetPath: `/clinic-head/inventory?search=${encodeURIComponent(item.itemName)}&statusFilter=${outOfStock ? 'out_of_stock' : 'low_stock'}`,
        title: outOfStock ? 'Inventory item out of stock' : 'Low inventory stock',
        message: `${item.itemName}: ${Math.max(0, quantity)} remaining (alert threshold: ${threshold}).`,
        priority: outOfStock ? 'urgent' : 'high'
      });
    }

    const batches = Array.isArray(item.batches) && item.batches.length
      ? item.batches.filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate)
      : Number(item.quantity) > 0 && item.expiryDate
        ? [{ batchNumber: '', quantity: item.quantity, expiryDate: item.expiryDate }]
        : [];
    for (const batch of batches) {
      const expiryDate = new Date(batch.expiryDate);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate > expiryWarningDate) continue;

      const expired = expiryDate < now;
      const batchLabel = batch.batchNumber ? ` batch ${batch.batchNumber}` : '';
      alerts.push({
        type: expired ? 'expired' : 'expiring_soon',
        key: `${expired ? 'expired' : 'expiring'}:${item._id}:${batch.batchNumber || expiryDate.toISOString()}`,
        targetPath: `/clinic-head/inventory?search=${encodeURIComponent(item.itemName)}&statusFilter=${expired ? 'expired' : 'expiring_soon'}`,
        title: expired ? 'Expired inventory batch' : 'Inventory batch nearing expiry',
        message: `${item.itemName}${batchLabel} ${expired ? 'expired' : `expires on ${expiryDate.toLocaleDateString('en-US', { timeZone: clinicTimeZone })}`} (${batch.quantity} units).`,
        priority: expired ? 'urgent' : 'high'
      });
    }
  }

  return alerts;
};

const isSmtpConfigured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_USER
  && process.env.SMTP_PASS
  && (process.env.SMTP_FROM || process.env.SMTP_USER)
);

const sendAlertEmail = async (notification, recipientEmail, alerts) => {
  const attempts = notification.deliveryAttempts || [];
  const lastAttempt = attempts.at(-1);
  if (attempts.filter(({ status }) => status === 'failed').length >= 3) return false;
  if (lastAttempt && Date.now() - new Date(lastAttempt.attemptedAt).getTime() < 14 * 60 * 1000) return false;

  await ClinicNotification.updateOne(
    { _id: notification._id },
    {
      $set: { deliveryStatus: 'queued' },
      $push: { deliveryAttempts: { channel: 'email', status: 'queued', attemptedAt: new Date() } }
    }
  );
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const lines = alerts.map((alert) => `- ${alert.title}: ${alert.message}`).join('\n');
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject: `Clinic inventory alerts (${alerts.length})`,
      text: `Inventory alerts detected on ${getClinicDate(new Date())}:\n\n${lines}`
    });
    await ClinicNotification.updateOne(
      { _id: notification._id },
      {
        $set: { deliveryStatus: 'sent' },
        $push: { deliveryAttempts: { channel: 'email', status: 'sent', attemptedAt: new Date() } }
      }
    );
    return true;
  } catch (error) {
    await ClinicNotification.updateOne(
      { _id: notification._id },
      {
        $set: { deliveryStatus: 'failed' },
        $push: {
          deliveryAttempts: {
            channel: 'email',
            status: 'failed',
            attemptedAt: new Date(),
            failureReason: error.message || 'SMTP delivery failed.'
          }
        }
      }
    );
    console.error('Inventory alert email delivery failed:', error);
    return false;
  }
};

export const runInventoryAlertCheck = async () => {
  const now = new Date();
  const date = getClinicDateKey(now);
  const clinicHeadRole = /^clinic head$/i;
  const [inventoryItems, settings, clinicHeads] = await Promise.all([
    ClinicInventory.find().select('itemName category quantity reorderLevel expiryDate batches').lean(),
    ClinicOperationalSettings.findOne({ key: 'clinic' }).select('inventoryRules').lean(),
    User.find({
      status: { $ne: 'Inactive' },
      $or: [
        { role: clinicHeadRole },
        { activeRole: clinicHeadRole },
        { roles: clinicHeadRole }
      ],
      'notificationPreferences.systemNotification': { $ne: false }
    }).select('_id').lean()
  ]);
  const inventoryRules = {
    defaultThreshold: settings?.inventoryRules?.defaultThreshold ?? 20,
    categoryThresholds: settings?.inventoryRules?.categoryThresholds || [],
    expiryWarningDays: settings?.inventoryRules?.expiryWarningDays ?? 90
  };
  const alerts = getInventoryAlerts(inventoryItems, inventoryRules, now);
  await Promise.all(alerts.map(async (alert) => {
    try {
      await notifyClinicHeads({
        batchId: `inventory:${date}:${alert.key}`,
        title: alert.title,
        message: alert.message,
        targetPath: alert.targetPath,
        notificationType: 'system_announcement',
        priority: alert.priority
      });
    } catch (error) {
      console.error('Failed to create Clinic Head inventory notification:', error);
    }
  }));

  const recipientEmail = settings?.inventoryRules?.alertEmail?.trim().toLowerCase();
  if (!recipientEmail || !alerts.length) return { alertCount: alerts.length };
  if (!isSmtpConfigured()) {
    if (!smtpConfigurationWarningLogged) {
      console.warn('Inventory alert email is enabled, but SMTP is not configured. Configure SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM on the server.');
      smtpConfigurationWarningLogged = true;
    }
    return { alertCount: alerts.length, emailSent: false };
  }

  const alertFingerprint = createHash('sha256')
    .update(alerts.map(({ key }) => key).sort().join('|'))
    .digest('hex')
    .slice(0, 16);
  const batchId = `inventory-email:${date}:${alertFingerprint}`;
  let emailNotification = await ClinicNotification.findOne({ batchId, channel: 'email' });
  if (!emailNotification) {
    try {
      emailNotification = await ClinicNotification.create({
        recipient: clinicHeads[0]?._id || null,
        title: 'Daily inventory alert summary',
        message: `${alerts.length} low-stock or expiry alert(s) detected.`,
        notificationType: 'system_announcement',
        channel: 'email',
        priority: 'high',
        recipientRole: 'Clinic Head',
        deliveryStatus: 'queued',
        batchId
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      emailNotification = await ClinicNotification.findOne({ batchId, channel: 'email' });
    }
  }
  const emailSent = emailNotification?.deliveryStatus === 'sent'
    || (emailNotification
      ? await sendAlertEmail(emailNotification, recipientEmail, alerts)
      : false);

  return { alertCount: alerts.length, emailSent };
};

export const runClinicOperationsAlertCheck = async () => {
  const now = new Date();
  const date = getClinicDateKey(now);
  const { start, end } = getClinicDayBounds(date);
  const [
    rosterEntries,
    attendanceEntries,
    settings,
    waitingQueues
  ] = await Promise.all([
    Roster.find({ date, shift: { $in: ['morning', 'afternoon', 'night'] } }).lean(),
    StaffAttendance.find({ date }).select('staffId status timeIn').lean(),
    ClinicOperationalSettings.findOne({ key: 'clinic' })
      .select('rosterRules.shiftTimes rosterRules.gracePeriodMinutes rosterRules.lateAlertTriggerMinutes')
      .lean(),
    Queue.find({
      $or: [{ clinicDate: date }, { arrivedAt: { $gte: start, $lt: end } }],
      status: { $in: ['waiting', 'called'] }
    }).select('department status arrivedAt isEmergency queueNumber').lean()
  ]);
  const attendanceByStaff = new Map(attendanceEntries.map((entry) => [String(entry.staffId), entry]));
  const rosterStaffIds = [...new Set(rosterEntries.map((entry) => String(entry.staffId)))];
  const staffMembers = await Staff.find({ _id: { $in: rosterStaffIds } })
    .select('name department status')
    .lean();
  const knownStaffIds = new Set(staffMembers.map((staff) => String(staff._id)));
  const fallbackUsers = rosterStaffIds.length
    ? await User.find({
      _id: { $in: rosterStaffIds.filter((staffId) => !knownStaffIds.has(staffId)) },
      status: { $ne: 'Inactive' }
    }).select('name department status').lean()
    : [];
  const staffById = new Map(
    [...staffMembers, ...fallbackUsers]
      .filter((staff) => !['Inactive', 'On Leave'].includes(staff.status))
      .map((staff) => [String(staff._id), staff])
  );
  const rosterRules = settings?.rosterRules || {};
  const shiftTimes = rosterRules.shiftTimes || {};
  const gracePeriodMinutes = rosterRules.gracePeriodMinutes ?? 15;
  const lateAlertTriggerMinutes = rosterRules.lateAlertTriggerMinutes ?? 30;
  const noShowNotifications = rosterEntries.flatMap((entry) => {
    const staffId = String(entry.staffId);
    const staff = staffById.get(staffId);
    if (!staff || attendanceByStaff.has(staffId)) return [];
    const shiftStart = shiftTimes[entry.shift]?.start;
    if (!shiftStart) return [];
    const alertAt = new Date(
      getClinicShiftStart(date, shiftStart).getTime()
      + (gracePeriodMinutes + lateAlertTriggerMinutes) * 60000
    );
    if (now < alertAt) return [];
    return [{
      batchId: `staff-no-show:${date}:${staffId}:${entry.shift}`,
      title: 'Scheduled staff no-show',
      message: `${staff.name || 'A staff member'} in ${staff.department || 'an unlisted department'} has no attendance record for the ${entry.shift} shift.`,
      targetPath: `/clinic-head/staff?staff=${encodeURIComponent(staff.name || '')}`,
      priority: 'urgent'
    }];
  });
  await Promise.all(noShowNotifications.map((alert) => notifyClinicHeads(alert)));

  const queuesByDepartment = new Map();
  for (const queue of waitingQueues) {
    const department = String(queue.department || 'Unassigned').trim();
    const entries = queuesByDepartment.get(department) || [];
    entries.push(queue);
    queuesByDepartment.set(department, entries);
  }
  const configuredQueueThreshold = Number.parseInt(process.env.CLINIC_QUEUE_ALERT_THRESHOLD || '10', 10);
  const configuredWaitThreshold = Number.parseInt(process.env.CLINIC_QUEUE_WAIT_ALERT_MINUTES || '30', 10);
  const queueThreshold = Number.isFinite(configuredQueueThreshold) && configuredQueueThreshold > 0
    ? configuredQueueThreshold
    : 10;
  const waitThresholdMinutes = Number.isFinite(configuredWaitThreshold) && configuredWaitThreshold > 0
    ? configuredWaitThreshold
    : 30;
  const queueAlerts = [];
  for (const [department, entries] of queuesByDepartment) {
    const oldestArrival = entries.reduce((oldest, queue) => (
      !oldest || queue.arrivedAt < oldest ? queue.arrivedAt : oldest
    ), null);
    const oldestWaitMinutes = oldestArrival
      ? Math.floor((now.getTime() - new Date(oldestArrival).getTime()) / 60000)
      : 0;
    const reason = entries.length >= queueThreshold
      ? 'high-volume'
      : oldestWaitMinutes >= waitThresholdMinutes ? 'long-wait' : '';
    if (!reason) continue;
    queueAlerts.push(notifyClinicHeads({
      batchId: `queue-bottleneck:${date}:${department.toLowerCase()}:${reason}`,
      title: 'Patient queue bottleneck',
      message: `${department} has ${entries.length} patients waiting; the oldest has waited ${oldestWaitMinutes} minutes.`,
      targetPath: '/clinic-head',
      priority: 'urgent'
    }));
  }
  await Promise.all(queueAlerts);
  return {
    noShowAlertCount: noShowNotifications.length,
    queueAlertCount: queueAlerts.length
  };
};

export const notifyEmergencyQueueArrival = async (queue) => {
  if (!queue?.isEmergency && queue?.priority !== 'Emergency') return 0;
  return notifyClinicHeads({
    batchId: `emergency-queue:${queue._id}`,
    title: 'Emergency patient requires immediate assessment',
    message: `Emergency queue ${queue.queueNumber || ''} in ${queue.department || 'the clinic'} is awaiting assessment.`,
    targetPath: '/clinic-head',
    priority: 'urgent'
  });
};

import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import SystemSettings from '../module/SystemSettings.js';
import { writeAuditEvent } from '../utils/auditLogger.js';
import { defaultSecurityPolicy } from '../utils/securityPolicy.js';

const defaultGeneral = Object.freeze({
  systemName: 'MAU Clinic Management System',
  organizationName: 'Mekdela Amba University',
  timezone: 'Africa/Addis_Ababa',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24-hour',
  language: 'English',
});

const readSettings = async () => {
  let settings = await SystemSettings.findOne({ key: 'system' }).lean();
  if (!settings) {
    settings = (await SystemSettings.create({
      key: 'system',
      general: defaultGeneral,
      security: defaultSecurityPolicy,
    })).toObject();
  }
  return {
    general: { ...defaultGeneral, ...(settings.general || {}) },
    security: { ...defaultSecurityPolicy, ...(settings.security || {}) },
  };
};

const validGeneral = (input) => {
  if (!input || typeof input !== 'object') return 'General settings are required.';
  if (typeof input.systemName !== 'string' || !input.systemName.trim() || input.systemName.trim().length > 120) {
    return 'System name is required and must be 120 characters or fewer.';
  }
  if (typeof input.organizationName !== 'string' || !input.organizationName.trim() || input.organizationName.trim().length > 120) {
    return 'Organization name is required and must be 120 characters or fewer.';
  }
  if (typeof input.timezone !== 'string' || input.timezone.length > 80) return 'Choose a valid timezone.';
  try {
    new Intl.DateTimeFormat('en', { timeZone: input.timezone });
  } catch {
    return 'Choose a valid timezone.';
  }
  if (!['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(input.dateFormat)
    || !['12-hour', '24-hour'].includes(input.timeFormat)
    || !['English', 'Amharic'].includes(input.language)) {
    return 'Date, time, or language format is not supported.';
  }
  return '';
};

const validSecurity = (input) => {
  if (!input || typeof input !== 'object') return 'Security settings are required.';
  const numericRanges = [
    ['minimumPasswordLength', 8, 32],
    ['sessionTimeoutMinutes', 15, 480],
    ['maximumLoginAttempts', 3, 10],
    ['lockoutDurationMinutes', 5, 120],
  ];
  for (const [field, minimum, maximum] of numericRanges) {
    if (!Number.isInteger(input[field]) || input[field] < minimum || input[field] > maximum) {
      return `${field} must be a whole number between ${minimum} and ${maximum}.`;
    }
  }
  for (const field of ['requireLetter', 'requireNumber', 'requireUppercase', 'requireSpecialCharacter']) {
    if (typeof input[field] !== 'boolean') return 'Password policy options must be enabled or disabled.';
  }
  return '';
};

const changedFields = (before, after) => Object.keys(after)
  .filter((field) => before[field] !== after[field])
  .map((field) => ({ field, from: String(before[field]), to: String(after[field]) }));

export const getAdminSystemSettings = async (req, res) => {
  try {
    const data = await readSettings();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Failed to load System Admin settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to load system settings.' });
  }
};

export const updateAdminSystemSettings = async (req, res) => {
  const { section } = req.params;
  if (!['general', 'security'].includes(section)) {
    return res.status(404).json({ success: false, message: 'Settings section is not supported.' });
  }
  const incoming = req.body?.[section];
  const validationError = section === 'general' ? validGeneral(incoming) : validSecurity(incoming);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  const fields = section === 'general'
    ? ['systemName', 'organizationName', 'timezone', 'dateFormat', 'timeFormat', 'language']
    : Object.keys(defaultSecurityPolicy);
  const values = Object.fromEntries(fields.map((field) => [
    field,
    typeof incoming[field] === 'string' ? incoming[field].trim() : incoming[field],
  ]));

  try {
    const current = await readSettings();
    const changes = changedFields(current[section], values);
    if (!changes.length) {
      return res.status(200).json({ success: true, message: 'No settings changed.', data: current });
    }
    const saved = await SystemSettings.findOneAndUpdate(
      { key: 'system' },
      { $set: { [section]: values }, $setOnInsert: { key: 'system' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    await writeAuditEvent({
      req,
      action: 'SYSTEM_SETTINGS_UPDATED',
      details: `Updated ${section} system settings.`,
      entityType: 'system_settings',
      entityId: saved._id,
      changes: changes.map(({ field, from, to }) => ({ field: `${section}.${field}`, from, to })),
    });
    return res.status(200).json({
      success: true,
      message: `${section === 'general' ? 'General' : 'Security'} settings saved.`,
      data: {
        general: { ...defaultGeneral, ...(saved.general || {}) },
        security: { ...defaultSecurityPolicy, ...(saved.security || {}) },
      },
    });
  } catch (error) {
    console.error('Failed to save System Admin settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to save system settings.' });
  }
};

export const getAdminSystemHealth = async (req, res) => {
  try {
    let version = process.env.npm_package_version || 'unknown';
    try {
      const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
      version = packageJson.version || version;
    } catch (error) {
      console.error('Unable to read server application version:', error.message);
    }
    return res.status(200).json({
      success: true,
      data: {
        application: { status: 'available', version },
        database: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable',
          checkedAt: new Date().toISOString(),
        },
        api: { status: 'available', checkedAt: new Date().toISOString() },
        capabilities: {
          backupRestore: false,
          maintenanceMode: false,
          emailDelivery: false,
          scheduledBackups: false,
          diagnostics: false,
        },
      },
    });
  } catch (error) {
    console.error('Failed to read System Admin health status:', error);
    return res.status(500).json({ success: false, message: 'Unable to read system health status.' });
  }
};

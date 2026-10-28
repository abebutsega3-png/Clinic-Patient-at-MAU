import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const shifts = ['morning', 'afternoon', 'night'];
const imageDataPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const maximumImageDataLength = 700000;

const isImageData = (value) => (
  typeof value === 'string'
  && value.length <= maximumImageDataLength
  && (value === '' || imageDataPattern.test(value))
);

const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const finiteNumber = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

const defaultSettings = () => ({
  key: 'clinic',
  clinicProfile: { name: 'MAU Clinic', address: '', phone: '', email: '', logoDataUrl: '' },
  workingHours: {
    days: weekdays.map((day, index) => ({
      day,
      open: '08:00',
      close: index < 5 ? '17:00' : '12:00',
      closed: index === 6
    })),
    allDayService: false,
    allDayDepartments: ['Emergency', 'Triage']
  },
  officialMarks: { signatureDataUrl: '', stampDataUrl: '' },
  rosterRules: {
    shiftDurations: { morning: 6, afternoon: 6, night: 12 },
    minimumStaff: [],
    autoLockApprovedLeave: true
  },
  inventoryRules: { categoryThresholds: [], expiryWarningDays: 90 }
});

const validateSettings = (input) => {
  if (!input || typeof input !== 'object') return 'Settings payload is required.';
  const { clinicProfile, workingHours, officialMarks, rosterRules, inventoryRules } = input;
  if (!clinicProfile || !workingHours || !officialMarks || !rosterRules || !inventoryRules) {
    return 'Provide clinic profile, hours, official marks, roster rules and inventory rules.';
  }

  if (
    typeof clinicProfile.name !== 'string' || !clinicProfile.name.trim()
    || clinicProfile.name.trim().length > 120
    || typeof clinicProfile.address !== 'string' || clinicProfile.address.length > 250
    || typeof clinicProfile.phone !== 'string' || clinicProfile.phone.length > 40
    || typeof clinicProfile.email !== 'string' || (clinicProfile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clinicProfile.email))
    || !isImageData(clinicProfile.logoDataUrl)
  ) return 'Clinic profile values or logo image are invalid.';

  if (
    !Array.isArray(workingHours.days)
    || workingHours.days.length !== weekdays.length
    || workingHours.days.some((day) => (
      !day || !weekdays.includes(day.day)
      || !validTime(day.open)
      || !validTime(day.close)
      || typeof day.closed !== 'boolean'
    ))
    || typeof workingHours.allDayService !== 'boolean'
    || !Array.isArray(workingHours.allDayDepartments)
    || workingHours.allDayDepartments.some((department) => typeof department !== 'string' || !department.trim() || department.length > 80)
  ) return 'Working hours and continuous-service settings are invalid.';
  if (new Set(workingHours.days.map((day) => day.day)).size !== weekdays.length) {
    return 'Each day of the week must have exactly one working-hours entry.';
  }

  if (!officialMarks || !isImageData(officialMarks.signatureDataUrl) || !isImageData(officialMarks.stampDataUrl)) {
    return 'Signature or stamp must be a PNG, JPEG or WebP image smaller than 500 KB.';
  }

  const durations = rosterRules.shiftDurations;
  if (
    !durations || shifts.some((shift) => !finiteNumber(durations[shift], 1, 24))
    || typeof rosterRules.autoLockApprovedLeave !== 'boolean'
    || !Array.isArray(rosterRules.minimumStaff)
    || rosterRules.minimumStaff.some((rule) => (
      !rule || typeof rule.department !== 'string' || !rule.department.trim()
      || rule.department.length > 80 || !shifts.includes(rule.shift)
      || !finiteNumber(rule.count, 0, 500)
    ))
  ) return 'Roster shift durations or staffing requirements are invalid.';

  if (
    !inventoryRules || !finiteNumber(inventoryRules.expiryWarningDays, 1, 1095)
    || !Array.isArray(inventoryRules.categoryThresholds)
    || inventoryRules.categoryThresholds.some((rule) => (
      !rule || typeof rule.category !== 'string' || !rule.category.trim()
      || rule.category.length > 80 || !finiteNumber(rule.threshold, 0, 1000000)
    ))
    || new Set(inventoryRules.categoryThresholds.map(({ category }) => category.trim().toLowerCase())).size !== inventoryRules.categoryThresholds.length
  ) return 'Inventory thresholds or expiry-warning period are invalid.';

  return '';
};

export const getClinicOperationalSettings = async (req, res) => {
  try {
    let settings = await ClinicOperationalSettings.findOne({ key: 'clinic' }).lean();
    if (!settings) settings = (await ClinicOperationalSettings.create(defaultSettings())).toObject();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Failed to load clinic operational settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to load clinic settings.' });
  }
};

export const updateClinicOperationalSettings = async (req, res) => {
  const validationError = validateSettings(req.body);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  const { clinicProfile, workingHours, officialMarks, rosterRules, inventoryRules } = req.body;
  const settings = {
    clinicProfile: {
      name: clinicProfile.name.trim(),
      address: clinicProfile.address.trim(),
      phone: clinicProfile.phone.trim(),
      email: clinicProfile.email.trim().toLowerCase(),
      logoDataUrl: clinicProfile.logoDataUrl
    },
    workingHours: {
      days: workingHours.days.map(({ day, open, close, closed }) => ({ day, open, close, closed })),
      allDayService: workingHours.allDayService,
      allDayDepartments: [...new Set(workingHours.allDayDepartments.map((name) => name.trim()))]
    },
    officialMarks: {
      signatureDataUrl: officialMarks.signatureDataUrl,
      stampDataUrl: officialMarks.stampDataUrl
    },
    rosterRules: {
      shiftDurations: Object.fromEntries(shifts.map((shift) => [shift, rosterRules.shiftDurations[shift]])),
      minimumStaff: rosterRules.minimumStaff.map(({ department, shift, count }) => ({ department: department.trim(), shift, count })),
      autoLockApprovedLeave: rosterRules.autoLockApprovedLeave
    },
    inventoryRules: {
      categoryThresholds: inventoryRules.categoryThresholds.map(({ category, threshold }) => ({ category: category.trim(), threshold })),
      expiryWarningDays: inventoryRules.expiryWarningDays
    }
  };

  try {
    const saved = await ClinicOperationalSettings.findOneAndUpdate(
      { key: 'clinic' },
      { $set: settings, $setOnInsert: { key: 'clinic' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return res.status(200).json({ success: true, data: saved, message: 'Clinic settings saved.' });
  } catch (error) {
    console.error('Failed to save clinic operational settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to save clinic settings.' });
  }
};

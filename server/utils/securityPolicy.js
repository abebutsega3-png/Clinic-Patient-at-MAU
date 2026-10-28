import SystemSettings from '../module/SystemSettings.js';

export const defaultSecurityPolicy = Object.freeze({
  minimumPasswordLength: 8,
  requireLetter: true,
  requireNumber: true,
  requireUppercase: false,
  requireSpecialCharacter: false,
  sessionTimeoutMinutes: 480,
  maximumLoginAttempts: 5,
  lockoutDurationMinutes: 15,
});

export const getSecurityPolicy = async () => {
  const settings = await SystemSettings.findOne({ key: 'system' }).select('security').lean();
  return { ...defaultSecurityPolicy, ...(settings?.security || {}) };
};

export const validatePasswordAgainstPolicy = (password, policy) => {
  if (typeof password !== 'string' || password.length < policy.minimumPasswordLength) {
    return `Password must be at least ${policy.minimumPasswordLength} characters long.`;
  }
  if (policy.requireLetter && !/[A-Za-z]/.test(password)) {
    return 'Password must include at least one letter.';
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (policy.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character.';
  }
  return '';
};

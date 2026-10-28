import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../module/User.js';
import { writeAuditEvent } from '../utils/auditLogger.js';
import { getSecurityPolicy, validatePasswordAgainstPolicy } from '../utils/securityPolicy.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const login = async (req, res) => {
  const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
  }

  if (!process.env.JWT_KEY) {
    console.error('JWT_KEY is not configured.');
    return res.status(500).json({ success: false, message: 'Authentication is not configured on the server.' });
  }

  try {
    const securityPolicy = await getSecurityPolicy();
    const user = await User.findOne({
      $or: [
        { username: { $regex: `^${escapeRegex(identifier)}$`, $options: 'i' } },
        { email: identifier.toLowerCase() }
      ]
    });

    if (!user) {
      await writeAuditEvent({
        req,
        action: 'AUTH_LOGIN_FAILED',
        result: 'failure',
        details: 'Credential verification failed.',
        entityType: 'authentication',
        actorName: 'Unknown user',
        actorRole: 'Unknown',
      });
      return res.status(401).json({
        success: false,
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed.'
      });
    }

    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      await writeAuditEvent({
        req,
        action: 'AUTH_LOGIN_FAILED',
        result: 'failure',
        details: 'Sign-in was blocked by the account lockout policy.',
        entityType: 'authentication',
        entityId: user._id,
        actorName: 'Unknown user',
        actorRole: 'Unknown',
      });
      return res.status(423).json({
        success: false,
        message: `This account is temporarily locked after repeated failed attempts. Try again in ${securityPolicy.lockoutDurationMinutes} minutes.`
      });
    }

    if (!(await user.matchPassword(password))) {
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= securityPolicy.maximumLoginAttempts) {
          user.failedLoginAttempts = 0;
          user.loginLockedUntil = new Date(Date.now() + (securityPolicy.lockoutDurationMinutes * 60 * 1000));
        }
        await user.save();
      }
      await writeAuditEvent({
        req,
        action: 'AUTH_LOGIN_FAILED',
        result: 'failure',
        details: 'Credential verification failed.',
        entityType: 'authentication',
        entityId: user._id,
        actorName: 'Unknown user',
        actorRole: 'Unknown',
      });
      return res.status(401).json({
        success: false,
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed.'
      });
    }

    if (user.status !== 'Active') {
      await writeAuditEvent({
        req,
        action: 'AUTH_LOGIN_FAILED',
        result: 'failure',
        details: 'Sign-in was blocked because the account is inactive.',
        entityType: 'authentication',
        entityId: user._id,
        actorName: 'Unknown user',
        actorRole: 'Unknown',
      });
      return res.status(403).json({ success: false, message: 'This account is not active.' });
    }

    user.failedLoginAttempts = 0;
    user.loginLockedUntil = null;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { _id: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_KEY,
      { expiresIn: `${securityPolicy.sessionTimeoutMinutes}m` }
    );
    await writeAuditEvent({
      req,
      actor: user,
      action: 'AUTH_LOGIN_SUCCESS',
      details: 'User signed in successfully.',
      entityType: 'authentication',
      entityId: user._id,
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        activeRole: user.activeRole,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to sign in right now.' });
  }
};

export const logout = async (req, res) => {
  try {
    await writeAuditEvent({
      req,
      action: 'AUTH_LOGOUT',
      details: 'User signed out.',
      entityType: 'authentication',
      entityId: req.user._id,
    });
    return res.status(200).json({ success: true, message: 'Signed out.' });
  } catch (error) {
    console.error('Failed to record user sign-out:', error);
    return res.status(500).json({ success: false, message: 'Unable to record sign-out.' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name username email phoneNumber alternativePhone role activeRole department position employeeId dateJoined status profileImage createdAt lastLogin')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'User profile not found.' });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Failed to load current user profile:', error);
    return res.status(500).json({ success: false, message: 'Unable to load user profile.' });
  }
};

export const changeCurrentUserPassword = async (req, res) => {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  if (!currentPassword) {
    return res.status(400).json({ success: false, message: 'Enter your current password.' });
  }

  try {
    const securityPolicy = await getSecurityPolicy();
    const passwordError = validatePasswordAgainstPolicy(newPassword, securityPolicy);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    const user = await User.findById(req.user._id);
    if (!user || !(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (await user.matchPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'Choose a new password different from your current password.' });
    }

    const passwordHash = user.password;
    const updateResult = await User.updateOne(
      { _id: user._id, password: passwordHash },
      {
        $set: {
          password: await bcrypt.hash(newPassword, 12),
          passwordChangedAt: new Date(),
          mustChangePassword: false
        },
        $inc: { tokenVersion: 1 }
      },
      { runValidators: true }
    );
    if (updateResult.modifiedCount !== 1) {
      return res.status(409).json({ success: false, message: 'Password changed in another session. Please sign in again and retry.' });
    }
    await writeAuditEvent({
      req,
      action: 'AUTH_PASSWORD_CHANGED',
      details: 'User changed their password.',
      entityType: 'authentication',
      entityId: user._id,
    });
    return res.status(200).json({ success: true, message: 'Password changed. Sign in again with your new password.' });
  } catch (error) {
    console.error('Failed to change current user password:', error);
    return res.status(500).json({ success: false, message: 'Unable to change password.' });
  }
};

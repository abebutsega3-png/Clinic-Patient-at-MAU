import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../module/User.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const verifyUser = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "Authentication token not provided." });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_KEY);
    } catch {
        return res.status(401).json({ success: false, message: "Authentication token is expired or invalid." });
    }
    if (decoded.tokenUse === 'refresh') {
        return res.status(401).json({ success: false, message: "Refresh tokens cannot be used to access protected resources." });
    }

    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            success: false,
            message: "Database unavailable. Please check the MongoDB connection and try again.",
        });
    }

    try {
        const user = await User.findById(decoded._id).select('-password').maxTimeMS(5000);
        if (!user) {
            return res.status(401).json({ success: false, message: "Authentication token is not valid." });
        }
        if (user.status !== 'Active') {
            return res.status(403).json({ success: false, message: "This account is not active." });
        }
        if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
            return res.status(401).json({ success: false, message: "Your session has been revoked. Please sign in again." });
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error('Authentication user lookup failed:', error.message);
        return res.status(503).json({
            success: false,
            message: "Unable to reach the database to verify your account. Please try again.",
        });
    }
};

export default verifyUser;

export const isClinicHead = (req, res, next) => {
    const roles = [
        req.user?.activeRole,
        req.user?.role,
        ...(Array.isArray(req.user?.roles) ? req.user.roles : [])
    ].filter(Boolean);

    if (roles.some((role) => role.toLowerCase() === 'clinic head')) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Clinic Head access is required.'
    });
};

export const isAdmin = async (req, res, next) => {
    if (req.user?.mustChangePassword) {
        return res.status(403).json({
            success: false,
            message: 'Change your temporary password before continuing.'
        });
    }

    const roles = [
        req.user?.activeRole,
        req.user?.role,
        ...(Array.isArray(req.user?.roles) ? req.user.roles : [])
    ].filter(Boolean);

    if (roles.some((role) => role.toLowerCase() === 'admin')) {
        return next();
    }

    try {
        await writeAuditEvent({
          req,
          action: 'UNAUTHORIZED_ACCESS',
          result: 'failure',
          details: `Administrator access denied for ${req.method} ${req.baseUrl}${req.path}.`,
          entityType: 'authentication',
        });
    } catch (error) {
        console.error('Failed to record denied administrator access:', error);
    }

    return res.status(403).json({
        success: false,
        message: 'Administrator access is required.'
    });
};
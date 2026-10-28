import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    username: { type: String, trim: true, default: '' },
    usernameNormalized: { type: String, trim: true, lowercase: true, select: false, default: undefined },
    employeeId: { type: String, trim: true, default: '' },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        default: undefined,
        unique: true,
        sparse: true 
    },
    gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
    dateOfBirth: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, trim: true, default: '' },
    alternativePhone: { type: String, trim: true, default: '' },
    
    position: { type: String, trim: true, default: '' },
    specialization: { type: String, trim: true, default: '' },
    licenseNumber: { type: String, trim: true, default: '' },
    campus: { type: String, trim: true, default: 'Main Clinic' },
    dateJoined: { type: Date },
    password: {
        type: String,
        required: true
    },
    
    role: {
        type: String,
        trim: true,
        default: 'Employee'
    },
    roles: {
        type: [String],
        default: undefined,
        validate: {
            validator: function (value) {
                return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim());
            },
            message: 'User must have at least one role.'
        }
    },
    activeRole: {
        type: String,
        trim: true
    },
    department: { type: String, trim: true, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    status: { type: String, enum: ['Active', 'Inactive', 'On Leave'], default: 'Active' },
    onDutyToday: { type: Boolean, default: false },
    profileImage: {
        type: String
    },
    
    notificationPreferences: {
        emailNotifications: { type: Boolean, default: true },
        patientAppointments: { type: Boolean, default: true },
        labResultsReady: { type: Boolean, default: true },
        prescriptionUpdates: { type: Boolean, default: true },
        systemNotification: { type: Boolean, default: true }
    },
    
    displayPreferences: {
        theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
        language: { type: String, enum: ['English', 'Amharic'], default: 'English' },
        itemsPerPage: { type: Number, enum: [10, 20, 50, 100], default: 20 }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    loginLockedUntil: {
        type: Date,
        default: null
    },
    passwordChangedAt: {
        type: Date,
        default: null
    },
    mustChangePassword: {
        type: Boolean,
        default: false
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    passwordResetToken: {
        type: String,
        default: undefined,
        select: false
    },
    passwordResetExpires: {
        type: Date,
        default: undefined,
        select: false
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.pre('save', async function (next) {
    const currentRole = this.role && this.role.trim() ? this.role.trim() : 'Employee';
    const uniqueRoles = Array.isArray(this.roles) ? this.roles.map((role) => role.trim()).filter(Boolean) : [];

    if (!uniqueRoles.includes(currentRole)) {
        uniqueRoles.push(currentRole);
    }

    this.roles = [...new Set(uniqueRoles)];
    this.role = currentRole;
    this.activeRole = currentRole;
    this.updatedAt = new Date();

    next();
});

userSchema.index({ username: 1 }, { collation: { locale: 'en', strength: 2 } });
userSchema.index({ usernameNormalized: 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: -1, _id: -1 });

userSchema.methods.matchPassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
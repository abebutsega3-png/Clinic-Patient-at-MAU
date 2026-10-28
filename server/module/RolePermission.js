import mongoose from 'mongoose';

const rolePermissionSchema = new mongoose.Schema({
  roleName: { type: String, required: true, unique: true, trim: true },
  roleCode: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
  displayName: { type: String, required: true, trim: true },
  displayNameKey: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  description: { type: String, default: '' },
  department: { type: String, trim: true, default: '' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  isClearanceOffice: { type: Boolean, default: false },
  responsibilities: { type: String, default: '' },
  reports: { type: String, default: '' },
  isLocked: { type: Boolean, default: false },
  permissions: [{ type: String }],
}, { timestamps: true });

const RolePermission = mongoose.models.RolePermission
  || mongoose.model('RolePermission', rolePermissionSchema);

export default RolePermission;

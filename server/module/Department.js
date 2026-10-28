import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String },
    departmentType: { type: String, default: 'Clinical' },
    departmentHead: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        name: { type: String },
        role: { type: String }
    },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    location: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    campus: { type: String, default: '' },
    collegeInstitute: { type: String, default: '' },
    buildingName: { type: String, default: '' },
    officeRoomNumber: { type: String, default: '' },
    usesQueue: { type: Boolean, default: false },
    entryPoint: { type: Boolean, default: false },
    nextUnits: { type: [String], default: [] },
    reportsTo: { type: String, default: '' },
    icon: { type: String, default: 'fa-building' },
    colorBg: { type: String, default: 'bg-blue-500' }
}, { timestamps: true });

const Department = mongoose.models.Department || mongoose.model('Department', DepartmentSchema);

export default Department;
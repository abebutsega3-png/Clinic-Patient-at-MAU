import Department from '../module/Department.js';
import User from '../module/User.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const auditDepartmentChange = (req, department, action, changes) => writeAuditEvent({
    req,
    action,
    details: `${action.replaceAll('_', ' ')}: ${department.name} (${department.code}).`,
    entityType: 'department',
    entityId: department._id,
    changes,
});

// Get all departments with filters & search
export const getDepartments = async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const { status } = req.query;
        let query = {};

        if (search) {
            const expression = new RegExp(escapeRegex(search), 'i');
            query.$or = [
                { name: expression },
                { code: expression }
            ];
        }

        if (status && status !== 'All Status') {
            query.status = status;
        }

        const departments = await Department.find(query).sort({ name: 1 }).lean();
        res.status(200).json({ success: true, count: departments.length, data: departments });
    } catch (error) {
        console.error('Failed to load departments:', error);
        res.status(500).json({ success: false, message: 'Unable to load departments.' });
    }
};

export const getDepartmentStaff = async (req, res) => {
    try {
        const staff = await User.find({
            status: 'Active',
            role: { $ne: 'Admin' },
            roles: { $nin: ['Admin'] },
        })
            .select('name role position')
            .sort({ name: 1, _id: 1 })
            .lean();
        return res.status(200).json({ success: true, data: staff });
    } catch (error) {
        console.error('Failed to load department staff:', error);
        return res.status(500).json({ success: false, message: 'Unable to load registered staff.' });
    }
};

// Create a new department
export const createDepartment = async (req, res) => {
    try {
        const body = req.body || {};
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
        if (name.length < 2 || name.length > 120 || !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) {
            return res.status(400).json({ success: false, message: 'Provide a department name and a valid unique code.' });
        }
        if ((body.status !== undefined && !['Active', 'Inactive'].includes(body.status))
            || (body.description !== undefined && typeof body.description !== 'string')
            || (body.location !== undefined && typeof body.location !== 'string')
            || (body.departmentType !== undefined && typeof body.departmentType !== 'string')) {
            return res.status(400).json({ success: false, message: 'Department description, location, type, or status is invalid.' });
        }
        const existing = await Department.findOne({
            $or: [
                { code },
                { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
            ],
        }).select('_id');
        if (existing) {
            return res.status(409).json({ success: false, message: 'A department with this name or code already exists.' });
        }
        let departmentHead = { name: '', role: '' };
        if (body.departmentHeadUserId) {
            const staff = await User.findOne({
                _id: body.departmentHeadUserId,
                status: 'Active',
                role: { $ne: 'Admin' },
                roles: { $nin: ['Admin'] },
            }).select('name role');
            if (!staff) {
                return res.status(400).json({ success: false, message: 'Select an active registered staff member.' });
            }
            departmentHead = {
                userId: staff._id,
                name: staff.name,
                role: staff.role,
            };
        }
        const { departmentHeadUserId, ...departmentData } = body;
        const newDept = await Department.create({
            ...departmentData,
            name,
            code,
            departmentHead,
        });
        await auditDepartmentChange(req, newDept, 'DEPARTMENT_CREATED', [
            { field: 'name', from: '', to: newDept.name },
            { field: 'code', from: '', to: newDept.code },
            { field: 'description', from: '', to: newDept.description || '' },
            { field: 'location', from: '', to: newDept.location || '' },
            { field: 'status', from: '', to: newDept.status },
        ]);
        res.status(201).json({ success: true, data: newDept });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'A department with this name or code already exists.' });
        }
        console.error('Failed to create department:', error);
        res.status(500).json({ success: false, message: 'Unable to create department.' });
    }
};

export const updateDepartment = async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Department ID is invalid.' });
    }
    const { name, code, description = '', location = '' } = req.body || {};
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (normalizedName.length < 2 || normalizedName.length > 120
        || !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalizedCode)
        || typeof description !== 'string'
        || typeof location !== 'string') {
        return res.status(400).json({ success: false, message: 'Provide a valid department name, code, description, and location.' });
    }
    try {
        const department = await Department.findById(req.params.id);
        if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });
        const duplicate = await Department.findOne({
            _id: { $ne: department._id },
            $or: [
                { code: normalizedCode },
                { name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: 'i' } },
            ],
        }).select('_id');
        if (duplicate) return res.status(409).json({ success: false, message: 'A department with this name or code already exists.' });

        const before = {
            name: department.name,
            code: department.code,
            description: department.description || '',
            location: department.location || '',
        };
        Object.assign(department, {
            name: normalizedName,
            code: normalizedCode,
            description: description.trim(),
            location: location.trim(),
        });
        const changes = Object.keys(before)
            .filter((field) => before[field] !== department[field])
            .map((field) => ({ field, from: before[field], to: department[field] }));
        await department.save();
        if (changes.length) await auditDepartmentChange(req, department, 'DEPARTMENT_UPDATED', changes);
        return res.status(200).json({ success: true, message: 'Department updated.', data: department });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'A department with this name or code already exists.' });
        console.error('Failed to update department:', error);
        return res.status(500).json({ success: false, message: 'Unable to update department.' });
    }
};

export const updateDepartmentStatus = async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Department ID is invalid.' });
    }
    const { status } = req.body || {};
    if (!['Active', 'Inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be Active or Inactive.' });
    }
    try {
        const department = await Department.findById(req.params.id);
        if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });
        if (department.status === status) {
            return res.status(200).json({ success: true, message: `Department is already ${status.toLowerCase()}.`, data: department });
        }
        const previousStatus = department.status;
        department.status = status;
        await department.save();
        await auditDepartmentChange(req, department, 'DEPARTMENT_STATUS_CHANGED', [
            { field: 'status', from: previousStatus, to: status },
        ]);
        return res.status(200).json({ success: true, message: `Department ${status.toLowerCase()} successfully.`, data: department });
    } catch (error) {
        console.error('Failed to update department status:', error);
        return res.status(500).json({ success: false, message: 'Unable to update department status.' });
    }
};

// Keep the legacy delete route safe for records already referenced elsewhere.
export const deleteDepartment = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found.' });
        }
        if (department.status !== 'Inactive') {
            department.status = 'Inactive';
            await department.save();
            await auditDepartmentChange(req, department, 'DEPARTMENT_STATUS_CHANGED', [
                { field: 'status', from: 'Active', to: 'Inactive' },
            ]);
        }
        res.status(200).json({ success: true, message: 'Department deactivated successfully.', data: department });
    } catch (error) {
        console.error('Failed to delete department:', error);
        res.status(500).json({ success: false, message: 'Unable to delete department.' });
    }
};
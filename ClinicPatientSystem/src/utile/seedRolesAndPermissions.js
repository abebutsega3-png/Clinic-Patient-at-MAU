import mongoose from 'mongoose';

// የ Permission እና Role መዋቅር (Schema)
const rolePermissionSchema = new mongoose.Schema({
  roleName: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  description: { type: String },
  isLocked: { type: Boolean, default: false }, // እንደ Admin ያሉ የማይሰረዙ ሮሎች ለማቆለፍ
  permissions: [{ type: String }]
}, { timestamps: true });

const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);

// 9ቱ ሮሎች እና ፈቃዶቻቸው
const defaultRolesAndPermissions = [
  {
    roleName: 'Admin',
    displayName: 'System Admin',
    description: 'ስርዓቱን ያዋቅራል፣ ተጠቃሚዎችን እና ሎጆችን ይቆጣጠራል (የሕክምና መረጃ አያይም)',
    isLocked: true,
    permissions: [
      'users:manage', 'roles:manage', 'departments:manage', 
      'master_data:manage', 'audit:view', 'settings:manage', 'reports:all'
    ]
  },
  {
    roleName: 'Clinic Head',
    displayName: 'Clinic Student Head',
    description: 'ሁሉንም ክፍሎች ይቆጣጠራል፣ ሪፖርቶችን ይሰበስባል እና ለክሊኒክ አመራር ያቀርባል',
    isLocked: true,
    permissions: [
      'reports:all', 'queue:view', 'stock:view'
    ]
  },
  {
    roleName: 'Card Chief',
    displayName: 'Card Room Staff',
    description: 'ታካሚ ይመዘግባል፣ ካርድ ይከፍታል እና ወደ ሚመለከተው ክፍል ይልካል',
    isLocked: false,
    permissions: [
      'patients:register', 'patients:search', 'patients:edit_basic', 
      'queue:send', 'queue:view', 'reports:own'
    ]
  },
  {
    roleName: 'Doctor',
    displayName: 'Medical Doctor',
    description: 'ታካሚን ይመረምራል፣ ዲያግኖሲስ፣ ፕሪስክሪፕሽን እና የላብ ጥያቄ ይጽፋል',
    isLocked: false,
    permissions: [
      'patients:search', 'history:view', 'diagnosis:write', 
      'prescription:write', 'referral:write', 'lab:request', 
      'lab:result_view', 'service:order', 'queue:send', 'queue:view', 'reports:own'
    ]
  },
  {
    roleName: 'Lab Technician',
    displayName: 'Laboratory Technician',
    description: 'የላብ ጥያቄ ይቀበላል፣ ናሙና ይመረምራል እና ውጤት ያስገባል',
    isLocked: false,
    permissions: [
      'lab:view', 'lab:result_write', 'queue:view', 'reports:own'
    ]
  },
  {
    roleName: 'Pharmacist',
    displayName: 'Dispensary Pharmacist',
    description: 'በሐኪም የታዘዘ መድኃኒት ለታካሚ ይሰጣል',
    isLocked: false,
    permissions: [
      'prescription:view', 'medicine:dispense', 'stock:view', 'queue:view', 'reports:own'
    ]
  },
  {
    roleName: 'Drug Store Manager',
    displayName: 'Drug Store Officer',
    description: 'መድኃኒት ይቀበላል፣ ያስቀምጣል፣ ለDispensary ያከፋፍላል እና expiry ይከታተላል',
    isLocked: false,
    permissions: [
      'stock:view', 'stock:receive', 'stock:issue', 'stock:adjust', 'reports:own'
    ]
  },
  {
    roleName: 'Nurse',
    displayName: 'Injection & Dressing Nurse',
    description: 'ሐኪም ያዘዘውን መርፌና ቁስል ማሰር አገልግሎት ይሰጣል',
    isLocked: false,
    permissions: [
      'service:order', 'service:view', 'service:record', 'queue:view', 'reports:own'
    ]
  },
  {
    roleName: 'Emergency Staff',
    displayName: 'Emergency Room Staff',
    description: 'አስቸኳይ ታካሚ ይቀበላል፣ የመጀመሪያ ህክምና ይሰጣል እና ወደ ሌላ ሆስፒታል ይመራል',
    isLocked: false,
    permissions: [
      'patients:register', 'patients:search', 'history:view', 
      'diagnosis:write', 'prescription:write', 'lab:request', 
      'referral:write', 'queue:send', 'queue:view', 'reports:own'
    ]
  }
];

export const seedRolesAndPermissions = async () => {
  try {
    for (const roleData of defaultRolesAndPermissions) {
      await RolePermission.findOneAndUpdate(
        { roleName: roleData.roleName },
        roleData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('✅ Roles and Permissions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding roles and permissions:', error.message);
  }
};

export default RolePermission;
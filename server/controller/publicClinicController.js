import { Staff } from '../module/StaffAndRoster.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
import User from '../module/User.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const staffRoles = ['Doctor', 'Nurse', 'Lab', 'Lab Technician', 'Pharmacy', 'Pharmacist', 'Registration', 'Receptionist'];
const supportedDepartments = ['OPD', 'Triage', 'Laboratory', 'Pharmacy', 'Registration'];

const defaultWorkingHours = {
  days: weekdays.map((day, index) => ({
    day,
    open: '08:00',
    close: index < 5 ? '17:00' : '12:00',
    closed: index === 6
  })),
  allDayService: false,
  allDayDepartments: ['Emergency', 'Triage']
};

export const getPublicClinicOverview = async (req, res) => {
  try {
    let staffCount = await Staff.countDocuments({ status: { $ne: 'Inactive' } });
    if (staffCount === 0) {
      staffCount = await User.countDocuments({
        status: { $ne: 'Inactive' },
        $or: [
          { role: { $in: staffRoles } },
          { activeRole: { $in: staffRoles } },
          { roles: { $in: staffRoles } },
          { position: { $in: staffRoles } }
        ]
      });
    }

    const settings = await ClinicOperationalSettings.findOne({ key: 'clinic' })
      .select('workingHours clinicProfile.phone')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        statistics: {
          staff: staffCount,
          departments: supportedDepartments.length
        },
        workingHours: settings?.workingHours || defaultWorkingHours,
        emergencyPhone: settings?.clinicProfile?.phone || '+251583209653'
      }
    });
  } catch (error) {
    console.error('Failed to load public clinic overview:', error);
    return res.status(500).json({ success: false, message: 'Unable to load clinic information.' });
  }
};

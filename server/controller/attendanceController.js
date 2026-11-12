const Attendance = require('../models/Attendance');

// 1. ሰራተኛው Check-in ሲያደርግ (Present)
const checkInStaff = async (req, res) => {
  try {
    const { staffId, staffName, role, department } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // ሰራተኛው ዛሬ ቀድሞ መዝግቦ ከሆነ ማሻሻል ወይም አዲስ መፍጠር
    let attendance = await Attendance.findOne({ staffId, date: today });

    if (attendance) {
      return res.status(400).json({ success: false, message: 'Already checked in today' });
    }

    // ከጠዋቱ 3:00 (09:00 AM) በኋላ ከገባ Late ይባላል
    const currentHour = now.getHours();
    const status = currentHour >= 9 ? 'Late' : 'Present';

    attendance = await Attendance.create({
      staffId,
      staffName,
      role,
      department,
      date: today,
      checkInTime: now,
      status
    });

    // Socket.io Real-time emission ለ Clinic Head
    if (req.io) {
      req.io.emit('staff-attendance-updated', attendance);
    }

    res.status(201).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. የክሊኒክ ኃላፊ የዛሬውን መገኘት ሁሉንም ለማየት
const getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { department } = req.query;
    
    let query = { date: today };
    if (department && department !== 'All Departments') {
      query.department = department;
    }

    const attendanceList = await Attendance.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: attendanceList.length, data: attendanceList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { checkInStaff, getTodayAttendance };
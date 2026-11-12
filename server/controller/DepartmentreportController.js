const Report = require('../models/DepartmentReport');

// 1. ሁሉንም ሪፖርቶች ማምጣት (ከማጣሪያ ጋር)
const getReports = async (req, res) => {
  try {
    const { department, reportType, status } = req.query;
    let query = {};

    if (department && department !== 'All Departments') query.department = department;
    if (reportType && reportType !== 'All Report Types') query.reportType = reportType;
    if (status && status !== 'All Statuses') query.status = status;

    const reports = await Report.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. የሪፖርት ሁኔታን መቀየር (Approve / Reject / Return)
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Approved, Rejected, Returned

    const updatedReport = await Report.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedReport) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: updatedReport });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getReports, updateReportStatus };
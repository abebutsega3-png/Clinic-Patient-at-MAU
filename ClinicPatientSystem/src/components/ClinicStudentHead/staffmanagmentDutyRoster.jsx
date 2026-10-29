import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Copy,
  AlertTriangle, 
  Calendar, 
  Users,
  Search,
  UserRound,
  Phone,
  Printer,
  Send,
  CheckCircle2,
  Clock3,
  Sun, 
  Moon, 
  Sunset, 
  Coffee, 
  Palmtree 
} from 'lucide-react';

const RosterView = () => {
  const { token } = useAuth();
  // 1. State Management
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
  });
  const [deptFilter, setDeptFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');

  const [staffList, setStaffList] = useState([]);
  const [rosterRoles, setRosterRoles] = useState([]);
  const [rosterDepartments, setRosterDepartments] = useState([]);
  const [rosterData, setRosterData] = useState({}); // Grid format: { "staffId_YYYY-MM-DD": "morning" }
  const [lockedCells, setLockedCells] = useState({}); // { "staffId_YYYY-MM-DD": true }
  const [rosterRules, setRosterRules] = useState({
    shiftDurations: { morning: 6, afternoon: 6, night: 12 },
    minimumStaff: []
  });
  const [staffingCounts, setStaffingCounts] = useState({});
  const [isPublished, setIsPublished] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // የሳምንቱን 7 ቀናት ዝርዝር ማስያ
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return {
      dateStr: formatDate(d),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      formattedDate: `${d.getMonth() + 1}/${d.getDate()}`
    };
  }), [currentWeekStart]);

  const fetchRoster = useCallback(async () => {
    try {
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[6].dateStr;
      const res = await axios.get(
        `/api/roster/weekly?startDate=${startDate}&endDate=${endDate}&department=${deptFilter}&role=${roleFilter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setErrorMessage('');
      setStaffList(Array.isArray(res.data.staff) ? res.data.staff : []);
      setRosterRoles(Array.isArray(res.data.roles) ? res.data.roles : []);
      setRosterDepartments(Array.isArray(res.data.departments) ? res.data.departments : []);
      setRosterRules({
        shiftDurations: { morning: 6, afternoon: 6, night: 12, ...(res.data.rosterRules?.shiftDurations || {}) },
        minimumStaff: Array.isArray(res.data.rosterRules?.minimumStaff) ? res.data.rosterRules.minimumStaff : []
      });
      setStaffingCounts(res.data.staffingCounts || {});
      setIsPublished(Boolean(res.data.isPublished));

      // Convert array response to quick lookup map
      const rosterMap = {};
      const lockedMap = {};
      (Array.isArray(res.data.roster) ? res.data.roster : []).forEach(item => {
        const key = `${item.staffId}_${item.date}`;
        rosterMap[key] = item.shift;
        if (item.isLocked || item.shift === 'leave') {
          lockedMap[key] = true;
        }
      });

      setRosterData(rosterMap);
      setLockedCells(lockedMap);
    } catch (error) {
      console.error('Failed to load staff roster:', error);
      setErrorMessage(error.response?.data?.message || 'Unable to load staff and roster data.');
    } finally {
      setLoading(false);
    }
  }, [deptFilter, roleFilter, token, weekDays]);

  useEffect(() => {
    void Promise.resolve().then(fetchRoster);
  }, [fetchRoster]);

  // 3. Handle Cell Shift Change
  const handleShiftChange = (staffId, dateStr, newShift) => {
    const key = `${staffId}_${dateStr}`;
    if (lockedCells[key]) return; // Locked ከሆነ መለወጥ አይቻልም
    const member = staffList.find((staff) => staff._id === staffId);
    const previousShift = rosterData[key] || 'off';
    if (member?.department && previousShift !== newShift) {
      setStaffingCounts((current) => {
        const next = { ...current };
        const previousCountKey = `${member.department}_${dateStr}_${previousShift}`;
        const nextCountKey = `${member.department}_${dateStr}_${newShift}`;
        if (['morning', 'afternoon', 'night'].includes(previousShift)) {
          next[previousCountKey] = Math.max(0, (next[previousCountKey] || 0) - 1);
        }
        if (['morning', 'afternoon', 'night'].includes(newShift)) {
          next[nextCountKey] = (next[nextCountKey] || 0) + 1;
        }
        return next;
      });
    }
    setSuccessMessage('');
    setIsPublished(false);

    setRosterData(prev => ({
      ...prev,
      [key]: newShift
    }));
  };

  // 4. Save Roster
  const handleSaveRoster = async () => {
    setSaving(true);
    try {
      const rosterUpdates = [];

      staffList.forEach(staff => {
        weekDays.forEach(day => {
          const key = `${staff._id}_${day.dateStr}`;
          if (rosterData[key] && !lockedCells[key]) {
            rosterUpdates.push({
              staffId: staff._id,
              date: day.dateStr,
              shift: rosterData[key]
            });
          }
        });
      });

      await axios.post('/api/roster/save', { rosterUpdates }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setErrorMessage('');
      setSuccessMessage('Roster saved successfully.');
      await fetchRoster();
      return true;
    } catch (error) {
      console.error('Failed to save staff roster:', error);
      setErrorMessage(error.response?.data?.message || 'Unable to save the duty roster.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublishRoster = async () => {
    setPublishing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const saved = await handleSaveRoster();
      if (!saved) return;
      const { data } = await axios.post('/api/roster/publish', {
        startDate: weekDays[0].dateStr,
        endDate: weekDays[6].dateStr
      }, { headers: { Authorization: `Bearer ${token}` } });
      setIsPublished(true);
      setSuccessMessage(data.message || 'Roster published and staff notified.');
      await fetchRoster();
    } catch (error) {
      console.error('Failed to publish staff roster:', error);
      setErrorMessage(error.response?.data?.message || 'Unable to publish the duty roster.');
    } finally {
      setPublishing(false);
    }
  };

  const handlePrintRoster = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setErrorMessage('Allow pop-ups to print or save the duty roster as PDF.');
      return;
    }
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
    const shiftLabels = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      night: 'Night',
      off: 'Off',
      leave: 'Leave'
    };
    const tableRows = staffList.map((staff) => {
      const assignedShifts = weekDays.map((day) => rosterData[staff._id + '_' + day.dateStr] || 'off');
      const shifts = assignedShifts
        .map((shift) => '<td>' + escapeHtml(shiftLabels[shift] || shift) + '</td>')
        .join('');
      const workShifts = assignedShifts.filter((shift) => ['morning', 'afternoon', 'night'].includes(shift));
      const totalHours = workShifts.reduce((hours, shift) => hours + (Number(rosterRules.shiftDurations[shift]) || 0), 0);
      return '<tr><td>' + escapeHtml(staff.name) + '</td><td>'
        + escapeHtml(staff.employeeId || '') + '</td><td>'
        + escapeHtml(staff.roleLabel || staff.role) + '</td><td>' + shifts + '</td><td>'
        + workShifts.length + '</td><td>' + totalHours + ' h</td></tr>';
    }).join('');
    const tableHeaders = weekDays
      .map((day) => '<th>' + escapeHtml(day.dayName) + ' ' + escapeHtml(day.formattedDate) + '</th>')
      .join('');
    const publicationLabel = isPublished
      ? '<span class="published">· Published</span>'
      : '· Draft';
    printWindow.document.write(`<!doctype html><html><head><title>Duty roster</title><style>
      body{font-family:Arial,sans-serif;color:#0f172a;padding:24px}
      h1{font-size:20px;margin-bottom:4px}p{color:#475569;margin:0 0 20px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}
      th{background:#f1f5f9}.published{color:#047857;font-weight:bold}
      @media print{body{padding:0}}
      </style></head><body><h1>Clinic Duty Roster</h1>
      <p>Week: ${escapeHtml(weekDays[0].dateStr)} – ${escapeHtml(weekDays[6].dateStr)} ${publicationLabel}</p>
      <table><thead><tr><th>Staff member</th><th>ID</th><th>Role</th>${tableHeaders}<th>Shifts</th><th>Total hours</th></tr></thead>
      <tbody>${tableRows || '<tr><td colspan="12">No staff records found.</td></tr>'}</tbody></table></body></html>`);
    printWindow.onload = () => printWindow.print();
    printWindow.document.close();
  };

  const handleCopyLastWeek = async () => {
    setCopying(true);
    setErrorMessage('');
    const previousStart = new Date(currentWeekStart);
    previousStart.setDate(previousStart.getDate() - 7);
    const previousEnd = new Date(previousStart);
    previousEnd.setDate(previousEnd.getDate() + 6);
    try {
      const { data } = await axios.post('/api/roster/copy-last-week', {
        currentStartDate: weekDays[0].dateStr,
        prevStartDate: formatDate(previousStart),
        prevEndDate: formatDate(previousEnd),
        staffIds: staffList.map((staff) => staff._id)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMessage(data.message || 'Last week’s roster has been copied.');
      await fetchRoster();
    } catch (error) {
      console.error('Failed to copy last week roster:', error);
      setErrorMessage(error.response?.data?.message || 'Unable to copy last week roster.');
    } finally {
      setCopying(false);
    }
  };

  // 5. Week Navigation
  const changeWeek = (direction) => {
    setLoading(true);
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  // 6. Check Zero Staff Warning per Shift/Day
  const getStaffingIssues = (dateStr) => rosterRules.minimumStaff
    .filter((rule) => Number(staffingCounts[`${rule.department}_${dateStr}_${rule.shift}`] || 0) < rule.count)
    .map((rule) => ({
      ...rule,
      assigned: Number(staffingCounts[`${rule.department}_${dateStr}_${rule.shift}`] || 0)
    }));

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      
      {/* HEADER & CONTROLS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        
        {/* Title & Week Switcher */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Calendar size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Duty Roster</h1>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-1">
              <button onClick={() => changeWeek('prev')} className="p-1 hover:bg-slate-100 rounded-lg">
                <ChevronLeft size={16} />
              </button>
              <span>
                {weekDays[0].formattedDate} – {weekDays[6].formattedDate}, {currentWeekStart.getFullYear()}
              </span>
              <button onClick={() => changeWeek('next')} className="p-1 hover:bg-slate-100 rounded-lg">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select 
            value={deptFilter} 
            onChange={(e) => {
              setLoading(true);
              setDeptFilter(e.target.value);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium focus:outline-none"
          >
            <option value="All">ሁሉም Departments</option>
            {rosterDepartments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>

          <select 
            value={roleFilter} 
            onChange={(e) => {
              setLoading(true);
              setRoleFilter(e.target.value);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium focus:outline-none"
          >
            <option value="All">ሁሉም Roles</option>
            {rosterRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>

          <button 
            onClick={handleSaveRoster} 
            disabled={saving || publishing || loading}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'እየተቀመጠ...' : 'Save Roster'}
          </button>
          <button
            onClick={handlePrintRoster}
            disabled={loading || !staffList.length}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={16} /> Print / Export PDF
          </button>
          <button
            onClick={handlePublishRoster}
            disabled={saving || publishing || loading || isPublished || !staffList.length}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPublished ? <CheckCircle2 size={16} /> : <Send size={16} />}
            {publishing ? 'Publishing...' : isPublished ? 'Published' : 'Publish Roster'}
          </button>
          <button
            onClick={handleCopyLastWeek}
            disabled={copying || loading || !staffList.length}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Copy size={16} /> {copying ? 'Copying...' : 'Copy Last Week'}
          </button>
        </div>

      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* MAIN ROSTER TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">ፈረቃው እየተጫነ ነው...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              
              {/* TABLE HEADER */}
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 w-52">ሰራተኛ (Staff)</th>
                  <th className="p-3.5 border-r border-slate-200 w-28 text-center">Role</th>
                  {weekDays.map((day, idx) => {
                    const staffingIssues = getStaffingIssues(day.dateStr);
                    const isZeroStaff = staffingIssues.length > 0;
                    return (
                      <th key={idx} className="p-3 text-center border-r border-slate-200 min-w-[120px]">
                        <div>{day.dayName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{day.formattedDate}</div>
                        {isZeroStaff && (
                          <span className="mt-1 flex flex-col items-center gap-0.5 text-[9px] font-bold text-rose-600" title={staffingIssues.map((issue) => `${issue.department} ${issue.shift}: ${issue.assigned}/${issue.count}`).join(', ')}>
                            <span className="inline-flex items-center gap-0.5"><AlertTriangle size={10} /> Below minimum</span>
                            <span>{staffingIssues.length} staffing gap{staffingIssues.length === 1 ? '' : 's'}</span>
                          </span>
                        )}
                      </th>
                    );
                  })}
                  <th className="p-3 text-center border-r border-slate-200 min-w-[90px]">Shifts</th>
                  <th className="p-3 text-center min-w-[90px]">Total hours</th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="p-8 text-center text-slate-400">No staff records found for these filters.</td>
                  </tr>
                ) : (
                  staffList.map((staff) => (
                    <tr key={staff._id} className="hover:bg-slate-50/60">
                      
                      {/* Staff Name */}
                      <td className="p-3 border-r border-slate-100 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          {staff.profileImage ? (
                            <img src={staff.profileImage} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                              {staff.name?.trim()?.charAt(0)?.toUpperCase() || <UserRound size={14} />}
                            </span>
                          )}
                          <span>
                            <span className="block">{staff.name}</span>
                            <span className="block text-[10px] font-normal text-slate-400">
                              {[staff.employeeId, staff.department].filter(Boolean).join(' · ') || 'No ID listed'}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-3 border-r border-slate-100 text-center text-slate-500 font-medium">
                        {staff.roleLabel || staff.role}
                      </td>

                      {/* 7 Days Grid Cells */}
                      {weekDays.map((day, dIdx) => {
                        const cellKey = `${staff._id}_${day.dateStr}`;
                        const currentShift = rosterData[cellKey] || 'off';
                        const isLocked = lockedCells[cellKey] || currentShift === 'leave';

                        return (
                          <td key={dIdx} className="p-2 border-r border-slate-100 text-center">
                            {isLocked ? (
                              // Locked Cell (Leave)
                              <div className="bg-amber-50 text-amber-700 border border-amber-200/80 rounded-xl py-2 px-1 font-bold flex items-center justify-center gap-1 text-[11px]">
                                <Palmtree size={13} /> 🏖 Leave
                              </div>
                            ) : (
                              // Editable Cell Dropdown
                              <select
                                value={currentShift}
                                onChange={(e) => handleShiftChange(staff._id, day.dateStr, e.target.value)}
                                className={`w-full text-xs font-semibold py-1.5 px-2 rounded-xl border focus:outline-none transition ${
                                  currentShift === 'morning' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                                  currentShift === 'afternoon' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                  currentShift === 'night' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                                  'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                              >
                                <option value="morning">🌅 ጠዋት</option>
                                <option value="afternoon">☀️ ከሰዓት</option>
                                <option value="night">🌙 ሌሊት</option>
                                <option value="off">Off</option>
                              </select>
                            )}
                          </td>
                        );
                      })}
                      {(() => {
                        const assignedShifts = weekDays
                          .map((day) => rosterData[`${staff._id}_${day.dateStr}`] || 'off')
                          .filter((shift) => ['morning', 'afternoon', 'night'].includes(shift));
                        const totalHours = assignedShifts.reduce((hours, shift) => (
                          hours + (Number(rosterRules.shiftDurations[shift]) || 0)
                        ), 0);
                        return (
                          <>
                            <td className="border-r border-slate-100 p-2 text-center font-semibold text-slate-700">
                              {assignedShifts.length}
                            </td>
                            <td className="p-2 text-center font-bold text-slate-800">{totalHours} h</td>
                          </>
                        );
                      })()}

                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>
        )}
      </div>

      {/* LEGEND / ማብራሪያ */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6 text-xs text-slate-600">
        <span className="font-bold text-slate-800">ማብራሪያ (Legend):</span>
        <div className="flex items-center gap-1.5"><Sun size={14} className="text-amber-500" /> 🌅 ጠዋት ({rosterRules.shiftDurations.morning} hours)</div>
        <div className="flex items-center gap-1.5"><Sunset size={14} className="text-amber-500" /> ☀️ ከሰዓት ({rosterRules.shiftDurations.afternoon} hours)</div>
        <div className="flex items-center gap-1.5"><Moon size={14} className="text-indigo-500" /> 🌙 ሌሊት ({rosterRules.shiftDurations.night} hours)</div>
        <div className="flex items-center gap-1.5"><Coffee size={14} className="text-slate-400" /> Off = እረፍት</div>
        <div className="flex items-center gap-1.5"><Palmtree size={14} className="text-amber-600" /> 🏖 Leave = በ Approvals የጸደቀ ፈቃድ (Locked)</div>
        {!rosterRules.minimumStaff.length && <span className="text-slate-500">No staffing minimums configured. Add department/shift requirements in Clinic Settings.</span>}
      </div>

    </div>
  );
};

const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

const StaffProfile = ({ staff, onClose }) => {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    axios.get(`/api/roster/staff/${staff._id}/profile`, authHeaders(token))
      .then(({ data }) => {
        if (active) setProfile(data.data);
      })
      .catch((loadError) => {
        console.error('Failed to load staff profile:', loadError);
        if (active) setError(loadError.response?.data?.message || 'Unable to load staff profile history.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [staff._id, token]);

  const selectedStaff = profile?.staff || staff;
  const roster = profile?.roster || [];
  const attendance = profile?.attendance || [];
  const leaveHistory = roster.filter((entry) => entry.shift === 'leave');
  const workedShifts = roster.filter((entry) => ['morning', 'afternoon', 'night'].includes(entry.shift));
  const formatHistoryDate = (date) => (
    date ? new Date(`${date}T00:00:00`).toLocaleDateString() : '—'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Staff profile">
      <section className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{selectedStaff.name}</h2>
            <p className="text-sm text-slate-500">Staff profile · recent 90-day history</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1 text-sm">Close</button>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Role', selectedStaff.roleLabel || selectedStaff.role],
            ['Department', selectedStaff.department],
            ['Status', selectedStaff.status || 'Active'],
            ['Email', selectedStaff.email || 'Not provided'],
            ['Joined', selectedStaff.joinedDate ? new Date(selectedStaff.joinedDate).toLocaleDateString() : 'Not recorded']
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-800">{value || '—'}</dd>
            </div>
          ))}
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Phone</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">
              {selectedStaff.phone ? (
                <a className="inline-flex items-center gap-1 text-teal-700 hover:underline" href={`tel:${selectedStaff.phone.replace(/[^\d+]/g, '')}`}>
                  <Phone size={14} />{selectedStaff.phone}
                </a>
              ) : 'Not provided'}
            </dd>
          </div>
        </dl>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading staff history...</p>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ['Work shifts', workedShifts.length],
                ['Visits completed', profile?.completedVisitCount || 0],
                ['Present', attendance.filter((entry) => entry.status === 'present').length],
                ['Late / absent', attendance.filter((entry) => ['late', 'absent'].includes(entry.status)).length],
                ['Leave days', leaveHistory.length]
              ].map(([label, count]) => (
                <div key={label} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-800">{count}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800">Shift history</h3>
                {roster.length ? (
                  <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
                    {roster.slice(0, 10).map((entry) => (
                      <li key={`${entry.date}-${entry._id}`} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                        <span>{formatHistoryDate(entry.date)}</span>
                        <span className="font-medium capitalize text-slate-700">{entry.shift}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-slate-500">No shift records in this period.</p>}
              </section>
              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800">Attendance history</h3>
                {attendance.length ? (
                  <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm">
                    {attendance.slice(0, 10).map((entry) => (
                      <li key={`${entry.date}-${entry._id}`} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                        <span>{formatHistoryDate(entry.date)}</span>
                        <span className="font-medium capitalize text-slate-700">{entry.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-slate-500">No attendance records in this period.</p>}
              </section>
              <section className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
                <h3 className="font-semibold text-slate-800">Leave history</h3>
                {leaveHistory.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {leaveHistory.slice(0, 10).map((entry) => (
                      <li key={`${entry.date}-${entry._id}`} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {formatHistoryDate(entry.date)}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-slate-500">No approved leave records in this period.</p>}
              </section>
            </div>
            <p className="text-xs text-slate-400">
              History shown from {formatHistoryDate(profile?.historyFrom)} to {formatHistoryDate(profile?.historyThrough)}.
            </p>
          </>
        )}
      </section>
    </div>
  );
};

const StaffDirectory = () => {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('staff') || '');
  const [department, setDepartment] = useState('All');
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const staffCounts = staff.reduce((counts, member) => {
    const memberStatus = member.status || 'Active';
    counts[memberStatus] = (counts[memberStatus] || 0) + 1;
    return counts;
  }, {});

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ search, department, role, status });
    axios.get(`/api/roster/staff?${params}`, authHeaders(token))
      .then(({ data }) => {
        if (active) {
          setStaff(Array.isArray(data.data) ? data.data : []);
          setRoles(Array.isArray(data.roles) ? data.roles : []);
          setDepartments(Array.isArray(data.departments) ? data.departments : []);
        }
      })
      .catch((loadError) => {
        console.error('Failed to load staff directory:', loadError);
        if (active) setError(loadError.response?.data?.message || 'Unable to load staff directory.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [department, role, search, status, token]);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Staff shown', staff.length],
          ['Active', staffCounts.Active || 0],
          ['On leave', staffCounts['On Leave'] || 0],
          ['Inactive', staffCounts.Inactive || 0]
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-800">{count}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff name" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
        </label>
        <select aria-label="Filter staff by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="All">All departments</option>
          {departments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select aria-label="Filter staff by role" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="All">All roles</option>
          {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select aria-label="Filter staff by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="All">All statuses</option>
          {['Active', 'On Leave', 'Inactive'].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading staff...</p> : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{['Staff member', 'Role', 'Department', 'Status', 'Phone', 'Profile'].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.length ? staff.map((member) => (
                <tr key={member._id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-800">{member.name}<small className="block text-xs font-normal text-slate-500">{member.email || 'No email listed'}</small></td>
                  <td className="p-3">{member.roleLabel || member.role || '—'}</td>
                  <td className="p-3">{member.department || '—'}</td>
                  <td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{member.status || 'Active'}</span></td>
                  <td className="p-3">
                    {member.phone ? (
                      <a href={`tel:${member.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 text-teal-700 hover:underline">
                        <Phone size={14} />{member.phone}
                      </a>
                    ) : <span className="text-slate-400">Not provided</span>}
                  </td>
                  <td className="p-3"><button onClick={() => setSelectedStaff(member)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-teal-800"><UserRound size={14} /> View profile</button></td>
                </tr>
              )) : <tr><td colSpan="6" className="p-8 text-center text-slate-500">No staff found for these filters.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {selectedStaff && <StaffProfile staff={selectedStaff} onClose={() => setSelectedStaff(null)} />}
    </section>
  );
};

const TodayAttendance = () => {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [replacementCandidates, setReplacementCandidates] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [department, setDepartment] = useState('All');
  const [role, setRole] = useState('All');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('staff') || '');
  const [scheduleFilter, setScheduleFilter] = useState('scheduled');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [replacementMessage, setReplacementMessage] = useState('');
  const [replacementSelection, setReplacementSelection] = useState({});
  const [today, setToday] = useState('');

  const loadAttendance = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams({ department, role });
      const candidateParams = new URLSearchParams({ department, role: 'All' });
      const [attendanceResponse, candidateResponse] = await Promise.all([
        axios.get(`/api/roster/attendance/today?${params}`, authHeaders(token)),
        axios.get(`/api/roster/attendance/today?${candidateParams}`, authHeaders(token))
      ]);
      setStaff(Array.isArray(attendanceResponse.data.data) ? attendanceResponse.data.data : []);
      setReplacementCandidates(Array.isArray(candidateResponse.data.data) ? candidateResponse.data.data : []);
      setDepartmentOptions(Array.isArray(attendanceResponse.data.departments) ? attendanceResponse.data.departments : []);
      setRoleOptions(Array.isArray(attendanceResponse.data.roles) ? attendanceResponse.data.roles : []);
      setToday(attendanceResponse.data.date || '');
    } catch (loadError) {
      console.error('Failed to load attendance:', loadError);
      setError(loadError.response?.data?.message || 'Unable to load today attendance.');
    } finally {
      setLoading(false);
    }
  }, [department, role, token]);

  useEffect(() => { void Promise.resolve().then(loadAttendance); }, [loadAttendance]);

  const updateRecord = (staffId, field, value) => {
    setStaff((current) => current.map((member) => (
      member._id === staffId
        ? field === 'attendanceStatus' && ['absent', 'unrecorded'].includes(value)
          ? { ...member, attendanceStatus: value, timeIn: '', timeOut: '', attendanceNote: value === 'unrecorded' ? '' : member.attendanceNote }
          : { ...member, [field]: value }
        : member
    )));
    setSavedMessage('');
  };

  const visibleStaff = staff.filter((member) => (
    (!search || member.name.toLowerCase().includes(search.trim().toLowerCase()))
    && (scheduleFilter === 'all'
      || (scheduleFilter === 'scheduled' && (member.isScheduled || member.attendanceStatus === 'on_leave'))
      || (scheduleFilter === 'not_scheduled' && !member.isScheduled && member.attendanceStatus !== 'on_leave'))
  ));

  const scheduledStaff = visibleStaff.filter((member) => member.isScheduled);
  const assignReplacement = async (absentStaff) => {
    const replacementStaffId = replacementSelection[absentStaff._id];
    if (!replacementStaffId) {
      setError('Choose an available staff member to cover this absence.');
      return;
    }
    setSaving(true);
    setError('');
    setReplacementMessage('');
    try {
      const { data } = await axios.post('/api/roster/attendance/today/replacement', {
        absentStaffId: absentStaff._id,
        replacementStaffId
      }, authHeaders(token));
      setReplacementMessage(data.message || 'Replacement assigned.');
      await loadAttendance();
    } catch (assignmentError) {
      console.error('Failed to assign attendance replacement:', assignmentError);
      setError(assignmentError.response?.data?.message || 'Unable to assign the replacement.');
    } finally {
      setSaving(false);
    }
  };

  const saveAttendance = async () => {
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const attendanceUpdates = staff
        .filter((member) => member.isScheduled && ['present', 'absent', 'late', 'unrecorded'].includes(member.attendanceStatus))
        .map((member) => ({
          staffId: member._id,
          status: member.attendanceStatus,
          timeIn: member.timeIn || '',
          timeOut: member.timeOut || '',
          note: member.attendanceNote || ''
        }));
      const { data } = await axios.post('/api/roster/attendance/today', { attendanceUpdates }, authHeaders(token));
      setSavedMessage([data.message || `Attendance saved for ${data.savedCount || 0} staff members.`, data.warning].filter(Boolean).join(' '));
      await loadAttendance();
    } catch (saveError) {
      console.error('Failed to save attendance:', saveError);
      setError(saveError.response?.data?.message || 'Unable to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const counts = visibleStaff.reduce((result, member) => {
    if (!member.isScheduled && member.attendanceStatus !== 'on_leave') return result;
    const key = member.attendanceStatus || 'unrecorded';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Today’s Attendance</h2>
          <p className="text-sm text-slate-500">{today || 'Today'} · Verify attendance for staff scheduled to work.</p>
          <p className="mt-1 text-xs text-slate-400">Clinic Head records attendance and actual time-in / time-out manually. Select Present or Late to enter times; biometric clock-in is not connected.</p>
        </div>
        <button onClick={saveAttendance} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saving...' : 'Save Attendance'}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Scheduled', scheduledStaff.length],
          ['Present', counts.present || 0],
          ['Absent', counts.absent || 0],
          ['Late', counts.late || 0],
          ['On leave', counts.on_leave || 0],
          ['Not recorded', scheduledStaff.filter((member) => member.attendanceStatus === 'unrecorded').length]
        ].map(([label, count]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-slate-800">{count}</p></div>)}
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff name" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
        </label>
        <select aria-label="Filter attendance by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="All">All departments</option>{departmentOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select aria-label="Filter attendance by role" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="All">All roles</option>{roleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select aria-label="Filter by scheduled shift" value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="scheduled">Scheduled today</option>
          <option value="not_scheduled">Not scheduled / Off</option>
          <option value="all">All staff</option>
        </select>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {savedMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{savedMessage}</div>}
      {replacementMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{replacementMessage}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading attendance...</p> : (
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Staff member', 'Role / Department', 'Today’s shift', 'Attendance', 'Time-In', 'Time-Out', 'Note / reason', 'Replacement'].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleStaff.length ? visibleStaff.map((member) => (
                <tr key={member._id}>
                  <td className="p-3 font-semibold text-slate-800">{member.name}</td>
                  <td className="p-3 text-slate-600">{member.roleLabel || member.role} · {member.department || '—'}</td>
                  <td className="p-3 text-slate-600">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      member.rosterShift === 'morning' ? 'bg-sky-100 text-sky-800' :
                      member.rosterShift === 'afternoon' ? 'bg-amber-100 text-amber-800' :
                      member.rosterShift === 'night' ? 'bg-indigo-100 text-indigo-800' :
                      member.rosterShift === 'leave' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {member.rosterShift === 'off' ? 'Off / not scheduled' : member.rosterShift || '—'}
                    </span>
                  </td>
                  <td className="p-3">
                    {member.attendanceStatus === 'on_leave'
                      ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">On Leave</span>
                      : !member.isScheduled
                        ? <span className="text-xs text-slate-400">Not scheduled</span>
                        : <select aria-label={`Attendance for ${member.name}`} value={member.attendanceStatus} onChange={(event) => updateRecord(member._id, 'attendanceStatus', event.target.value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                          member.attendanceStatus === 'present' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                          member.attendanceStatus === 'absent' ? 'border-rose-200 bg-rose-50 text-rose-800' :
                          member.attendanceStatus === 'late' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                          'border-slate-200 bg-white text-slate-700'
                        }`}>
                        <option value="unrecorded">Not recorded</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option>
                      </select>}
                  </td>
                  <td className="p-3">
                    <input type="time" aria-label={`Time in for ${member.name}`} disabled={!member.isScheduled || !['present', 'late'].includes(member.attendanceStatus)} value={member.timeIn || ''} onChange={(event) => updateRecord(member._id, 'timeIn', event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:bg-slate-100" />
                  </td>
                  <td className="p-3">
                    <input type="time" aria-label={`Time out for ${member.name}`} disabled={!member.isScheduled || !['present', 'late'].includes(member.attendanceStatus)} value={member.timeOut || ''} onChange={(event) => updateRecord(member._id, 'timeOut', event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:bg-slate-100" />
                  </td>
                  <td className="p-3"><input disabled={!member.isScheduled || member.attendanceStatus === 'on_leave'} value={member.attendanceNote || ''} onChange={(event) => updateRecord(member._id, 'attendanceNote', event.target.value)} placeholder="Optional note" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></td>
                  <td className="p-3">
                    {member.replacementStaffId ? (
                      <span className="text-xs font-semibold text-emerald-700">{member.replacementName || 'Replacement assigned'} · {member.rosterShift}</span>
                    ) : member.attendanceStatus === 'absent' && ['morning', 'afternoon', 'night'].includes(member.rosterShift) ? (
                      <div className="flex min-w-56 items-center gap-2">
                        <select
                          aria-label={`Replacement for ${member.name}`}
                          value={replacementSelection[member._id] || ''}
                          onChange={(event) => setReplacementSelection((current) => ({ ...current, [member._id]: event.target.value }))}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        >
                          <option value="">Choose replacement</option>
                          {replacementCandidates.filter((candidate) => (
                            candidate._id !== member._id
                            && candidate.department === member.department
                            && candidate.status !== 'On Leave'
                            && candidate.attendanceStatus !== 'on_leave'
                            && candidate.attendanceStatus !== 'absent'
                            && candidate.rosterShift === 'off'
                          )).map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name}</option>)}
                        </select>
                        <button onClick={() => assignReplacement(member)} disabled={saving || !replacementSelection[member._id]} className="rounded-lg bg-teal-700 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">Assign</button>
                      </div>
                    ) : member.attendanceStatus === 'absent' ? (
                      <span className="text-xs text-slate-500">No scheduled shift to cover.</span>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              )) : <tr><td colSpan="8" className="p-8 text-center text-slate-500">No staff found for these filters.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

const DutyRoster = () => {
  const [activeView, setActiveView] = useState('roster');
  const views = [
    { id: 'staff', label: 'Staff List', icon: Users },
    { id: 'roster', label: 'Duty Roster', icon: Calendar },
    { id: 'attendance', label: 'Today’s Attendance', icon: Clock3 }
  ];

  return (
    <div className="space-y-5">
      <header><h1 className="text-2xl font-bold text-slate-800">Staff Management</h1><p className="mt-1 text-sm text-slate-500">View staff profiles, plan weekly shifts, and record today’s attendance.</p></header>
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200" aria-label="Staff management sections">
        {views.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveView(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${activeView === id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Icon size={16} />{label}
          </button>
        ))}
      </nav>
      {activeView === 'staff' && <StaffDirectory />}
      {activeView === 'roster' && <RosterView />}
      {activeView === 'attendance' && <TodayAttendance />}
    </div>
  );
};

export default DutyRoster;
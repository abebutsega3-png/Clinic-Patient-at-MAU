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
  const [rosterData, setRosterData] = useState({}); // Grid format: { "staffId_YYYY-MM-DD": "morning" }
  const [lockedCells, setLockedCells] = useState({}); // { "staffId_YYYY-MM-DD": true }
  const [rosterRules, setRosterRules] = useState({
    shiftDurations: { morning: 6, afternoon: 6, night: 12 },
    minimumStaff: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
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
      setRosterRules({
        shiftDurations: { morning: 6, afternoon: 6, night: 12, ...(res.data.rosterRules?.shiftDurations || {}) },
        minimumStaff: Array.isArray(res.data.rosterRules?.minimumStaff) ? res.data.rosterRules.minimumStaff : []
      });

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
    setSuccessMessage('');

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
    } catch (error) {
      console.error('Failed to save staff roster:', error);
      setErrorMessage(error.response?.data?.message || 'Unable to save the duty roster.');
    } finally {
      setSaving(false);
    }
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
  const getZeroStaffWarning = (dateStr) => {
    const staffDepartments = [...new Set(staffList.map((staff) => staff.department).filter(Boolean))];
    if (rosterRules.minimumStaff.length) {
      return staffDepartments.some((staffDepartment) => {
        const departmentRules = rosterRules.minimumStaff.filter((rule) => rule.department === staffDepartment);
        if (!departmentRules.length) {
          return ['morning', 'afternoon', 'night'].some((shift) => (
            !staffList.some((staff) => staff.department === staffDepartment && rosterData[`${staff._id}_${dateStr}`] === shift)
          ));
        }
        return departmentRules.some((rule) => {
          const assignedCount = staffList.filter((staff) => (
            staff.department === rule.department
            && rosterData[`${staff._id}_${dateStr}`] === rule.shift
          )).length;
          return assignedCount < rule.count;
        });
      });
    }
    return staffDepartments.some((staffDepartment) => {
      const departmentStaff = staffList.filter((staff) => staff.department === staffDepartment);
      const morningCount = departmentStaff.filter((staff) => rosterData[`${staff._id}_${dateStr}`] === 'morning').length;
      const afternoonCount = departmentStaff.filter((staff) => rosterData[`${staff._id}_${dateStr}`] === 'afternoon').length;
      const nightCount = departmentStaff.filter((staff) => rosterData[`${staff._id}_${dateStr}`] === 'night').length;
      return morningCount === 0 || afternoonCount === 0 || nightCount === 0;
    });
  };

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
            <option value="OPD">OPD</option>
            <option value="Triage">Triage</option>
            <option value="Laboratory">Laboratory</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="Registration">Registration</option>
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
            <option value="Doctor">Doctor</option>
            <option value="Nurse">Nurse</option>
            <option value="Lab">Lab</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="Registration">Registration</option>
          </select>

          <button 
            onClick={handleSaveRoster} 
            disabled={saving}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'እየተቀመጠ...' : 'Save Roster'}
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
                  <th className="p-3.5 border-r border-slate-200 w-48">ሰራተኛ (Staff)</th>
                  <th className="p-3.5 border-r border-slate-200 w-24 text-center">Role</th>
                  {weekDays.map((day, idx) => {
                    const isZeroStaff = getZeroStaffWarning(day.dateStr);
                    return (
                      <th key={idx} className="p-3 text-center border-r border-slate-200 min-w-[120px]">
                        <div>{day.dayName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{day.formattedDate}</div>
                        {isZeroStaff && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-600 font-bold mt-0.5">
                            <AlertTriangle size={10} /> Below staffing minimum
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-slate-400">No staff records found for these filters.</td>
                  </tr>
                ) : (
                  staffList.map((staff) => (
                    <tr key={staff._id} className="hover:bg-slate-50/60">
                      
                      {/* Staff Name */}
                      <td className="p-3 border-r border-slate-100 font-bold text-slate-800">
                        <div>{staff.name}</div>
                        <span className="text-[10px] text-slate-400 font-normal">{staff.department}</span>
                      </td>

                      {/* Role */}
                      <td className="p-3 border-r border-slate-100 text-center text-slate-500 font-medium">
                        {staff.role}
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
                                  currentShift === 'morning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                  currentShift === 'afternoon' ? 'bg-blue-50 text-blue-800 border-blue-200' :
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
        <div className="flex items-center gap-1.5"><Sunset size={14} className="text-blue-500" /> ☀️ ከሰዓት ({rosterRules.shiftDurations.afternoon} hours)</div>
        <div className="flex items-center gap-1.5"><Moon size={14} className="text-indigo-500" /> 🌙 ሌሊት ({rosterRules.shiftDurations.night} hours)</div>
        <div className="flex items-center gap-1.5"><Coffee size={14} className="text-slate-400" /> Off = እረፍት</div>
        <div className="flex items-center gap-1.5"><Palmtree size={14} className="text-amber-600" /> 🏖 Leave = በ Approvals የጸደቀ ፈቃድ (Locked)</div>
      </div>

    </div>
  );
};

const departments = ['OPD', 'Triage', 'Laboratory', 'Pharmacy', 'Registration'];
const staffRoles = ['Doctor', 'Nurse', 'Lab', 'Pharmacy', 'Registration'];
const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

const StaffDirectory = () => {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ search, department, role, status });
    axios.get(`/api/roster/staff?${params}`, authHeaders(token))
      .then(({ data }) => {
        if (active) setStaff(Array.isArray(data.data) ? data.data : []);
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
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff name" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
        </label>
        <select aria-label="Filter staff by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="All">All departments</option>
          {departments.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="Filter staff by role" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="All">All roles</option>
          {staffRoles.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="Filter staff by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="All">All statuses</option>
          {['Active', 'On Leave', 'Inactive'].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading staff...</p> : (
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{['Staff member', 'Role', 'Department', 'Status', 'Profile'].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.length ? staff.map((member) => (
                <tr key={member._id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-800">{member.name}<small className="block text-xs font-normal text-slate-500">{member.email || 'No email listed'}</small></td>
                  <td className="p-3">{member.role || '—'}</td>
                  <td className="p-3">{member.department || '—'}</td>
                  <td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{member.status || 'Active'}</span></td>
                  <td className="p-3"><button onClick={() => setSelectedStaff(member)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-teal-800"><UserRound size={14} /> View profile</button></td>
                </tr>
              )) : <tr><td colSpan="5" className="p-8 text-center text-slate-500">No staff found for these filters.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Staff profile">
          <section className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><h2 className="text-lg font-bold text-slate-800">{selectedStaff.name}</h2><p className="text-sm text-slate-500">Staff profile · view only</p></div>
              <button onClick={() => setSelectedStaff(null)} className="rounded-lg border border-slate-200 px-3 py-1 text-sm">Close</button>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[['Role', selectedStaff.role], ['Department', selectedStaff.department], ['Status', selectedStaff.status], ['Phone', selectedStaff.phone || 'Not provided'], ['Email', selectedStaff.email || 'Not provided'], ['Joined', selectedStaff.joinedDate ? new Date(selectedStaff.joinedDate).toLocaleDateString() : 'Not recorded']].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value || '—'}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </section>
  );
};

const TodayAttendance = () => {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [replacementCandidates, setReplacementCandidates] = useState([]);
  const [department, setDepartment] = useState('All');
  const [role, setRole] = useState('All');
  const [search, setSearch] = useState('');
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
        ? { ...member, [field]: value }
        : member
    )));
    setSavedMessage('');
  };

  const visibleStaff = staff.filter((member) => (
    !search || member.name.toLowerCase().includes(search.trim().toLowerCase())
  ));

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
        .filter((member) => ['present', 'absent', 'late'].includes(member.attendanceStatus))
        .map((member) => ({
          staffId: member._id,
          status: member.attendanceStatus,
          note: member.attendanceNote || ''
        }));
      const { data } = await axios.post('/api/roster/attendance/today', { attendanceUpdates }, authHeaders(token));
      setSavedMessage(data.message || 'Attendance saved.');
      await loadAttendance();
    } catch (saveError) {
      console.error('Failed to save attendance:', saveError);
      setError(saveError.response?.data?.message || 'Unable to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const counts = visibleStaff.reduce((result, member) => {
    const key = member.attendanceStatus || 'unrecorded';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-800">Today’s Attendance</h2><p className="text-sm text-slate-500">{today || 'Today'} · Record who is present, absent, or late.</p></div>
        <button onClick={saveAttendance} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saving...' : 'Save Attendance'}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Present', counts.present || 0],
          ['Absent', counts.absent || 0],
          ['Late', counts.late || 0],
          ['On leave', counts.on_leave || 0],
          ['Unrecorded', counts.unrecorded || 0]
        ].map(([label, count]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-slate-800">{count}</p></div>)}
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff name" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
        </label>
        <select aria-label="Filter attendance by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="All">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Filter attendance by role" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="All">All roles</option>{staffRoles.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {savedMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{savedMessage}</div>}
      {replacementMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{replacementMessage}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading attendance...</p> : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Staff member', 'Role / Department', 'Today’s shift', 'Attendance', 'Note', 'Replacement'].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleStaff.length ? visibleStaff.map((member) => (
                <tr key={member._id}>
                  <td className="p-3 font-semibold text-slate-800">{member.name}</td>
                  <td className="p-3 text-slate-600">{member.role} · {member.department || '—'}</td>
                  <td className="p-3 text-slate-600">{member.rosterShift === 'off' ? 'Off / not scheduled' : member.rosterShift || '—'}</td>
                  <td className="p-3">
                    {member.attendanceStatus === 'on_leave'
                      ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">On Leave</span>
                      : <select aria-label={`Attendance for ${member.name}`} value={member.attendanceStatus} onChange={(event) => updateRecord(member._id, 'attendanceStatus', event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="unrecorded">Not recorded</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option>
                      </select>}
                  </td>
                  <td className="p-3"><input disabled={member.attendanceStatus === 'on_leave'} value={member.attendanceNote || ''} onChange={(event) => updateRecord(member._id, 'attendanceNote', event.target.value)} placeholder="Optional note" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></td>
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
              )) : <tr><td colSpan="6" className="p-8 text-center text-slate-500">No staff found for these filters.</td></tr>}
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
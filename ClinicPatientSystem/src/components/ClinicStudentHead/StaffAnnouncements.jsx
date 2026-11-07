import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Megaphone, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = {
  title: '',
  message: '',
  audienceType: 'all',
  targetRole: '',
  targetDepartment: '',
  priority: 'normal',
};

const priorityLabels = {
  normal: 'Normal',
  important: 'Important',
  urgent: 'Urgent',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const StaffAnnouncements = () => {
  const { user, token } = useAuth();
  const isManager = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .filter(Boolean)
    .some((role) => String(role).trim().toLowerCase().replace(/[_-]+/g, ' ') === 'clinic head');
  const normalizedRoles = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase().replace(/[_-]+/g, ' '));
  const homePath = normalizedRoles.includes('card chief')
    ? '/card-room'
    : normalizedRoles.some((role) => ['pharmacist', 'drug store manager', 'dispensary room'].includes(role))
      ? '/dispensary'
      : normalizedRoles.some((role) => role.includes('doctor') || role.includes('examination') || role.includes('exam room'))
        ? '/examination-room'
        : '/';
  const [announcements, setAnnouncements] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAnnouncements = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (priorityFilter) params.set('priority', priorityFilter);
    if (audienceFilter) params.set('audienceType', audienceFilter);
    if (startDateFilter) params.set('startDate', startDateFilter);
    if (endDateFilter) params.set('endDate', endDateFilter);
    try {
      const response = await fetch(`/api/announcements?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.message || `Unable to load announcements (${response.status}).`);
      }
      setAnnouncements(result.data);
      setError('');
    } catch (loadError) {
      console.error('Failed to load staff announcements:', loadError);
      setError(loadError.message || 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  }, [audienceFilter, endDateFilter, priorityFilter, search, startDateFilter, token]);

  const loadOptions = useCallback(async () => {
    const response = await fetch('/api/announcements/options', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !result.data) {
      throw new Error(result?.message || `Unable to load announcement recipients (${response.status}).`);
    }
    setRoles(result.data.roles || []);
    setDepartments(result.data.departments || []);
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const refresh = () => {
      if (active) void loadAnnouncements();
    };
    const initialLoad = window.setTimeout(refresh, 0);
    const socket = io({ auth: { token } });
    socket.on('clinic:announcement-updated', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      socket.off('clinic:announcement-updated', refresh);
      socket.disconnect();
    };
  }, [loadAnnouncements, token]);

  useEffect(() => {
    if (!isManager || !token) return;
    const timer = window.setTimeout(() => {
      void loadOptions().catch((loadError) => {
        console.error('Failed to load announcement options:', loadError);
        setError(loadError.message || 'Unable to load announcement recipients.');
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isManager, loadOptions, token]);

  const selectedAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === selectedId) || null,
    [announcements, selectedId],
  );

  if (!user || !token) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId('');
  };

  const editAnnouncement = (announcement) => {
    setForm({
      title: announcement.title,
      message: announcement.message,
      audienceType: announcement.audienceType,
      targetRole: announcement.targetRole || '',
      targetDepartment: announcement.targetDepartment?.id || '',
      priority: announcement.priority,
    });
    setEditingId(announcement.id);
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitAnnouncement = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(editingId ? `/api/announcements/${editingId}` : '/api/announcements', {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to save announcement (${response.status}).`);
      }
      setSuccess(result.message || 'Announcement published.');
      resetForm();
      await loadAnnouncements();
    } catch (saveError) {
      console.error('Failed to save announcement:', saveError);
      setError(saveError.message || 'Unable to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (announcement) => {
    if (!window.confirm(`Delete "${announcement.title}"? Staff will no longer see it.`)) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to delete announcement (${response.status}).`);
      }
      if (selectedId === announcement.id) setSelectedId('');
      setSuccess(result.message || 'Announcement deleted.');
      await loadAnnouncements();
    } catch (deleteError) {
      console.error('Failed to delete announcement:', deleteError);
      setError(deleteError.message || 'Unable to delete announcement.');
    }
  };

  const updateReadStatus = async (announcement, action) => {
    setError('');
    try {
      const response = await fetch(`/api/announcements/${announcement.id}/read-status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to update announcement (${response.status}).`);
      }
      await loadAnnouncements();
    } catch (readError) {
      console.error('Failed to update announcement read status:', readError);
      setError(readError.message || 'Unable to update announcement status.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white"><Megaphone size={22} /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Clinic staff communications</p>
            <h1 className="text-xl font-bold text-slate-900">Announcements</h1>
            <p className="mt-0.5 text-xs text-slate-500">{isManager ? 'Publish messages and track staff read status.' : 'Read messages for your role and department.'}</p>
          </div>
        </div>
        {!isManager && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">{announcements.filter((item) => !item.readAt).length} unread</span>
            <Link to={homePath} className="text-xs font-semibold text-blue-700 hover:underline">Back to dashboard</Link>
          </div>
        )}
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}

      {isManager && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">{editingId ? 'Edit announcement' : 'Create announcement'}</h2>
              <p className="mt-1 text-xs text-slate-500">Do not include identifiable student health information.</p>
            </div>
            <Plus className="text-blue-700" size={20} />
          </div>
          <form onSubmit={submitAnnouncement} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              Title
              <input required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="e.g. Laboratory closed Friday" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              Priority
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              Audience
              <select value={form.audienceType} onChange={(event) => setForm((current) => ({ ...current, audienceType: event.target.value, targetRole: '', targetDepartment: '' }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                <option value="all">All staff</option>
                <option value="role">Specific role</option>
                <option value="department">Specific department</option>
              </select>
            </label>
            {form.audienceType === 'role' && (
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Recipient role
                <select required value={form.targetRole} onChange={(event) => setForm((current) => ({ ...current, targetRole: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">Select role</option>
                  {roles.map((role) => <option key={role.roleName} value={role.roleName}>{role.displayName || role.roleName}</option>)}
                </select>
              </label>
            )}
            {form.audienceType === 'department' && (
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Recipient department
                <select required value={form.targetDepartment} onChange={(event) => setForm((current) => ({ ...current, targetDepartment: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">Select department</option>
                  {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                </select>
              </label>
            )}
            <label className="space-y-1 text-xs font-semibold text-slate-700 md:col-span-2">
              Message
              <textarea required maxLength={10000} rows={5} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Write the announcement for staff..." />
            </label>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel edit</button>}
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Publish announcement'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">{isManager ? 'Published announcements' : 'Staff announcements'}</h2>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input aria-label="Search announcements" value={search} onChange={(event) => setSearch(event.target.value)} className="w-48 rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs" placeholder="Search..." />
            </label>
            <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
              <option value="">All priorities</option>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {isManager && (
              <>
                <select aria-label="Filter by audience" value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                  <option value="">All audiences</option>
                  <option value="all">All staff</option>
                  <option value="role">Specific role</option>
                  <option value="department">Specific department</option>
                </select>
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">From
                  <input aria-label="Filter announcements from date" type="date" value={startDateFilter} max={endDateFilter || undefined} onChange={(event) => setStartDateFilter(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-normal" />
                </label>
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">To
                  <input aria-label="Filter announcements to date" type="date" value={endDateFilter} min={startDateFilter || undefined} onChange={(event) => setEndDateFilter(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-normal" />
                </label>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <p role="status" className="p-8 text-center text-sm text-slate-500">Loading announcements…</p>
        ) : announcements.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No announcements to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Announcement</th>
                  <th scope="col" className="px-4 py-3">Audience</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Published</th>
                  <th scope="col" className="px-4 py-3">{isManager ? 'Read status' : 'Status'}</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {announcements.map((announcement) => {
                  const unreadUrgent = announcement.priority === 'urgent' && !announcement.readAt;
                  const audience = announcement.audienceType === 'all'
                    ? 'All staff'
                    : announcement.audienceType === 'role'
                      ? announcement.targetRole
                      : announcement.targetDepartment?.name || 'Department';
                  return (
                    <tr key={announcement.id} className={`align-top ${unreadUrgent ? 'bg-rose-50' : 'hover:bg-slate-50/70'}`}>
                      <td className="max-w-md px-4 py-3">
                        <div className="flex items-start gap-2">
                          {unreadUrgent && <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" aria-label="Urgent and unread" />}
                          <div>
                            <p className={`font-semibold ${unreadUrgent ? 'text-rose-900' : 'text-slate-800'}`}>{announcement.title}</p>
                            <p className="mt-1 whitespace-pre-wrap text-slate-600">{announcement.message}</p>
                            {!isManager && announcement.priority === 'urgent' && !announcement.readAt && <p className="mt-2 font-bold text-rose-700">Urgent — please read and acknowledge.</p>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{audience}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${announcement.priority === 'urgent' ? 'bg-rose-100 text-rose-800' : announcement.priority === 'important' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{priorityLabels[announcement.priority] || announcement.priority}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(announcement.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        {isManager ? (
                          <button type="button" onClick={() => setSelectedId(selectedId === announcement.id ? '' : announcement.id)} className="text-blue-700 hover:underline">
                            {announcement.readCount}/{announcement.recipientCount} read
                          </button>
                        ) : announcement.readAt ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={13} />Read</span>
                        ) : <span className="text-amber-700">Unread</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isManager ? (
                          <div className="flex gap-2">
                            <button type="button" aria-label={`Edit ${announcement.title}`} onClick={() => editAnnouncement(announcement)} className="rounded p-1.5 text-blue-700 hover:bg-blue-50"><Pencil size={15} /></button>
                            <button type="button" aria-label={`Delete ${announcement.title}`} onClick={() => void deleteAnnouncement(announcement)} className="rounded p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {!announcement.readAt && <button type="button" onClick={() => void updateReadStatus(announcement, 'read')} className="rounded-md bg-blue-700 px-2.5 py-1.5 font-semibold text-white hover:bg-blue-800">Mark as read</button>}
                            {!announcement.acknowledgedAt && <button type="button" onClick={() => void updateReadStatus(announcement, 'acknowledge')} className="rounded-md border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Acknowledge</button>}
                            {announcement.acknowledgedAt && <span className="text-emerald-700">Acknowledged</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isManager && selectedAnnouncement && (
        <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">Read tracking: {selectedAnnouncement.title}</h2>
            <button type="button" onClick={() => setSelectedId('')} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Close</button>
          </div>
          <p className="mt-2 text-xs text-slate-600">{selectedAnnouncement.readCount} of {selectedAnnouncement.recipientCount} staff members have read this announcement.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-emerald-700">Read</h3>
              <ul className="space-y-1 text-xs text-slate-700">
                {selectedAnnouncement.recipients.filter((recipient) => recipient.readAt).map((recipient) => <li key={recipient.id}>{recipient.name} · {recipient.role} · {formatDate(recipient.readAt)}</li>)}
                {!selectedAnnouncement.recipients.some((recipient) => recipient.readAt) && <li className="text-slate-400">No one has read it yet.</li>}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-amber-700">Unread</h3>
              <ul className="space-y-1 text-xs text-slate-700">
                {selectedAnnouncement.unreadRecipients.map((recipient) => <li key={recipient.id}>{recipient.name} · {recipient.role} · {recipient.department || 'No department'}</li>)}
                {!selectedAnnouncement.unreadRecipients.length && <li className="text-slate-400">All recipients have read it.</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

    </div>
  );
};

export default StaffAnnouncements;

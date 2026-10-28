import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Clock3,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  X,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const initialForm = {
  name: '',
  username: '',
  email: '',
  employeeId: '',
  phoneNumber: '',
  role: '',
  departmentId: '',
  status: 'Active',
  password: '',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
};

const UserManagement = () => {
  const { token, user } = useAuth();
  const isAdmin = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .some((role) => typeof role === 'string' && role.toLowerCase() === 'admin');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, onLeave: 0, pendingSupported: false });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || `Request failed (${response.status}).`);
    }
    return result;
  }, [token]);

  useEffect(() => {
    let isCurrent = true;
    const loadPage = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          page: String(pagination.page),
          limit: String(pagination.limit),
          sortBy,
          sortDirection,
        });
        if (search.trim()) params.set('search', search.trim());
        if (roleFilter) params.set('role', roleFilter);
        if (departmentFilter) params.set('department', departmentFilter);
        if (statusFilter) params.set('status', statusFilter);
        const [userResult, optionsResult] = await Promise.all([
          request(`/api/admin/users?${params}`),
          request('/api/admin/users/options'),
        ]);
        if (isCurrent) {
          setUsers(userResult.data);
          setPagination(userResult.pagination);
          setSummary(userResult.summary || { total: 0, active: 0, inactive: 0, onLeave: 0, pendingSupported: false });
          setRoles(optionsResult.data.roles);
          setDepartments(optionsResult.data.departments || []);
          setPasswordPolicy(optionsResult.data.passwordPolicy || null);
        }
      } catch (loadError) {
        if (isCurrent) setError(loadError.message || 'Unable to load users.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    loadPage();
    return () => {
      isCurrent = false;
    };
  }, [request, pagination.page, pagination.limit, search, roleFilter, departmentFilter, statusFilter, sortBy, sortDirection, refreshKey]);

  const rangeStart = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('');
    setDepartmentFilter('');
    setStatusFilter('');
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const openCreate = () => {
    setForm({ ...initialForm, role: '', departmentId: '' });
    setSelectedUser(null);
    setDialog('edit');
    setError('');
    setNotice('');
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setForm({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      employeeId: user.employeeId || '',
      phoneNumber: user.phoneNumber || '',
      role: user.role || '',
      departmentId: user.departmentId ? String(user.departmentId) : departments.find((department) => department.name === user.department)?._id || '',
      status: user.status || 'Active',
      password: '',
    });
    setDialog('edit');
    setError('');
    setNotice('');
  };

  const closeDialog = () => {
    setDialog('');
    setSelectedUser(null);
    setForm(initialForm);
    setError('');
  };

  const saveUser = async (event) => {
    event.preventDefault();
    if (!form.email.trim() && !form.phoneNumber.trim()) {
      setError('Provide an email address or phone number.');
      return;
    }
    if ((!selectedUser || (selectedUser.role !== 'Admin' && form.role === 'Admin'))
      && !window.confirm('You are assigning System Admin access. This role can manage users, permissions, and system settings. Continue?')) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      const result = await request(
        selectedUser ? `/api/admin/users/${selectedUser._id}` : '/api/admin/users',
        {
          method: selectedUser ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      closeDialog();
      setNotice(result.message);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (user) => {
    const status = user.status === 'Active' ? 'Inactive' : 'Active';
    if (!window.confirm(`Set ${user.name}'s account to ${status}?`)) return;
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/admin/users/${user._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(result.message);
      setRefreshKey((current) => current + 1);
    } catch (statusError) {
      setError(statusError.message || 'Unable to change account status.');
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (!window.confirm(`Set a temporary password for ${selectedUser?.name} and revoke their current sessions?`)) return;
    const password = event.currentTarget.password.value;
    setSaving(true);
    setError('');
    try {
      const result = await request(`/api/admin/users/${selectedUser._id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
      closeDialog();
      setNotice(result.message);
      setRefreshKey((current) => current + 1);
    } catch (resetError) {
      setError(resetError.message || 'Unable to reset password.');
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (user) => {
    setSelectedUser(user);
    setDialog('details');
    setError('');
    try {
      const result = await request(`/api/admin/users/${user._id}`);
      setSelectedUser(result.data);
    } catch (detailsError) {
      setError(detailsError.message || 'Unable to load user details.');
    }
  };

  const pageNumbers = useMemo(() => {
    const first = Math.max(1, Math.min(pagination.page - 2, pagination.pages - 4));
    const last = Math.min(pagination.pages, first + 4);
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
  }, [pagination.page, pagination.pages]);
  const changeSort = (field) => {
    if (sortBy === field) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortDirection(field === 'createdAt' ? 'desc' : 'asc');
    }
    setPagination((current) => ({ ...current, page: 1 }));
  };
  const sortIndicator = (field) => {
    const Icon = sortBy !== field ? ArrowDownUp : sortDirection === 'asc' ? ArrowUp : ArrowDown;
    return <Icon size={12} className="ml-1 inline" aria-hidden="true" />;
  };
  const passwordHint = passwordPolicy
    ? `At least ${passwordPolicy.minimumPasswordLength} characters${passwordPolicy.requireLetter ? ', with a letter' : ''}${passwordPolicy.requireNumber ? ' and a number' : ''}${passwordPolicy.requireUppercase ? ', including an uppercase letter' : ''}${passwordPolicy.requireSpecialCharacter ? ' and a special character' : ''}.`
    : 'Password rules are validated by the server.';

  if (!token || !isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-slate-500">System Admin / Access Control</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Manage clinic accounts, access, and account status.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh
          </button>
          <button type="button" disabled={loading || !roles.length || !departments.length} onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={17} aria-hidden="true" />Add New User
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      <section aria-label="User summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Total Users', value: summary.total, icon: UsersRound, style: 'bg-blue-50 text-blue-700' },
          { label: 'Active Users', value: summary.active, icon: UserRoundCheck, style: 'bg-emerald-50 text-emerald-700' },
          { label: 'Inactive Users', value: summary.inactive, icon: UserRoundX, style: 'bg-slate-100 text-slate-700' },
          { label: 'Pending / Unverified', value: summary.pendingSupported ? summary.pending : 'Not tracked', icon: Clock3, style: 'bg-amber-50 text-amber-700' },
        ].map(({ label, value, icon: Icon, style }) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <span className={`rounded-lg p-2 ${style}`}><Icon size={16} aria-hidden="true" /></span>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{loading || error ? '—' : typeof value === 'number' ? new Intl.NumberFormat().format(value) : value}</p>
          </article>
        ))}
      </section>
      {!summary.pendingSupported && <p className="text-xs text-slate-500">Pending or unverified status is not tracked. {summary.onLeave ? `${new Intl.NumberFormat().format(summary.onLeave)} account(s) are marked On Leave.` : ''}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_160px_auto]">
          <label className="relative block">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              placeholder="Search name, username, email, or staff ID..."
              aria-label="Search by name, username, email, or staff ID"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <select aria-label="Filter by role" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700">
            <option value="">All roles</option>
            {roles.map((role) => <option key={role} value={role}>{role === 'Admin' ? 'System Admin' : role}</option>)}
          </select>
          <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700">
            <option value="">All departments</option>
            {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
          </select>
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700">
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
          </select>
          <button type="button" onClick={resetFilters} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading users...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    ['name', 'Full Name'],
                    ['username', 'Username / Email'],
                    ['employeeId', 'Staff ID'],
                    ['role', 'Role'],
                    ['department', 'Department'],
                    ['status', 'Status'],
                    ['createdAt', 'Created Date'],
                  ].map(([field, label]) => (
                    <th key={field} className="px-5 py-3">
                      <button type="button" onClick={() => changeSort(field)} className="whitespace-nowrap hover:text-teal-700">
                        {label}{sortIndicator(field)}
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length ? users.map((user) => (
                  <tr key={user._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{user.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <span className="block">{user.username || '—'}</span>
                      {user.email && <span className="mt-0.5 block text-xs text-slate-400">{user.email}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{user.employeeId || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{user.role === 'Admin' ? 'System Admin' : user.role}</td>
                    <td className="px-5 py-3.5 text-slate-600">{user.department || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : user.status === 'On Leave' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="View details" aria-label={`View ${user.name}`} onClick={() => openDetails(user)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-teal-700"><Eye size={16} /></button>
                        <button type="button" title="Edit user" aria-label={`Edit ${user.name}`} onClick={() => openEdit(user)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700"><Pencil size={16} /></button>
                        <button type="button" title="Reset password" aria-label={`Reset password for ${user.name}`} onClick={() => { setSelectedUser(user); setDialog('password'); setError(''); }} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-purple-700"><KeyRound size={16} /></button>
                        <button type="button" title={user.status === 'Active' ? 'Deactivate user' : 'Activate user'} aria-label={`${user.status === 'Active' ? 'Deactivate' : 'Activate'} ${user.name}`} onClick={() => changeStatus(user)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-amber-700">
                          {user.status === 'Active' ? <UserRoundX size={16} /> : <UserRoundCheck size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-slate-500">{error ? 'User records could not be loaded.' : 'No user accounts match these filters.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
          <span>Showing {rangeStart}–{rangeEnd} of {pagination.total}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))} className="rounded-md border border-slate-300 px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page">‹</button>
            {pageNumbers.map((page) => (
              <button key={page} type="button" onClick={() => setPagination((current) => ({ ...current, page }))} className={`min-w-9 rounded-md border px-2.5 py-1.5 ${page === pagination.page ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 hover:bg-slate-50'}`} aria-current={page === pagination.page ? 'page' : undefined}>{page}</button>
            ))}
            <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))} className="rounded-md border border-slate-300 px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page">›</button>
          </div>
        </div>
      </section>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="user-dialog-title" className="text-lg font-bold text-slate-800">
                  {dialog === 'details' ? 'User Details' : dialog === 'password' ? 'Reset Password' : selectedUser ? 'Edit User' : 'Add User'}
                </h2>
                {dialog === 'edit' && <p className="mt-1 text-sm text-slate-500">Account changes are audited. Role or username changes revoke existing sessions.</p>}
              </div>
              <button type="button" onClick={closeDialog} aria-label="Close dialog" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>

            {dialog === 'edit' && (
              <form onSubmit={saveUser} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Full name
                    <input required minLength="2" maxLength="120" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Username
                    <input required minLength="3" maxLength="50" pattern="[A-Za-z0-9._-]+" autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Email
                    <input type="email" maxLength="254" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Phone number
                    <input type="tel" maxLength="30" autoComplete="tel" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Provide an email address or phone number.</span>
                  </label>
                  <label className="text-sm font-medium text-slate-700">Staff / employee ID
                    <input maxLength="50" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Role
                    <select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                      <option value="">Select role</option>
                      {roles.map((role) => <option key={role} value={role}>{role === 'Admin' ? 'System Admin' : role}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">Department
                    <select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                      <option value="">Select department</option>
                      {departments.map((department) => <option key={department._id} value={department._id}>{department.name}{department.code ? ` (${department.code})` : ''}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">Account status
                    <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                      <option>Active</option><option>Inactive</option><option>On Leave</option>
                    </select>
                  </label>
                  {!selectedUser && (
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">Temporary password
                      <input required type="password" minLength={passwordPolicy?.minimumPasswordLength || 8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                      <span className="mt-1 block text-xs font-normal text-slate-500">{passwordHint} User must change it at first sign-in.</span>
                    </label>
                  )}
                </div>
                {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={closeDialog} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : selectedUser ? 'Save Changes' : 'Create Account'}</button>
                </div>
              </form>
            )}

            {dialog === 'password' && (
              <form onSubmit={resetPassword} className="space-y-4">
                <p className="text-sm text-slate-600">Set a temporary password for <strong>{selectedUser?.name}</strong>. Their current password cannot be viewed, and they must change this password after signing in.</p>
                <label className="block text-sm font-medium text-slate-700">Temporary password
                  <input name="password" type="password" minLength={passwordPolicy?.minimumPasswordLength || 8} required autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">{passwordHint}</span>
                </label>
                {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={closeDialog} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Resetting...' : 'Set Temporary Password'}</button>
                </div>
              </form>
            )}

            {dialog === 'details' && selectedUser && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <p><span className="text-slate-500">Name:</span> <strong>{selectedUser.name}</strong></p>
                  <p><span className="text-slate-500">Username:</span> <strong>{selectedUser.username || '—'}</strong></p>
                  <p><span className="text-slate-500">Email:</span> <strong>{selectedUser.email || '—'}</strong></p>
                  <p><span className="text-slate-500">Staff ID:</span> <strong>{selectedUser.employeeId || '—'}</strong></p>
                  <p><span className="text-slate-500">Role:</span> <strong>{selectedUser.role === 'Admin' ? 'System Admin' : selectedUser.role}</strong></p>
                  <p><span className="text-slate-500">Department:</span> <strong>{selectedUser.department || '—'}</strong></p>
                  <p><span className="text-slate-500">Phone:</span> <strong>{selectedUser.phoneNumber || '—'}</strong></p>
                  <p><span className="text-slate-500">Status:</span> <strong>{selectedUser.status}</strong></p>
                  <p><span className="text-slate-500">Created:</span> <strong>{formatDate(selectedUser.createdAt)}</strong></p>
                  <p><span className="text-slate-500">Last login:</span> <strong>{formatDate(selectedUser.lastLogin)}</strong></p>
                  <p><span className="text-slate-500">Failed login attempts:</span> <strong>{selectedUser.failedLoginAttempts || 0}</strong></p>
                  <p><span className="text-slate-500">Lockout expires:</span> <strong>{formatDate(selectedUser.loginLockedUntil)}</strong></p>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck size={16} /> Recent Activity</h3>
                  {selectedUser.recentActivities?.length ? (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {selectedUser.recentActivities.map((activity) => (
                        <li key={activity._id} className="flex flex-wrap justify-between gap-2 px-3 py-2.5 text-sm">
                          <span><strong>{activity.action}</strong> {activity.details}<span className="ml-1 text-xs text-slate-400">({activity.result || 'recorded'})</span></span>
                          <time className="text-xs text-slate-500">{formatDate(activity.createdAt)}</time>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No recent audit activity.</p>}
                </div>
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button type="button" onClick={closeDialog} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Close</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

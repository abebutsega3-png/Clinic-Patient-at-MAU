import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Save,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const initialForm = {
  name: '',
  username: '',
  email: '',
  employeeId: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  gender: '',
  dateOfBirth: '',
  role: '',
  departmentId: '',
  status: 'Active',
  sendWelcomeEmail: false,
  requirePasswordChange: true,
};

const isValidFullName = (value) => {
  const name = value.trim();
  return name.length >= 3 && name.length <= 120 && /^\p{L}+(?:\s+\p{L}+)*$/u.test(name);
};
const isValidEmployeeId = (value) => /^MAU_\d+$/.test(value.trim());
const isValidEmail = (value) => /^[A-Za-z0-9]+(?:[._%+-][A-Za-z0-9]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value.trim());
const isValidEthiopianPhone = (value) => /^(?:09\d{8}|\+2519\d{8})$/.test(value.trim());
const getAdultBirthDateLimit = (date) => {
  const limit = new Date(`${date}T00:00:00.000Z`);
  limit.setUTCFullYear(limit.getUTCFullYear() - 18);
  return limit.toISOString().slice(0, 10);
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
  const [oneTimeCredentials, setOneTimeCredentials] = useState(null);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [todayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const adultBirthDateLimit = getAdultBirthDateLimit(todayDate);

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
    setShowTemporaryPassword(false);
    setShowConfirmPassword(false);
    setOneTimeCredentials(null);
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
      gender: user.gender || '',
      dateOfBirth: user.dateOfBirth || '',
      role: user.role || '',
      departmentId: user.departmentId ? String(user.departmentId) : departments.find((department) => department.name === user.department)?._id || '',
      status: user.status || 'Active',
      sendWelcomeEmail: true,
    });
    setDialog('edit');
    setShowTemporaryPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setNotice('');
    setOneTimeCredentials(null);
  };

  const closeDialog = () => {
    setDialog('');
    setSelectedUser(null);
    setForm(initialForm);
    setError('');
  };

  const saveUser = async (event) => {
    event.preventDefault();
    if (!selectedUser && !isValidFullName(form.name)) {
      setError('Full name must be at least 3 letters. Use letters and spaces only.');
      return;
    }
    if (!selectedUser && !isValidEmployeeId(form.employeeId)) {
      setError('Employee ID must use the format MAU_ followed by digits (for example, MAU_1234).');
      return;
    }
    if (!selectedUser && (!form.dateOfBirth || form.dateOfBirth > adultBirthDateLimit)) {
      setError('The user must be at least 18 years old.');
      return;
    }
    if (!selectedUser && form.email.trim() && !isValidEmail(form.email)) {
      setError('Enter an email with letters or numbers before @ and a valid domain (for example, abebe12@mau.edu.et).');
      return;
    }
    if (!selectedUser && form.phoneNumber.trim() && !isValidEthiopianPhone(form.phoneNumber)) {
      setError('Phone number must be 09 followed by 8 digits, or +2519 followed by 8 digits.');
      return;
    }
    if (!selectedUser && form.password !== form.confirmPassword) {
      setError('Temporary password and confirmation do not match.');
      return;
    }
    if (!form.email.trim() && !form.phoneNumber.trim()) {
      setError('Provide an email address or phone number.');
      return;
    }
    if (form.role === 'Admin' && (!selectedUser || selectedUser.role !== 'Admin')
      && !window.confirm('You are assigning System Admin access. This role can manage users, permissions, and system settings. Continue?')) return;
    setSaving(true);
    setError('');
    try {
      const payload = selectedUser
        ? { ...form }
        : {
          ...form,
          confirmPassword: undefined,
          sendWelcomeEmail: Boolean(form.sendWelcomeEmail),
          mustChangePassword: Boolean(form.requirePasswordChange),
        };
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
    const sendWelcomeEmail = event.currentTarget.sendWelcomeEmail.checked;
    if (!window.confirm(`Generate a new temporary password for ${selectedUser?.name}, revoke their current sessions, and ${sendWelcomeEmail ? 'email it to the account address' : 'show it once for secure sharing'}?`)) return;
    setSaving(true);
    setError('');
    try {
      const result = await request(`/api/admin/users/${selectedUser._id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ sendWelcomeEmail }),
      });
      closeDialog();
      setNotice(result.message);
      setOneTimeCredentials(result.temporaryPassword ? {
        username: selectedUser.username || '',
        email: selectedUser.email || '',
        password: result.temporaryPassword,
        emailRequested: result.emailRequested,
      } : null);
      setRefreshKey((current) => current + 1);
    } catch (resetError) {
      setError(resetError.message || 'Unable to reset password.');
    } finally {
      setSaving(false);
    }
  };

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(oneTimeCredentials.password);
      setNotice('Temporary password copied. Share it through a secure channel and ask the user to change it at first sign-in.');
    } catch (copyError) {
      console.error('Unable to copy the temporary password:', copyError);
      setError('Could not copy the password. Select and copy it manually from the secure one-time display.');
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
    <div className="min-h-screen space-y-4 bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1 text-xs text-slate-500">
            <Link to="/admin" className="text-blue-600 hover:underline">Home</Link>
            <span className="mx-1.5">/</span>
            <span>Employees &amp; Users</span>
            <span className="mx-1.5">/</span>
            <span>Users</span>
          </nav>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Users List</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Refresh
          </button>
          <button type="button" disabled={loading || !roles.length || !departments.length} onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={17} aria-hidden="true" />Add New User
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {oneTimeCredentials && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm" aria-label="One-time temporary credentials">
          <div className="flex items-start gap-3">
            <KeyRound size={20} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-amber-950">One-time temporary password</h2>
              <p className="mt-1 text-sm text-amber-900">{oneTimeCredentials.emailRequested ? 'Email delivery was not completed. ' : 'Welcome email was not requested. '}Share this password with {oneTimeCredentials.username || oneTimeCredentials.email} through a secure channel. It will not be shown again after leaving this page.</p>
              <div className="mt-3 flex max-w-lg gap-2">
                <input aria-label="Generated temporary password" readOnly value={oneTimeCredentials.password} className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-sm text-slate-900" />
                <button type="button" onClick={() => void copyTemporaryPassword()} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"><Copy size={15} />Copy</button>
                <button type="button" aria-label="Dismiss one-time credentials" onClick={() => setOneTimeCredentials(null)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-amber-800 hover:bg-amber-100"><X size={16} /></button>
              </div>
              <p className="mt-2 text-xs text-amber-800">The user must change this password at first sign-in. Avoid sending it through public or shared channels.</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(160px,1fr)_minmax(180px,1fr)_minmax(150px,1fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Search users</span>
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              placeholder="Search"
              aria-label="Search by name, username, email, or staff ID"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Role Type
            <select aria-label="Filter by role" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">All</option>
              {roles.map((role) => <option key={role.roleName} value={role.roleName}>{role.roleName === 'Admin' ? 'System Admin' : role.displayName}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Department / Unit
            <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">All Departments</option>
              {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Status
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-4 text-base font-bold text-slate-900 sm:px-5">System Users</h2>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading users...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-white text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  {[
                    ['username', 'Username'],
                    ['name', 'Full Name'],
                    [null, 'Email Address'],
                    ['role', 'Role'],
                    ['department', 'Department / Unit'],
                    ['employeeId', 'Linked Employee ID'],
                    ['status', 'Status'],
                  ].map(([field, label]) => (
                    <th key={label} className="border-b border-slate-200 px-4 py-3">
                      {field ? (
                        <button type="button" onClick={() => changeSort(field)} className="whitespace-nowrap hover:text-blue-700">
                          {label}{sortIndicator(field)}
                        </button>
                      ) : label}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length ? users.map((user) => (
                  <tr key={user._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{user.username || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-600">{user.name || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-600">{user.email || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-600">{user.role === 'Admin' ? 'System Admin' : user.role}</td>
                    <td className="max-w-48 px-4 py-3.5 text-slate-600">{user.department || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-600">{user.employeeId || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : user.status === 'On Leave' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : user.status === 'On Leave' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        {user.status === 'Inactive' ? 'Deactivated' : user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
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
        <div className="fixed inset-x-0 bottom-0 top-[72px] z-20 flex items-center justify-center bg-slate-950/40 p-2 sm:p-4 lg:left-64" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className={`max-h-[calc(100dvh-6rem)] w-full ${dialog === 'edit' ? (selectedUser ? 'max-w-2xl' : 'max-w-6xl') + ' flex flex-col overflow-hidden' : 'max-w-2xl overflow-y-auto'} rounded-2xl bg-white p-4 shadow-xl sm:p-6`}>
            <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
              <div>
                <h2 id="user-dialog-title" className="text-lg font-bold text-slate-800">
                  {dialog === 'details' ? 'User Details' : dialog === 'password' ? 'Reset Password' : selectedUser ? 'Edit User' : 'Create New System User'}
                </h2>
                {dialog === 'edit' && <p className="mt-1 text-sm text-slate-500">{selectedUser ? 'Account changes are audited. Role or username changes revoke existing sessions.' : 'Register staff members and assign secure system access roles.'}</p>}
              </div>
              <button type="button" onClick={closeDialog} aria-label="Close dialog" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>

            {dialog === 'edit' && (
              <form onSubmit={saveUser} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {selectedUser ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <label className="text-sm font-medium text-slate-700">Gender
                    <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                      <option value="">Not specified</option><option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">Date of birth
                    <input type="date" max={todayDate} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Role
                    <select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                      <option value="">Select role</option>
                      {roles.map((role) => <option key={role.roleName} value={role.roleName}>{role.roleName === 'Admin' ? 'System Admin' : role.displayName}</option>)}
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
                </div> : (
                  <>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <section className="rounded-xl border border-blue-200 bg-white p-3 shadow-sm sm:p-4">
                        <h3 className="mb-3 rounded-lg bg-blue-900 px-3 py-2 text-sm font-bold text-white">1. Basic Information</h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-700">Full name <span className="text-rose-600">*</span>
                            <input required minLength="3" maxLength="120" autoComplete="name" title="Use at least 3 letters; spaces between names are allowed." value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                          </label>
                          <label className="text-xs font-semibold text-slate-700">Employee ID <span className="text-rose-600">*</span>
                            <input required pattern="MAU_[0-9]+" title="Use the format MAU_ followed by digits, for example MAU_1234." placeholder="MAU_1234" maxLength="50" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                          </label>
                          <label className="text-xs font-semibold text-slate-700">Email address
                            <input type="email" pattern="[A-Za-z0-9]+([._%+-][A-Za-z0-9]+)*@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+" title="Enter a valid address, for example abebe12@mau.edu.et." required={form.sendWelcomeEmail || !form.phoneNumber} maxLength="254" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                          </label>
                          <label className="text-xs font-semibold text-slate-700">Phone number
                            <input type="tel" pattern="(09[0-9]{8}|\+2519[0-9]{8})" title="Use 09 followed by 8 digits, or +2519 followed by 8 digits." placeholder="09XXXXXXXX or +2519XXXXXXXX" required={!form.email} maxLength="13" autoComplete="tel" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                          </label>
                          <label className="text-xs font-semibold text-slate-700">Gender <span className="text-rose-600">*</span>
                            <select required value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal">
                              <option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option>
                            </select>
                          </label>
                          <label className="text-xs font-semibold text-slate-700">Date of birth <span className="text-rose-600">*</span>
                            <input required type="date" min="1900-01-01" max={adultBirthDateLimit} title="User must be at least 18 years old." value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal" />
                          </label>
                        </div>
                      </section>

                      <section className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm sm:p-4">
                        <h3 className="mb-3 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">2. Department &amp; Role Assignment</h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-700">Department <span className="text-rose-600">*</span>
                            <select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal">
                              <option value="">Select department</option>
                              {departments.map((department) => <option key={department._id} value={department._id}>{department.name}{department.code ? ` (${department.code})` : ''}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-semibold text-slate-700">Assign role <span className="text-rose-600">*</span>
                            <select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal">
                              <option value="">Select role</option>
                              {roles.map((role) => <option key={role.roleName} value={role.roleName}>{role.roleName === 'Admin' ? 'System Admin' : role.displayName}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                          <ShieldCheck size={17} className="shrink-0" />
                          <span>{form.role ? `Access permissions are assigned by the ${form.role} role.` : 'Choose a role to assign the correct system permissions.'}</span>
                        </div>
                      </section>

                      <section className="rounded-xl border border-violet-200 bg-white p-3 shadow-sm sm:p-4">
                        <h3 className="mb-3 rounded-lg bg-violet-700 px-3 py-2 text-sm font-bold text-white">3. Account Information &amp; Security</h3>
                        <div className="space-y-3 text-xs text-slate-700">
                          <label className="block font-semibold">Username <span className="text-rose-600">*</span>
                            <input required minLength="3" maxLength="50" pattern="[A-Za-z0-9._-]+" autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Enter username" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                          </label>
                          <label className="block font-semibold">Temporary password <span className="text-rose-600">*</span>
                            <span className="mt-1 flex rounded-lg border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                              <input required type={showTemporaryPassword ? 'text' : 'password'} minLength={passwordPolicy?.minimumPasswordLength || 8} maxLength="128" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm font-normal outline-none" />
                              <button type="button" aria-label={showTemporaryPassword ? 'Hide temporary password' : 'Show temporary password'} onClick={() => setShowTemporaryPassword((current) => !current)} className="px-3 text-slate-500 hover:text-blue-700">{showTemporaryPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                            </span>
                          </label>
                          <label className="block font-semibold">Confirm password <span className="text-rose-600">*</span>
                            <span className="mt-1 flex rounded-lg border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                              <input required type={showConfirmPassword ? 'text' : 'password'} minLength={passwordPolicy?.minimumPasswordLength || 8} maxLength="128" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm font-normal outline-none" />
                              <button type="button" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} onClick={() => setShowConfirmPassword((current) => !current)} className="px-3 text-slate-500 hover:text-blue-700">{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                            </span>
                            {form.confirmPassword && <span className={`mt-1 block text-[11px] font-normal ${form.password === form.confirmPassword ? 'text-emerald-700' : 'text-rose-700'}`}>{form.password === form.confirmPassword ? 'Passwords match.' : 'Passwords do not match.'}</span>}
                          </label>
                          <label className="block font-semibold">First login password change
                            <select required value={form.requirePasswordChange ? 'required' : 'not-required'} onChange={(event) => setForm({ ...form, requirePasswordChange: event.target.value === 'required' })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                              <option value="required">Required</option>
                              <option value="not-required">Not Required</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={form.sendWelcomeEmail} onChange={(event) => setForm({ ...form, sendWelcomeEmail: event.target.checked })} className="h-4 w-4 accent-blue-700" />Send login credentials by email (optional)</label>
                          <p className="rounded-lg bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900">
                            {form.sendWelcomeEmail
                              ? form.email ? `A welcome message will be sent to ${form.email}. If email delivery fails, the temporary password will be shown once after account creation.` : 'Enter an email address to send the login credentials.'
                              : 'Email is optional. The temporary password will be shown once after account creation; share it securely.'}
                          </p>
                          <p className="text-[11px] text-slate-500">{passwordHint} The password is stored as a bcrypt hash. {form.requirePasswordChange ? 'The user must change it after first sign-in.' : 'The user can keep this password after first sign-in.'}</p>
                        </div>
                      </section>

                      <section className="rounded-xl border border-cyan-200 bg-white p-3 shadow-sm sm:p-4">
                        <h3 className="mb-3 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-bold text-white">4. Review &amp; Confirm</h3>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                          <dt className="font-semibold text-slate-600">Name</dt><dd className="truncate text-slate-900">{form.name || '—'}</dd>
                          <dt className="font-semibold text-slate-600">Employee ID</dt><dd className="truncate text-slate-900">{form.employeeId || '—'}</dd>
                          <dt className="font-semibold text-slate-600">Username</dt><dd className="truncate text-slate-900">{form.username || '—'}</dd>
                          <dt className="font-semibold text-slate-600">Department</dt><dd className="truncate text-slate-900">{departments.find((item) => item._id === form.departmentId)?.name || '—'}</dd>
                          <dt className="font-semibold text-slate-600">Role</dt><dd className="truncate text-slate-900">{form.role === 'Admin' ? 'System Admin' : form.role || '—'}</dd>
                          <dt className="font-semibold text-slate-600">Email</dt><dd className="truncate text-slate-900">{form.email || '—'}</dd>
                          <dt className="font-semibold text-slate-600">Welcome email</dt><dd className="truncate text-slate-900">{form.sendWelcomeEmail ? 'Send' : 'Not requested'}</dd>
                          <dt className="font-semibold text-slate-600">First-login change</dt><dd className="truncate text-slate-900">{form.requirePasswordChange ? 'Required' : 'Not Required'}</dd>
                        </dl>
                      </section>
                    </div>
                  </>
                )}
                </div>
                {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white pt-3">
                  <button type="button" onClick={closeDialog} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><X size={15} />Cancel</button>
                  <button type="submit" disabled={saving} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${selectedUser ? 'bg-teal-700 hover:bg-teal-800' : 'bg-blue-700 hover:bg-blue-800'}`}><Save size={15} />{saving ? 'Saving...' : selectedUser ? 'Save Changes' : 'Save & Create User'}</button>
                </div>
              </form>
            )}

            {dialog === 'password' && (
              <form onSubmit={resetPassword} className="space-y-4">
                <p className="text-sm text-slate-600">Generate a secure temporary password for <strong>{selectedUser?.name}</strong>. Their current password cannot be viewed, all existing sessions will be revoked, and they must change the password after signing in.</p>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input name="sendWelcomeEmail" type="checkbox" defaultChecked={Boolean(selectedUser?.email)} className="mt-0.5 h-4 w-4 accent-teal-700" />
                  <span>Send temporary login credentials by email {selectedUser?.email ? `to ${selectedUser.email}` : '(no email is registered)'}</span>
                </label>
                <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">{passwordHint} If email delivery is not selected or fails, the password is shown once for secure sharing.</p>
                {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={closeDialog} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Resetting...' : 'Generate & Reset Password'}</button>
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
                  <p><span className="text-slate-500">Gender:</span> <strong>{selectedUser.gender || '—'}</strong></p>
                  <p><span className="text-slate-500">Date of birth:</span> <strong>{selectedUser.dateOfBirth || '—'}</strong></p>
                  <p><span className="text-slate-500">Role:</span> <strong>{selectedUser.role === 'Admin' ? 'System Admin' : selectedUser.role}</strong></p>
                  <p><span className="text-slate-500">Department:</span> <strong>{selectedUser.department || '—'}</strong></p>
                  <p><span className="text-slate-500">Phone:</span> <strong>{selectedUser.phoneNumber || '—'}</strong></p>
                  <p><span className="text-slate-500">Status:</span> <strong>{selectedUser.status}</strong></p>
                  <p><span className="text-slate-500">Date joined:</span> <strong>{formatDate(selectedUser.dateJoined || selectedUser.createdAt)}</strong></p>
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

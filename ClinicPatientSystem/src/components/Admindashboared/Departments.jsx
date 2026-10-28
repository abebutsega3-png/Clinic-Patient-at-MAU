import { useEffect, useState } from 'react';
import { Building2, MapPin, Plus, Save, ToggleRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const initialForm = {
  name: '',
  code: '',
  description: '',
  departmentType: '',
  status: 'Active',
  location: '',
  contactNumber: '',
  departmentHeadUserId: '',
};

export default function Departments() {
  const { token } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    const loadDepartments = async () => {
      try {
        const params = new URLSearchParams({ search, status: statusFilter });
        const response = await fetch(`/api/departments?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Unable to load departments (${response.status}).`);
        }
        if (isCurrent) setDepartments(Array.isArray(result.data) ? result.data : []);
      } catch (loadError) {
        if (isCurrent) setError(loadError.message || 'Unable to load departments.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadDepartments();
    return () => {
      isCurrent = false;
    };
  }, [search, statusFilter, token, refreshKey]);

  useEffect(() => {
    if (!showCreateForm) return undefined;

    let isCurrent = true;
    const loadStaff = async () => {
      setStaffLoading(true);
      setStaffError('');
      try {
        const response = await fetch('/api/departments/staff', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Unable to load registered staff (${response.status}).`);
        }
        if (isCurrent) setStaff(Array.isArray(result.data) ? result.data : []);
      } catch (loadError) {
        if (isCurrent) setStaffError(loadError.message || 'Unable to load registered staff.');
      } finally {
        if (isCurrent) setStaffLoading(false);
      }
    };

    void loadStaff();
    return () => {
      isCurrent = false;
    };
  }, [showCreateForm, token]);

  const openCreateForm = () => {
    setForm(initialForm);
    setFormError('');
    setShowCreateForm(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          description: form.description.trim(),
          departmentType: form.departmentType,
          status: form.status,
          location: form.location.trim(),
          contactNumber: form.contactNumber.trim(),
          departmentHeadUserId: form.departmentHeadUserId,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to create department (${response.status}).`);
      }
      setShowCreateForm(false);
      setNotice('Department / Unit created successfully.');
      setLoading(true);
      setRefreshKey((current) => current + 1);
    } catch (createError) {
      setFormError(createError.message || 'Unable to create department.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this department? Existing records will keep their historical department reference.')) return;

    setError('');
    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to deactivate department (${response.status}).`);
      }
      setNotice(result.message || 'Department deactivated successfully.');
      setLoading(true);
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to deactivate department.');
    }
  };

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Departments / Units</h1>
          <p className="text-sm text-gray-500">Manage clinic departments and units</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={17} aria-hidden="true" />
          Add Department / Unit
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-4">
          <input
            type="search"
            placeholder="Search departments..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLoading(true);
              setError('');
            }}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none sm:w-80"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setLoading(true);
              setError('');
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="p-4">#</th>
                <th className="p-4">Department / Unit</th>
                <th className="p-4">Code</th>
                <th className="p-4">Description</th>
                <th className="p-4">Department Head</th>
                <th className="p-4">Location</th>
                <th className="p-4">Contact Number</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-gray-500">Loading departments...</td>
                </tr>
              ) : !error && departments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-gray-500">No departments or units found.</td>
                </tr>
              ) : departments.map((department, index) => (
                <tr key={department._id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-500">{index + 1}</td>
                  <td className="p-4 font-medium">
                    <span className="flex items-center gap-3">
                      <span className={`rounded-lg p-2 text-white ${department.colorBg || 'bg-blue-500'}`}>
                        <i className={`fa-solid ${department.icon || 'fa-building'}`} aria-hidden="true" />
                      </span>
                      <span>
                        {department.name}
                        {department.departmentType && (
                          <span className="block text-xs font-normal text-gray-400">{department.departmentType}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                      {department.code}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-500">{department.description || '—'}</td>
                  <td className="p-4">
                    {department.departmentHead?.name || '—'}
                    {department.departmentHead?.role && (
                      <span className="block text-xs text-gray-400">({department.departmentHead.role})</span>
                    )}
                  </td>
                  <td className="p-4 text-xs text-gray-500">{department.location || '—'}</td>
                  <td className="p-4 text-xs text-gray-500">{department.contactNumber || '—'}</td>
                  <td className="p-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${department.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {department.status}
                    </span>
                  </td>
                  <td className="space-x-2 p-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(department._id)}
                      aria-label={`Deactivate ${department.name}`}
                      title="Deactivate department"
                      className="rounded p-1.5 text-amber-700 hover:bg-amber-50"
                    >
                      <ToggleRight size={18} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateForm && (
        <div
          className="fixed bottom-0 left-0 right-0 top-[72px] z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-5 lg:left-64"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setShowCreateForm(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="department-dialog-title"
            className="max-h-[calc(100vh-6rem)] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <form onSubmit={handleCreate}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
                <h2 id="department-dialog-title" className="text-xl font-bold text-slate-800">
                  Add New Department / Unit
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={saving}
                  aria-label="Close dialog"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7 xl:grid-cols-3">
                <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-5 flex items-center gap-2 border-b border-slate-300 pb-3 text-base font-semibold text-slate-800">
                    <Building2 size={18} className="text-blue-600" aria-hidden="true" />
                    Basic Department Info
                  </h3>
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Department Name <span className="text-red-500">*</span>
                      <input
                        required
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        placeholder="e.g., Examination Room"
                        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Department Code <span className="text-red-500">*</span>
                      <input
                        required
                        value={form.code}
                        onChange={(event) => setForm({ ...form, code: event.target.value })}
                        placeholder="e.g., EXAM-002"
                        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Department Type <span className="text-red-500">*</span>
                      <select
                        required
                        value={form.departmentType}
                        onChange={(event) => setForm({ ...form, departmentType: event.target.value })}
                        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Select department type</option>
                        <option>Registration</option>
                        <option>Clinical Care</option>
                        <option>Laboratory Services</option>
                        <option>Pharmacy Services</option>
                        <option>Pharmacy Inventory</option>
                        <option>Treatment / Nursing Services</option>
                        <option>Emergency Care</option>
                        <option>Administration / Management</option>
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Description
                      <textarea
                        rows="3"
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                        placeholder="e.g., Clinical examination and diagnosis"
                        className="mt-1.5 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Department Head
                      <select
                        value={form.departmentHeadUserId}
                        onChange={(event) => setForm({ ...form, departmentHeadUserId: event.target.value })}
                        disabled={staffLoading || Boolean(staffError)}
                        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      >
                        <option value="">
                          {staffLoading ? 'Loading staff...' : 'Select registered staff (optional)'}
                        </option>
                        {staff.map((member) => (
                          <option key={member._id} value={member._id}>
                            {member.name}{member.position ? ` — ${member.position}` : ` — ${member.role}`}
                          </option>
                        ))}
                      </select>
                      {staffError && <span role="alert" className="mt-1 block text-xs text-red-600">{staffError}</span>}
                      {!staffLoading && !staffError && staff.length === 0 && (
                        <span className="mt-1 block text-xs text-slate-500">No active registered staff found.</span>
                      )}
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-5 flex items-center gap-2 border-b border-slate-300 pb-3 text-base font-semibold text-slate-800">
                    <MapPin size={18} className="text-blue-600" aria-hidden="true" />
                    Location
                  </h3>
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Location / Room Number
                      <input
                        value={form.location}
                        onChange={(event) => setForm({ ...form, location: event.target.value })}
                        placeholder="Enter the actual room location"
                        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Contact Number
                      <input
                        type="tel"
                        value={form.contactNumber}
                        onChange={(event) => setForm({ ...form, contactNumber: event.target.value })}
                        placeholder="Department phone number (optional)"
                        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-5 flex items-center gap-2 border-b border-slate-300 pb-3 text-base font-semibold text-slate-800">
                    <ToggleRight size={19} className="text-blue-600" aria-hidden="true" />
                    Department Status
                  </h3>
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Status <span className="text-red-500">*</span>
                      <select
                        required
                        value={form.status}
                        onChange={(event) => setForm({ ...form, status: event.target.value })}
                        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        <option>Active</option>
                        <option>Inactive</option>
                      </select>
                    </label>
                  </div>
                </section>
              </div>

              {formError && (
                <p role="alert" className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-7">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-7">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} aria-hidden="true" />
                  {saving ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

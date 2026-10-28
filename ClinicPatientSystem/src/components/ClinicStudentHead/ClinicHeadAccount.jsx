import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700';

export function ClinicHeadProfile() {
  const { token, user, updateUser } = useAuth();
  const [profile, setProfile] = useState(user || {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authConfig = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    let mounted = true;
    axios.get('/api/auth/me', authConfig)
      .then(({ data }) => {
        if (!mounted) return;
        setProfile(data.data);
        updateUser(data.data);
      })
      .catch((loadError) => {
        console.error('Failed to load profile:', loadError);
        if (mounted) setError(loadError.response?.data?.message || 'Unable to load your profile.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [authConfig, updateUser]);

  const entries = [
    ['Name', profile.name],
    ['Username', profile.username],
    ['Email', profile.email],
    ['Phone', profile.phoneNumber],
    ['Alternative phone', profile.alternativePhone],
    ['Role', profile.activeRole || profile.role],
    ['Department', profile.department],
    ['Position', profile.position],
    ['Employee ID', profile.employeeId],
    ['Account status', profile.status],
    ['Date joined', profile.dateJoined ? new Date(profile.dateJoined).toLocaleDateString() : 'Not recorded']
  ];

  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex items-center gap-3"><UserRound className="text-teal-600" /><div><h1 className="text-xl font-bold text-slate-800">My Profile</h1><p className="text-sm text-slate-500">Your account information.</p></div></header>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Loading profile…</p> : <div className="grid gap-4 sm:grid-cols-2">{entries.map(([label, value]) => <label key={label} className="space-y-1 text-xs font-semibold text-slate-500">{label}<input readOnly value={value || 'Not recorded'} className={fieldClass} /></label>)}</div>}
    </section>
  );
}

export function ClinicHeadChangePassword() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const formData = new FormData(event.currentTarget);
    const submittedCurrentPassword = String(formData.get('currentPassword') || '');
    const submittedNewPassword = String(formData.get('newPassword') || '');
    const submittedConfirmPassword = String(formData.get('confirmPassword') || '');
    if (submittedNewPassword.length < 8) {
      setError('New password must contain at least 8 characters.');
      return;
    }
    if (submittedNewPassword !== submittedConfirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (!submittedCurrentPassword) {
      setError('Enter your current password to confirm this change.');
      return;
    }
    setBusy(true);
    try {
      await axios.patch('/api/auth/change-password', {
        currentPassword: submittedCurrentPassword,
        newPassword: submittedNewPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      logout();
      navigate('/login', { replace: true, state: { message: 'Password changed. Sign in with your new password.' } });
    } catch (changeError) {
      console.error('Failed to change password:', changeError);
      setError(changeError.response?.data?.message || 'Unable to change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-3 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/10 sm:p-8">
        <Link to="/clinic-head" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-indigo-600">
          <ArrowLeft size={15} /> Back to Dashboard
        </Link>
        <header className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><ShieldCheck size={24} /></span>
          <h1 className="text-xl font-bold text-slate-800">Change Password</h1>
          <p className="mt-1 text-xs text-slate-500">Update your password securely.</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          {[
            { name: 'currentPassword', label: 'Current Password', value: currentPassword, setValue: setCurrentPassword, autocomplete: 'current-password', placeholder: 'Enter current password' },
            { name: 'newPassword', label: 'New Password', value: newPassword, setValue: setNewPassword, autocomplete: 'new-password', placeholder: 'Enter new password' },
            { name: 'confirmPassword', label: 'Confirm New Password', value: confirmPassword, setValue: setConfirmPassword, autocomplete: 'new-password', placeholder: 'Confirm new password' }
          ].map((field) => {
            const isVisible = Boolean(visiblePasswords[field.name]);
            const ToggleIcon = isVisible ? EyeOff : Eye;
            return (
              <label key={field.name} className="block space-y-1.5 text-xs font-semibold text-slate-600">
                {field.label}
                <span className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                  <LockKeyhole size={15} className="shrink-0 text-slate-400" />
                  <input
                    required
                    name={field.name}
                    minLength={field.name === 'currentPassword' ? undefined : 8}
                    autoComplete={field.autocomplete}
                    type={isVisible ? 'text' : 'password'}
                    value={field.value}
                    onChange={(event) => field.setValue(event.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-transparent px-3 py-3 text-sm font-normal text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button type="button" onClick={() => togglePasswordVisibility(field.name)} aria-label={`${isVisible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} className="shrink-0 p-1 text-slate-400 hover:text-slate-700">
                    <ToggleIcon size={17} />
                  </button>
                </span>
              </label>
            );
          })}
          <button type="submit" disabled={busy} className="mt-1 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Updating Password…' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  );
}

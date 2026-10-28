import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/context/AuthContext.jsx';

const ForcePasswordChange = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Use at least 8 characters, including a letter and a number.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Password update failed (${response.status}).`);
      }
      logout();
      navigate('/login', { replace: true, state: { message: 'Password changed. Sign in with your new password.' } });
    } catch (submitError) {
      setError(submitError.message || 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-slate-800">Change your temporary password</h1>
        <p className="mt-2 text-sm text-slate-600">For account security, set a new password before continuing.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Temporary password
            <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            New password
            <input required type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters, including a letter and a number.</span>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirm new password
            <input required type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button disabled={saving || !token} type="submit" className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            {saving ? 'Changing password...' : 'Change Password'}
          </button>
          {!token && <p className="text-sm text-rose-700">Your session has expired. Sign in again.</p>}
        </form>
      </section>
    </main>
  );
};

export default ForcePasswordChange;

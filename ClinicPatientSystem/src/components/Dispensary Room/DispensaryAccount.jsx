import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, Eye, EyeOff, Globe, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function DispensaryChangePassword() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const authConfig = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await axios.patch('/api/auth/change-password', {
        currentPassword,
        newPassword
      }, authConfig);
      logout();
      navigate('/login', { replace: true, state: { message: 'Password changed. Sign in with your new password.' } });
    } catch (changeError) {
      console.error('Failed to change dispensary password:', changeError);
      setError(changeError.response?.data?.message || 'Unable to change your password.');
    } finally {
      setBusy(false);
    }
  };

  const fields = [
    { name: 'currentPassword', label: 'Current Password', value: currentPassword, setValue: setCurrentPassword, autocomplete: 'current-password', placeholder: 'Enter current password' },
    { name: 'newPassword', label: 'New Password', value: newPassword, setValue: setNewPassword, autocomplete: 'new-password', placeholder: 'Enter new password' },
    { name: 'confirmPassword', label: 'Confirm New Password', value: confirmPassword, setValue: setConfirmPassword, autocomplete: 'new-password', placeholder: 'Confirm new password' }
  ];

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center px-3 py-6 sm:py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/10 sm:p-8">
        <Link to="/dispensary" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-blue-700">
          <ArrowLeft size={15} aria-hidden="true" /> Back to Dashboard
        </Link>
        <header className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <ShieldCheck size={30} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold text-slate-800">Change Password</h1>
          <p className="mt-2 text-sm text-slate-500">Update your password to keep your account secure.</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          {fields.map((field) => {
            const isVisible = Boolean(visiblePasswords[field.name]);
            const ToggleIcon = isVisible ? EyeOff : Eye;
            return (
              <label key={field.name} className="block space-y-1.5 text-xs font-semibold text-slate-600">
                {field.label}
                <span className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <LockKeyhole size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
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
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(field.name)}
                    aria-label={`${isVisible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`}
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-700"
                  >
                    <ToggleIcon size={17} aria-hidden="true" />
                  </button>
                </span>
              </label>
            );
          })}
          <button type="submit" disabled={busy} className="mt-1 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Updating Password…' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  );
}

export function DispensaryProfile() {
  const { token, user, updateUser } = useAuth();
  const [profile, setProfile] = useState(user || {});
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const authConfig = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  useEffect(() => {
    let active = true;
    axios.get('/api/auth/me', authConfig)
      .then(({ data }) => {
        if (!active) return;
        setProfile(data.data);
        setPhoneNumber(data.data.phoneNumber || '');
        setProfileImage(data.data.profileImage || '');
        updateUser(data.data);
      })
      .catch((loadError) => {
        console.error('Failed to load dispensary profile:', loadError);
        if (active) setError(loadError.response?.data?.message || 'Unable to load your profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [authConfig, updateUser]);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPhotoError('');
    setNotice('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a PNG, JPEG or WebP image.');
      return;
    }
    if (file.size > 500 * 1024) {
      setPhotoError('Profile photos must be smaller than 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setProfileImage(reader.result);
      else setPhotoError('Unable to read the selected profile photo.');
    };
    reader.onerror = () => setPhotoError('Unable to read the selected profile photo.');
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setNotice('');
    try {
      const { data } = await axios.patch('/api/auth/me/profile', {
        phoneNumber,
        profileImage
      }, authConfig);
      setProfile(data.data);
      setPhoneNumber(data.data.phoneNumber || '');
      setProfileImage(data.data.profileImage || '');
      updateUser(data.data);
      setNotice(data.message || 'Profile changes saved.');
    } catch (saveProfileError) {
      console.error('Failed to save dispensary profile:', saveProfileError);
      setSaveError(saveProfileError.response?.data?.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const readOnlyField = 'w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-600';
  const editableField = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="mx-auto max-w-3xl">
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <header className="border-b border-slate-100 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Account</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Profile</h1>
          <p className="mt-1 text-sm text-slate-500">Your authenticated dispensary account details.</p>
        </header>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {saveError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{saveError}</p>}
        {photoError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{photoError}</p>}
        {notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={17} />{notice}</p>}
        {loading ? <p className="py-8 text-sm text-slate-500">Loading profile…</p> : (
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 pb-1">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-blue-50 bg-slate-100 text-blue-600">
                {profileImage
                  ? <img src={profileImage} alt={`${profile.name || 'Account'} profile`} className="h-full w-full object-cover" />
                  : <UserRound size={34} aria-hidden="true" />}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100">
                <Camera size={16} aria-hidden="true" /> Change Profile Photo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} className="sr-only" aria-label="Change profile photo" />
              </label>
            </div>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
              Full Name
              <input readOnly value={profile.name || profile.username || 'Not recorded'} className={readOnlyField} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
              Email Address
              <input readOnly type="email" value={profile.email || 'Not recorded'} className={readOnlyField} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
              Role / Title
              <input readOnly value={profile.position || profile.activeRole || profile.role || 'Not assigned'} className={readOnlyField} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
              Department
              <input readOnly value={profile.department || 'Not assigned'} className={readOnlyField} />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
              Phone Number
              <input
                type="tel"
                autoComplete="tel"
                maxLength="30"
                value={phoneNumber}
                onChange={(event) => { setPhoneNumber(event.target.value); setNotice(''); }}
                placeholder="Enter phone number"
                className={editableField}
              />
            </label>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={16} aria-hidden="true" />
              {saving ? 'Saving…' : 'Save Profile Changes'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

export function DispensarySettings() {
  const [language, setLanguage] = useState(() => localStorage.getItem('dispensary-language') || 'en');

  const updateLanguage = (value) => {
    setLanguage(value);
    localStorage.setItem('dispensary-language', value);
    window.dispatchEvent(new CustomEvent('dispensary-language-change', { detail: value }));
  };

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-slate-50 px-5 py-5 sm:px-7">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Preferences</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Dashboard Settings</h1>
      </header>
      <div className="flex items-start gap-3 p-5 sm:px-7">
        <Globe size={20} className="mt-0.5 text-blue-700" aria-hidden="true" />
        <div className="flex-1">
          <label htmlFor="dispensary-language" className="block text-sm font-semibold text-slate-800">Language</label>
          <p className="mt-1 text-xs text-slate-500">Choose the language used in the dispensary navigation.</p>
          <select
            id="dispensary-language"
            value={language}
            onChange={(event) => updateLanguage(event.target.value)}
            className="mt-3 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="en">English</option>
            <option value="am">አማርኛ</option>
          </select>
        </div>
      </div>
    </section>
  );
}

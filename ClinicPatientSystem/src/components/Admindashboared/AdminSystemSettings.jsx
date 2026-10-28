import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock3,
  Database,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const defaultSettings = {
  general: {
    systemName: 'MAU Clinic Management System',
    organizationName: 'Mekdela Amba University',
    timezone: 'Africa/Addis_Ababa',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24-hour',
    language: 'English',
  },
  security: {
    minimumPasswordLength: 8,
    requireLetter: true,
    requireNumber: true,
    requireUppercase: false,
    requireSpecialCharacter: false,
    sessionTimeoutMinutes: 480,
    maximumLoginAttempts: 5,
    lockoutDurationMinutes: 15,
  },
};

const sections = [
  { id: 'general', label: 'General', icon: Settings, editable: true },
  { id: 'security', label: 'Security', icon: ShieldCheck, editable: true },
  { id: 'access', label: 'User & Access', icon: UsersRound },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'backup', label: 'Backup & Data', icon: Database },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'email', label: 'Email & Integrations', icon: Mail },
];

const cardClass = 'rounded-xl border border-slate-200 bg-white shadow-sm';
const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100';
const labelClass = 'block text-xs font-semibold text-slate-600';

function SettingField({ label, children, description }) {
  return (
    <label className={labelClass}>
      {label}
      {children}
      {description && <span className="mt-1 block text-[11px] font-normal leading-4 text-slate-500">{description}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-3 py-3">
      <span>
        <span className="block text-xs font-semibold text-slate-700">{label}</span>
        {description && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" />
    </label>
  );
}

function StatusCard({ title, status, description, icon: Icon }) {
  const active = status === 'available' || status === 'connected';
  return (
    <article className={`${cardClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-lg p-2 ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {status === 'connected' ? 'Connected' : status === 'available' ? 'Available' : 'Not implemented'}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

export default function AdminSystemSettings() {
  const { token, user } = useAuth();
  const hasAdminRole = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .filter(Boolean)
    .some((value) => value.toLowerCase() === 'admin');
  const [section, setSection] = useState('general');
  const [settings, setSettings] = useState(defaultSettings);
  const [savedSettings, setSavedSettings] = useState(defaultSettings);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResponse, healthResponse] = await Promise.all([
        fetch('/api/admin/dashboard/system-settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/dashboard/system-settings/health', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [settingsPayload, healthPayload] = await Promise.all([
        settingsResponse.json().catch(() => null),
        healthResponse.json().catch(() => null),
      ]);
      if (!settingsResponse.ok || !settingsPayload?.success || !settingsPayload.data) {
        throw new Error(settingsPayload?.message || `Unable to load settings (${settingsResponse.status}).`);
      }
      if (!healthResponse.ok || !healthPayload?.success || !healthPayload.data) {
        throw new Error(healthPayload?.message || `Unable to load system health (${healthResponse.status}).`);
      }
      const loaded = {
        general: { ...defaultSettings.general, ...settingsPayload.data.general },
        security: { ...defaultSettings.security, ...settingsPayload.data.security },
      };
      setSettings(loaded);
      setSavedSettings(loaded);
      setHealth(healthPayload.data);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load System Admin settings.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (hasAdminRole && token) {
      void Promise.resolve().then(loadSettings);
    }
  }, [hasAdminRole, token, loadSettings, refreshKey]);

  const updateValue = (group, field, value) => {
    setSettings((current) => ({ ...current, [group]: { ...current[group], [field]: value } }));
  };

  const cancelChanges = () => {
    setSettings((current) => ({ ...current, [section]: { ...savedSettings[section] } }));
    setError('');
    setNotice('');
  };

  const resetSection = () => {
    if (!window.confirm(`Reset the ${section} form to the application defaults? This does not save until you select Save Changes.`)) return;
    setSettings((current) => ({ ...current, [section]: { ...defaultSettings[section] } }));
    setError('');
    setNotice('Form reset to defaults. Save Changes to persist these values.');
  };

  const saveSection = async () => {
    if (section === 'security' && !window.confirm('Save and enforce these password, session, and login-lockout policies? Existing sessions keep their original expiry; new sign-ins will use the updated timeout.')) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/dashboard/system-settings/${section}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [section]: settings[section] }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message || `Unable to save settings (${response.status}).`);
      }
      const loaded = {
        general: { ...defaultSettings.general, ...payload.data.general },
        security: { ...defaultSettings.security, ...payload.data.security },
      };
      setSettings(loaded);
      setSavedSettings(loaded);
      setNotice(payload.message || 'Settings saved successfully.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!hasAdminRole || !token) return <Navigate to="/login" replace />;
  const activeSection = sections.find((item) => item.id === section);
  const ActiveIcon = activeSection.icon;
  const hasChanges = activeSection.editable
    && JSON.stringify(settings[section]) !== JSON.stringify(savedSettings[section]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
              <Link to="/admin" className="font-medium hover:text-teal-700">System Admin</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span className="text-teal-700">System Settings</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Settings</h1>
            <p className="mt-1 text-sm text-slate-500">Configure supported application defaults and security policies.</p>
          </div>
          <button type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:self-auto">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh settings
          </button>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <nav aria-label="System settings sections" className={`${cardClass} h-fit p-2`}>
            {sections.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => { setSection(id); setError(''); setNotice(''); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-semibold transition ${section === id ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <section className={`${cardClass} min-w-0`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-teal-50 p-2 text-teal-700"><ActiveIcon size={18} aria-hidden="true" /></span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{activeSection.label} Settings</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {activeSection.editable ? 'Changes are saved to the system settings database.' : 'Capabilities and controls currently available in this installation.'}
                  </p>
                </div>
              </div>
              {activeSection.editable && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{section === 'security' ? 'Persisted & enforced' : 'Persisted'}</span>
              )}
            </div>

            {loading ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />Loading saved settings…</span>
              </div>
            ) : (
              <>
                <div className="space-y-6 p-4 sm:p-6">
                  {section === 'general' && (
                    <>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Organization &amp; display</h3>
                        <p className="mt-1 text-xs text-slate-500">These preferences are saved in the database. Existing screens do not yet consume them globally; branding and organization details are not applied across the application.</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <SettingField label="System name">
                          <input className={inputClass} maxLength="120" value={settings.general.systemName} onChange={(event) => updateValue('general', 'systemName', event.target.value)} />
                        </SettingField>
                        <SettingField label="Organization name">
                          <input className={inputClass} maxLength="120" value={settings.general.organizationName} onChange={(event) => updateValue('general', 'organizationName', event.target.value)} />
                        </SettingField>
                        <SettingField label="Timezone" description="Used for system date/time presentation metadata; individual pages may still use browser-local formatting.">
                          <select className={inputClass} value={settings.general.timezone} onChange={(event) => updateValue('general', 'timezone', event.target.value)}>
                            {['Africa/Addis_Ababa', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai'].map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll('_', ' ')}</option>)}
                          </select>
                        </SettingField>
                        <SettingField label="Date format">
                          <select className={inputClass} value={settings.general.dateFormat} onChange={(event) => updateValue('general', 'dateFormat', event.target.value)}>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </select>
                        </SettingField>
                        <SettingField label="Time format">
                          <select className={inputClass} value={settings.general.timeFormat} onChange={(event) => updateValue('general', 'timeFormat', event.target.value)}>
                            <option value="24-hour">24-hour</option>
                            <option value="12-hour">12-hour</option>
                          </select>
                        </SettingField>
                        <SettingField label="Language">
                          <select className={inputClass} value={settings.general.language} onChange={(event) => updateValue('general', 'language', event.target.value)}>
                            <option value="English">English</option>
                            <option value="Amharic">Amharic</option>
                          </select>
                        </SettingField>
                      </div>
                    </>
                  )}

                  {section === 'security' && (
                    <>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Password policy</h3>
                        <p className="mt-1 text-xs text-slate-500">Applied to sign-in session expiry, account lockouts, new accounts, password resets, and self-service password changes.</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <SettingField label="Minimum password length">
                          <input type="number" min="8" max="32" step="1" className={inputClass} value={settings.security.minimumPasswordLength} onChange={(event) => updateValue('security', 'minimumPasswordLength', Number(event.target.value))} />
                        </SettingField>
                        <SettingField label="Maximum failed login attempts">
                          <input type="number" min="3" max="10" step="1" className={inputClass} value={settings.security.maximumLoginAttempts} onChange={(event) => updateValue('security', 'maximumLoginAttempts', Number(event.target.value))} />
                        </SettingField>
                        <SettingField label="Account lockout duration (minutes)">
                          <input type="number" min="5" max="120" step="1" className={inputClass} value={settings.security.lockoutDurationMinutes} onChange={(event) => updateValue('security', 'lockoutDurationMinutes', Number(event.target.value))} />
                        </SettingField>
                        <SettingField label="Session timeout (minutes)" description="Applies to newly issued sessions. Existing JWT sessions retain the expiry with which they were issued.">
                          <input type="number" min="15" max="480" step="1" className={inputClass} value={settings.security.sessionTimeoutMinutes} onChange={(event) => updateValue('security', 'sessionTimeoutMinutes', Number(event.target.value))} />
                        </SettingField>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Toggle label="Require a letter" checked={settings.security.requireLetter} onChange={(value) => updateValue('security', 'requireLetter', value)} />
                        <Toggle label="Require a number" checked={settings.security.requireNumber} onChange={(value) => updateValue('security', 'requireNumber', value)} />
                        <Toggle label="Require an uppercase letter" checked={settings.security.requireUppercase} onChange={(value) => updateValue('security', 'requireUppercase', value)} />
                        <Toggle label="Require a special character" checked={settings.security.requireSpecialCharacter} onChange={(value) => updateValue('security', 'requireSpecialCharacter', value)} />
                      </div>
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        Existing passwords are not reset when a stricter policy is saved. The policy is enforced when passwords are next set or changed.
                      </div>
                    </>
                  )}

                  {section === 'access' && (
                    <>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
                        Role permissions are managed in the existing Role &amp; Permissions module. Account creation, activation, deactivation, and password resets are handled in User Management. No duplicate access-control settings are created here.
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Link to="/admin/roles-permissions" className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50">
                          <span className="flex items-center gap-3"><ShieldCheck size={18} className="text-teal-700" />Roles &amp; Permissions</span><ChevronRight size={16} />
                        </Link>
                        <Link to="/admin/users" className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50">
                          <span className="flex items-center gap-3"><UsersRound size={18} className="text-teal-700" />User Management</span><ChevronRight size={16} />
                        </Link>
                      </div>
                    </>
                  )}

                  {section === 'notifications' && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <StatusCard title="In-app notifications" status="available" icon={Bell} description="Clinic workflow notifications are stored in the database. System Admin can manage supported announcement categories and delivery preferences in Notification Management." />
                        <StatusCard title="Email notifications" status="unavailable" icon={Mail} description="No email transport or notification delivery service is configured in the backend. Email alert switches are not exposed as if they were functional." />
                      </div>
                      <Link to="/admin/notifications" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"><Bell size={15} />Open Notification Management<ChevronRight size={14} /></Link>
                      <p className="text-xs text-slate-500">Per-user notification preferences exist on user records, but this application does not currently use them to control delivery.</p>
                    </>
                  )}

                  {section === 'backup' && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <StatusCard title="Scheduled backups" status="unavailable" icon={Database} description="No backup scheduler or backup storage integration is present. No schedule or retention value can be saved or represented as active." />
                        <StatusCard title="Restore controls" status="unavailable" icon={RotateCcw} description="Database restore is not implemented. Restore actions are intentionally unavailable to prevent unsafe or misleading operations." />
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">Production backup and restore support requires an approved database backup provider, encrypted off-site storage, retention policy, restore validation, and operational access controls.</div>
                    </>
                  )}

                  {section === 'maintenance' && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <StatusCard title="Application API" status={health?.api?.status || 'unavailable'} icon={Wrench} description={`Version ${health?.application?.version || '—'} · Checked ${health?.api?.checkedAt ? new Date(health.api.checkedAt).toLocaleString() : '—'}`} />
                        <StatusCard title="MongoDB connection" status={health?.database?.status || 'unavailable'} icon={Database} description={`Connection status only; database credentials and infrastructure details are not exposed. Last checked ${health?.database?.checkedAt ? new Date(health.database.checkedAt).toLocaleString() : '—'}`} />
                        <StatusCard title="Maintenance mode" status="unavailable" icon={Wrench} description="No safe maintenance-mode gate exists in the API or frontend. The application cannot be placed into maintenance from this page." />
                        <StatusCard title="Diagnostics" status="unavailable" icon={Clock3} description="Detailed diagnostics and operational telemetry are not implemented. Only basic API and database connection status are available." />
                      </div>
                    </>
                  )}

                  {section === 'email' && (
                    <>
                      <StatusCard title="Email service" status="unavailable" icon={Mail} description="No mail transport dependency or server-side email delivery integration is installed. Sender configuration and test-email controls are not available." />
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">Email credentials and SMTP configuration are not loaded or returned by System Settings. Add a secured backend mail provider before enabling email settings or sending tests.</div>
                    </>
                  )}
                </div>

                {activeSection.editable && (
                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:px-6">
                    <p className="text-[11px] text-slate-500">{hasChanges ? 'You have unsaved changes.' : 'All changes are saved.'}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={saving} onClick={resetSection} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RotateCcw size={14} />Reset form</button>
                      <button type="button" disabled={saving || !hasChanges} onClick={cancelChanges} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                      <button type="button" disabled={saving || loading || !hasChanges} onClick={saveSection} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                        {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={14} />}
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </footer>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

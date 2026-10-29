import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Bell, Clock3, DollarSign, LoaderCircle, PackageCheck, Plus, Save, ShieldCheck, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const initialSettings = {
  clinicProfile: { name: '', address: '', phone: '', email: '', logoDataUrl: '' },
  workingHours: {
    days: weekdays.map((day) => ({ day, open: '08:00', close: '17:00', closed: false })),
    allDayService: false,
    allDayDepartments: ['Emergency', 'Triage']
  },
  officialMarks: { signatureDataUrl: '', stampDataUrl: '' },
  rosterRules: {
    shiftDurations: { morning: 6, afternoon: 6, night: 12 },
    shiftTimes: {
      morning: { start: '06:00', end: '14:00' },
      afternoon: { start: '14:00', end: '22:00' },
      night: { start: '22:00', end: '06:00' }
    },
    gracePeriodMinutes: 15,
    lateAlertTriggerMinutes: 30,
    minimumStaff: [],
    autoLockApprovedLeave: true
  },
  inventoryRules: { defaultThreshold: 20, categoryThresholds: [], expiryWarningDays: 90, alertEmail: '' }
};

const makePayload = (data) => ({
  clinicProfile: { ...initialSettings.clinicProfile, ...(data.clinicProfile || {}) },
  workingHours: {
    ...initialSettings.workingHours,
    ...(data.workingHours || {}),
    days: weekdays.map((day) => ({
      ...initialSettings.workingHours.days.find((entry) => entry.day === day),
      ...(data.workingHours?.days || []).find((entry) => entry.day === day)
    }))
  },
  officialMarks: { ...initialSettings.officialMarks, ...(data.officialMarks || {}) },
  rosterRules: {
    ...initialSettings.rosterRules,
    ...(data.rosterRules || {}),
    shiftDurations: { ...initialSettings.rosterRules.shiftDurations, ...(data.rosterRules?.shiftDurations || {}) },
    shiftTimes: Object.fromEntries(['morning', 'afternoon', 'night'].map((shift) => [
      shift,
      { ...initialSettings.rosterRules.shiftTimes[shift], ...(data.rosterRules?.shiftTimes?.[shift] || {}) }
    ])),
    minimumStaff: data.rosterRules?.minimumStaff || []
  },
  inventoryRules: {
    ...initialSettings.inventoryRules,
    ...(data.inventoryRules || {}),
    categoryThresholds: data.inventoryRules?.categoryThresholds || []
  }
});

const Section = ({ icon: Icon, title, description, accent, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className={`flex items-center gap-3 bg-gradient-to-r ${accent} px-4 py-3 text-white`}>
      <Icon size={19} />
      <div><h2 className="font-bold">{title}</h2><p className="mt-0.5 text-xs text-white/85">{description}</p></div>
    </div>
    <div className="space-y-5 p-4 sm:p-5">{children}</div>
  </section>
);

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100';
const infoClass = 'rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900';

const ClinicHeadSettings = () => {
  const { token } = useAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedWorkingDay, setSelectedWorkingDay] = useState('Monday');

  const authConfig = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get('/api/clinic-head/settings', authConfig);
      setSettings(makePayload(data.data || {}));
    } catch (loadError) {
      console.error('Failed to load Clinic Head settings:', loadError);
      setError(loadError.response?.data?.message || 'Unable to load clinic settings.');
    } finally {
      setLoading(false);
    }
  }, [authConfig]);

  useEffect(() => {
    void Promise.resolve().then(loadSettings);
  }, [loadSettings]);

  const updateNested = (section, key, value) => {
    setSettings((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  };

  const updateDay = (day, key, value) => {
    setSettings((current) => ({
      ...current,
      workingHours: {
        ...current.workingHours,
        days: current.workingHours.days.map((entry) => entry.day === day ? { ...entry, [key]: value } : entry)
      }
    }));
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await axios.put('/api/clinic-head/settings', settings, authConfig);
      setSettings(makePayload(data.data || settings));
      setNotice(data.message || 'Clinic settings saved.');
    } catch (saveError) {
      console.error('Failed to save Clinic Head settings:', saveError);
      setError(saveError.response?.data?.message || 'Unable to save clinic settings.');
    } finally {
      setSaving(false);
    }
  };

  const addMinimumStaff = () => updateNested('rosterRules', 'minimumStaff', [
    ...settings.rosterRules.minimumStaff,
    { department: '', shift: 'morning', count: 1 }
  ]);
  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle className="animate-spin" /> Loading clinic settings…</div>;
  const selectedDayHours = settings.workingHours.days.find(({ day }) => day === selectedWorkingDay);

  return (
    <form onSubmit={saveSettings} className="mx-auto max-w-6xl space-y-4 rounded-2xl bg-slate-100/80 p-3 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-blue-950"><ShieldCheck className="text-blue-700" /> Clinic Head Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Manage operational policies, staffing rules and inventory alerts.</p>
        </div>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </header>

      {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}<button type="button" onClick={() => void loadSettings()} className="font-semibold underline">Reload</button></div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
      <p className={infoClass}>Clinic name, contact details and logo are managed by the System Admin. Clinic Head settings are limited to day-to-day clinical operations.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={PackageCheck} title="1. Inventory & Alert Thresholds" description="Set the stock and expiry warning rules used in Pharmacy & Inventory." accent="from-blue-800 to-blue-600">
          <p className="text-sm font-medium text-slate-700">Set limits for medicine stock alerts and expiry notifications.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-600">Low stock limit (items)
              <input aria-label="Low stock limit" type="number" min="0" max="1000000" className={inputClass} value={settings.inventoryRules.defaultThreshold} onChange={(event) => updateNested('inventoryRules', 'defaultThreshold', Number(event.target.value))} />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-600">Expiry alert period (months)
              <select aria-label="Expiry alert period in months" className={inputClass} value={Math.max(1, Math.round(settings.inventoryRules.expiryWarningDays / 30))} onChange={(event) => updateNested('inventoryRules', 'expiryWarningDays', Number(event.target.value) * 30)}>
                {[1, 2, 3, 4, 6, 9, 12, 18, 24, 36].map((months) => <option key={months} value={months}>{months}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Inventory alert email
            <input aria-label="Inventory alert email" type="email" autoComplete="email" maxLength="160" className={inputClass} value={settings.inventoryRules.alertEmail} onChange={(event) => updateNested('inventoryRules', 'alertEmail', event.target.value)} placeholder="pharmacy@example.org" />
          </label>
          <div className={infoClass}>Low-stock and near-expiry alerts appear in the Clinic Head notification list. Email summaries are sent to this address when SMTP_HOST, SMTP_USER and SMTP_PASS are configured on the server. SMTP_PORT defaults to 587 and SMTP_FROM defaults to SMTP_USER; inventory alerts are evaluated every 15 minutes.</div>
        </Section>

        <Section icon={Clock3} title="2. Shift & Attendance Rules" description="Configure clinic working hours and attendance rules." accent="from-emerald-800 to-emerald-600">
          <div className="space-y-3">
            <label className="grid items-center gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-[140px_1fr]">Clinic working hours
              <select aria-label="Select working-hours day" className={inputClass} value={selectedWorkingDay} onChange={(event) => setSelectedWorkingDay(event.target.value)}>
                {weekdays.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">Opens
                <input aria-label={`${selectedWorkingDay} opening time`} type="time" disabled={selectedDayHours.closed || settings.workingHours.allDayService} className={inputClass} value={selectedDayHours.open} onChange={(event) => updateDay(selectedWorkingDay, 'open', event.target.value)} />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">Closes
                <input aria-label={`${selectedWorkingDay} closing time`} type="time" disabled={selectedDayHours.closed || settings.workingHours.allDayService} className={inputClass} value={selectedDayHours.close} onChange={(event) => updateDay(selectedWorkingDay, 'close', event.target.value)} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={selectedDayHours.closed} disabled={settings.workingHours.allDayService} onChange={(event) => updateDay(selectedWorkingDay, 'closed', event.target.checked)} className="h-4 w-4 accent-emerald-700" /> {selectedWorkingDay} is closed</label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['morning', 'afternoon', 'night'].map((shift) => <fieldset key={shift} className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold capitalize text-slate-700">{shift} shift</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[11px] text-slate-500">Start<input aria-label={`${shift} shift start`} type="time" className={inputClass} value={settings.rosterRules.shiftTimes[shift].start} onChange={(event) => updateNested('rosterRules', 'shiftTimes', { ...settings.rosterRules.shiftTimes, [shift]: { ...settings.rosterRules.shiftTimes[shift], start: event.target.value } })} /></label>
                <label className="space-y-1 text-[11px] text-slate-500">End<input aria-label={`${shift} shift end`} type="time" className={inputClass} value={settings.rosterRules.shiftTimes[shift].end} onChange={(event) => updateNested('rosterRules', 'shiftTimes', { ...settings.rosterRules.shiftTimes, [shift]: { ...settings.rosterRules.shiftTimes[shift], end: event.target.value } })} /></label>
              </div>
            </fieldset>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-600">Grace period
              <select aria-label="Grace period in minutes" className={inputClass} value={settings.rosterRules.gracePeriodMinutes} onChange={(event) => updateNested('rosterRules', 'gracePeriodMinutes', Number(event.target.value))}>
                {[0, 5, 10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} Minutes</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-600">Late alert trigger
              <select aria-label="Late alert trigger in minutes" className={inputClass} value={settings.rosterRules.lateAlertTriggerMinutes} onChange={(event) => updateNested('rosterRules', 'lateAlertTriggerMinutes', Number(event.target.value))}>
                {[15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} Minutes</option>)}
              </select>
            </label>
          </div>
          <div className={infoClass}>A Present record with a clock-in after the shift start plus grace period is saved as Late. Late alert trigger is a policy setting; automatic alert delivery is not enabled.</div>
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Additional roster policies</summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {['morning', 'afternoon', 'night'].map((shift) => <label key={shift} className="space-y-1.5 text-xs font-semibold capitalize text-slate-600">{shift} shift duration (hours)
                  <input aria-label={`${shift} shift duration in hours`} type="number" min="1" max="24" className={inputClass} value={settings.rosterRules.shiftDurations[shift]} onChange={(event) => updateNested('rosterRules', 'shiftDurations', { ...settings.rosterRules.shiftDurations, [shift]: Number(event.target.value) })} />
                </label>)}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-700">Minimum staff per department and shift</h3><button type="button" onClick={addMinimumStaff} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700"><Plus size={15} /> Add rule</button></div>
                {settings.rosterRules.minimumStaff.map((rule, index) => <div key={`${index}-${rule.shift}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
                  <input aria-label="Department" className={inputClass} placeholder="Department" value={rule.department} onChange={(event) => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.map((item, row) => row === index ? { ...item, department: event.target.value } : item))} />
                  <select aria-label="Shift" className={inputClass} value={rule.shift} onChange={(event) => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.map((item, row) => row === index ? { ...item, shift: event.target.value } : item))}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option></select>
                  <input aria-label="Minimum staff" type="number" min="0" max="500" className={inputClass} value={rule.count} onChange={(event) => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.map((item, row) => row === index ? { ...item, count: Number(event.target.value) } : item))} />
                  <button type="button" aria-label="Remove staffing rule" onClick={() => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.filter((_, row) => row !== index))} className="flex items-center justify-center rounded-lg px-3 text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button>
                </div>)}
                {!settings.rosterRules.minimumStaff.length && <p className="text-xs text-slate-500">No minimum staffing rules added.</p>}
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={settings.rosterRules.autoLockApprovedLeave} onChange={(event) => updateNested('rosterRules', 'autoLockApprovedLeave', event.target.checked)} className="h-4 w-4 accent-violet-700" /> Lock roster dates when staff leave is approved</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={settings.workingHours.allDayService} onChange={(event) => updateNested('workingHours', 'allDayService', event.target.checked)} className="h-4 w-4 accent-violet-700" /> Clinic operates 24 hours a day</label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-600">24/7 departments (comma-separated)
                <input className={inputClass} value={settings.workingHours.allDayDepartments.join(', ')} onChange={(event) => updateNested('workingHours', 'allDayDepartments', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="Emergency, Triage" />
              </label>
            </div>
          </details>
        </Section>

        <Section icon={DollarSign} title="3. Financial & Approval Limits" description="Set purchase approval limits and financial control rules." accent="from-violet-800 to-violet-600">
          <div className="space-y-4">
            {['Purchase approval threshold', 'Storekeeper purchase limit'].map((label) => <label key={label} className="grid items-center gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-[1fr_150px_auto]">
              <span>{label}</span>
              <input aria-label={label} className={`${inputClass} bg-slate-100`} value="Not configured" disabled readOnly />
              <span>ETB</span>
            </label>)}
          </div>
          <div className={infoClass}>All purchase requisitions currently require Clinic Head review. Separate storekeeper limits and amount-based approval routing are not configured, so these controls are unavailable.</div>
        </Section>

        <Section icon={Bell} title="4. Automated Reporting & Notifications" description="Configure automatic reports and system notifications." accent="from-teal-800 to-cyan-700">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <label className="text-sm font-semibold text-slate-700">Auto-send monthly report
              <span className="mt-1 block text-xs font-normal text-slate-500">Scheduled delivery is not configured.</span>
            </label>
            <input aria-label="Auto-send monthly report" type="checkbox" disabled className="h-5 w-5 accent-blue-700" />
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-600">Report recipients
            <input aria-label="Report recipients" type="email" placeholder="Not configured" disabled className={`${inputClass} bg-slate-100`} />
          </label>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-600">Notification channels</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {['Email notifications', 'In-app notifications'].map((channel) => <label key={channel} className="flex items-center gap-2 text-sm text-slate-500">
                <input aria-label={channel} type="checkbox" disabled className="h-4 w-4 accent-blue-700" /> {channel}
              </label>)}
            </div>
          </fieldset>
          <div className={infoClass}>In-app alerts cover purchase approvals, stock/expiry risks, late or missed scheduled staff, emergency patient arrivals and queue bottlenecks. Queue alerts default to 10 waiting patients or 30 minutes and can be adjusted with CLINIC_QUEUE_ALERT_THRESHOLD and CLINIC_QUEUE_WAIT_ALERT_MINUTES on the server. Inventory emails use the address above only when SMTP is configured. Monthly report emails and clinician-initiated emergency escalation requests are not implemented; reports remain available for manual export.</div>
        </Section>
      </div>

      <footer className="flex justify-end pb-1">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save Operational Settings
        </button>
      </footer>
    </form>
  );
};

export default ClinicHeadSettings;

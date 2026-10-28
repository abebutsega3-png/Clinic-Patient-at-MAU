import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Building2, Clock3, ImagePlus, LoaderCircle, Plus, Save, ShieldCheck, Trash2
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
    minimumStaff: [],
    autoLockApprovedLeave: true
  },
  inventoryRules: { categoryThresholds: [], expiryWarningDays: 90 }
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
    minimumStaff: data.rosterRules?.minimumStaff || []
  },
  inventoryRules: { ...initialSettings.inventoryRules, ...(data.inventoryRules || {}), categoryThresholds: data.inventoryRules?.categoryThresholds || [] }
});

const Section = ({ icon: Icon, title, description, children }) => (
  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><Icon size={20} /></span>
      <div><h2 className="font-bold text-slate-800">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    </div>
    {children}
  </section>
);

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100';

const ClinicHeadSettings = () => {
  const { token } = useAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  const readImage = async (file) => {
    if (!file) return '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 512000) {
      throw new Error('Choose a PNG, JPEG or WebP image smaller than 500 KB.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('The selected image could not be read.'));
      reader.readAsDataURL(file);
    });
  };

  const handleImage = async (event, section, key) => {
    setError('');
    setNotice('');
    try {
      const dataUrl = await readImage(event.target.files?.[0]);
      updateNested(section, key, dataUrl);
    } catch (imageError) {
      setError(imageError.message);
    } finally {
      event.target.value = '';
    }
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
  const addThreshold = () => updateNested('inventoryRules', 'categoryThresholds', [
    ...settings.inventoryRules.categoryThresholds,
    { category: '', threshold: 0 }
  ]);

  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle className="animate-spin" /> Loading clinic settings…</div>;

  return (
    <form onSubmit={saveSettings} className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clinic Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage clinic details, working hours, roster rules and inventory alerts.</p>
        </div>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </header>

      {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}<button type="button" onClick={() => void loadSettings()} className="font-semibold underline">Reload</button></div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <Section icon={Building2} title="Clinic Profile & Official Marks" description="Clinic identity and optional logo, signature and stamp images for official documents.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">Clinic name<input required maxLength="120" className={inputClass} value={settings.clinicProfile.name} onChange={(event) => updateNested('clinicProfile', 'name', event.target.value)} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">Official email<input type="email" maxLength="160" className={inputClass} value={settings.clinicProfile.email} onChange={(event) => updateNested('clinicProfile', 'email', event.target.value)} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">Phone<input type="tel" maxLength="40" className={inputClass} value={settings.clinicProfile.phone} onChange={(event) => updateNested('clinicProfile', 'phone', event.target.value)} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">Address<input maxLength="250" className={inputClass} value={settings.clinicProfile.address} onChange={(event) => updateNested('clinicProfile', 'address', event.target.value)} /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Clinic logo', section: 'clinicProfile', key: 'logoDataUrl' },
            { title: 'Clinic Head signature', section: 'officialMarks', key: 'signatureDataUrl' },
            { title: 'Official clinic stamp', section: 'officialMarks', key: 'stampDataUrl' }
          ].map(({ title, section, key }) => {
            const image = section === 'clinicProfile' ? settings.clinicProfile[key] : settings.officialMarks[key];
            return <div key={key} className="space-y-2 rounded-xl border border-dashed border-slate-300 p-4">
              <p className="text-sm font-semibold text-slate-700">{title}</p>
              {image ? <img src={image} alt={`${title} preview`} className="h-20 max-w-full object-contain" /> : <div className="flex h-20 items-center justify-center text-slate-400"><ImagePlus /></div>}
              <label className="block cursor-pointer text-xs font-semibold text-teal-700 hover:underline">Choose image<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void handleImage(event, section, key)} /></label>
              {image && <button type="button" onClick={() => section === 'clinicProfile' ? updateNested(section, key, '') : updateNested(section, key, '')} className="text-xs text-rose-600 hover:underline">Remove image</button>}
              <p className="text-[11px] text-slate-400">PNG, JPEG or WebP; max 500 KB.</p>
            </div>;
          })}
        </div>
        <p className="text-xs text-amber-700">Logo, signature and stamp are saved for clinic configuration. Automatic placement on certificates and referral documents requires those document templates to be connected to these settings.</p>
      </Section>

      <Section icon={Clock3} title="Working Hours & 24/7 Services" description="Configure regular opening times and identify services that operate continuously.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Day</th><th className="p-3">Open</th><th className="p-3">Close</th><th className="p-3">Closed</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{settings.workingHours.days.map((entry) => <tr key={entry.day}>
              <td className="p-3 font-medium">{entry.day}</td>
              <td className="p-3"><input aria-label={`${entry.day} opening time`} type="time" disabled={entry.closed || settings.workingHours.allDayService} className={inputClass} value={entry.open} onChange={(event) => updateDay(entry.day, 'open', event.target.value)} /></td>
              <td className="p-3"><input aria-label={`${entry.day} closing time`} type="time" disabled={entry.closed || settings.workingHours.allDayService} className={inputClass} value={entry.close} onChange={(event) => updateDay(entry.day, 'close', event.target.value)} /></td>
              <td className="p-3"><input aria-label={`${entry.day} closed`} type="checkbox" checked={entry.closed} disabled={settings.workingHours.allDayService} onChange={(event) => updateDay(entry.day, 'closed', event.target.checked)} className="h-4 w-4 accent-teal-600" /></td>
            </tr>)}</tbody>
          </table>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={settings.workingHours.allDayService} onChange={(event) => updateNested('workingHours', 'allDayService', event.target.checked)} className="h-4 w-4 accent-teal-600" /> Clinic operates 24 hours a day</label>
        <label className="block max-w-xl space-y-1.5 text-xs font-semibold text-slate-600">24/7 departments (comma-separated)
          <input className={inputClass} value={settings.workingHours.allDayDepartments.join(', ')} onChange={(event) => updateNested('workingHours', 'allDayDepartments', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="Emergency, Triage" />
        </label>
      </Section>

      <Section icon={ShieldCheck} title="Roster & Shift Rules" description="Set planned shift lengths, minimum staffing by department and shift, and approved-leave roster locking.">
        <div className="grid gap-4 sm:grid-cols-3">
          {['morning', 'afternoon', 'night'].map((shift) => <label key={shift} className="space-y-1.5 text-xs font-semibold capitalize text-slate-600">{shift} shift duration (hours)
            <input type="number" min="1" max="24" className={inputClass} value={settings.rosterRules.shiftDurations[shift]} onChange={(event) => updateNested('rosterRules', 'shiftDurations', { ...settings.rosterRules.shiftDurations, [shift]: Number(event.target.value) })} />
          </label>)}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-700">Minimum staffing per shift</h3><button type="button" onClick={addMinimumStaff} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700"><Plus size={15} /> Add rule</button></div>
          {settings.rosterRules.minimumStaff.map((rule, index) => <div key={`${index}-${rule.shift}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_120px_auto]">
            <input aria-label="Department" className={inputClass} placeholder="Department" value={rule.department} onChange={(event) => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.map((item, row) => row === index ? { ...item, department: event.target.value } : item))} />
            <select aria-label="Shift" className={inputClass} value={rule.shift} onChange={(event) => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.map((item, row) => row === index ? { ...item, shift: event.target.value } : item))}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option></select>
            <input aria-label="Minimum staff" type="number" min="0" max="500" className={inputClass} value={rule.count} onChange={(event) => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.map((item, row) => row === index ? { ...item, count: Number(event.target.value) } : item))} />
            <button type="button" aria-label="Remove staffing rule" onClick={() => updateNested('rosterRules', 'minimumStaff', settings.rosterRules.minimumStaff.filter((_, row) => row !== index))} className="flex items-center justify-center rounded-lg px-3 text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button>
          </div>)}
          {!settings.rosterRules.minimumStaff.length && <p className="text-xs text-slate-400">No minimum staffing rules added.</p>}
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={settings.rosterRules.autoLockApprovedLeave} onChange={(event) => updateNested('rosterRules', 'autoLockApprovedLeave', event.target.checked)} className="h-4 w-4 accent-teal-600" /> Lock roster dates when staff leave is approved</label>
      </Section>

      <Section icon={ShieldCheck} title="Inventory Alert Thresholds" description="Define low-stock limits by item category and the expiry warning lead time.">
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-700">Category reorder thresholds</h3><button type="button" onClick={addThreshold} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700"><Plus size={15} /> Add category</button></div>
          {settings.inventoryRules.categoryThresholds.map((rule, index) => <div key={`${index}-${rule.category}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_180px_auto]">
            <input aria-label="Inventory category" className={inputClass} placeholder="Category (for example, Tablets)" value={rule.category} onChange={(event) => updateNested('inventoryRules', 'categoryThresholds', settings.inventoryRules.categoryThresholds.map((item, row) => row === index ? { ...item, category: event.target.value } : item))} />
            <input aria-label="Low stock threshold" type="number" min="0" max="1000000" className={inputClass} value={rule.threshold} onChange={(event) => updateNested('inventoryRules', 'categoryThresholds', settings.inventoryRules.categoryThresholds.map((item, row) => row === index ? { ...item, threshold: Number(event.target.value) } : item))} />
            <button type="button" aria-label="Remove category threshold" onClick={() => updateNested('inventoryRules', 'categoryThresholds', settings.inventoryRules.categoryThresholds.filter((_, row) => row !== index))} className="flex items-center justify-center rounded-lg px-3 text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button>
          </div>)}
          {!settings.inventoryRules.categoryThresholds.length && <p className="text-xs text-slate-400">No category-specific thresholds; each item's saved reorder level remains in effect.</p>}
        </div>
        <label className="block max-w-sm space-y-1.5 text-xs font-semibold text-slate-600">Expiry warning (days before expiry)
          <input type="number" min="1" max="1095" className={inputClass} value={settings.inventoryRules.expiryWarningDays} onChange={(event) => updateNested('inventoryRules', 'expiryWarningDays', Number(event.target.value))} />
        </label>
      </Section>

      <footer className="flex justify-end pb-4">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save Settings
        </button>
      </footer>
    </form>
  );
};

export default ClinicHeadSettings;

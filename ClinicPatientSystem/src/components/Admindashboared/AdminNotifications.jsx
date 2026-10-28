import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  FilterX,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const initialResponse = {
  summary: { total: 0, unread: 0, delivered: 0, failed: 0, created: 0, queued: 0, sent: 0, read: 0 },
  notifications: [],
  pagination: { page: 1, limit: 25, total: 0, pages: 0 },
  options: { recipients: [], roles: [], departments: [], types: [], priorities: [], channels: [] },
  settings: {
    inAppEnabled: true,
    emailEnabled: false,
    categories: {
      system_announcement: true,
      user_account_update: true,
      security_alert: true,
      maintenance_announcement: true,
    },
  },
};

const typeLabels = {
  clinic_workflow: 'Clinic workflow',
  system_announcement: 'System announcement',
  user_account_update: 'User account update',
  security_alert: 'Security alert',
  maintenance_announcement: 'Maintenance announcement',
};
const dateValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const defaultEnd = dateValue(new Date());
const defaultStart = (() => {
  const date = new Date(`${defaultEnd}T12:00:00`);
  date.setDate(date.getDate() - 29);
  return dateValue(date);
})();
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};
const formatCount = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const createIdempotencyKey = () => globalThis.crypto?.randomUUID?.()
  || `notification_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

function Panel({ title, description, children, action }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ status }) {
  const color = status === 'delivered' || status === 'read'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'failed'
      ? 'bg-rose-50 text-rose-700'
      : status === 'sent'
        ? 'bg-blue-50 text-blue-700'
        : status === 'queued'
          ? 'bg-amber-50 text-amber-800'
          : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${color}`}>{status.replaceAll('_', ' ')}</span>;
}

export default function AdminNotifications() {
  const { token, user } = useAuth();
  const isAdmin = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .filter(Boolean)
    .some((value) => value.toLowerCase() === 'admin');
  const [view, setView] = useState('list');
  const [data, setData] = useState(initialResponse);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    title: '',
    message: '',
    recipientType: 'user',
    recipientId: '',
    notificationType: 'system_announcement',
    priority: 'normal',
    channel: 'in_app',
  });
  const [notificationSettings, setNotificationSettings] = useState(initialResponse.settings);
  const [sendRequestKey, setSendRequestKey] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        startDate,
        endDate,
        search,
        userId: recipientId,
        role: roleFilter,
        department: departmentFilter,
        type: typeFilter,
        channel: channelFilter,
        priority: priorityFilter,
        status: statusFilter,
        page: String(page),
        limit: '25',
        sortBy,
        sortDirection,
      });
      const response = await fetch(`/api/admin/dashboard/notifications?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message || `Unable to load notifications (${response.status}).`);
      }
      setData({ ...initialResponse, ...payload.data });
      setNotificationSettings({
        ...initialResponse.settings,
        ...payload.data.settings,
        categories: { ...initialResponse.settings.categories, ...payload.data.settings?.categories },
      });
    } catch (loadError) {
      setError(loadError.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [
    token, startDate, endDate, search, recipientId, roleFilter, departmentFilter,
    typeFilter, channelFilter, priorityFilter, statusFilter, page, sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    if (isAdmin && token) void loadNotifications();
  }, [isAdmin, token, loadNotifications, refreshKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchText);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const setFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const resetFilters = () => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setSearch('');
    setSearchText('');
    setRecipientId('');
    setRoleFilter('');
    setDepartmentFilter('');
    setTypeFilter('');
    setChannelFilter('');
    setPriorityFilter('');
    setStatusFilter('');
    setPage(1);
  };
  const refresh = () => setRefreshKey((current) => current + 1);
  const selectedRecipient = useMemo(
    () => data.options.recipients.find((recipient) => recipient.id === form.recipientId),
    [data.options.recipients, form.recipientId],
  );
  const matchingAudience = useMemo(() => {
    if (form.recipientType === 'user') return data.options.recipients.filter((recipient) => recipient.id === form.recipientId).length;
    if (form.recipientType === 'role') return data.options.recipients.filter((recipient) => recipient.role === form.recipientId).length;
    if (form.recipientType === 'department') return data.options.recipients.filter((recipient) => recipient.department === form.recipientId).length;
    return data.options.recipients.filter((recipient) => recipient.id !== user?.id && recipient.id !== user?._id).length;
  }, [data.options.recipients, form.recipientId, form.recipientType, user]);

  const openCompose = () => {
    setSendRequestKey(createIdempotencyKey());
    setForm({
      title: '',
      message: '',
      recipientType: 'user',
      recipientId: '',
      notificationType: 'system_announcement',
      priority: 'normal',
      channel: 'in_app',
    });
    setError('');
    setNotice('');
    setView('compose');
  };

  const sendNotification = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.title.trim() || !form.message.trim()) {
      setError('Enter both a title and a message.');
      return;
    }
    if (form.recipientType !== 'all' && !form.recipientId) {
      setError('Select a recipient.');
      return;
    }
    if (!notificationSettings.inAppEnabled || !notificationSettings.categories[form.notificationType]) {
      setError('In-app delivery or this notification category is disabled in Notification Settings.');
      return;
    }
    if (form.recipientType === 'all' || matchingAudience > 25) {
      const audienceDescription = form.recipientType === 'all'
        ? `all eligible active users except your account (up to 2,000 recipients)`
        : `${formatCount(matchingAudience)} active users`;
      if (!window.confirm(`Send this ${form.notificationType.replaceAll('_', ' ')} to ${audienceDescription}? This action cannot be recalled.`)) return;
    }

    const idempotencyKey = sendRequestKey || createIdempotencyKey();
    setSendRequestKey(idempotencyKey);
    setSending(true);
    try {
      const response = await fetch('/api/admin/dashboard/notifications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          message: form.message.trim(),
          idempotencyKey,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || `Unable to send notification (${response.status}).`);
      }
      setNotice(payload.message || 'Notification created.');
      setSendRequestKey('');
      setView('list');
      setStatusFilter('');
      setPage(1);
      refresh();
    } catch (sendError) {
      setError(sendError.message || 'Unable to create notification.');
    } finally {
      setSending(false);
    }
  };

  const updateNotificationSettings = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/dashboard/notifications/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            inAppEnabled: notificationSettings.inAppEnabled,
            categories: notificationSettings.categories,
          },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message || `Unable to save notification settings (${response.status}).`);
      }
      setNotificationSettings({ ...initialResponse.settings, ...payload.data, categories: { ...initialResponse.settings.categories, ...payload.data.categories } });
      setNotice(payload.message || 'Notification settings saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const viewDetails = async (notification) => {
    setError('');
    try {
      const response = await fetch(`/api/admin/dashboard/notifications/${notification.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message || `Unable to load notification (${response.status}).`);
      }
      setSelected(payload.data);
    } catch (detailError) {
      setError(detailError.message || 'Unable to load notification details.');
    }
  };

  const changeSort = (field) => {
    if (sortBy === field) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortDirection(field === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };
  const sortIcon = (field) => sortBy !== field
    ? <span className="ml-1 text-slate-400">↕</span>
    : <span className="ml-1 text-teal-700">{sortDirection === 'asc' ? '↑' : '↓'}</span>;

  const summaryCards = [
    { key: 'total', label: 'Total Notifications', icon: Bell, style: 'bg-blue-50 text-blue-700' },
    { key: 'unread', label: 'Unread Notifications', icon: Mail, style: 'bg-amber-50 text-amber-700' },
    { key: 'delivered', label: 'Confirmed Delivered', icon: CheckCircle2, style: 'bg-emerald-50 text-emerald-700' },
    { key: 'failed', label: 'Failed Deliveries', icon: CircleAlert, style: 'bg-rose-50 text-rose-700' },
  ];

  if (!isAdmin || !token) return <Navigate to="/login" replace />;
  const pageCount = Math.max(1, data.pagination.pages || 1);
  const startRow = data.pagination.total ? ((page - 1) * data.pagination.limit) + 1 : 0;
  const endRow = Math.min(page * data.pagination.limit, data.pagination.total);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
              <Link to="/admin" className="font-medium hover:text-teal-700">System Admin</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span className="text-teal-700">Notifications</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notification Management</h1>
            <p className="mt-1 text-sm text-slate-500">Create and review role-aware in-app notifications for clinic users.</p>
            <p className="mt-1 text-[11px] text-slate-400">“Created” means stored for in-app retrieval; it does not confirm device delivery. Email transport is not configured.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
            <button type="button" onClick={openCompose} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"><Plus size={14} />Send Notification</button>
          </div>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <section aria-label="Notification summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map(({ key, label, icon: Icon, style }) => (
            <article key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <span className={`rounded-lg p-2 ${style}`}><Icon size={16} aria-hidden="true" /></span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{loading || error ? '—' : formatCount(data.summary[key])}</p>
            </article>
          ))}
        </section>

        <div className="flex flex-wrap gap-2 border-b border-slate-200">
          {[
            ['list', 'Notification List', Bell],
            ['compose', 'Send Notification', Send],
            ['settings', 'Notification Settings', Settings2],
          ].map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => { setView(id); setError(''); setNotice(''); }} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${view === id ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon size={14} aria-hidden="true" />{label}
            </button>
          ))}
        </div>

        {view === 'list' && (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700"><Search size={15} className="text-teal-700" />Search and filter</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <label className="text-[11px] font-medium text-slate-500">From
                  <input type="date" value={startDate} max={endDate || undefined} onChange={setFilter(setStartDate)} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                </label>
                <label className="text-[11px] font-medium text-slate-500">To
                  <input type="date" value={endDate} min={startDate || undefined} onChange={setFilter(setEndDate)} className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                </label>
                <label className="text-[11px] font-medium text-slate-500">Recipient
                  <select value={recipientId} onChange={setFilter(setRecipientId)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"><option value="">All recipients</option>{data.options.recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}</select>
                </label>
                <label className="text-[11px] font-medium text-slate-500">Role
                  <select value={roleFilter} onChange={setFilter(setRoleFilter)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"><option value="">All roles</option>{data.options.roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>
                <label className="text-[11px] font-medium text-slate-500">Department
                  <select value={departmentFilter} onChange={setFilter(setDepartmentFilter)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"><option value="">All departments</option>{data.options.departments.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                </label>
                <label className="text-[11px] font-medium text-slate-500">Type
                  <select value={typeFilter} onChange={setFilter(setTypeFilter)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"><option value="">All types</option>{data.options.types.map((item) => <option key={item} value={item}>{typeLabels[item] || item}</option>)}</select>
                </label>
                <label className="text-[11px] font-medium text-slate-500">Channel
                  <select value={channelFilter} onChange={setFilter(setChannelFilter)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"><option value="">All channels</option>{data.options.channels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>
                <label className="text-[11px] font-medium text-slate-500">Priority
                  <select value={priorityFilter} onChange={setFilter(setPriorityFilter)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"><option value="">All priorities</option>{data.options.priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                </label>
                <label className="text-[11px] font-medium text-slate-500">Status
                  <select value={statusFilter} onChange={setFilter(setStatusFilter)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs">
                    <option value="">All statuses</option>
                    <option value="unread">Unread</option><option value="read">Read</option>
                    <option value="created">Created / stored</option><option value="queued">Queued</option>
                    <option value="sent">Sent</option><option value="delivered">Delivered</option><option value="failed">Failed</option>
                  </select>
                </label>
                <label className="text-[11px] font-medium text-slate-500 sm:col-span-2">Search
                  <span className="relative mt-1 block">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Title, message, role, department" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-2 text-xs" />
                  </span>
                </label>
              </div>
              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700"><FilterX size={14} />Reset filters</button>
              </div>
            </section>

            <Panel title="Notification Records" description={`${formatCount(data.pagination.total)} matching stored notifications. Status reflects database/provider state, not assumed device delivery.`}>
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[1180px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      {[['title', 'Title'], ['recipientRole', 'Recipient / role'], ['notificationType', 'Type'], ['channel', 'Channel'], ['priority', 'Priority'], ['createdAt', 'Created / sent time']].map(([field, label]) => (
                        <th key={field} className="px-3 py-3">
                          <button type="button" onClick={() => changeSort(field)} className="hover:text-teal-700">{label}{sortIcon(field)}</button>
                        </th>
                      ))}
                      <th className="px-3 py-3">Delivery / read status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />Loading notifications…</span></td></tr>
                    ) : data.notifications.length ? data.notifications.map((item) => (
                      <tr key={item.id} className="align-top hover:bg-slate-50">
                        <td className="max-w-sm px-3 py-3"><span className="font-semibold text-slate-800">{item.title}</span><span className="mt-1 block line-clamp-2 text-slate-500">{item.message}</span></td>
                        <td className="px-3 py-3"><span className="font-medium text-slate-700">{item.recipient?.name || 'Unknown user'}</span><span className="mt-1 block text-[10px] text-slate-400">{item.recipient?.role || 'Not recorded'} · {item.recipient?.department || 'Not recorded'}</span></td>
                        <td className="px-3 py-3 text-slate-600">{typeLabels[item.notificationType] || item.notificationType}</td>
                        <td className="px-3 py-3 capitalize text-slate-600">{item.channel.replaceAll('_', ' ')}</td>
                        <td className="px-3 py-3 capitalize text-slate-600">{item.priority}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                        <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge status={item.deliveryStatus} /><span className="text-[10px] text-slate-400">{item.readAt ? `Read ${formatDate(item.readAt)}` : 'Unread'}</span></div></td>
                        <td className="px-3 py-3"><button type="button" onClick={() => void viewDetails(item)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-800"><Eye size={12} />View details</button></td>
                      </tr>
                    )) : (
                      <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-500">{error ? 'Notification records are unavailable until the server request succeeds.' : 'No notifications match these filters.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>{startRow}–{endRow} of {formatCount(data.pagination.total)} notifications</span>
                <div className="flex items-center gap-3">
                  <span>Page {Math.min(page, pageCount)} of {pageCount}</span>
                  <button type="button" aria-label="Previous page" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-slate-300 p-1.5 disabled:opacity-40"><ChevronLeft size={15} /></button>
                  <button type="button" aria-label="Next page" disabled={loading || page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded border border-slate-300 p-1.5 disabled:opacity-40"><ChevronRight size={15} /></button>
                </div>
              </footer>
            </Panel>
          </>
        )}

        {view === 'compose' && (
          <Panel title="Send an in-app notification" description="Only active users receive notifications. Email is unavailable because no mail provider is configured.">
            <form onSubmit={sendNotification} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">Title *
                  <input required maxLength="160" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="Notification title" />
                </label>
                <label className="text-xs font-semibold text-slate-600">Notification type *
                  <select value={form.notificationType} onChange={(event) => setForm((current) => ({ ...current, notificationType: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    {data.options.types.filter((type) => type !== 'clinic_workflow').map((type) => <option key={type} value={type} disabled={!notificationSettings.categories[type]}>{typeLabels[type]}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600">Message *
                <textarea required maxLength="4000" rows="5" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="mt-1 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="Write a concise message for the selected recipients." />
                <span className="mt-1 block text-right text-[10px] font-normal text-slate-400">{form.message.length}/4,000</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-600">Recipient group *
                  <select value={form.recipientType} onChange={(event) => setForm((current) => ({ ...current, recipientType: event.target.value, recipientId: '' }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    <option value="user">Specific active user</option>
                    <option value="role">Active role</option>
                    <option value="department">Active department</option>
                    <option value="all">All eligible active users</option>
                  </select>
                </label>
                {form.recipientType === 'user' && (
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Recipient user *
                    <select required value={form.recipientId} onChange={(event) => setForm((current) => ({ ...current, recipientId: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="">Select an active user</option>
                      {data.options.recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.role} · {recipient.department}</option>)}
                    </select>
                  </label>
                )}
                {form.recipientType === 'role' && (
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Recipient role *
                    <select required value={form.recipientId} onChange={(event) => setForm((current) => ({ ...current, recipientId: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="">Select an active role</option>
                      {data.options.roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </label>
                )}
                {form.recipientType === 'department' && (
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Recipient department *
                    <select required value={form.recipientId} onChange={(event) => setForm((current) => ({ ...current, recipientId: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="">Select an active department</option>
                      {data.options.departments.map((department) => <option key={department} value={department}>{department}</option>)}
                    </select>
                  </label>
                )}
                {form.recipientType === 'all' && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900 sm:col-span-2">
                    <UsersRound size={16} className="shrink-0" />
                    Sends to all active users except your account. This is an explicitly selected audience and requires confirmation.
                  </div>
                )}
              </div>
              {form.recipientType === 'user' && selectedRecipient && <p className="text-xs text-slate-500">Selected: {selectedRecipient.name} · {selectedRecipient.role} · {selectedRecipient.department}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">Priority
                  <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">{data.options.priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-slate-600">Channel
                  <select value="in_app" disabled className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-600"><option value="in_app">In-app (available)</option></select>
                  <span className="mt-1 block text-[10px] font-normal text-slate-500">Email delivery is unavailable; no email service is configured.</span>
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" disabled={sending} onClick={() => { setView('list'); setError(''); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={sending || !notificationSettings.inAppEnabled || !notificationSettings.categories[form.notificationType]} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                  {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send size={14} />}
                  {sending ? 'Creating…' : `Send${matchingAudience ? ` to ${formatCount(matchingAudience)}` : ''}`}
                </button>
              </div>
            </form>
          </Panel>
        )}

        {view === 'settings' && (
          <Panel title="Notification settings" description="These settings persist in SystemSettings and apply to System Admin in-app notifications. Existing clinic workflow notifications are unaffected.">
            <div className="space-y-5">
              <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <span><span className="block text-sm font-semibold text-slate-800">Enable System Admin in-app notifications</span><span className="mt-1 block text-xs text-slate-500">When disabled, System Admin announcements and alerts cannot be sent.</span></span>
                <input type="checkbox" checked={notificationSettings.inAppEnabled} onChange={(event) => setNotificationSettings((current) => ({ ...current, inAppEnabled: event.target.checked }))} className="mt-1 h-4 w-4 accent-teal-700" />
              </label>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Supported categories</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.entries(typeLabels).filter(([type]) => type !== 'clinic_workflow').map(([type, label]) => (
                    <label key={type} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                      <span className="text-xs font-semibold text-slate-700">{label}</span>
                      <input type="checkbox" checked={notificationSettings.categories[type] ?? true} onChange={(event) => setNotificationSettings((current) => ({ ...current, categories: { ...current.categories, [type]: event.target.checked } }))} className="h-4 w-4 accent-teal-700" />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                <Mail size={16} className="mt-0.5 shrink-0 text-slate-500" />
                Email notifications are not configured in this application. No email setting is shown as enabled, and no email is sent.
              </div>
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button type="button" disabled={saving} onClick={() => void updateNotificationSettings()} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                  {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Settings2 size={14} />}
                  {saving ? 'Saving…' : 'Save notification settings'}
                </button>
              </div>
            </div>
          </Panel>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="notification-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">Notification details</p><h2 id="notification-details-title" className="mt-1 text-lg font-bold text-slate-900">{selected.title}</h2></div>
              <button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </header>
            <div className="space-y-5 p-5">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{selected.message}</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Recipient', selected.recipient?.name || 'Unknown user'],
                  ['Role / department', `${selected.recipient?.role || 'Not recorded'} · ${selected.recipient?.department || 'Not recorded'}`],
                  ['Type', typeLabels[selected.notificationType] || selected.notificationType],
                  ['Channel', selected.channel.replaceAll('_', ' ')],
                  ['Priority', selected.priority],
                  ['Created', formatDate(selected.createdAt)],
                  ['Delivery status', selected.deliveryStatus],
                  ['Read', selected.readAt ? formatDate(selected.readAt) : 'Unread'],
                  ['Batch reference', selected.batchId || 'Workflow notification'],
                ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-100 p-3"><dt className="text-[10px] font-semibold uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs font-medium capitalize text-slate-700">{value}</dd></div>)}
              </dl>
              <div>
                <h3 className="flex items-center gap-2 text-xs font-bold text-slate-800"><Clock3 size={14} />Delivery history</h3>
                {selected.deliveryAttempts?.length ? (
                  <ul className="mt-2 space-y-2">
                    {selected.deliveryAttempts.map((attempt, index) => <li key={`${attempt._id || attempt.attemptedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                      <span className="text-xs text-slate-600">{attempt.channel?.replaceAll('_', ' ')} · {formatDate(attempt.attemptedAt)}</span>
                      <StatusBadge status={attempt.status} />
                      {attempt.failureReason && <span className="w-full text-xs text-rose-700">{attempt.failureReason}</span>}
                    </li>)}
                  </ul>
                ) : <p className="mt-2 rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">No delivery attempt detail is stored for this record.</p>}
                {selected.channel === 'in_app' && selected.deliveryStatus === 'created' && <p className="mt-2 text-[11px] text-slate-500">Stored and available for in-app retrieval; client/device delivery confirmation is not recorded.</p>}
                {selected.channel === 'email' && selected.deliveryStatus === 'sent' && <p className="mt-2 text-[11px] text-amber-700">Sent status means the provider accepted submission; it is not proof of recipient delivery.</p>}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

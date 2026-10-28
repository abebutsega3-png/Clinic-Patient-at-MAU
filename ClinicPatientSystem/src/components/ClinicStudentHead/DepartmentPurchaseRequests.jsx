import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, Package, Send } from 'lucide-react';
import {
  createApprovalRequest,
  fetchMyPurchaseRequests,
  receivePurchaseRequest
} from '../../utile/clinicheadapprovalApi.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const categories = [
  'Medicine',
  'Medical supplies',
  'Medical equipment',
  'Laboratory supplies',
  'Office and registration supplies',
  'Other'
];

const initialForm = {
  itemName: '',
  category: 'Medicine',
  quantity: '',
  unit: 'units',
  estimatedCost: '',
  currentStock: '',
  monthlyUsage: '',
  priority: 'normal',
  reason: ''
};

const formatDate = (date) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};

const DepartmentPurchaseRequests = () => {
  const { user, token } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [receivingId, setReceivingId] = useState('');

  useEffect(() => {
    let active = true;
    if (!token) return () => {
      active = false;
    };
    fetchMyPurchaseRequests(token)
      .then((result) => {
        if (active) setRequests(Array.isArray(result.data) ? result.data : []);
      })
      .catch((loadError) => {
        if (active) {
          console.error('Failed to load department purchase requests:', loadError);
          setError(loadError.response?.data?.message || 'Unable to load your purchase requests.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, refreshKey]);

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

  const department = String(user.department || '').trim();
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submitRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const request = {
        requestType: 'purchase_request',
        reason: form.reason.trim(),
        department,
        priority: form.priority,
        purchase: {
          itemName: form.itemName.trim(),
          category: form.category,
          quantity: Number(form.quantity),
          unit: form.unit.trim() || 'units',
          estimatedCost: Number(form.estimatedCost),
          currentStock: form.currentStock === '' ? null : Number(form.currentStock),
          monthlyUsage: form.monthlyUsage === '' ? null : Number(form.monthlyUsage)
        }
      };
      const result = await createApprovalRequest(request, token);
      setForm(initialForm);
      setNotice(result.warning || 'Purchase request submitted to the Clinic Head for review.');
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      console.error('Failed to submit department purchase request:', submitError);
      setError(submitError.response?.data?.message || 'Unable to submit this purchase request.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelivery = async (request) => {
    const quantity = request.purchase?.approvedQuantity ?? request.purchase?.quantity;
    if (!window.confirm(`Confirm that ${quantity} ${request.purchase?.unit || 'units'} of ${request.purchase?.itemName} were physically received and checked?`)) {
      return;
    }
    setError('');
    setNotice('');
    setReceivingId(request._id);
    try {
      await receivePurchaseRequest(request._id, token);
      setNotice('Delivery marked as received. Update inventory separately after checking quantities and any required batch/expiry details.');
      setRefreshKey((current) => current + 1);
    } catch (receiveError) {
      console.error('Failed to confirm purchase delivery:', receiveError);
      setError(receiveError.response?.data?.message || 'Unable to confirm this delivery.');
    } finally {
      setReceivingId('');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold text-teal-300">MAU Clinic · Department Procurement</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <Package size={24} /> Purchase Requests
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Submit supply needs for Clinic Head approval and track their delivery progress.
          </p>
        </header>

        {(error || notice) && (
          <p role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${
            error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}>
            {error || notice}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <form onSubmit={submitRequest} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Submit a supply request</h2>
              <p className="mt-1 text-sm text-slate-500">
                Department: <strong className="text-slate-700">{department || 'Not set on your account'}</strong>
                {' · '}Requester: {user.name}
              </p>
            </div>
            {!department && (
              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Your account has no department assigned. Contact the administrator before submitting a request.
              </p>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Item name *
              <input required maxLength={120} value={form.itemName} onChange={(event) => updateField('itemName', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="e.g. Paracetamol 500 mg" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Category
                <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Priority
                <select value={form.priority} onChange={(event) => updateField('priority', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="normal">Routine</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Quantity *
                <input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Unit
                <input required maxLength={40} value={form.unit} onChange={(event) => updateField('unit', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="boxes, packs, bottles..." />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Estimated total cost (ETB) *
                <input required type="number" min="0" step="0.01" value={form.estimatedCost} onChange={(event) => updateField('estimatedCost', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Current stock
                <input type="number" min="0" step="1" value={form.currentStock} onChange={(event) => updateField('currentStock', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Monthly usage
                <input type="number" min="0" step="1" value={form.monthlyUsage} onChange={(event) => updateField('monthlyUsage', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>
            {form.priority === 'urgent' && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                Explain the urgency in the reason so the Clinic Head can prioritize safely.
              </p>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Reason / clinical or operational need *
              <textarea required maxLength={1500} rows={4} value={form.reason} onChange={(event) => updateField('reason', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <button type="submit" disabled={saving || !department} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={16} /> {saving ? 'Submitting...' : 'Submit for approval'}
            </button>
          </form>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-bold text-slate-800">My department requests</h2>
              <p className="mt-1 text-sm text-slate-500">Approval and delivery status for requests in your department. Receipt confirmation does not change stock levels; update inventory after checking the delivered goods.</p>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500">Loading requests...</p>
            ) : requests.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">You have not submitted any purchase requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Submitted</th>
                      <th className="p-3">Item</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Approval</th>
                      <th className="p-3">Delivery</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map((request) => {
                      const history = request.decisionHistory || [];
                      const latestDecision = history[history.length - 1];
                      return (
                        <tr key={request._id}>
                          <td className="p-3 text-xs text-slate-500">{formatDate(request.createdAt)}<span className="block font-mono">{request.requestNumber || request._id.slice(-7)}</span></td>
                          <td className="p-3 font-medium text-slate-800">{request.purchase?.itemName}<span className="block text-xs text-slate-500">{request.purchase?.category || 'Other'}</span></td>
                          <td className="p-3 text-slate-700">
                            {request.status === 'approved'
                              ? `${request.purchase?.approvedQuantity ?? request.purchase?.quantity} / ${request.purchase?.quantity}`
                              : request.purchase?.quantity}{' '}
                            {request.purchase?.unit || 'units'}
                          </td>
                          <td className="p-3 capitalize text-slate-700">
                            {request.status}
                            {(request.rejectionReason || (latestDecision?.action === 'returned' ? latestDecision.comment : '')) && (
                              <span className="block max-w-40 text-xs text-rose-700">
                                {request.rejectionReason || latestDecision.comment}
                              </span>
                            )}
                          </td>
                          <td className="p-3 capitalize text-xs text-slate-600">
                            {(request.fulfillmentStatus || 'awaiting_approval').replaceAll('_', ' ')}
                            {request.receivedAt && <span className="block text-slate-400">{formatDate(request.receivedAt)} · {request.receivedBy}</span>}
                          </td>
                          <td className="p-3">
                            {request.status === 'approved' && request.fulfillmentStatus === 'awaiting_delivery' && (
                              <button type="button" onClick={() => void confirmDelivery(request)} disabled={receivingId === request._id} className="whitespace-nowrap rounded-md bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                                {receivingId === request._id ? 'Saving...' : 'Mark received'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default DepartmentPurchaseRequests;

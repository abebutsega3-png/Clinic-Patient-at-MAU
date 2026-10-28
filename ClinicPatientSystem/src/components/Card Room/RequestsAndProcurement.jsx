import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Edit2, Package, Plus, Send, ShoppingCart, X } from 'lucide-react';
import {
  createApprovalRequest,
  fetchMyDepartmentRequests,
  receivePurchaseRequest,
  resubmitApprovalRequest
} from '../../utile/clinicheadapprovalApi.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const purchaseCategories = [
  'Office & Registration Supplies',
  'Printer Supplies',
  'IT Accessories',
  'Other'
];

const initialPurchaseForm = {
  itemName: '',
  category: purchaseCategories[0],
  quantity: '',
  unit: 'units',
  estimatedCost: '',
  priority: 'normal',
  reason: ''
};

const initialLeaveForm = {
  leaveType: 'annual',
  startDate: '',
  endDate: '',
  reason: ''
};

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  returned: 'bg-violet-100 text-violet-800 border-violet-200'
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const getInclusiveDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
};

const getDecisionComment = (request) => {
  const history = request.decisionHistory || [];
  return [...history].reverse().find((entry) => entry.comment)?.comment || request.rejectionReason || '';
};

const RequestsAndProcurement = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('purchase');
  const [requests, setRequests] = useState([]);
  const [purchaseForm, setPurchaseForm] = useState(initialPurchaseForm);
  const [leaveForm, setLeaveForm] = useState(initialLeaveForm);
  const [editingLeaveRequest, setEditingLeaveRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!token) return [];
    const result = await fetchMyDepartmentRequests(token);
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.message || 'The server returned an invalid request history.');
    }
    return result.data;
  }, [token]);

  useEffect(() => {
    let active = true;
    loadRequests()
      .then((data) => {
        if (active) {
          setRequests(data);
          setError('');
        }
      })
      .catch((loadError) => {
        if (active) {
          console.error('Failed to load Card Room requests:', loadError);
          setError(loadError.response?.data?.message || loadError.message || 'Unable to load your requests.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadRequests, refreshKey]);

  const visibleRequests = useMemo(() => requests.filter((request) => (
    activeTab === 'purchase'
      ? request.requestType === 'purchase_request'
      : ['leave_request', 'staff_leave'].includes(request.requestType)
  )), [activeTab, requests]);
  const requestedLeaveDays = getInclusiveDays(leaveForm.startDate, leaveForm.endDate);

  const submitPurchaseRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await createApprovalRequest({
        requestType: 'purchase_request',
        reason: purchaseForm.reason.trim(),
        priority: purchaseForm.priority,
        purchase: {
          itemName: purchaseForm.itemName.trim(),
          category: purchaseForm.category,
          quantity: Number(purchaseForm.quantity),
          unit: purchaseForm.unit.trim(),
          estimatedCost: purchaseForm.estimatedCost === '' ? 0 : Number(purchaseForm.estimatedCost)
        }
      }, token);
      setPurchaseForm(initialPurchaseForm);
      setNotice(result.warning || 'Purchase request sent to the Clinic Head for approval.');
      setIsModalOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (submitError) {
      console.error('Failed to submit Card Room purchase request:', submitError);
      setError(submitError.response?.data?.message || 'Unable to submit the purchase request.');
    } finally {
      setSaving(false);
    }
  };

  const submitLeaveRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (requestedLeaveDays < 1) {
        setError('The leave end date must be on or after the start date.');
        return;
      }
      const requestData = {
        reason: leaveForm.reason.trim(),
        leave: {
          leaveType: leaveForm.leaveType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          totalDays: requestedLeaveDays
        }
      };
      const result = editingLeaveRequest
        ? await resubmitApprovalRequest(editingLeaveRequest._id, requestData, token)
        : await createApprovalRequest({ requestType: 'leave_request', ...requestData }, token);
      setLeaveForm(initialLeaveForm);
      setEditingLeaveRequest(null);
      setNotice(result.warning || (
        editingLeaveRequest
          ? 'Corrected leave request resubmitted to the Clinic Head for approval.'
          : 'Leave request sent to the Clinic Head for approval.'
      ));
      setIsModalOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (submitError) {
      console.error('Failed to submit Card Room leave request:', submitError);
      setError(submitError.response?.data?.message || 'Unable to submit the leave request.');
    } finally {
      setSaving(false);
    }
  };

  const editAndResubmitLeaveRequest = (request) => {
    const leave = request.leave || {};
    setEditingLeaveRequest(request);
    setLeaveForm({
      leaveType: leave.leaveType || 'annual',
      startDate: toDateInputValue(leave.startDate),
      endDate: toDateInputValue(leave.endDate),
      reason: request.reason || ''
    });
    setError('');
    setNotice('');
    setIsModalOpen(true);
  };

  const closeRequestModal = () => {
    setIsModalOpen(false);
    setEditingLeaveRequest(null);
    setError('');
  };

  const confirmDelivery = async (request) => {
    const quantity = request.purchase?.approvedQuantity ?? request.purchase?.quantity;
    if (!window.confirm(`Confirm receipt of ${quantity} ${request.purchase?.unit || 'units'} of ${request.purchase?.itemName}?`)) {
      return;
    }
    setReceivingId(request._id);
    setError('');
    setNotice('');
    try {
      await receivePurchaseRequest(request._id, token);
      setNotice('Receipt recorded. Check and update inventory separately if required.');
      setRefreshKey((key) => key + 1);
    } catch (receiveError) {
      console.error('Failed to record Card Room purchase receipt:', receiveError);
      setError(receiveError.response?.data?.message || 'Unable to record receipt.');
    } finally {
      setReceivingId('');
    }
  };

  const requester = user?.name || 'Card Room staff';

  return (
    <section className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* HEADER SECTION */}
      <header className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-6 text-white shadow-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-400">Card Room · Requests</p>
          <h1 className="mt-1 text-2xl font-bold">Requests &amp; Procurement</h1>
          <p className="mt-1 text-sm text-slate-300">
            Submit purchase and leave requests to the Clinic Head, then track decisions here.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingLeaveRequest(null);
            if (activeTab === 'leave') setLeaveForm(initialLeaveForm);
            setIsModalOpen(true);
            setError('');
            setNotice('');
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-500 shrink-0"
        >
          <Plus size={18} /> New {activeTab === 'purchase' ? 'Purchase' : 'Leave'} Request
        </button>
      </header>

      {/* ALERT NOTICES */}
      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 text-sm font-medium ${
          error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {error ? <AlertCircle size={20} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={20} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      {/* TABS SELECTION */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm max-w-md">
        <button
          type="button"
          onClick={() => { setActiveTab('purchase'); setError(''); setNotice(''); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
            activeTab === 'purchase' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart size={17} /> Purchase Requests
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('leave'); setError(''); setNotice(''); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
            activeTab === 'leave' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CalendarDays size={17} /> Staff Leave
        </button>
      </div>

      {/* MAIN HISTORY TABLE / LIST (FULL WIDTH) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {activeTab === 'purchase' ? 'Purchase Request History' : 'Leave Request History'}
            </h2>
            <p className="text-xs text-slate-500">Your submitted requisitions and approval status</p>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            {visibleRequests.length} total
          </span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading request history...</p>
        ) : visibleRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold">No {activeTab === 'purchase' ? 'purchase' : 'leave'} requests yet</p>
            <p className="text-xs mt-1">Click the top button to create a new request.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Details</th>
                  <th className="px-6 py-3.5">{activeTab === 'purchase' ? 'Quantity / Priority' : 'Dates / Duration'}</th>
                  <th className="px-6 py-3.5">Reason</th>
                  <th className="px-6 py-3.5">Status & Notes</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRequests.map((request) => {
                  const status = String(request.status || 'pending').toLowerCase();
                  const comment = getDecisionComment(request);
                  const purchase = request.purchase || {};
                  const leave = request.leave || {};

                  return (
                    <tr key={request._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {activeTab === 'purchase' ? purchase.itemName || 'Purchase Request' : `${leave.leaveType || 'Leave'} Leave`}
                        {activeTab === 'purchase' && (
                          <div className="mt-1 text-xs font-normal text-slate-500">
                            {purchase.category || 'Other'}
                            {Number(purchase.estimatedCost) > 0 && ` · Estimated cost: ${Number(purchase.estimatedCost).toLocaleString()}`}
                          </div>
                        )}
                        <div className="text-xs font-normal text-slate-400 mt-0.5">
                          {request.requestNumber || `ID: ${request._id.slice(-6)}`} · {formatDate(request.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {activeTab === 'purchase' ? (
                          <div>
                            <span className="font-medium text-slate-700">{purchase.quantity} {purchase.unit || 'units'}</span>
                            <div className="text-xs text-slate-400">
                              {request.priority === 'urgent' ? (
                                <span className="text-rose-600 font-bold">Urgent</span>
                              ) : 'Routine'}
                              {purchase.approvedQuantity != null && ` (Approved: ${purchase.approvedQuantity})`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span>{formatDate(leave.startDate)} – {formatDate(leave.endDate)}</span>
                            <div className="text-xs text-slate-400">{leave.totalDays || '—'} day(s)</div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-slate-600" title={request.reason}>
                        {request.reason}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold border ${statusStyles[status] || statusStyles.pending}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {comment && (
                          <div className="mt-1 text-xs text-slate-500 bg-slate-100 p-2 rounded-lg max-w-xs">
                            <strong className="text-slate-700">Note:</strong> {comment}
                          </div>
                        )}
                        {activeTab === 'purchase' && request.fulfillmentStatus === 'received' && (
                          <div className="text-xs font-semibold text-emerald-600 mt-1">
                            ✓ Received on {formatDate(request.receivedAt)}
                          </div>
                        )}
                      </td>
                      {activeTab === 'purchase' && (
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {status === 'approved' && request.fulfillmentStatus === 'awaiting_delivery' && (
                            <button
                              type="button"
                              disabled={receivingId === request._id}
                              onClick={() => confirmDelivery(request)}
                              className="rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                            >
                              {receivingId === request._id ? 'Recording...' : 'Mark Received'}
                            </button>
                          )}
                        </td>
                      )}
                      {activeTab === 'leave' && (
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {status === 'returned' && (
                            <button
                              type="button"
                              onClick={() => editAndResubmitLeaveRequest(request)}
                              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                            >
                              <Edit2 size={14} /> Edit &amp; Resubmit
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* POP-UP MODAL FOR NEW REQUESTS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={activeTab === 'purchase' ? 'New purchase request' : editingLeaveRequest ? 'Edit and resubmit leave request' : 'New staff leave request'}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 relative my-8">
            <button
              type="button"
              aria-label="Close request form"
              onClick={closeRequestModal}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X size={20} />
            </button>

            {activeTab === 'purchase' ? (
              <form onSubmit={submitPurchaseRequest} className="space-y-4">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                    <Package size={22} className="text-teal-600" /> New Purchase Request
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Requester and department are taken from your signed-in account.</p>
                  <p className="mt-1 text-xs font-medium text-slate-600">Requester: {requester} · Department: Card Room</p>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Item name *
                  <input required maxLength={120} value={purchaseForm.itemName} onChange={(e) => setPurchaseForm({ ...purchaseForm, itemName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" placeholder="A4 paper, printer toner, file folders, pens..." />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Category
                    <select value={purchaseForm.category} onChange={(e) => setPurchaseForm({ ...purchaseForm, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none">
                      {purchaseCategories.map((cat) => <option key={cat}>{cat}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Priority
                    <select value={purchaseForm.priority} onChange={(e) => setPurchaseForm({ ...purchaseForm, priority: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none">
                      <option value="normal">Routine</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Quantity *
                    <input required type="number" min="1" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Unit *
                    <input required maxLength={40} value={purchaseForm.unit} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" placeholder="boxes, packs..." />
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Estimated cost (optional)
                  <input type="number" min="0" step="0.01" value={purchaseForm.estimatedCost} onChange={(e) => setPurchaseForm({ ...purchaseForm, estimatedCost: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Reason for request *
                  <textarea required maxLength={1000} rows="3" value={purchaseForm.reason} onChange={(e) => setPurchaseForm({ ...purchaseForm, reason: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" placeholder="Explain what the supplies are needed for." />
                </label>

                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50">
                    <Send size={16} /> {saving ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitLeaveRequest} className="space-y-4">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                    <CalendarDays size={22} className="text-teal-600" /> {editingLeaveRequest ? 'Edit Leave Application' : 'New Leave Application'}
                  </h2>
                  {editingLeaveRequest && (
                    <p className="mt-1 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
                      Update the returned request details below. Submitting will send it back to the Clinic Head as Pending.
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-0.5">Requester and department are taken from your signed-in account.</p>
                  <p className="mt-1 text-xs font-medium text-slate-600">Requester: {requester} · Department: Card Room</p>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Leave type
                  <select value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none">
                    <option value="annual">Annual leave</option>
                    <option value="sick">Sick leave</option>
                    <option value="emergency">Emergency leave</option>
                    <option value="personal">Personal leave</option>
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Start date *
                    <input required type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    End date *
                    <input required type="date" min={leaveForm.startDate || undefined} value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" />
                  </label>
                </div>
                <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900" aria-live="polite">
                  Total leave days: <strong>{requestedLeaveDays > 0 ? requestedLeaveDays : 'Select a valid date range'}</strong>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Reason *
                  <textarea required maxLength={1000} rows="3" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" />
                </label>

                {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button type="button" onClick={closeRequestModal} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50">
                    <Send size={16} /> {saving ? (editingLeaveRequest ? 'Resubmitting...' : 'Submitting...') : (editingLeaveRequest ? 'Resubmit Request' : 'Submit Application')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default RequestsAndProcurement;
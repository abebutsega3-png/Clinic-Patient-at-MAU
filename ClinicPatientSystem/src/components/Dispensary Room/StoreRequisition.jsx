import { Fragment, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, FileText, PackagePlus, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const blankItem = () => ({
  itemCode: '',
  itemDescription: '',
  uom: 'PKT',
  itemCategory: 'Medical Supplies',
  requestedQty: 1,
});

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const statusClassNames = {
  'Pending Approval': 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  'Partially Issued': 'bg-sky-100 text-sky-800',
  Issued: 'bg-sky-100 text-sky-800',
  'Issued (Model 22)': 'bg-sky-100 text-sky-800',
  'Partially Received': 'bg-violet-100 text-violet-800',
  Received: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-rose-100 text-rose-800',
};

export default function StoreRequisition() {
  const { token, user } = useAuth();
  const roleNames = [user?.activeRole, user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase().replace(/[_-]+/g, ' '));
  const canCreate = roleNames.some((role) => ['pharmacist', 'drug store manager', 'dispensary room'].includes(role));
  const canManage = roleNames.some((role) => [
    'clinic head', 'clinic manager', 'drug store', 'drug store manager',
    'main store keeper', 'main storekeeper', 'store keeper', 'storekeeper',
  ].includes(role));
  const [activeTab, setActiveTab] = useState(canCreate ? 'new' : 'history');
  const [reason, setReason] = useState('Routine Restock');
  const [items, setItems] = useState([blankItem()]);
  const [history, setHistory] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState('');
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRequisitions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/requisitions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.message || result?.error || `Unable to load requisitions (${response.status}).`);
      }
      setHistory(result.data);
      if (canCreate) {
        const stockResponse = await fetch('/api/inventory/stock', {
          headers: { Authorization: ['Bearer', token].join(' ') },
        });
        const stockResult = await stockResponse.json().catch(() => null);
        if (!stockResponse.ok || !stockResult?.success || !Array.isArray(stockResult.data)) {
          setInventoryError(stockResult?.message || `Unable to load low-stock suggestions (${stockResponse.status}).`);
        } else {
          setInventory(stockResult.data);
          setInventoryError('');
        }
      }
    } catch (loadError) {
      console.error('Failed to load store requisitions:', loadError);
      setError(loadError.message || 'Unable to load store requisitions.');
    } finally {
      setLoading(false);
    }
  }, [canCreate, token]);

  useEffect(() => {
    void Promise.resolve().then(loadRequisitions);
  }, [loadRequisitions]);

  const handleItemChange = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, [field]: value }
        : item
    )));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        reason,
        items: items.map((item) => ({
          ...item,
          itemCode: item.itemCode.trim(),
          itemDescription: item.itemDescription.trim(),
          itemCategory: item.itemCategory,
          requestedQty: Number(item.requestedQty),
        })),
      };
      const response = await fetch('/api/requisitions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result.data) {
        throw new Error(result?.message || result?.error || `Unable to submit requisition (${response.status}).`);
      }
      setHistory((current) => [result.data, ...current.filter((entry) => entry._id !== result.data._id)]);
      setItems([blankItem()]);
      setReason('Routine Restock');
      setNotice(`Requisition ${result.data.requisitionNo} submitted successfully.`);
      setActiveTab('history');
    } catch (submitError) {
      console.error('Failed to submit store requisition:', submitError);
      setError(submitError.message || 'Unable to submit store requisition.');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => setItems((current) => [...current, blankItem()]);
  const removeItem = (index) => setItems((current) => (
    current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current
  ));

  const addLowStockItem = (inventoryItem) => {
    const suggestedQty = Math.max(
      1,
      Number(inventoryItem.effectiveReorderLevel || 0) - Number(inventoryItem.availableQuantity || 0),
    );
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.itemCode.toLowerCase() === String(inventoryItem.itemCode || '').toLowerCase());
      if (existingIndex < 0) {
        return [...current, {
          itemCode: inventoryItem.itemCode || '',
          itemDescription: inventoryItem.itemName || '',
          uom: inventoryItem.unit || 'EA',
          itemCategory: inventoryItem.category || 'Medical Supplies',
          requestedQty: suggestedQty,
        }];
      }
      return current.map((item, index) => (
        index === existingIndex ? { ...item, requestedQty: Math.max(Number(item.requestedQty) || 0, suggestedQty) } : item
      ));
    });
    setNotice(`${inventoryItem.itemName} added to the requisition form.`);
    setError('');
    setActiveTab('new');
  };

  const openWorkflow = (request) => {
    setWorkflow({
      requestId: request._id,
      reviews: request.items.map((item) => ({ requisitionItemId: item._id, approvedQty: item.approvedQty || item.requestedQty })),
      issues: request.items.map((item) => ({ requisitionItemId: item._id, quantity: Math.max(0, item.approvedQty - item.issuedQty) })),
      receipts: request.items.map((item) => ({
        requisitionItemId: item._id,
        quantity: Math.max(0, item.issuedQty - item.receivedQty),
        batchNumber: '',
        serialNumber: '',
        expiryDate: '',
        unitPrice: 0,
      })),
      model22Reference: '',
      approvalRemark: '',
    });
    setError('');
    setNotice('');
  };

  const updateWorkflow = (group, index, field, value) => {
    setWorkflow((current) => ({
      ...current,
      [group]: current[group].map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, [field]: ['quantity', 'approvedQty', 'unitPrice'].includes(field) ? Number(value) : value }
          : item
      )),
    }));
  };

  const submitWorkflow = async (requestId, endpoint, payload, successMessage) => {
    setProcessing(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/requisitions/${encodeURIComponent(requestId)}/${endpoint}`, {
        method: 'PATCH',
        headers: {
          Authorization: ['Bearer', token].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to process requisition (${response.status}).`);
      }
      setNotice(result.message || successMessage);
      setWorkflow(null);
      await loadRequisitions();
    } catch (actionError) {
      console.error(`Failed to process requisition ${endpoint}:`, actionError);
      setError(actionError.message || 'Unable to process requisition.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="min-h-screen space-y-5 bg-slate-100 p-4 text-xs sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-slate-800">Store Requisition</h1>
          <p className="mt-1 text-[11px] text-slate-500">Request drugs and supplies from the MAU Main Medical Store</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && <button type="button" onClick={() => { setActiveTab('new'); setError(''); setNotice(''); }} className={`rounded-lg px-3.5 py-2 font-bold transition ${activeTab === 'new' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>New Request</button>}
          <button type="button" onClick={() => { setActiveTab('history'); setError(''); setNotice(''); }} className={`rounded-lg px-3.5 py-2 font-bold transition ${activeTab === 'history' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Request History</button>
          <button type="button" aria-label="Refresh requisitions" disabled={loading} onClick={() => void loadRequisitions()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {activeTab === 'new' && (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 border-b border-slate-200 pb-4 sm:grid-cols-2">
            <label className="block space-y-1 font-bold text-slate-700">
              Requisition Reason / Priority
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm font-normal">
                <option value="Routine Restock">Routine Restock</option>
                <option value="Emergency Shortage">Emergency Shortage</option>
                <option value="Seasonal Outbreak">Seasonal Outbreak</option>
              </select>
            </label>
            <label className="block space-y-1 font-bold text-slate-700">
              Requested By
              <input type="text" value={user?.name || ''} readOnly className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm font-normal" />
            </label>
          </div>

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-bold text-amber-900">Low / Out-of-Stock Suggestions</h2><p className="mt-1 text-[11px] text-amber-800">Suggested quantity restores stock to the configured reorder level.</p></div>
              <span className="rounded-full bg-white px-2.5 py-1 font-bold text-amber-800">{inventory.filter((item) => ['low_stock', 'out_of_stock'].includes(item.computedStatus)).length} items</span>
            </div>
            {inventoryError && <p role="status" className="mt-3 text-amber-900">{inventoryError}</p>}
            {!inventoryError && inventory.length === 0 && <p className="mt-3 text-amber-900">No stock suggestions are currently available.</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {inventory.filter((item) => ['low_stock', 'out_of_stock'].includes(item.computedStatus)).map((item) => (
                <article key={item._id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{item.itemName}</p>
                    <p className="text-[11px] text-slate-500">{item.itemCode || 'No item code'} · Available {item.availableQuantity ?? 0} / reorder {item.effectiveReorderLevel ?? 0} {item.unit}</p>
                  </div>
                  <button type="button" onClick={() => addLowStockItem(item)} disabled={!item.itemCode} title={!item.itemCode ? 'Add an item code in Inventory before requesting this item.' : ''} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-2 py-1.5 font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-50"><PackagePlus className="h-3.5 w-3.5" /> Add</button>
                </article>
              ))}
            </div>
          </section>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-slate-800">Requested Items</h2>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 font-bold text-sky-700 hover:bg-sky-200"><Plus className="h-3.5 w-3.5" /> Add Item</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-b border-slate-200 text-slate-500"><tr>
                  <th className="pb-2 pr-2">Item Code</th><th className="pb-2 pr-2">Item Description</th><th className="pb-2 pr-2">UOM</th><th className="pb-2 pr-2">Requested Qty</th><th className="pb-2 text-center">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="py-2 pr-2"><input type="text" placeholder="Item code" value={item.itemCode} onChange={(event) => handleItemChange(index, 'itemCode', event.target.value)} className="w-full rounded border border-slate-300 p-2" required maxLength={80} /></td>
                      <td className="py-2 pr-2"><input type="text" placeholder="Medicine / supply description" value={item.itemDescription} onChange={(event) => handleItemChange(index, 'itemDescription', event.target.value)} className="w-full rounded border border-slate-300 p-2" required maxLength={200} /><input type="text" aria-label="Item category" placeholder="Category (optional)" value={item.itemCategory} onChange={(event) => handleItemChange(index, 'itemCategory', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 text-[11px]" maxLength={120} /></td>
                      <td className="py-2 pr-2">
                        <select value={item.uom} onChange={(event) => handleItemChange(index, 'uom', event.target.value)} className="rounded border border-slate-300 p-2">
                          <option value="PKT">PKT</option><option value="EA">EA</option><option value="LT">LT</option><option value="Tablet">Tablet</option><option value="Bottle">Bottle</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2"><input type="number" min="1" step="1" value={item.requestedQty} onChange={(event) => handleItemChange(index, 'requestedQty', event.target.value)} className="w-28 rounded border border-slate-300 p-2 font-bold text-sky-700" required /></td>
                      <td className="py-2 text-center"><button type="button" aria-label={`Remove item ${index + 1}`} onClick={() => removeItem(index)} disabled={items.length === 1} className="rounded p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50">
              <Send className="h-4 w-4" />{saving ? 'Submitting…' : 'Submit Requisition'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'history' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-800">Requisition History</h2><p className="mt-1 text-slate-500">Requests submitted to the Main Store</p></header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-slate-50 text-slate-500"><tr>
                <th className="p-3">Requisition No.</th><th className="p-3">Date</th><th className="p-3">Requested By</th><th className="p-3">Reason</th><th className="p-3">Status</th><th className="p-3">Model 22 Ref</th><th className="p-3">Items</th><th className="p-3">Workflow</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan="8" className="p-8 text-center text-slate-500">Loading requisition history…</td></tr>
                  : history.length ? history.map((request) => {
                    const canReview = canManage && ['Pending Approval', 'Partially Issued', 'Partially Received'].includes(request.status);
                    const canIssue = canManage && ['Approved', 'Partially Issued', 'Partially Received', 'Issued', 'Issued (Model 22)'].includes(request.status)
                      && request.items.some((item) => Number(item.approvedQty) > Number(item.issuedQty));
                    const canReceive = canCreate && ['Partially Issued', 'Issued', 'Issued (Model 22)', 'Partially Received'].includes(request.status)
                      && request.items.some((item) => Number(item.issuedQty) > Number(item.receivedQty));
                    const isOpen = workflow?.requestId === request._id;
                    return (
                      <Fragment key={request._id}>
                        <tr className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-sky-700">{request.requisitionNo}</td>
                          <td className="p-3 text-slate-600">{formatDate(request.createdAt)}</td>
                          <td className="p-3 text-slate-600">{request.requestedBy || '—'}</td>
                          <td className="p-3 font-semibold text-slate-800">{request.reason}</td>
                          <td className="p-3"><StatusBadge status={request.status} /></td>
                          <td className="p-3 font-mono text-slate-600">{(request.model22Issues || []).map((entry) => entry.model22Reference).join(', ') || request.model22Reference || '—'}</td>
                          <td className="p-3">{Array.isArray(request.items) ? request.items.length : 0} items</td>
                          <td className="p-3">
                            {(canReview || canIssue || canReceive) && (
                              <button type="button" onClick={() => isOpen ? setWorkflow(null) : openWorkflow(request)} className="rounded-md bg-sky-100 px-2.5 py-1.5 font-bold text-sky-800 hover:bg-sky-200">
                                {isOpen ? 'Close' : canReview ? 'Review' : canIssue ? 'Record Issue' : 'Confirm Receipt'}
                              </button>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="8" className="p-0">
                            <div className="border-t border-slate-100 px-4 py-2">
                              <p className="text-[11px] text-slate-600">
                                {request.items.map((item) => `${item.itemDescription}: requested ${item.requestedQty}, approved ${item.approvedQty || 0}, issued ${item.issuedQty || 0}, received ${item.receivedQty || 0}`).join(' · ')}
                              </p>
                              {request.approvalRemark && <p className="mt-1 text-[11px] text-slate-500">Store remark: {request.approvalRemark}</p>}
                              {isOpen && workflow && (
                                <div className="mt-3 space-y-3 rounded-lg border border-sky-100 bg-slate-50 p-4">
                                  {canReview && (
                                    <section className="space-y-2">
                                      <h3 className="font-bold text-slate-800">Approve requested quantities</h3>
                                      <div className="overflow-x-auto">
                                        <table className="w-full min-w-[560px] text-left">
                                          <thead><tr className="text-slate-500"><th className="p-2">Item</th><th className="p-2">Requested</th><th className="p-2">Approved</th></tr></thead>
                                          <tbody>{request.items.map((item, index) => (
                                            <tr key={item._id}>
                                              <td className="p-2">{item.itemDescription}</td><td className="p-2">{item.requestedQty} {item.uom}</td>
                                              <td className="p-2"><input type="number" min={item.issuedQty || 0} max={item.requestedQty} step="any" value={workflow.reviews[index].approvedQty} onChange={(event) => updateWorkflow('reviews', index, 'approvedQty', event.target.value)} className="w-28 rounded border border-slate-300 p-2" /></td>
                                            </tr>
                                          ))}</tbody>
                                        </table>
                                      </div>
                                      <input value={workflow.approvalRemark} onChange={(event) => setWorkflow((current) => ({ ...current, approvalRemark: event.target.value }))} placeholder="Approval / rejection remark" maxLength={500} className="w-full rounded border border-slate-300 p-2" />
                                      <div className="flex flex-wrap gap-2">
                                        <button type="button" disabled={processing} onClick={() => void submitWorkflow(request._id, 'decision', { decision: 'approve', approvalRemark: workflow.approvalRemark, items: workflow.reviews }, 'Request approved.')} className="rounded bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">Approve</button>
                                        {request.status === 'Pending Approval' && <button type="button" disabled={processing} onClick={() => void submitWorkflow(request._id, 'decision', { decision: 'reject', approvalRemark: workflow.approvalRemark }, 'Request rejected.')} className="rounded bg-rose-700 px-3 py-2 font-bold text-white disabled:opacity-50">Reject</button>}
                                      </div>
                                    </section>
                                  )}
                                  {canIssue && (
                                    <section className="space-y-2 border-t border-slate-200 pt-3">
                                      <h3 className="font-bold text-slate-800">Record Model 22 issue</h3>
                                      <input required value={workflow.model22Reference} onChange={(event) => setWorkflow((current) => ({ ...current, model22Reference: event.target.value }))} placeholder="Model 22 issue voucher number" maxLength={100} className="w-full rounded border border-slate-300 p-2 sm:max-w-sm" />
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {request.items.map((item, index) => (
                                          <label key={item._id} className="rounded border border-slate-200 bg-white p-3">
                                            <span className="block font-semibold">{item.itemDescription} · outstanding approved {Math.max(0, item.approvedQty - item.issuedQty)} {item.uom}</span>
                                            <input type="number" min="0" max={Math.max(0, item.approvedQty - item.issuedQty)} step="any" value={workflow.issues[index].quantity} onChange={(event) => updateWorkflow('issues', index, 'quantity', event.target.value)} className="mt-2 w-full rounded border border-slate-300 p-2" />
                                          </label>
                                        ))}
                                      </div>
                                      <button type="button" disabled={processing} onClick={() => void submitWorkflow(request._id, 'issue', { model22Reference: workflow.model22Reference, items: workflow.issues.filter((item) => item.quantity > 0) }, 'Model 22 issue recorded.')} className="rounded bg-sky-700 px-3 py-2 font-bold text-white disabled:opacity-50">Save Model 22 Issue</button>
                                    </section>
                                  )}
                                  {canReceive && (
                                    <section className="space-y-2 border-t border-slate-200 pt-3">
                                      <h3 className="font-bold text-slate-800">Cross-check and confirm physical receipt</h3>
                                      <p className="text-[11px] text-slate-600">Confirm only quantities physically received against the Model 22 voucher. Batch, expiry, and unit price are required to update stock safely.</p>
                                      <div className="space-y-3">
                                        {request.items.map((item, index) => {
                                          const outstanding = Math.max(0, item.issuedQty - item.receivedQty);
                                          if (!outstanding) return null;
                                          return (
                                            <div key={item._id} className="grid gap-2 rounded border border-slate-200 bg-white p-3 sm:grid-cols-2 xl:grid-cols-3">
                                              <p className="sm:col-span-2 xl:col-span-3"><strong>{item.itemDescription}</strong> · Issued {item.issuedQty} · Already received {item.receivedQty || 0} · Outstanding {outstanding} {item.uom}</p>
                                              <label>Received quantity<input type="number" min="0.001" max={outstanding} step="any" value={workflow.receipts[index].quantity} onChange={(event) => updateWorkflow('receipts', index, 'quantity', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" required /></label>
                                              <label>Batch / Lot number<input value={workflow.receipts[index].batchNumber} onChange={(event) => updateWorkflow('receipts', index, 'batchNumber', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" required maxLength={100} /></label>
                                              <label>Serial number (optional)<input value={workflow.receipts[index].serialNumber} onChange={(event) => updateWorkflow('receipts', index, 'serialNumber', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" maxLength={100} /></label>
                                              <label>Expiry date<input type="date" value={workflow.receipts[index].expiryDate} onChange={(event) => updateWorkflow('receipts', index, 'expiryDate', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" required /></label>
                                              <label>Unit price (ETB)<input type="number" min="0" step="0.01" value={workflow.receipts[index].unitPrice} onChange={(event) => updateWorkflow('receipts', index, 'unitPrice', event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" required /></label>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <button type="button" disabled={processing} onClick={() => void submitWorkflow(request._id, 'receive', { model22Reference: request.model22Reference, items: workflow.receipts.filter((item) => item.quantity > 0) }, 'Receipt confirmed and stock updated.')} className="rounded bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">Confirm Receipt &amp; Update Inventory</button>
                                    </section>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  }) : <tr><td colSpan="8" className="p-8 text-center text-slate-500"><FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />No store requisitions have been submitted yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

function StatusBadge({ status }) {
  const Icon = status === 'Received' ? CheckCircle2 : status === 'Pending Approval' ? Clock : FileText;
  return <span className={`inline-flex w-max items-center gap-1 rounded-full px-2.5 py-1 font-bold ${statusClassNames[status] || 'bg-slate-100 text-slate-700'}`}><Icon className="h-3.5 w-3.5" />{status || 'Unknown'}</span>;
}

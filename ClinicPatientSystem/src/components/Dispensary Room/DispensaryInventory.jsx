import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ClipboardList, Package, Printer, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatMoney = (value) => `${(Number(value) || 0).toFixed(2)} ETB`;

const statusLabels = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

const statusStyles = {
  in_stock: 'bg-emerald-100 text-emerald-800',
  low_stock: 'bg-amber-100 text-amber-800',
  out_of_stock: 'bg-rose-100 text-rose-800',
};

const initialReceipt = {
  itemCode: '',
  itemDescription: '',
  uom: '',
  subInventory: 'Clinical Pharmacy',
  itemCategory: '',
  batchNumber: '',
  serialNumber: '',
  quantity: '',
  unitPrice: '',
  expiryDate: '',
  modelNumber: '',
  transactionType: 'PO Receipt',
  source: '',
  poNumber: '',
  buyer: '',
  sequenceFrom: '',
  sequenceTo: '',
  remark: '',
};

const initialIssue = {
  inventoryItemId: '',
  batchNumber: '',
  serialNumber: '',
  quantity: '',
  modelNumber: '',
  transactionType: 'Move Order Issue',
  destination: '',
  sequenceFrom: '',
  sequenceTo: '',
  remark: '',
};

const DispensaryInventory = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('stock');
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expiryWarningDays, setExpiryWarningDays] = useState(90);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [receipt, setReceipt] = useState(initialReceipt);
  const [issue, setIssue] = useState(initialIssue);
  const [printDocument, setPrintDocument] = useState(null);

  const loadInventory = useCallback(async () => {
    const response = await fetch('/api/inventory/stock', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !Array.isArray(result.data)) {
      throw new Error(result?.message || `Unable to load dispensary inventory (${response.status}).`);
    }
    setInventory(result.data);
    setExpiryWarningDays(Number(result.expiryWarningDays) || 90);
    setIssue((current) => ({
      ...current,
      inventoryItemId: current.inventoryItemId || result.data[0]?._id || '',
    }));
  }, [token]);

  const loadTransactions = useCallback(async (modelType = '') => {
    const query = modelType ? `?modelType=${encodeURIComponent(modelType)}` : '';
    const response = await fetch(`/api/inventory/transactions${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !Array.isArray(result.data)) {
      throw new Error(result?.message || `Unable to load inventory transactions (${response.status}).`);
    }
    setTransactions(result.data);
  }, [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadInventory();
      if (activeTab === 'transactions') await loadTransactions();
      if (activeTab === 'model19' || activeTab === 'model22') {
        await loadTransactions(activeTab === 'model19' ? 'Model 19' : 'Model 22');
      }
    } catch (loadError) {
      console.error('Failed to load dispensary inventory:', loadError);
      setError(loadError.message || 'Unable to load dispensary inventory.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadInventory, loadTransactions]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (!printDocument) return undefined;
    const clearPrintDocument = () => setPrintDocument(null);
    window.addEventListener('afterprint', clearPrintDocument);
    window.print();
    return () => window.removeEventListener('afterprint', clearPrintDocument);
  }, [printDocument]);

  const filteredInventory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
      const matchesSearch = !query
        || [item.itemName, item.itemCode, item.category, item.storageLocation]
          .some((value) => String(value || '').toLocaleLowerCase().includes(query))
        || (item.batches || []).some((batch) => (
          String(batch.batchNumber || '').toLocaleLowerCase().includes(query)
          || String(batch.serialNumber || '').toLocaleLowerCase().includes(query)
        ));
      return matchesSearch && (statusFilter === 'all' || item.computedStatus === statusFilter);
    });
  }, [inventory, search, statusFilter]);
  const stockRows = useMemo(() => filteredInventory.flatMap((item) => {
    const batches = (item.batches || []).filter((batch) => Number(batch.quantity) > 0);
    return batches.length
      ? batches.map((batch) => ({ item, batch }))
      : [{ item, batch: null }];
  }), [filteredInventory]);

  const summary = useMemo(() => ({
    total: inventory.length,
    inStock: inventory.filter((item) => item.computedStatus === 'in_stock').length,
    lowStock: inventory.filter((item) => item.computedStatus === 'low_stock').length,
    outOfStock: inventory.filter((item) => item.computedStatus === 'out_of_stock').length,
    expiryAlerts: inventory.filter((item) => item.expired || item.expiringSoon).length,
  }), [inventory]);

  const selectedIssueItem = inventory.find((item) => item._id === issue.inventoryItemId);
  const issueBatches = (selectedIssueItem?.batches || []).filter((batch) => (
    Number(batch.quantity) > 0 && batch.expiryDate && !batch.expired
  ));
  const selectedIssueBatch = issueBatches.find((batch) => batch.batchNumber === issue.batchNumber);
  const issueBatchAllocation = (issue.batchNumber
    ? [selectedIssueBatch].filter(Boolean)
    : issueBatches
  ).reduce((allocation, batch) => {
    const issued = Math.min(allocation.remaining, Number(batch.quantity));
    allocation.remaining -= issued;
    allocation.totalAmount += issued * (Number(batch.unitPrice) || 0);
    if (issued > 0) allocation.unitPrices.add(Number(batch.unitPrice) || 0);
    return allocation;
  }, { remaining: Number(issue.quantity) || 0, totalAmount: 0, unitPrices: new Set() });
  const issueUnitPriceLabel = issueBatchAllocation.unitPrices.size === 1
    ? `${[...issueBatchAllocation.unitPrices][0].toFixed(2)} ETB`
    : issueBatchAllocation.unitPrices.size > 1 ? 'Varies by batch' : '—';

  const submitTransaction = async (event, modelType) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const isReceipt = modelType === 'Model 19';
      const endpoint = isReceipt
        ? '/api/inventory/model19-receive'
        : `/api/inventory/model22-issue/${encodeURIComponent(issue.inventoryItemId)}`;
      const payload = isReceipt
        ? {
          ...receipt,
          quantity: Number(receipt.quantity),
          unitPrice: Number(receipt.unitPrice),
        }
        : { ...issue, quantity: Number(issue.quantity) };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Unable to save ${modelType} transaction (${response.status}).`);
      }
      setNotice(result.message || `${modelType} transaction saved.`);
      if (isReceipt) setReceipt(initialReceipt);
      else setIssue((current) => ({ ...initialIssue, inventoryItemId: current.inventoryItemId }));
      await loadInventory();
      await loadTransactions(modelType);
    } catch (saveError) {
      console.error(`Failed to save ${modelType} inventory transaction:`, saveError);
      setError(saveError.message || `Unable to save ${modelType} transaction.`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'stock', label: 'Current Stock' },
    { id: 'model19', label: 'Model 19 · Receipt' },
    { id: 'model22', label: 'Model 22 · Issue' },
    { id: 'transactions', label: 'Transaction History' },
  ];

  return (
    <section className="min-h-screen space-y-5 bg-slate-100 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sky-100 p-2.5 text-sky-700"><Package className="h-5 w-5" /></div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Dispensary Inventory &amp; Stock Management</h1>
            <p className="text-[11px] text-slate-500">Mekdela Amba University Clinic · Model 19 receipts and Model 22 issues</p>
          </div>
        </div>
        <button type="button" aria-label="Refresh inventory" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <nav aria-label="Inventory sections" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setError(''); setNotice(''); }} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === tab.id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {activeTab === 'stock' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Total items', summary.total, 'bg-sky-50 text-sky-800'],
              ['In stock', summary.inStock, 'bg-emerald-50 text-emerald-800'],
              ['Low stock', summary.lowStock, 'bg-amber-50 text-amber-800'],
              ['Out of stock', summary.outOfStock, 'bg-rose-50 text-rose-800'],
              ['Expiry alerts', summary.expiryAlerts, 'bg-orange-50 text-orange-800'],
            ].map(([label, count, className]) => (
              <article key={label} className={`rounded-xl border border-white p-4 shadow-sm ${className}`}>
                <p className="text-xs font-semibold">{label}</p>
                <p className="mt-1 text-2xl font-bold">{loading ? '—' : count}</p>
              </article>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div className="relative min-w-56 flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, code, batch, or serial" aria-label="Search dispensary inventory" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Stock status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="all">All stock</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option>
                </select>
              </label>
              <button type="button" onClick={() => setPrintDocument({ kind: 'on-hand', reportDate: new Date().toISOString() })} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50">
                <Printer className="h-4 w-4" /> Print On-Hand Report
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1350px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-600"><tr>
                  <th className="p-3">S/No.</th><th className="p-3">Item Code</th><th className="p-3">Item Description</th><th className="p-3">UOM</th><th className="p-3">Sub Inventory / Category</th><th className="p-3">Lot / Batch No.</th><th className="p-3">Serial No.</th><th className="p-3">Quantity</th><th className="p-3">Unit Price</th><th className="p-3">Total Amount</th><th className="p-3">Expiry</th><th className="p-3">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan="12" className="p-8 text-center text-slate-500">Loading dispensary inventory…</td></tr>
                    : stockRows.length ? stockRows.map(({ item, batch }, index) => {
                      const unitPrice = Number(batch?.unitPrice) || 0;
                      const batchExpired = Boolean(batch?.expired);
                      const batchExpiringSoon = Boolean(batch?.expiringSoon);
                      return (
                        <tr key={`${item._id}-${batch?._id || 'unbatched'}`} className="align-top hover:bg-slate-50">
                          <td className="p-3">{index + 1}</td>
                          <td className="p-3 font-mono text-slate-600">{item.itemCode || '—'}</td>
                          <td className="p-3 font-semibold text-slate-800">{item.itemName}</td>
                          <td className="p-3 text-slate-600">{item.unit || '—'}</td>
                          <td className="p-3 text-slate-600">{item.storageLocation || 'Clinical Pharmacy'}<span className="block text-[11px] text-slate-400">{item.category || 'Other'}</span></td>
                          <td className="p-3 font-mono text-slate-600">{batch?.batchNumber || '—'}</td>
                          <td className="p-3 text-slate-600">{batch?.serialNumber || '—'}</td>
                          <td className="p-3 font-bold">{batch ? `${batch.quantity} ${item.unit || ''}` : `${item.quantity ?? 0} ${item.unit || ''}`}<span className="block text-[11px] font-normal text-slate-500">Available: {item.availableQuantity ?? 0}</span></td>
                          <td className="p-3">{unitPrice ? `${unitPrice.toFixed(2)} ETB` : '—'}</td>
                          <td className="p-3">{unitPrice && batch ? `${(unitPrice * batch.quantity).toFixed(2)} ETB` : '—'}</td>
                          <td className="p-3"><CalendarDays className="mr-1 inline h-3 w-3" />{formatDate(batch?.expiryDate || item.expiryDate)}</td>
                          <td className="p-3"><span className={`inline-flex rounded-full px-2 py-1 font-bold ${statusStyles[item.computedStatus] || 'bg-slate-100 text-slate-700'}`}>{statusLabels[item.computedStatus] || 'Unknown'}</span>{batchExpired && <span className="mt-1 flex items-center gap-1 text-rose-700"><AlertTriangle className="h-3 w-3" />Expired batch</span>}{batchExpiringSoon && <span className="mt-1 flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" />Expires within {expiryWarningDays} days</span>}</td>
                        </tr>
                      );
                    }) : <tr><td colSpan="12" className="p-8 text-center text-slate-500">{inventory.length ? 'No inventory items match these filters.' : 'No inventory items have been recorded.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">Showing {loading ? '—' : filteredInventory.length} of {loading ? '—' : inventory.length} stock items</footer>
          </div>
        </>
      )}

      {activeTab === 'model19' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <form onSubmit={(event) => void submitTransaction(event, 'Model 19')} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b pb-3"><h2 className="font-bold text-slate-900">Goods Receiving · Model 19</h2><p className="mt-1 text-xs text-slate-500">Record a supplier or store receipt and add its lot to available pharmacy stock.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Model 19 Number" required value={receipt.modelNumber} onChange={(value) => setReceipt({ ...receipt, modelNumber: value })} />
              <Field label="Transaction Type" required value={receipt.transactionType} onChange={(value) => setReceipt({ ...receipt, transactionType: value })} />
              <Field label="Source / Supplier" required value={receipt.source} onChange={(value) => setReceipt({ ...receipt, source: value })} placeholder="Main store / supplier" />
              <Field label="PO Number" value={receipt.poNumber} onChange={(value) => setReceipt({ ...receipt, poNumber: value })} />
              <Field label="Buyer" value={receipt.buyer} onChange={(value) => setReceipt({ ...receipt, buyer: value })} />
              <Field label="Sub Inventory" required value={receipt.subInventory} onChange={(value) => setReceipt({ ...receipt, subInventory: value })} />
              <Field label="Item Code" required value={receipt.itemCode} onChange={(value) => setReceipt({ ...receipt, itemCode: value })} />
              <Field label="Item Description" required value={receipt.itemDescription} onChange={(value) => setReceipt({ ...receipt, itemDescription: value })} />
              <Field label="UOM" required value={receipt.uom} onChange={(value) => setReceipt({ ...receipt, uom: value })} placeholder="PKT, EA, Tablet" />
              <Field label="Item Category" required value={receipt.itemCategory} onChange={(value) => setReceipt({ ...receipt, itemCategory: value })} />
              <Field label="Lot / Batch No." required value={receipt.batchNumber} onChange={(value) => setReceipt({ ...receipt, batchNumber: value })} />
              <Field label="Serial No." value={receipt.serialNumber} onChange={(value) => setReceipt({ ...receipt, serialNumber: value })} />
              <Field label="Quantity Received" type="number" min="0.001" step="any" required value={receipt.quantity} onChange={(value) => setReceipt({ ...receipt, quantity: value })} />
              <Field label="Unit Price (ETB)" type="number" min="0" step="0.01" required value={receipt.unitPrice} onChange={(value) => setReceipt({ ...receipt, unitPrice: value })} />
              <Field label="Expiry Date" type="date" required value={receipt.expiryDate} onChange={(value) => setReceipt({ ...receipt, expiryDate: value })} />
              <Field label="Printed Pad Sequence From" value={receipt.sequenceFrom} onChange={(value) => setReceipt({ ...receipt, sequenceFrom: value })} />
              <Field label="Printed Pad Sequence To" value={receipt.sequenceTo} onChange={(value) => setReceipt({ ...receipt, sequenceTo: value })} />
              <Field label="Remark" value={receipt.remark} onChange={(value) => setReceipt({ ...receipt, remark: value })} />
              <div className="rounded-lg bg-sky-50 p-3 text-xs"><span className="font-semibold text-sky-900">Total Amount</span><strong className="mt-1 block text-base text-sky-900">{((Number(receipt.quantity) || 0) * (Number(receipt.unitPrice) || 0)).toFixed(2)} ETB</strong></div>
            </div>
            <button type="submit" disabled={saving || loading} className="rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50">{saving ? 'Saving receipt…' : 'Receive Stock (Model 19)'}</button>
          </form>
          <TransactionList title="Model 19 Receipt History" transactions={transactions.filter((entry) => entry.modelType === 'Model 19')} onPrint={setPrintDocument} />
        </div>
      )}

      {activeTab === 'model22' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <form onSubmit={(event) => void submitTransaction(event, 'Model 22')} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b pb-3"><h2 className="font-bold text-slate-900">Articles / Property Issue · Model 22</h2><p className="mt-1 text-xs text-slate-500">Issue pharmacy stock to a destination and retain its batch and value record.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Model 22 Number" required value={issue.modelNumber} onChange={(value) => setIssue({ ...issue, modelNumber: value })} />
              <Field label="Transaction Type" required value={issue.transactionType} onChange={(value) => setIssue({ ...issue, transactionType: value })} />
              <Field label="Printed Pad Sequence From" value={issue.sequenceFrom} onChange={(value) => setIssue({ ...issue, sequenceFrom: value })} />
              <Field label="Printed Pad Sequence To" value={issue.sequenceTo} onChange={(value) => setIssue({ ...issue, sequenceTo: value })} />
              <label className="block space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">Item Description / Code
                <select required value={issue.inventoryItemId} onChange={(event) => setIssue({ ...issue, inventoryItemId: event.target.value, batchNumber: '' })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">Select inventory item</option>
                  {inventory.map((item) => <option key={item._id} value={item._id}>{item.itemCode ? `${item.itemCode} · ` : ''}{item.itemName} ({item.availableQuantity ?? 0} {item.unit})</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold text-slate-700">Lot / Batch No.
                <select value={issue.batchNumber} onChange={(event) => setIssue({ ...issue, batchNumber: event.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">Auto-select earliest valid batch</option>
                  {issueBatches.map((batch) => <option key={batch._id || batch.batchNumber} value={batch.batchNumber}>{batch.batchNumber || 'Unnumbered'} · {batch.quantity} {selectedIssueItem?.unit} · expires {formatDate(batch.expiryDate)}</option>)}
                </select>
              </label>
              <Field label="Serial No. (if applicable)" value={issue.serialNumber} onChange={(value) => setIssue({ ...issue, serialNumber: value })} />
              <Field label={`Quantity to Issue${selectedIssueItem ? ` (${selectedIssueItem.unit})` : ''}`} type="number" min="0.001" step="any" max={selectedIssueBatch?.quantity ?? selectedIssueItem?.availableQuantity ?? undefined} required value={issue.quantity} onChange={(value) => setIssue({ ...issue, quantity: value })} />
              <Field label="Destination Department / Store" required value={issue.destination} onChange={(value) => setIssue({ ...issue, destination: value })} />
              <Field label="Remark" value={issue.remark} onChange={(value) => setIssue({ ...issue, remark: value })} />
            </div>
            {selectedIssueItem && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Available: <strong>{selectedIssueItem.availableQuantity ?? 0} {selectedIssueItem.unit}</strong>. Stock will be deducted from the selected batch or earliest-expiring valid batches. Items without recorded, unexpired batches cannot be issued.</p>}
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2">
              <p>Unit Price: <strong>{issueUnitPriceLabel}</strong></p>
              <p>Total Amount: <strong>{issueBatchAllocation.remaining > 0 ? 'Insufficient batch quantity' : `${issueBatchAllocation.totalAmount.toFixed(2)} ETB`}</strong></p>
            </div>
            <button type="submit" disabled={saving || loading || !inventory.length} className="rounded-lg bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50">{saving ? 'Issuing stock…' : 'Issue Stock (Model 22)'}</button>
          </form>
          <TransactionList title="Model 22 Issue History" transactions={transactions.filter((entry) => entry.modelType === 'Model 22')} onPrint={setPrintDocument} />
        </div>
      )}

      {activeTab === 'transactions' && <TransactionList title="Inventory Transaction History" transactions={transactions} onPrint={setPrintDocument} />}
      <InventoryPrintDocument document={printDocument} stockRows={stockRows} />
      <style>{`
        .inventory-print-document { display: none; }
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          .inventory-print-document,
          .inventory-print-document * { visibility: visible !important; }
          .inventory-print-document {
            display: block !important;
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            color: #111827 !important;
            background: white !important;
            font-family: Arial, sans-serif !important;
            font-size: 9px !important;
          }
          .inventory-print-document table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .inventory-print-document th, .inventory-print-document td { border: 1px solid #222; padding: 4px; overflow-wrap: anywhere; vertical-align: top; }
          .inventory-print-document th { text-align: center; }
          .inventory-print-document .print-signatures { display: flex; justify-content: space-between; gap: 24px; margin-top: 32px; }
        }
      `}</style>
      {loading && <p role="status" className="text-center text-xs text-slate-500">Loading inventory data…</p>}
    </section>
  );
};

function Field({ label, value, onChange, type = 'text', required = false, ...props }) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-slate-700">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} {...props} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
    </label>
  );
}

function InventoryPrintDocument({ document, stockRows }) {
  if (!document) return null;

  if (document.kind === 'on-hand') {
    const totalValue = stockRows.reduce((total, { item, batch }) => (
      total + (Number(batch?.quantity ?? item.quantity) || 0) * (Number(batch?.unitPrice) || 0)
    ), 0);
    return (
      <article className="inventory-print-document">
        <PrintHeader title="On Hand Quantity Report" />
        <p><strong>Operating Unit:</strong> Mekdela Amba University Clinic</p>
        <p><strong>Report Date:</strong> {formatDate(document.reportDate)} <strong>Store / Sub-Inventory:</strong> Clinical Pharmacy</p>
        <table>
          <thead><tr>
            <th>S/No.</th><th>Item Code</th><th>Item Description</th><th>UOM</th><th>Sub Inventory</th><th>Item Category</th><th>Lot / Batch No.</th><th>Serial No.</th><th>Quantity</th><th>Unit Price</th><th>Total Amount</th><th>Remark</th>
          </tr></thead>
          <tbody>{stockRows.length ? stockRows.map(({ item, batch }, index) => {
            const quantity = Number(batch?.quantity ?? item.quantity) || 0;
            const unitPrice = Number(batch?.unitPrice) || 0;
            return (
              <tr key={`${item._id}-${batch?._id || 'unbatched'}`}>
                <td>{index + 1}</td><td>{item.itemCode || ''}</td><td>{item.itemName}</td><td>{item.unit || ''}</td>
                <td>{item.storageLocation || 'Clinical Pharmacy'}</td><td>{item.category || ''}</td>
                <td>{batch?.batchNumber || ''}</td><td>{batch?.serialNumber || ''}</td><td>{quantity}</td>
                <td>{formatMoney(unitPrice)}</td><td>{formatMoney(quantity * unitPrice)}</td><td />
              </tr>
            );
          }) : <tr><td colSpan="12">No stock records found.</td></tr>}</tbody>
          <tfoot><tr><th colSpan="10">Total Inventory Value</th><th>{formatMoney(totalValue)}</th><th /></tr></tfoot>
        </table>
        <div className="print-signatures"><span>Prepared by: ____________________</span><span>Checked by: ____________________</span><span>Approved by: ____________________</span></div>
      </article>
    );
  }

  const transaction = document;
  const isReceipt = transaction.modelType === 'Model 19';
  return (
    <article className="inventory-print-document">
      <PrintHeader title={isReceipt ? 'Receipt for Articles / Property Received' : 'Receipt for Articles / Property Issued'} model={transaction.modelType} />
      <table className="inventory-print-metadata">
        <tbody>
          <tr><th>Model Number</th><td>{transaction.modelNumber || ''}</td><th>{isReceipt ? 'PO Number' : 'Issue Date'}</th><td>{isReceipt ? transaction.poNumber || '' : formatDate(transaction.transactionDate)}</td></tr>
          <tr><th>{isReceipt ? 'Received Date' : 'Transaction Type'}</th><td>{isReceipt ? formatDate(transaction.transactionDate) : transaction.transactionType || ''}</td><th>{isReceipt ? 'Transaction Type' : 'Destination'}</th><td>{isReceipt ? transaction.transactionType || '' : transaction.destination || ''}</td></tr>
          <tr><th>{isReceipt ? 'Source' : 'Source Sub-Inventory'}</th><td>{transaction.source || transaction.items?.[0]?.subInventory || ''}</td><th>{isReceipt ? 'Buyer' : 'Prepared By'}</th><td>{isReceipt ? transaction.buyer || '' : transaction.performedBy || ''}</td></tr>
        </tbody>
      </table>
      <table>
        <thead><tr>
          <th>S/No.</th><th>Item Code</th><th>Item Description</th><th>UOM</th><th>Sub Inventory</th><th>Item Category</th><th>Lot / Batch No.</th><th>Serial No.</th><th>Pad From</th><th>Pad To</th><th>Quantity</th><th>Unit Price</th><th>Total Amount</th><th>Remark</th>
        </tr></thead>
        <tbody>
          {(transaction.items || []).map((item, index) => (
            <tr key={`${item.inventoryItemId || item.itemCode}-${index}`}>
              <td>{index + 1}</td><td>{item.itemCode || ''}</td><td>{item.itemDescription || ''}</td><td>{item.uom || ''}</td>
              <td>{item.subInventory || ''}</td><td>{item.itemCategory || ''}</td><td>{item.batchNumber || ''}</td>
              <td>{item.serialNumber || ''}</td><td>{item.sequenceFrom || ''}</td><td>{item.sequenceTo || ''}</td>
              <td>{item.quantity}</td><td>{formatMoney(item.unitPrice)}</td><td>{formatMoney(item.totalAmount)}</td><td>{item.remark || ''}</td>
            </tr>
          ))}
          <tr><th colSpan="12">Grand Total</th><th>{formatMoney((transaction.items || []).reduce((total, item) => total + (Number(item.totalAmount) || 0), 0))}</th><th /></tr>
        </tbody>
      </table>
      <div className="print-signatures">
        <span>Prepared by: ____________________</span><span>Received / Issued by: ____________________</span><span>Authorized by: ____________________</span>
      </div>
    </article>
  );
}

function PrintHeader({ title, model }) {
  return (
    <header className="mb-3 text-center">
      <p className="font-bold uppercase">Federal Democratic Republic of Ethiopia</p>
      <p className="font-bold">Mekdela Amba University · Clinic</p>
      <h1 className="mt-2 text-lg font-bold uppercase">{title}{model ? ` · ${model}` : ''}</h1>
    </header>
  );
}

function TransactionList({ title, transactions, onPrint }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b p-4"><ClipboardList className="h-4 w-4 text-sky-700" /><h2 className="text-sm font-bold text-slate-800">{title}</h2></header>
      <div className="max-h-[720px] space-y-3 overflow-auto p-4">
        {transactions.length ? transactions.map((transaction) => (
          <article key={transaction._id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div><p className="font-bold text-slate-800">{transaction.modelType} · {transaction.modelNumber}</p><p className="text-[11px] text-slate-500">{transaction.transactionType} · {formatDateTime(transaction.transactionDate)}</p></div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-600">{transaction.performedBy || '—'}</span>
                <button type="button" onClick={() => onPrint(transaction)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"><Printer className="h-3 w-3" /> Print</button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">{transaction.source ? `Source: ${transaction.source}` : ''}{transaction.source && transaction.destination ? ' · ' : ''}{transaction.destination ? `Destination: ${transaction.destination}` : ''}</p>
            <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-slate-700">
              {(transaction.items || []).map((item, index) => <li key={`${item.inventoryItemId}-${index}`}>{item.itemCode ? `${item.itemCode} · ` : ''}{item.itemDescription} · {item.quantity} {item.uom} · Batch {item.batchNumber || '—'} · Serial {item.serialNumber || '—'} · Unit {Number(item.unitPrice || 0).toFixed(2)} ETB · Total {Number(item.totalAmount || 0).toFixed(2)} ETB</li>)}
            </ul>
          </article>
        )) : <p className="p-4 text-center text-xs text-slate-500">No inventory transactions recorded yet.</p>}
      </div>
    </section>
  );
}

export default DispensaryInventory;

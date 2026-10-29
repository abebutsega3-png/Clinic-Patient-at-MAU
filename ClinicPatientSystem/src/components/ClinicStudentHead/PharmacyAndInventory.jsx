import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  Pill, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Search, 
  Download, 
  Calendar, 
  FileText, 
  Clock3,
  Check,
  X,
  PackageCheck,
  MapPin
} from 'lucide-react';
import { updateRequestStatus } from '../../utile/clinicheadapprovalApi.jsx';

const PharmacyAndInventory = () => {
  const { token } = useAuth();
  // States
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    expiringSoonCount: 0,
    outOfStockCount: 0,
    expiredCount: 0,
    pendingPurchaseRequestCount: 0
  });

  const [stockTable, setStockTable] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [dispensingReport, setDispensingReport] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [statusFilter, setStatusFilter] = useState(() => new URLSearchParams(window.location.search).get('statusFilter') || 'all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const [reviewRequest, setReviewRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState('');
  const [approvedQuantity, setApprovedQuantity] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);
  const [notice, setNotice] = useState('');
  const [expiryWarningDays, setExpiryWarningDays] = useState(90);

  const authConfig = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ search: searchQuery, statusFilter });
      const { data } = await axios.get(`/api/pharmacy/overview?${params}`, authConfig);
      setSummary(data.summaryCards || {});
      setExpiryWarningDays(data.expiryWarningDays || 90);
      setStockTable(Array.isArray(data.stockTable) ? data.stockTable : []);
      setPurchaseRequests(Array.isArray(data.purchaseRequests) ? data.purchaseRequests : []);
    } catch (loadError) {
      console.error('Failed to load pharmacy inventory overview:', loadError);
      setError(loadError.response?.data?.message || 'Unable to load pharmacy inventory.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, authConfig]);

  const fetchDispensingReport = useCallback(async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }
      const query = params.size ? `?${params}` : '';
      if (startDate !== endDate && (!startDate || !endDate)) {
        setReportError('Select both a start and end date, or clear both dates for the full report.');
        setDispensingReport([]);
        return;
      }
      const { data } = await axios.get(`/api/pharmacy/dispensing-report${query}`, authConfig);
      setDispensingReport(Array.isArray(data.data) ? data.data : []);
    } catch (loadError) {
      console.error('Failed to load dispensing report:', loadError);
      setReportError(loadError.response?.data?.message || 'Unable to load the dispensing report.');
    } finally {
      setReportLoading(false);
    }
  }, [startDate, endDate, authConfig]);

  useEffect(() => { void Promise.resolve().then(fetchOverviewData); }, [fetchOverviewData]);
  useEffect(() => { void Promise.resolve().then(fetchDispensingReport); }, [fetchDispensingReport]);

  const exportReport = () => {
    const escapeCsvCell = (cell) => {
      const value = String(cell ?? '');
      const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const rows = [
      ['Medicine', 'Times dispensed', 'Quantity dispensed', 'Patients'],
      ...dispensingReport.map((record) => [
        record._id,
        record.totalTimesDispensed,
        record.totalQuantityDispensed,
        record.patientCount
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dispensing-report-${startDate || 'all'}-${endDate || 'dates'}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openReview = (request, action) => {
    setReviewRequest(request);
    setReviewAction(action);
    setApprovedQuantity(String(request.purchase?.quantity ?? ''));
    setReviewComment('');
    setNotice('');
  };

  const submitDecision = async (event) => {
    event.preventDefault();
    if (!reviewRequest || !reviewAction) return;
    if (reviewAction === 'rejected' && !reviewComment.trim()) {
      setError('Enter a reason before rejecting a purchase request.');
      return;
    }
    const quantity = Number(approvedQuantity);
    if (reviewAction === 'approved'
      && (!Number.isInteger(quantity) || quantity < 1 || quantity > reviewRequest.purchase.quantity)) {
      setError(`Enter an approved quantity between 1 and ${reviewRequest.purchase.quantity}.`);
      return;
    }

    setSavingDecision(true);
    setError('');
    try {
      const result = await updateRequestStatus(
        reviewRequest._id,
        reviewAction,
        reviewComment.trim(),
        token,
        'approval',
        reviewAction === 'approved' ? quantity : undefined
      );
      setReviewRequest(null);
      setReviewAction('');
      setNotice([result.message, result.warning].filter(Boolean).join(' ') || `Purchase request ${reviewAction}.`);
      await fetchOverviewData();
    } catch (decisionError) {
      console.error('Failed to decide purchase request:', decisionError);
      setError(decisionError.response?.data?.message || 'Unable to save the purchase request decision.');
    } finally {
      setSavingDecision(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Pharmacy &amp; Inventory Oversight</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor stock, expiry risks, purchase requests and dispensing trends. Approve or reject requisitions; pharmacy staff manage dispensing and stock handling.</p>
      </header>
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => void fetchOverviewData()} className="font-semibold underline">Retry</button>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        
        {/* Total Medicines */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Items</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{loading ? '—' : summary.totalItems}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Pill size={22} /></div>
        </div>

        {/* Low Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Low Stock</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{loading ? '—' : summary.lowStockCount}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle size={22} /></div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Expiring Within {expiryWarningDays} Days</p>
            <h3 className="text-2xl font-bold text-purple-600 mt-1">{loading ? '—' : summary.expiringSoonCount}</h3>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Clock size={22} /></div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Out of Stock</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{loading ? '—' : summary.outOfStockCount}</h3>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><XCircle size={22} /></div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Expired Items</p>
            <h3 className="text-2xl font-bold text-rose-700 mt-1">{loading ? '—' : summary.expiredCount}</h3>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle size={22} /></div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Pending Requisitions</p>
            <h3 className="text-2xl font-bold text-violet-700 mt-1">{loading ? '—' : summary.pendingPurchaseRequestCount}</h3>
          </div>
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl"><Clock3 size={22} /></div>
        </div>

      </div>


      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Pill className="text-teal-600" size={20} /> Medicine &amp; Supply Stock
          </h2>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-3">
            <div className="relative w-60">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search medicine name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-medium focus:outline-none"
            >
              <option value="all">All stock statuses</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="expired">Expired</option>
              <option value="expiring_soon">Expiring within {Math.max(1, Math.round(expiryWarningDays / 30))} months</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Medicine</th>
                <th className="p-3">Category</th>
                <th className="p-3">Storage location</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Batch Expiry Dates</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="p-6 text-center text-slate-400">Loading inventory...</td></tr>
              ) : stockTable.length === 0 ? (
                <tr><td colSpan="7" className="p-6 text-center text-slate-400">No inventory items match these filters.</td></tr>
              ) : (
                stockTable.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">
                      {item.itemName}
                      {item.itemCode && <span className="mt-1 block font-mono text-[10px] font-medium text-slate-400">Catalog: {item.itemCode}</span>}
                    </td>
                    <td className="p-3 font-medium text-slate-500">{item.category || 'Other'}</td>
                    <td className="p-3 text-slate-500"><span className="inline-flex items-center gap-1"><MapPin size={13} />{item.storageLocation || 'Not recorded'}</span></td>
                    <td className="p-3 font-semibold">{item.quantity} {item.unit}</td>
                    <td className="p-3 text-slate-400">{item.effectiveReorderLevel ?? item.reorderLevel} {item.unit}</td>
                    <td className="p-3">
                      {item.expiryEntries?.length ? (
                        <div className="space-y-1">
                          {item.expiryEntries.map((entry, index) => {
                            const date = new Date(entry.expiryDate);
                            return <p key={`${entry.batchNumber || entry.expiryDate}-${index}`} className={entry.expired ? 'font-semibold text-rose-700' : entry.expiringSoon ? 'font-semibold text-amber-700' : ''}>
                              {entry.batchNumber ? `${entry.batchNumber}: ` : ''}{Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString()}
                              {entry.expired ? ' · Expired' : entry.expiringSoon ? ' · Expiring soon' : ''}
                            </p>;
                          })}
                        </div>
                      ) : <span className="text-slate-400">Not recorded</span>}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold inline-flex items-center gap-1 ${
                        item.expired || item.computedStatus === 'out_of_stock' ? 'bg-rose-50 text-rose-700' :
                        item.computedStatus === 'low_stock' ? 'bg-amber-50 text-amber-700' :
                        'bg-emerald-50 text-emerald-700'
                      }`}>
                        {item.expired && '🔴 Expired'}
                        {!item.expired && item.computedStatus === 'in_stock' && '🟢 In stock'}
                        {item.computedStatus === 'low_stock' && '🟡 Low stock'}
                        {item.computedStatus === 'out_of_stock' && '🔴 Out of stock'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <PackageCheck className="text-purple-600" size={18} /> Purchase Requisitions
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Request ID</th>
                <th className="p-2.5">Requested by / Department</th>
                <th className="p-2.5">Item</th>
                <th className="p-2.5">Quantity</th>
                <th className="p-2.5">Est. cost</th>
                <th className="p-2.5">Approval</th>
                <th className="p-2.5">Delivery</th>
                <th className="p-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="8" className="p-4 text-center text-slate-400">Loading purchase requests...</td></tr>
              ) : purchaseRequests.length === 0 ? (
                <tr><td colSpan="8" className="p-4 text-center text-slate-400">No purchase requests have been submitted.</td></tr>
              ) : (
                purchaseRequests.map((req) => (
                  <tr key={req._id}>
                    <td className="p-2.5 font-mono text-[11px] text-slate-500">{req.requestNumber || req._id.substring(0, 8)}</td>
                    <td className="p-2.5 text-slate-600">{req.applicantName}<span className="block text-[11px]">{req.department || req.purchase?.requesterDepartment || 'Department not listed'}</span><span className="block max-w-48 truncate text-[11px] text-slate-400" title={req.reason}>{req.reason || 'No reason provided'}</span></td>
                    <td className="p-2.5 font-bold text-slate-700">{req.purchase?.itemName || 'Not specified'}<span className="block text-[11px] font-normal text-slate-500">{req.purchase?.category || 'Other'} · {req.priority || 'normal'} priority</span></td>
                    <td className="p-2.5">{req.status === 'approved' && req.purchase?.approvedQuantity != null
                      ? `${req.purchase.approvedQuantity} / ${req.purchase.quantity}`
                      : req.purchase?.quantity ?? '—'} {req.purchase?.unit || 'units'}</td>
                    <td className="p-2.5">{req.purchase?.estimatedCost ? `${Number(req.purchase.estimatedCost).toLocaleString()} ETB` : 'Not provided'}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-xs capitalize">{(req.fulfillmentStatus || (req.status === 'approved' ? 'awaiting_delivery' : 'awaiting_approval')).replaceAll('_', ' ')}</td>
                    <td className="p-2.5">
                      {req.status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => openReview(req, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 font-semibold text-white hover:bg-emerald-700" aria-label={`Approve ${req.purchase?.itemName || 'purchase request'}`}><Check size={13} />Approve</button>
                          <button type="button" onClick={() => openReview(req, 'rejected')} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1.5 font-semibold text-white hover:bg-rose-700" aria-label={`Reject ${req.purchase?.itemName || 'purchase request'}`}><X size={13} />Reject</button>
                        </div>
                      ) : <span className="text-slate-400">Reviewed</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-teal-600" size={18} /> Dispensing Report
          </h2>

          {/* Date Filter & Export Button */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent focus:outline-none"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent focus:outline-none"
              />
            </div>

            <button 
              onClick={exportReport}
              disabled={!dispensingReport.length}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-xl font-bold transition shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} /> Export Report
            </button>
          </div>
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto">
          {!reportLoading && !reportError && dispensingReport.length > 0 && (
            <div className="mb-5 space-y-3" aria-label="Most dispensed medicines">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Highest consumption in selected period</h3>
              {dispensingReport.slice(0, 5).map((rep) => {
                const maxQuantity = Math.max(...dispensingReport.map((record) => record.totalQuantityDispensed), 1);
                return (
                  <div key={rep._id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-xs">
                    <span className="truncate font-medium text-slate-600">{rep._id}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(3, (rep.totalQuantityDispensed / maxQuantity) * 100)}%` }} /></div>
                    <span className="font-semibold text-slate-700">{rep.totalQuantityDispensed}</span>
                  </div>
                );
              })}
            </div>
          )}
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Medicine</th>
                <th className="p-3">Times Dispensed</th>
                <th className="p-3">Quantity Dispensed</th>
                <th className="p-3">Patients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportError ? (
                <tr><td colSpan="4" className="p-4 text-center text-rose-600">{reportError}</td></tr>
              ) : reportLoading ? (
                <tr><td colSpan="4" className="p-4 text-center text-slate-400">Loading dispensing report...</td></tr>
              ) : dispensingReport.length === 0 ? (
                <tr><td colSpan="4" className="p-4 text-center text-slate-400">No dispensing records exist for this date range.</td></tr>
              ) : (
                dispensingReport.map((rep, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{rep._id}</td>
                    <td className="p-3">{rep.totalTimesDispensed}</td>
                    <td className="p-3 font-semibold text-teal-700">{rep.totalQuantityDispensed}</td>
                    <td className="p-3">{rep.patientCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Dispensing logs do not currently include unit costs, so budget expenditure cannot be calculated from this report.</p>
      </div>

      {reviewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <form onSubmit={submitDecision} role="dialog" aria-modal="true" aria-labelledby="purchase-review-title" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="purchase-review-title" className="text-lg font-bold text-slate-800">{reviewAction === 'approved' ? 'Approve purchase request' : 'Reject purchase request'}</h2>
                <p className="mt-1 text-sm text-slate-500">{reviewRequest.purchase?.itemName} · Requested {reviewRequest.purchase?.quantity} {reviewRequest.purchase?.unit || 'units'}</p>
              </div>
              <button type="button" onClick={() => setReviewRequest(null)} aria-label="Close review" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            {reviewAction === 'approved' && (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Approved quantity
                <input type="number" min="1" max={reviewRequest.purchase?.quantity} step="1" required value={approvedQuantity} onChange={(event) => setApprovedQuantity(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" />
                <span className="block text-xs font-normal text-slate-500">Approval authorizes procurement; it does not add stock to inventory.</span>
              </label>
            )}
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              {reviewAction === 'rejected' ? 'Reason for rejection (required)' : 'Comment (optional)'}
              <textarea required={reviewAction === 'rejected'} maxLength="1000" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows="3" className="w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder={reviewAction === 'rejected' ? 'Explain why this request is rejected…' : 'Add an approval note…'} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReviewRequest(null)} disabled={savingDecision} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={savingDecision} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${reviewAction === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{savingDecision ? 'Saving…' : reviewAction === 'approved' ? 'Confirm approval' : 'Confirm rejection'}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default PharmacyAndInventory;
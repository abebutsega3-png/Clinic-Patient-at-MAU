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
  Clock3 
} from 'lucide-react';

const PharmacyAndInventory = () => {
  const { token } = useAuth();
  // States
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    expiringSoonCount: 0,
    outOfStockCount: 0,
    expiredCount: 0
  });

  const [stockTable, setStockTable] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [dispensingReport, setDispensingReport] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');

  const authConfig = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ search: searchQuery, statusFilter });
      const { data } = await axios.get(`/api/pharmacy/overview?${params}`, authConfig);
      setSummary(data.summaryCards || {});
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
    const rows = [
      ['Medicine', 'Times dispensed', 'Quantity dispensed', 'Patients'],
      ...dispensingReport.map((record) => [
        record._id,
        record.totalTimesDispensed,
        record.totalQuantityDispensed,
        record.patientCount
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dispensing-report-${startDate || 'all'}-${endDate || 'dates'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Pharmacy &amp; Inventory Oversight</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor medicine stock, expiry risks, purchase-request progress, and dispensing activity. Inventory and purchase records are view-only here.</p>
      </header>
      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => void fetchOverviewData()} className="font-semibold underline">Retry</button>
        </div>
      )}
      
      {/* 🟢 KIFIL 1: TOP 4 SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
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
            <p className="text-xs font-semibold text-slate-500 uppercase">Expiring Within 3 Months</p>
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

      </div>


      {/* 🟢 KIFIL 2: STOCK TABLE (MAIN - VIEW ONLY) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Pill className="text-teal-600" size={20} /> Medicine Stock (View Only)
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
              <option value="expiring_soon">Expiring within 3 months</option>
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
                <th className="p-3">Quantity</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Batch Expiry Dates</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="p-6 text-center text-slate-400">Loading inventory...</td></tr>
              ) : stockTable.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-slate-400">No inventory items match these filters.</td></tr>
              ) : (
                stockTable.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">
                      {item.itemName}
                      {item.itemCode && <span className="mt-1 block font-mono text-[10px] font-medium text-slate-400">Catalog: {item.itemCode}</span>}
                    </td>
                    <td className="p-3 font-medium text-slate-500">{item.category || 'Other'}</td>
                    <td className="p-3 font-semibold">{item.quantity} {item.unit}</td>
                    <td className="p-3 text-slate-400">{item.effectiveReorderLevel ?? item.reorderLevel} {item.unit}</td>
                    <td className="p-3">
                      {item.expiryDates?.length ? (
                        <div className="space-y-1">
                          {item.expiryDates.map((expiryDate, index) => {
                            const date = new Date(expiryDate);
                            const expired = date < new Date();
                            return <p key={`${expiryDate}-${index}`} className={expired ? 'font-semibold text-rose-700' : item.expiringSoon ? 'font-semibold text-amber-700' : ''}>
                              {item.batches?.[index]?.batchNumber ? `${item.batches[index].batchNumber}: ` : ''}{Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString()}
                              {expired ? ' · Expired' : item.expiringSoon ? ' · Expiring soon' : ''}
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


      {/* 🟢 KIFIL 3: PURCHASE REQUESTS STATUS (READ-ONLY) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Clock3 className="text-purple-600" size={18} /> Purchase Request Status (View Only)
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Request ID</th>
                <th className="p-2.5">Requested by / Department</th>
                <th className="p-2.5">Item</th>
                <th className="p-2.5">Quantity</th>
                <th className="p-2.5">Approval</th>
                <th className="p-2.5">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="p-4 text-center text-slate-400">Loading purchase requests...</td></tr>
              ) : purchaseRequests.length === 0 ? (
                <tr><td colSpan="6" className="p-4 text-center text-slate-400">No purchase requests have been submitted.</td></tr>
              ) : (
                purchaseRequests.map((req) => (
                  <tr key={req._id}>
                    <td className="p-2.5 font-mono text-[11px] text-slate-500">{req.requestNumber || req._id.substring(0, 8)}</td>
                    <td className="p-2.5 text-slate-600">{req.applicantName}<span className="block text-[11px]">{req.department || req.purchase?.requesterDepartment || 'Department not listed'}</span></td>
                    <td className="p-2.5 font-bold text-slate-700">{req.purchase?.itemName || 'Not specified'}<span className="block text-[11px] font-normal text-slate-500">{req.purchase?.category || 'Other'}</span></td>
                    <td className="p-2.5">{req.status === 'approved' && req.purchase?.approvedQuantity != null
                      ? `${req.purchase.approvedQuantity} / ${req.purchase.quantity}`
                      : req.purchase?.quantity ?? '—'} {req.purchase?.unit || 'units'}</td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* 🟢 KIFIL 4: DISPENSING REPORT */}
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
      </div>

    </div>
  );
};

export default PharmacyAndInventory;
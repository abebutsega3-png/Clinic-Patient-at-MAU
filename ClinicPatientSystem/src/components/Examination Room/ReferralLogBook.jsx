import { useEffect, useState } from "react";
import { ClipboardCheck, Search, Trash2, PlusCircle, Printer } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const API_URL = "/api/referral-log";

export default function App() {
  const { token, expireSession } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("All");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    patientCardNumber: "",
    diseaseHmisClassification: "",
    patientCondition: "Non emergency",
    referredByHealthProfession: "",
    referredOrAmbulanceDriver: "",
    time: "",
    remark: "",
  });

  const loadReferrals = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, condition: conditionFilter });
      const res = await fetch(`${API_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) expireSession();
      if (!res.ok) throw new Error("Failed to load referral records");
      setReferrals(await res.json());
    } catch (err) {
      console.error("Error loading referrals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, [search, conditionFilter, token]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null);
        throw new Error(result?.message || "Failed to create referral");
      }
      setForm({
        date: new Date().toISOString().split("T")[0],
        patientCardNumber: "",
        diseaseHmisClassification: "",
        patientCondition: "Non emergency",
        referredByHealthProfession: "",
        referredOrAmbulanceDriver: "",
        time: "",
        remark: "",
      });
      loadReferrals();
    } catch (err) {
      console.error("Error creating referral:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete referral");
      loadReferrals();
    } catch (err) {
      console.error("Error deleting referral:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Title Banner */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-3 print:hidden">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-xl font-bold text-slate-800">
              MAU Tulu Awuliya Campus Student Clinic — Referral Registration Log Book
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Digital referral logbook replacing manual paper entries and preventing record loss
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Patient Card Number
            </label>
            <input
              type="text"
              name="patientCardNumber"
              placeholder="e.g., 04258"
              value={form.patientCardNumber}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Disease / HMIS Classification
            </label>
            <input
              type="text"
              name="diseaseHmisClassification"
              placeholder="e.g., Dermatitis, TB, PID"
              value={form.diseaseHmisClassification}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Patient Condition
            </label>
            <select
              name="patientCondition"
              value={form.patientCondition}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Emergency">Emergency</option>
              <option value="Non emergency">Non emergency</option>
              <option value="Sick leave">Sick leave</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Name of Referred by Health Profession
            </label>
            <input
              type="text"
              name="referredByHealthProfession"
              placeholder="Clinician / Nurse name"
              value={form.referredByHealthProfession}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Referred / Name of Ambulance Driver
            </label>
            <input
              type="text"
              name="referredOrAmbulanceDriver"
              placeholder="Destination or driver name"
              value={form.referredOrAmbulanceDriver}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
            <input
              type="time"
              name="time"
              value={form.time}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Remark</label>
            <input
              type="text"
              name="remark"
              placeholder="e.g., Referral"
              value={form.remark}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Add Referral Entry
            </button>
          </div>
        </form>

        {/* Filter & Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 justify-between print:hidden">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by card number, disease/HMIS, or health professional..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Conditions</option>
            <option value="Emergency">Emergency</option>
            <option value="Non emergency">Non emergency</option>
            <option value="Sick leave">Sick leave</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          <div className="hidden text-center text-slate-900 print:block print:mb-3">
            <p className="text-sm font-bold">Mekdela Amba University Tulu Awuliya Campus</p>
            <p className="text-xs font-bold">Student Clinic — Referral Registration Log Book</p>
          </div>
          <table className="w-full min-w-[1100px] text-xs text-left border-collapse print:min-w-full print:text-[8px]">
            <thead>
              <tr className="bg-slate-50 text-slate-700 text-[10px] uppercase border-b border-slate-400">
                <th className="p-2 border border-slate-400">S.NO</th>
                <th className="p-2 border border-slate-400">Date</th>
                <th className="p-2 border border-slate-400">Patient Card No.</th>
                <th className="p-2 border border-slate-400">Disease / HMIS Classification</th>
                <th className="p-2 border border-slate-400 text-center">Emergency</th>
                <th className="p-2 border border-slate-400 text-center">Non emergency</th>
                <th className="p-2 border border-slate-400 text-center">Sick leave</th>
                <th className="p-2 border border-slate-400">Referred by Health Profession</th>
                <th className="p-2 border border-slate-400">Referred / Driver</th>
                <th className="p-2 border border-slate-400">Time</th>
                <th className="p-2 border border-slate-400">Remark</th>
                <th className="p-2 border border-slate-400 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="p-6 text-center text-slate-500">
                    Loading referral records...
                  </td>
                </tr>
              ) : referrals.length === 0 ? (
                <tr>
                  <td colSpan="12" className="p-6 text-center text-slate-500">
                    No referral records available.
                  </td>
                </tr>
              ) : (
                referrals.map((row) => (
                  <tr key={row._id} className="border-b hover:bg-slate-50">
                      <td className="p-2 border border-slate-300 font-semibold">{row.serialNo}</td>
                      <td className="p-2 border border-slate-300">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                      <td className="p-2 border border-slate-300 font-mono">{row.patientCardNumber}</td>
                      <td className="p-2 border border-slate-300">{row.diseaseHmisClassification}</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-red-600">
                      {row.patientCondition === "Emergency" ? "✓" : "-"}
                    </td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-blue-600">
                      {row.patientCondition === "Non emergency" ? "✓" : "-"}
                    </td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-amber-600">
                      {row.patientCondition === "Sick leave" ? "✓" : "-"}
                    </td>
                      <td className="p-2 border border-slate-300">{row.referredByHealthProfession}</td>
                      <td className="p-2 border border-slate-300">{row.referredOrAmbulanceDriver || "-"}</td>
                      <td className="p-2 border border-slate-300">{row.time || "-"}</td>
                      <td className="p-2 border border-slate-300">{row.remark || "-"}</td>
                      <td className="p-2 border border-slate-300 text-center print:hidden">
                      <button
                        onClick={() => handleDelete(row._id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
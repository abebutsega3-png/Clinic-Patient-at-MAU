import React, { useState, useEffect } from "react";
import axios from "axios";

export default function SendToCardRoomModal({
  isOpen,
  onClose,
  patient, // { _id, mrn, fullName, age, sex, department, phone, diagnosis, prescription, labResult }
  onSentSuccess,
}) {
  const [selectedDocs, setSelectedDocs] = useState({
    individualFolder: true,
    prescription: true,
    labResult: true,
  });
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (patient) {
      setSelectedDocs({
        individualFolder: true,
        prescription: Boolean(patient.prescription),
        labResult: Boolean(patient.labResult),
      });
      setRemarks("");
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [patient]);

  if (!isOpen || !patient) return null;

  const handleToggle = (key) => {
    setSelectedDocs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSendToCardRoom = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (
      !selectedDocs.individualFolder &&
      !selectedDocs.prescription &&
      !selectedDocs.labResult
    ) {
      setErrorMsg("ቢያንስ አንድ ሰነድ (Individual Folder, Prescription, ወይም Lab Result) ምረጥ።");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        patientId: patient._id,
        mrn: patient.mrn,
        patientName: patient.fullName || patient.name,
        sourceRoom: "EXAMINATION_ROOM",
        destinationRoom: "CARD_ROOM",
        documents: {
          individualFolder: selectedDocs.individualFolder,
          prescription: selectedDocs.prescription,
          labResult: selectedDocs.labResult,
        },
        snapshot: {
          individualFolder: {
            mrn: patient.mrn,
            fullName: patient.fullName || patient.name,
            age: patient.age,
            sex: patient.sex,
            department: patient.department || "N/A",
            phone: patient.phone || "N/A",
          },
          prescription: patient.prescription || null,
          labResult: patient.labResult || null,
        },
        remarks,
      };

      const token = localStorage.getItem("token");
      const res = await axios.post(
        "/api/examination/send-to-card-room",
        payload,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      setSuccessMsg("ወደ Card Room በተሳካ ሁኔታ ተልኳል።");
      if (onSentSuccess) onSentSuccess(res.data);
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message || "ወደ Card Room መላክ አልተሳካም።"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Send to Card Room — Examination Room
            </h2>
            <p className="text-xs text-gray-500">
              MRN: <span className="font-semibold">{patient.mrn}</span> | Patient:{" "}
              <span className="font-semibold">{patient.fullName || patient.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ✕ Close
          </button>
        </div>

        <form onSubmit={handleSendToCardRoom} className="space-y-4">
          {/* 1. Individual Folder */}
          <div className="rounded-lg border p-3 space-y-1">
            <label className="flex items-center gap-2 font-semibold text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDocs.individualFolder}
                onChange={() => handleToggle("individualFolder")}
              />
              1. Individual Folder
            </label>
            <p className="text-xs text-gray-600 pl-6">
              MRN: {patient.mrn || "-"} • Age/Sex: {patient.age || "-"} /{" "}
              {patient.sex || "-"} • Dept: {patient.department || "-"}
            </p>
          </div>

          {/* 2. Prescription */}
          <div className="rounded-lg border p-3 space-y-1">
            <label className="flex items-center gap-2 font-semibold text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDocs.prescription}
                onChange={() => handleToggle("prescription")}
              />
              2. Prescription
            </label>
            <p className="text-xs text-gray-600 pl-6">
              {patient.prescription
                ? typeof patient.prescription === "string"
                  ? patient.prescription
                  : JSON.stringify(patient.prescription)
                : "ምንም Prescription አልተመዘገበም (Optional)"}
            </p>
          </div>

          {/* 3. Lab Result */}
          <div className="rounded-lg border p-3 space-y-1">
            <label className="flex items-center gap-2 font-semibold text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDocs.labResult}
                onChange={() => handleToggle("labResult")}
              />
              3. Lab Result
            </label>
            <p className="text-xs text-gray-600 pl-6">
              {patient.labResult
                ? typeof patient.labResult === "string"
                  ? patient.labResult
                  : JSON.stringify(patient.labResult)
                : "ምንም Lab Result አልገባም (Optional)"}
            </p>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Remarks / Note for Card Room (Optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="ለምሳሌ፦ ምርመራ ተጠናቋል፣ ፋይሉን መልስ..."
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          {successMsg && <p className="text-sm text-emerald-700">{successMsg}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
            >
              {submitting ? "Sending..." : "Send to Card Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
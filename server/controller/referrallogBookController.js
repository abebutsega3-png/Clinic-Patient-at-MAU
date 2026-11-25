import Referral from '../module/referralLogBook.js';

// GET /api/referrals
export const getAllReferrals = async (req, res) => {
  try {
    const { search, condition } = req.query;
    const filter = {};

    if (condition && condition !== "All") {
      filter.patientCondition = condition;
    }

    if (search && search.trim() !== "") {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { patientCardNumber: regex },
        { diseaseHmisClassification: regex },
        { referredByHealthProfession: regex },
        { referredOrAmbulanceDriver: regex },
      ];
    }

    const referrals = await Referral.find(filter).sort({ date: -1, serialNo: -1 });
    res.status(200).json(referrals);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch referrals", error: error.message });
  }
};

// POST /api/referrals
export const createReferral = async (req, res) => {
  try {
    const {
      date,
      patientCardNumber,
      diseaseHmisClassification,
      patientCondition,
      referredByHealthProfession,
      referredOrAmbulanceDriver,
      time,
      remark,
    } = req.body;

    if (!patientCardNumber || !diseaseHmisClassification || !referredByHealthProfession) {
      return res.status(400).json({
        message: "Patient card number, disease/HMIS classification, and health profession are required.",
      });
    }

    const lastRecord = await Referral.findOne().sort({ serialNo: -1 });
    const nextSerialNo = lastRecord ? lastRecord.serialNo + 1 : 1;

    const referral = await Referral.create({
      serialNo: nextSerialNo,
      date: date || new Date(),
      patientCardNumber: patientCardNumber.trim(),
      diseaseHmisClassification: diseaseHmisClassification.trim(),
      patientCondition: patientCondition || "Non emergency",
      referredByHealthProfession: referredByHealthProfession.trim(),
      referredOrAmbulanceDriver: referredOrAmbulanceDriver ? referredOrAmbulanceDriver.trim() : "",
      time: time || "",
      remark: remark ? remark.trim() : "",
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("referral:new", referral);
    }

    res.status(201).json(referral);
  } catch (error) {
    res.status(400).json({ message: "Failed to create referral", error: error.message });
  }
};

// PUT /api/referrals/:id
export const updateReferral = async (req, res) => {
  try {
    const updated = await Referral.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Referral record not found" });
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: "Failed to update referral", error: error.message });
  }
};

// DELETE /api/referrals/:id
export const deleteReferral = async (req, res) => {
  try {
    const deleted = await Referral.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Referral record not found" });
    }

    res.status(200).json({ message: "Referral record deleted" });
  } catch (error) {
    res.status(400).json({ message: "Failed to delete referral", error: error.message });
  }
};

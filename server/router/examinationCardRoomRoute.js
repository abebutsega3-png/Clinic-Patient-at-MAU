const express = require("express");
const router = express.Router();
const CardRoomTransfer = require("../models/CardRoomTransferexamantion");

// POST /api/examination/send-to-card-room
router.post("/send-to-card-room", async (req, res) => {
  try {
    const {
      patientId,
      mrn,
      patientName,
      sourceRoom = "EXAMINATION_ROOM",
      destinationRoom = "CARD_ROOM",
      documents = {},
      snapshot = {},
      remarks = "",
    } = req.body;

    if (!patientId || !mrn || !patientName) {
      return res.status(400).json({
        message: "patientId, mrn, and patientName are required.",
      });
    }

    const hasAnyDoc =
      Boolean(documents.individualFolder) ||
      Boolean(documents.prescription) ||
      Boolean(documents.labResult);

    if (!hasAnyDoc) {
      return res.status(400).json({
        message: "At least one document must be selected to send to Card Room.",
      });
    }

    const transfer = await CardRoomTransfer.create({
      patientId,
      mrn,
      patientName,
      sourceRoom,
      destinationRoom,
      documents: {
        individualFolder: Boolean(documents.individualFolder),
        prescription: Boolean(documents.prescription),
        labResult: Boolean(documents.labResult),
      },
      snapshot,
      remarks,
      status: "SENT_TO_CARD_ROOM",
      sentBy: req.user?._id || null,
      sentAt: new Date(),
    });

    return res.status(201).json({
      message: "Documents sent to Card Room successfully.",
      transfer,
    });
  } catch (error) {
    console.error("Error sending to Card Room:", error);
    return res.status(500).json({
      message: "Server error while sending to Card Room.",
    });
  }
});

// GET /api/examination/card-room-transfers (ለ Card Room incoming list)
router.get("/card-room-transfers", async (req, res) => {
  try {
    const transfers = await CardRoomTransfer.find().sort({ sentAt: -1 });
    return res.json(transfers);
  } catch (error) {
    console.error("Error fetching Card Room transfers:", error);
    return res.status(500).json({
      message: "Server error while fetching Card Room transfers.",
    });
  }
});

module.exports = router;
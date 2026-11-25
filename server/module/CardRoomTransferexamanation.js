const mongoose = require("mongoose");

const cardRoomTransferSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    mrn: {
      type: String,
      required: true,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    sourceRoom: {
      type: String,
      default: "EXAMINATION_ROOM",
    },
    destinationRoom: {
      type: String,
      default: "CARD_ROOM",
    },
    documents: {
      individualFolder: { type: Boolean, default: true },
      prescription: { type: Boolean, default: false },
      labResult: { type: Boolean, default: false },
    },
    snapshot: {
      individualFolder: { type: mongoose.Schema.Types.Mixed, default: null },
      prescription: { type: mongoose.Schema.Types.Mixed, default: null },
      labResult: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    remarks: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["SENT_TO_CARD_ROOM", "RECEIVED_BY_CARD_ROOM"],
      default: "SENT_TO_CARD_ROOM",
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CardRoomTransferexamanation", cardRoomTransferSchema);
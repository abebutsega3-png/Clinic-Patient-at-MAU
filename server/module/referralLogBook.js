import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
  {
    examinationVisitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClinicVisit',
      default: null,
      index: true,
    },
    serialNo: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    patientCardNumber: {
      type: String,
      required: [true, "Patient card number is required"],
      trim: true,
    },
    diseaseHmisClassification: {
      type: String,
      required: [true, "Disease / HMIS classification is required"],
      trim: true,
    },
    patientCondition: {
      type: String,
      enum: ["Emergency", "Non emergency", "Sick leave"],
      required: true,
      default: "Non emergency",
    },
    referredByHealthProfession: {
      type: String,
      required: [true, "Referred by health profession is required"],
      trim: true,
    },
    referredOrAmbulanceDriver: {
      type: String,
      trim: true,
      default: "",
    },
    time: {
      type: String,
      trim: true,
      default: "",
    },
    remark: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.models.ReferralLog || mongoose.model('ReferralLog', referralSchema);
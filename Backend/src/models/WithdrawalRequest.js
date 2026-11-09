const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    amount: { type: Number, min: 100, required: true },
    status: { type: String, enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "REJECTED"], default: "PENDING", index: true },
    destinationSnapshot: {
      method: { type: String, enum: ["bank", "upi"], required: true },
      accountHolderName: String,
      maskedAccountNumber: String,
      ifsc: String,
      upiId: String,
    },
    razorpayPayoutId: { type: String, default: null, index: true },
    failureReason: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);

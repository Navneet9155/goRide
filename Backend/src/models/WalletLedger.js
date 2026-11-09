const mongoose = require("mongoose");

const walletLedgerSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    type: {
      type: String,
      enum: ["ONLINE_RIDE_EARNING", "CASH_PLATFORM_FEE", "PAYOUT_HOLD", "PAYOUT_REVERSAL", "BONUS", "PENALTY", "ADJUSTMENT"],
      required: true,
    },
    direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    amount: { type: Number, min: 0, required: true },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
    withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: "WithdrawalRequest", default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    note: { type: String, trim: true, maxlength: 240, default: null },
  },
  { timestamps: true }
);

walletLedgerSchema.index({ driver: 1, createdAt: -1 });
module.exports = mongoose.model("WalletLedger", walletLedgerSchema);

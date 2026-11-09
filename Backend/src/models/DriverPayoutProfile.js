const mongoose = require("mongoose");

const driverPayoutProfileSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, unique: true, index: true },
    accountHolderName: { type: String, trim: true, maxlength: 120 },
    bankAccountNumber: { type: String, trim: true, select: false },
    ifsc: { type: String, trim: true, uppercase: true },
    upiId: { type: String, trim: true, lowercase: true },
    preferredMethod: { type: String, enum: ["bank", "upi"], default: "bank" },
    verificationStatus: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "PENDING" },
    rejectionReason: { type: String, default: null },
    razorpayContactId: { type: String, default: null },
    razorpayFundAccountId: { type: String, default: null },
  },
  { timestamps: true }
);

driverPayoutProfileSchema.methods.toSafeJSON = function toSafeJSON() {
  const value = this.toObject();
  delete value.bankAccountNumber;
  return value;
};

module.exports = mongoose.model("DriverPayoutProfile", driverPayoutProfileSchema);

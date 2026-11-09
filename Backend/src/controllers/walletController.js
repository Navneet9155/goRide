const DriverPayoutProfile = require("../models/DriverPayoutProfile");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const WalletLedger = require("../models/WalletLedger");
const Ride = require("../models/Ride");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const walletService = require("../services/walletService");

function maskAccount(value) {
  return value ? `••••${String(value).slice(-4)}` : undefined;
}

const getWallet = catchAsync(async (req, res) => {
  const [balance, entries, profile, cashSummary] = await Promise.all([
    walletService.getBalance(req.user._id),
    WalletLedger.find({ driver: req.user._id }).sort({ createdAt: -1 }).limit(50).populate("ride", "pickupAddress dropAddress"),
    DriverPayoutProfile.findOne({ driver: req.user._id }),
    Ride.aggregate([
      { $match: { driver: req.user._id, rideStatus: "RIDE_COMPLETED", paymentMethod: "cash" } },
      { $group: { _id: null, cashCollected: { $sum: "$driverEarning" } } },
    ]),
  ]);
  return sendSuccess(res, {
    message: "Wallet fetched",
    data: {
      balance,
      // Cash is paid directly to the driver and is not withdrawable from GoRide.
      cashCollected: Math.round((cashSummary[0]?.cashCollected || 0) * 100) / 100,
      entries,
      payoutProfile: profile ? profile.toSafeJSON() : null,
      minimumWithdrawal: 100,
    },
  });
});

const savePayoutProfile = catchAsync(async (req, res, next) => {
  const { accountHolderName, bankAccountNumber, ifsc, upiId, preferredMethod } = req.body;
  const hasBank = bankAccountNumber && ifsc;
  const hasUpi = Boolean(upiId);
  if (!hasBank && !hasUpi) return next(new AppError("Provide a bank account with IFSC or a UPI ID", 400));
  if (preferredMethod === "bank" && !hasBank) return next(new AppError("Bank account and IFSC are required", 400));
  if (preferredMethod === "upi" && !hasUpi) return next(new AppError("UPI ID is required", 400));

  const update = {
    accountHolderName,
    ...(bankAccountNumber ? { bankAccountNumber } : {}),
    ...(ifsc ? { ifsc } : {}),
    ...(upiId ? { upiId } : {}),
    preferredMethod: preferredMethod || (hasUpi && !hasBank ? "upi" : "bank"),
    verificationStatus: "PENDING",
    rejectionReason: null,
  };
  const profile = await DriverPayoutProfile.findOneAndUpdate(
    { driver: req.user._id },
    { $set: update, $setOnInsert: { driver: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );
  return sendSuccess(res, { message: "Payout details saved and awaiting verification", data: { payoutProfile: profile.toSafeJSON() } });
});

const requestWithdrawal = catchAsync(async (req, res, next) => {
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 100) return next(new AppError("Minimum withdrawal is ₹100", 400));
  const profile = await DriverPayoutProfile.findOne({ driver: req.user._id }).select("+bankAccountNumber");
  if (!profile) return next(new AppError("Add payout details before withdrawing", 400));
  if (profile.verificationStatus !== "VERIFIED") return next(new AppError("Your payout details must be verified before withdrawal", 403));
  const balance = await walletService.getBalance(req.user._id);
  if (amount > balance.availableBalance) return next(new AppError("Withdrawal amount exceeds available wallet balance", 400));

  const withdrawal = await WithdrawalRequest.create({
    driver: req.user._id,
    amount,
    destinationSnapshot: {
      method: profile.preferredMethod,
      accountHolderName: profile.accountHolderName,
      maskedAccountNumber: maskAccount(profile.bankAccountNumber),
      ifsc: profile.ifsc,
      upiId: profile.upiId,
    },
  });
  await walletService.addEntry({
    driver: req.user._id,
    withdrawal: withdrawal._id,
    type: "PAYOUT_HOLD",
    direction: "DEBIT",
    amount,
    idempotencyKey: `payout-hold:${withdrawal._id}`,
    note: "Withdrawal request held for payout",
  });
  return sendSuccess(res, { statusCode: 201, message: "Withdrawal request created", data: { withdrawal } });
});

const getWithdrawals = catchAsync(async (req, res) => {
  const withdrawals = await WithdrawalRequest.find({ driver: req.user._id }).sort({ createdAt: -1 }).limit(50);
  return sendSuccess(res, { message: "Withdrawals fetched", data: { withdrawals } });
});

module.exports = { getWallet, savePayoutProfile, requestWithdrawal, getWithdrawals };

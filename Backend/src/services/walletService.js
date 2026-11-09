const WalletLedger = require("../models/WalletLedger");

async function addEntry(data) {
  try {
    return await WalletLedger.create(data);
  } catch (error) {
    if (error?.code === 11000) return WalletLedger.findOne({ idempotencyKey: data.idempotencyKey });
    throw error;
  }
}

async function getBalance(driverId) {
  const totals = await WalletLedger.aggregate([
    { $match: { driver: driverId } },
    { $group: { _id: "$direction", total: { $sum: "$amount" } } },
  ]);
  const credit = totals.find((item) => item._id === "CREDIT")?.total || 0;
  const debit = totals.find((item) => item._id === "DEBIT")?.total || 0;
  return { credit, debit, availableBalance: Math.max(0, Math.round((credit - debit) * 100) / 100), netBalance: Math.round((credit - debit) * 100) / 100 };
}

async function creditOnlineRide({ driver, ride, payment, amount }) {
  if (!driver || !amount) return null;
  return addEntry({
    driver,
    ride,
    payment,
    type: "ONLINE_RIDE_EARNING",
    direction: "CREDIT",
    amount,
    idempotencyKey: `online-earning:${payment}`,
    note: "Net earnings from online ride",
  });
}

async function chargeCashPlatformFee({ driver, ride, payment, amount }) {
  if (!driver || !amount) return null;
  return addEntry({
    driver,
    ride,
    payment,
    type: "CASH_PLATFORM_FEE",
    direction: "DEBIT",
    amount,
    idempotencyKey: `cash-fee:${ride}`,
    note: "Platform commission due for cash ride",
  });
}

module.exports = { addEntry, getBalance, creditOnlineRide, chargeCashPlatformFee };

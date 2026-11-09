const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");

const CAB_TOPIC = /ride|cab|taxi|driver|passenger|pickup|drop|fare|distance|route|eta|payment|upi|cash|refund|wallet|withdraw|payout|vehicle|otp|sos|safety|cancel|booking|trip|account|profile|password|go ?ride/i;

function fallbackAnswer(question) {
  if (/cancel/i.test(question)) return "You can cancel an eligible ride from the active ride screen. Cancellation charges, if applicable, are shown before confirmation.";
  if (/fare|price|cost/i.test(question)) return "Your fare is estimated from vehicle type, distance, duration and any applicable platform fee. The final fare is shown when the trip is completed.";
  if (/distance|route|eta|time/i.test(question)) return "Open the ride screen to see the live route, estimated distance and ETA. These can change with traffic and route availability.";
  if (/payment|upi|cash|refund/i.test(question)) return "GoRide supports cash and online payment. Online payments are confirmed only after the payment gateway verifies the transaction.";
  if (/wallet|withdraw|payout/i.test(question)) return "Drivers can view their wallet from Earnings, save bank or UPI payout details, and request a withdrawal after payout verification.";
  if (/sos|safety|emergency/i.test(question)) return "If you are in immediate danger, use the in-app SOS feature and contact local emergency services. Do not wait for chat support.";
  return "I can help with GoRide bookings, trips, fares, payments, wallet, safety and account support. Please tell me what happened with your ride.";
}

const chat = catchAsync(async (req, res, next) => {
  const question = String(req.body?.message || "").trim();
  if (!question || question.length > 800) return next(new AppError("Send a support question of up to 800 characters", 400));
  if (!CAB_TOPIC.test(question)) {
    return sendSuccess(res, { message: "Support response", data: { reply: "I can only help with GoRide rides, fares, payments, wallet, safety and account support." } });
  }

  let reply = fallbackAnswer(question);
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 250,
          messages: [
            { role: "system", content: "You are GoRide Support. Answer only questions about GoRide cab booking, rides, ETA/distance, fares, payment, driver wallet, safety, account and vehicle support. Do not answer unrelated topics. Do not invent live ride or payment data. For emergencies, tell the user to use SOS and contact local emergency services. Keep answers concise and helpful in the user's language." },
            { role: "user", content: question }
          ],
        }),
      });
      if (response.ok) {
        const body = await response.json();
        reply = body.choices?.[0]?.message?.content || reply;
      }
    } catch {
      // fallback reply retained
    }
  }
  return sendSuccess(res, { message: "Support response", data: { reply } });
});

module.exports = { chat };

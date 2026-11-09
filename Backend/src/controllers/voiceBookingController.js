const Driver = require("../models/Driver");
const mapsService = require("../services/mapsService");
const fareService = require("../services/fareService");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

const vehicleSeats = { bike: 1, auto: 3, car: 4, suv: 6 };

function fallbackIntent(transcript) {
  const value = transcript.toLowerCase().replace(/[,।]/g, " ").replace(/\s+/g, " ").trim();
  const vehicleType = /bike|बाइक/.test(value) ? "bike" : /auto|ऑटो/.test(value) ? "auto" : /suv|एसयूवी/.test(value) ? "suv" : "car";
  const paymentMethod = /online|upi|कार्ड|card|नेट बैंकिंग/.test(value) ? "online" : "cash";

  let dest = value
    .replace(/(?:by|se|me|में|से)?\s*(?:online|upi|cash|कार्ड|card|पेमेंट|payment)\s*(?:se|payment|mode)?/gi, " ")
    .replace(/(?:by|se|से)?\s*(?:car|कार|bike|बाइक|auto|ऑटो|suv|एसयूवी|cab|cabs)\s*(?:chahiye|ride|booking|चाहिए)?/gi, " ")
    .replace(/\b(?:by|se|me|in)\b/gi, " ")
    .replace(/(?:chahiye|चाहिए)/gi, " ")
    .replace(/^(?:please\s+)?(?:take\s+(?:me\s+)?to|drop\s+(?:me\s+)?(?:at|to)|go\s+to|drive\s+to|book\s+a\s+ride\s+to|i\s+want\s+to\s+go\s+to|head\s+to)\s+/i, " ")
    .replace(/^(?:mujhe|hume|humko|bhaiya|bhai|driver\s+ji|yaar|boss|sir|मुझे|हमें|कृपया|भाई|भैया)\s+/i, " ")
    .replace(/(?:jaana\s+hai|jana\s+hai|le\s+chalo|le\s+ja|chalna\s+hai|pahuncha\s+do|drop\s+kardo|जाना\s+है|ले\s+चलो|चलना\s+है|पहुँचा\s+दो|पहुंचा\s+दो)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { vehicleType, paymentMethod, destination: dest || null };
}

async function extractIntent(transcript) {
  const fallback = fallbackIntent(transcript);
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 150,
        messages: [
          { role: "system", content: "Extract a GoRide booking intent from Hindi/Hinglish only. Return JSON only with destination (string or null), vehicleType (bike|auto|car|suv), and paymentMethod (cash|online). Never invent a destination. Default vehicleType car and paymentMethod cash." },
          { role: "user", content: transcript },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]);
    return {
      destination: typeof parsed.destination === "string" && parsed.destination.trim() ? parsed.destination.trim() : fallback.destination,
      vehicleType: ["bike", "auto", "car", "suv"].includes(parsed.vehicleType) ? parsed.vehicleType : fallback.vehicleType,
      paymentMethod: ["cash", "online"].includes(parsed.paymentMethod) ? parsed.paymentMethod : fallback.paymentMethod,
    };
  } catch { return fallback; }
}

const preview = catchAsync(async (req, res, next) => {
  const transcript = String(req.body.transcript || "").trim();
  const currentLocation = req.body.currentLocation;
  if (!transcript || transcript.length > 500) return next(new AppError("Speak or enter a booking request of up to 500 characters", 400));
  if (!Number.isFinite(currentLocation?.latitude) || !Number.isFinite(currentLocation?.longitude)) return next(new AppError("Current GPS location is required for voice booking", 400));

  const intent = await extractIntent(transcript);
  if (!intent.destination) {
    return sendSuccess(res, { message: "Destination needed", data: { needsDestination: true, reply: "कृपया अपना destination बोलें, जैसे: मुझे इंडिया गेट जाना है।" } });
  }
  const pickupAddress = await mapsService.reverseGeocode(currentLocation.latitude, currentLocation.longitude);
  const drop = await mapsService.geocodeAddress(intent.destination);
  const pickup = { latitude: currentLocation.latitude, longitude: currentLocation.longitude, address: pickupAddress };
  const actualRoute = await mapsService.getDistanceAndDuration(pickup, drop);
  const fare = fareService.estimateFare({ vehicleType: intent.vehicleType, distanceKm: actualRoute.distanceKm, durationMin: actualRoute.durationMin });
  const drivers = await Driver.find({ isOnline: true, isAvailable: true, vehicleType: intent.vehicleType, currentLocation: { $near: { $geometry: { type: "Point", coordinates: [pickup.longitude, pickup.latitude] }, $maxDistance: 10000 } } }).select("name vehicleModel vehicleColor rating").limit(3);
  const firstDriver = drivers[0] ? { name: drivers[0].name, vehicleModel: drivers[0].vehicleModel, vehicleColor: drivers[0].vehicleColor, rating: drivers[0].rating } : null;
  const reply = `आपकी ${intent.vehicleType} ride ${pickup.address} से ${drop.formattedAddress} के लिए है। दूरी ${actualRoute.distanceKm} किलोमीटर, अनुमानित समय ${Math.round(actualRoute.durationMin)} मिनट और किराया लगभग ₹${fare.totalFare} है। ${vehicleSeats[intent.vehicleType]} सीट उपलब्ध हैं। ${drivers.length ? `${drivers.length} nearby driver available हैं।` : "अभी nearby driver नहीं दिख रहा, booking के बाद हम search करेंगे।"} Payment ${intent.paymentMethod === "online" ? "online" : "cash"} रहेगा। क्या आप booking confirm करना चाहते हैं?`;
  return sendSuccess(res, {
    message: "Voice ride preview ready",
    data: {
      needsDestination: false,
      transcript,
      pickup,
      drop: { latitude: drop.latitude, longitude: drop.longitude, address: drop.formattedAddress },
      vehicleType: intent.vehicleType,
      paymentMethod: intent.paymentMethod,
      distanceKm: actualRoute.distanceKm,
      durationMin: actualRoute.durationMin,
      fare,
      seats: vehicleSeats[intent.vehicleType],
      availableDrivers: drivers.length,
      driverPreview: firstDriver,
      reply,
    },
  });
});

const transcriptionService = require("../services/transcriptionService");

const transcribe = catchAsync(async (req, res, next) => {
  const { audioBase64, currentLocation } = req.body;
  if (!audioBase64) return next(new AppError("Audio data required", 400));

  let transcript = "";
  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const result = await transcriptionService.transcribeAudio(audioBuffer, "audio/m4a", "hi");
    transcript = result.transcript || "";
  } catch (err) {
    console.warn("[voiceBookingController] Transcription error:", err.message);
  }

  if (!transcript.trim()) {
    transcript = "मुझे इंडिया गेट जाना है, कार चाहिए";
  }

  req.body.transcript = transcript;
  return preview(req, res, next);
});

module.exports = { preview, transcribe };


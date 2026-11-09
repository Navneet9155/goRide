const mapsService = require("../services/mapsService");
const env = require("../config/env");
const { sendSuccess } = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");

const NOMINATIM_BASE = env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const HEADERS = {
  "User-Agent": "GoRideApp/1.0 (contact@goride.app)",
  "Accept-Language": "en-US,en;q=0.9",
};

const reverseGeocode = catchAsync(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return sendSuccess(res, { data: { address: "Unknown location" } });
  }

  const address = await mapsService.reverseGeocode(lat, lon);
  return sendSuccess(res, { data: { address } });
});

const searchLocations = catchAsync(async (req, res) => {
  const query = (req.query.q || "").trim();
  if (!query || query.length < 2) {
    return sendSuccess(res, { data: [] });
  }

  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      return sendSuccess(res, { data: [] });
    }

    const data = await response.json();
    const results = (Array.isArray(data) ? data : []).map((item) => ({
      address: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    }));

    return sendSuccess(res, { data: results });
  } catch (err) {
    return sendSuccess(res, { data: [] });
  }
});

/**
 * GET /api/maps/places-autocomplete?q=...&lat=...&lng=...
 *
 * Priority chain:
 *  1. LocationIQ free API (5k req/day) — with GPS proximity bias
 *  2. Mapbox free API (100k req/month) — with GPS proximity bias & fuzzy match
 *  3. Nominatim direct fallback
 */
const placesAutocomplete = catchAsync(async (req, res) => {
  const query = (req.query.q || req.query.query || "").trim();
  const userLat = parseFloat(req.query.lat);
  const userLng = parseFloat(req.query.lng);
  const hasCoords = !isNaN(userLat) && !isNaN(userLng);

  if (!query || query.length < 2) {
    return sendSuccess(res, { data: [] });
  }

  // ── 1. LocationIQ ─────────────────────────────────────────────────────
  if (env.LOCATIONIQ_KEY) {
    try {
      const proximityParam = hasCoords ? `&lat=${userLat}&lon=${userLng}` : "";
      const url =
        `https://us1.locationiq.com/v1/autocomplete?key=${env.LOCATIONIQ_KEY}` +
        `&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&dedupe=1${proximityParam}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const results = data.map((item) => ({
            address: item.display_name || item.display_place || "",
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          })).filter((r) => r.address && !isNaN(r.latitude));
          if (results.length > 0) return sendSuccess(res, { data: results });
        }
      }
    } catch { /* fall through */ }
  }

  // ── 2. Mapbox ─────────────────────────────────────────────────────────
  if (env.MAPBOX_KEY) {
    try {
      const proximityParam = hasCoords ? `&proximity=${userLng},${userLat}` : "";
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?country=in&limit=5&access_token=${env.MAPBOX_KEY}${proximityParam}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.features) && data.features.length > 0) {
          const results = data.features.map((f) => ({
            address: f.place_name || "",
            latitude: f.center?.[1] ?? 0,
            longitude: f.center?.[0] ?? 0,
          })).filter((r) => r.address);
          if (results.length > 0) return sendSuccess(res, { data: results });
        }
      }
    } catch { /* fall through */ }
  }

  // ── 3. Nominatim fallback ─────────────────────────────────────────────
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=in`;
    const response = await fetch(url, { headers: HEADERS });
    if (response.ok) {
      const data = await response.json();
      const results = (Array.isArray(data) ? data : []).map((item) => ({
        address: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
      return sendSuccess(res, { data: results });
    }
  } catch { /* ignore */ }

  return sendSuccess(res, { data: [] });
});

const transcriptionService = require("../services/transcriptionService");

const voiceTranscribe = catchAsync(async (req, res, next) => {
  const { audioBase64, language = "hi", lat, lng } = req.body;
  if (!audioBase64) {
    return next(new AppError("Audio data is required", 400));
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const result = await transcriptionService.transcribeAudio(audioBuffer, "audio/m4a", language);

  if (!result.cleanQuery) {
    return sendSuccess(res, {
      message: result.message || "Could not transcribe audio",
      data: {
        transcript: "",
        cleanQuery: "",
        places: [],
        provider: result.provider,
      },
    });
  }

  // Automatically search matching places for the clean destination
  let places = [];
  const query = result.cleanQuery;
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  // 1. Try LocationIQ
  if (env.LOCATIONIQ_KEY) {
    try {
      const proximity = !isNaN(userLat) && !isNaN(userLng) ? `&location=${userLat},${userLng}` : "";
      const url = `https://api.locationiq.com/v1/autocomplete?key=${env.LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&limit=5&countrycodes=in${proximity}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          places = data.map((item) => ({
            address: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          }));
        }
      }
    } catch { /* fallback */ }
  }

  // 2. Try Nominatim if LocationIQ yielded nothing
  if (places.length === 0) {
    try {
      const nominatimUrl = `${env.NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in&addressdetails=1`;
      const r = await fetch(nominatimUrl, {
        headers: { "User-Agent": "GoRide-App/1.0 (support@goride.com)" },
      });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) {
          places = data.map((item) => ({
            address: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          }));
        }
      }
    } catch { /* ignore */ }
  }

  return sendSuccess(res, {
    message: "Voice transcribed successfully",
    data: {
      transcript: result.transcript,
      cleanQuery: result.cleanQuery,
      places,
      provider: result.provider,
    },
  });
});

module.exports = {
  reverseGeocode,
  searchLocations,
  placesAutocomplete,
  voiceTranscribe,
};

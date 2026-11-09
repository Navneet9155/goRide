const logger = require("../utils/logger");

const EARTH_RADIUS_METRES = 6371000;

function distanceMetres(latitude, longitude, targetLatitude, targetLongitude) {
  const radians = (value) => (value * Math.PI) / 180;
  const latDelta = radians(targetLatitude - latitude);
  const lonDelta = radians(targetLongitude - longitude);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(targetLatitude)) * Math.sin(lonDelta / 2) ** 2;
  return Math.round(EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function findNearestPoliceStation(latitude, longitude) {
  const endpoint = (process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter").replace(/\/$/, "");
  const radius = Number(process.env.POLICE_STATION_SEARCH_RADIUS_METRES) || 15000;
  const query = `[out:json][timeout:8];(node["amenity"="police"](around:${radius},${latitude},${longitude});way["amenity"="police"](around:${radius},${latitude},${longitude}););out center tags;`;
  const controller = new AbortController();
  // SOS must not wait on a public map service; proceed with alert delivery quickly.
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "GoRide-Safety/1.0" }, body: new URLSearchParams({ data: query }), signal: controller.signal });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = await response.json();
    const stations = (payload.elements || []).map((element) => {
      const stationLatitude = element.lat ?? element.center?.lat;
      const stationLongitude = element.lon ?? element.center?.lon;
      if (!Number.isFinite(stationLatitude) || !Number.isFinite(stationLongitude)) return null;
      return { name: element.tags?.name || element.tags?.["name:en"] || "Nearest police station", address: [element.tags?.["addr:street"], element.tags?.["addr:city"]].filter(Boolean).join(", ") || null, phone: element.tags?.phone || element.tags?.["contact:phone"] || null, latitude: stationLatitude, longitude: stationLongitude, distanceMetres: distanceMetres(latitude, longitude, stationLatitude, stationLongitude) };
    }).filter(Boolean).sort((a, b) => a.distanceMetres - b.distanceMetres);
    return stations[0] || null;
  } catch (error) {
    logger.warn({ error: error.message }, "Nearest police-station lookup failed");
    return null;
  } finally { clearTimeout(timeout); }
}

module.exports = { findNearestPoliceStation };

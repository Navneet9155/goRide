const router = require("express").Router();
const mapController = require("../controllers/mapController");

router.get("/reverse-geocode", mapController.reverseGeocode);
router.get("/search", mapController.searchLocations);

// Enhanced place autocomplete: LocationIQ → Mapbox → Nominatim fallback chain
// GET /api/maps/places-autocomplete?q=Darbhanga+Station&lat=26.12&lng=85.89
router.get("/places-autocomplete", mapController.placesAutocomplete);

// Voice Destination Transcription + Auto Search
// POST /api/maps/voice-transcribe { audioBase64, language, lat, lng }
router.post("/voice-transcribe", mapController.voiceTranscribe);

module.exports = router;

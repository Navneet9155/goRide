const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { z } = require("zod");
const ctrl = require("../controllers/voiceBookingController");

router.post(
  "/preview",
  authenticate,
  authorize("passenger"),
  validate(
    z.object({
      transcript: z.string().min(1).max(500),
      currentLocation: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    })
  ),
  ctrl.preview
);

router.post(
  "/transcribe",
  authenticate,
  authorize("passenger"),
  validate(
    z.object({
      audioBase64: z.string().min(1),
      currentLocation: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    })
  ),
  ctrl.transcribe
);

module.exports = router;


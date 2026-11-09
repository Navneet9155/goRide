const router = require("express").Router();
const ctrl = require("../controllers/driverController");
const { authenticate, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  registerDriverSchema,
  updateDriverProfileSchema,
  locationUpdateSchema,
} = require("../validators/driverValidators");
const walletController = require("../controllers/walletController");
const { payoutProfileSchema, withdrawalSchema } = require("../validators/driverValidators");

router.post("/register", authLimiter, validate(registerDriverSchema), ctrl.register);
router.post("/login", authLimiter, validate(require("../validators/authValidators").loginSchema), ctrl.login);
// Alias of POST /api/auth/refresh — same handler, since it already
// resolves passenger vs driver from the token itself, not the URL.
router.post("/refresh", authLimiter, require("../controllers/authController").refresh);

router.use(authenticate, authorize("driver"));

router.post("/logout", ctrl.logout);
router.get("/profile", ctrl.getProfile);
router.patch("/profile", validate(updateDriverProfileSchema), ctrl.updateProfile);
router.patch("/change-password", validate(require("../validators/authValidators").changePasswordSchema), ctrl.changePassword);
router.post("/online", ctrl.goOnline);
router.post("/offline", ctrl.goOffline);
router.get("/status", ctrl.getStatus);
router.patch("/location", validate(locationUpdateSchema), ctrl.updateLocation);
router.get("/wallet", walletController.getWallet);
router.put("/payout-profile", validate(payoutProfileSchema), walletController.savePayoutProfile);
router.post("/withdrawals", validate(withdrawalSchema), walletController.requestWithdrawal);
router.get("/withdrawals", walletController.getWithdrawals);

module.exports = router;

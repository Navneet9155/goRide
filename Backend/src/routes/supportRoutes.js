const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const supportController = require("../controllers/supportController");

router.use(authenticate);
router.post("/assistant", supportController.chat);
module.exports = router;

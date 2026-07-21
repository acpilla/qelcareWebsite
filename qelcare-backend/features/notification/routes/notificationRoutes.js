const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/notificationController");
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");

router.use(authenticate);

router.get("/me", ctrl.getMine);
router.patch("/read-all", ctrl.markAllRead);
router.patch("/:id/read", ctrl.markRead);

module.exports = router;

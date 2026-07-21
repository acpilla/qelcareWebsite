const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/inquiryController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

// Public: anyone (no account) can submit an inquiry.
router.post("/", ctrl.create);

// Staff inbox: Admin / Front desk only.
router.get("/", authenticate, authorize(["Admin", "Frontdesk"]), ctrl.list);
router.patch("/:id", authenticate, authorize(["Admin", "Frontdesk"]), ctrl.update);

module.exports = router;

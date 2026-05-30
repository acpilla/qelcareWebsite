const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/queueController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

router.get("/display", ctrl.getDisplay);

router.use(authenticate);

router.get(
  "/specialties",
  authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]),
  ctrl.getSpecialties
);

router.get(
  "/specialty/:specialtyId",
  authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]),
  ctrl.getQueueBySpecialty
);

router.post(
  "/auto-enqueue",
  authorize(["Admin", "Frontdesk"]),
  ctrl.autoEnqueue
);

router.patch(
  "/:queueId/status",
  authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]),
  ctrl.updateStatus
);

module.exports = router;

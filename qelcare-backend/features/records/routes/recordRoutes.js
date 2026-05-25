const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/recordController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

router.use(authenticate);

router.get("/me", authorize(["Patient"]), ctrl.getMyRecords);

router.post("/", authorize(["Doctor"]), ctrl.create);
router.get("/", authorize(["Admin", "Nurse", "Doctor", "Cashier", "Frontdesk"]), ctrl.getAll);
router.get("/patient/:patientId", authorize(["Admin", "Nurse", "Doctor", "Cashier", "Frontdesk"]), ctrl.getByPatient);
router.get("/:id", authorize(["Admin", "Nurse", "Doctor", "Cashier", "Frontdesk"]), ctrl.getById);
router.put("/:id", authorize(["Doctor"]), ctrl.update);
router.patch("/:id", authorize(["Doctor"]), ctrl.update);

module.exports = router;
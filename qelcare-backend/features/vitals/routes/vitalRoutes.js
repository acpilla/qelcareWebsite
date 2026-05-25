const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/vitalController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

router.use(authenticate);

router.get("/me", authorize(["Patient"]), ctrl.getMyVitals);
router.post("/", authorize(["Admin", "Nurse"]), ctrl.create);
router.get("/patient/:patientId/latest", authorize(["Admin", "Nurse", "Doctor"]), ctrl.getLatest);
router.get("/patient/:patientId", authorize(["Admin", "Nurse", "Doctor"]), ctrl.getByPatient);
router.get("/appointment/:appointmentId", authorize(["Admin", "Nurse", "Doctor"]), ctrl.getByAppointment);
router.get("/:id", authorize(["Admin", "Nurse", "Doctor"]), ctrl.getById);

module.exports = router;

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/appointmentController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

router.use(authenticate);

router.get("/me", authorize(["Patient"]), ctrl.getMyAppointments);
router.post("/book", authorize(["Patient"]), ctrl.bookMyAppointment);

router.post("/", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.create);
router.get("/", authorize(["Admin", "Nurse", "Doctor", "Cashier", "Frontdesk"]), ctrl.getAll);
router.get("/today/:doctorId?", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.getTodayByDoctor);
router.get("/:id", authorize(["Admin", "Nurse", "Doctor", "Cashier", "Frontdesk"]), ctrl.getById);
router.put("/:id/status", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.updateStatus);
router.patch("/:id/status", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.updateStatus);
router.put("/:id/reschedule", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.reschedule);
router.patch("/:id/reschedule", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.reschedule);

module.exports = router;

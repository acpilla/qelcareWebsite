const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/patientController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

router.use(authenticate);

router.get("/me", authorize(["Patient"]), ctrl.getMyPatientProfile);

router.post("/", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.create);
router.get("/", authorize(["Admin", "Nurse", "Doctor", "Cashier", "Frontdesk"]), ctrl.getAll);
router.get("/:id", authorize(["Admin", "Nurse", "Doctor", "Cashier", "Frontdesk"]), ctrl.getById);
router.put("/:id", authorize(["Admin", "Nurse", "Doctor", "Frontdesk"]), ctrl.update);
router.patch("/:id/active", authorize(["Admin"]), ctrl.setActive);

module.exports = router;

const express = require("express");
const multer = require("multer");
const router = express.Router();
const ctrl = require("../controllers/patientResultController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

const allowedMime = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMime.has(file.mimetype)) return cb(null, true);
    cb(new Error("Only PNG, JPG, WEBP, and PDF medical result files are allowed."));
  },
});

router.use(authenticate);
router.use(authorize(["Patient"]));

router.get("/me", ctrl.getMine);
router.post("/", upload.single("resultFile"), ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;

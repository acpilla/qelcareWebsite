const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/relativeController");
const { authenticate, authorize } = require("../../../shared/middleware/tokenMiddleware");

// A patient's saved "book for someone else" address book.
router.use(authenticate);
router.use(authorize(["Patient"]));

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;

const router = require("express").Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");
const {
  login,
  logout,
  logoutAll,
  sendOTP,
  verifyOTP,
  resendOTP,
  resetPassword,
  changePassword,
  validateToken,
} = require("../controllers/authController");

// PUBLIC
router.post("/login",           login);
router.post("/otp/send",        sendOTP);
router.post("/otp/verify",      verifyOTP);
router.post("/otp/resend",      resendOTP);
router.post("/password/reset",  resetPassword);

// PROTECTED
router.post("/logout",          authenticate, logout);
router.post("/logout-all",      authenticate, logoutAll);
router.post("/password/change", authenticate, changePassword);
router.get("/validate-token",   authenticate, validateToken);

module.exports = router;

const tokenManager = require("../utils/tokenManager");

// ============================================================
// AUTHENTICATE — verifies JWT on protected routes
// ============================================================
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No authentication token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await tokenManager.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token format" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired. Please login again." });
    }
    return res.status(401).json({ success: false, message: error.message || "Authentication failed" });
  }
};

// ============================================================
// AUTHORIZE — role guard (pass allowed roles as array)
// Usage: authorize(['Admin', 'Doctor'])
// ============================================================
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };

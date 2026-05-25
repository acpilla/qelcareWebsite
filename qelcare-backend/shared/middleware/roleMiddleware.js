/**
 * requireRoles(['admin', 'nurse'])
 * Checks req.user.role (set by tokenMiddleware) against allowed roles.
 */
const requireRoles = (allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'Access denied: insufficient role.' });
  }
  next();
};

module.exports = { requireRoles };
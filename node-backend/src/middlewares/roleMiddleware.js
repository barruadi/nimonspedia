/**
 * Role-Based Access Control Middleware
 * Checks if user has required role(s)
 * 
 * Usage:
 *   - router.post('/seller-only', roleMiddleware(['seller']), handler)
 *   - router.get('/public', roleMiddleware(['buyer', 'seller']), handler)
 *   - router.delete('/admin-only', roleMiddleware(['admin']), handler)
 */
const roleMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.userId) {
        return res.status(401).json({
          ok: false,
          error: 'User not authenticated'
        });
      }

      // If no roles specified, allow all authenticated users
      if (allowedRoles.length === 0) {
        return next();
      }

      const userRole = req.userRole || 'buyer';

      // Check if user role is in allowed roles
      if (!allowedRoles.includes(userRole)) {
        console.warn(
          `[Role] Access denied: User ${req.userId} with role '${userRole}' ` +
          `attempted to access resource requiring: ${allowedRoles.join(', ')}`
        );

        return res.status(403).json({
          ok: false,
          error: `Access denied. This resource requires one of: ${allowedRoles.join(', ')}`
        });
      }

      console.log(`[Role] Access granted: User ${req.userId} (role: ${userRole})`);
      next();

    } catch (error) {
      console.error('[Role] Middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  };
};

module.exports = roleMiddleware;

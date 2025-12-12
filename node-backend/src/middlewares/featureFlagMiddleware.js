/**
 * Feature Flag Middleware
 * Enforces server-side feature flag checks for Node.js routes
 */

const featureFlagService = require('../services/featureFlagService');

/**
 * Middleware to check if a feature is enabled for the current user
 *
 * @param {string} featureName - Feature name to check (checkout_enabled, chat_enabled, auction_enabled)
 * @returns {Function} Express middleware function
 */
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      // Get user ID from request (set by auth middleware)
      const userId = req.userId || req.user?.user_id || null;

      // Check if feature is enabled
      const featureStatus = await featureFlagService.isFeatureEnabled(featureName, userId);

      if (!featureStatus.enabled) {
        // Feature is disabled
        console.log(`[FeatureFlag] ${featureName} is disabled for user ${userId || 'guest'}`);

        return res.status(403).json({
          ok: false,
          error: {
            code: 'FEATURE_DISABLED',
            message: 'This feature is currently disabled',
            feature: featureName,
            reason: featureStatus.reason,
            isGlobal: featureStatus.isGlobal
          }
        });
      }

      // Feature is enabled, continue to next middleware/handler
      next();
    } catch (error) {
      console.error('[FeatureFlag] Error checking feature flag:', error);
      // On error, allow request to proceed to avoid breaking the application
      next();
    }
  };
};

/**
 * Middleware to check checkout feature
 */
const requireCheckout = () => {
  return requireFeature('checkout_enabled');
};

/**
 * Middleware to check chat feature
 */
const requireChat = () => {
  return requireFeature('chat_enabled');
};

/**
 * Middleware to check auction feature
 */
const requireAuction = () => {
  return requireFeature('auction_enabled');
};

module.exports = {
  requireFeature,
  requireCheckout,
  requireChat,
  requireAuction
};

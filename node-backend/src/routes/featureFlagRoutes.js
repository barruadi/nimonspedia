const express = require('express');
const verifyUser = require('../middlewares/authMiddleware');
const {
  getUserFeatureFlags,
  getGlobalFeatureFlags,
  updateGlobalFeatureFlag,
  getUserSpecificFlags,
  updateUserFeatureFlag,
  deleteUserFlag,
  searchUsers
} = require('../controllers/featureFlagController');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      ok: false,
      error: 'Admin access required'
    });
  }
  next();
};

/**
 * Public/User Endpoints
 */

// Get feature flags for current authenticated user
router.get('/feature-flags', verifyUser, getUserFeatureFlags);

/**
 * Admin Endpoints
 */

// Get all global feature flags
router.get('/admin/feature-flags/global', verifyUser, requireAdmin, getGlobalFeatureFlags);

// Update global feature flag
router.put('/admin/feature-flags/global', verifyUser, requireAdmin, updateGlobalFeatureFlag);

// Search users
router.get('/admin/feature-flags/users/search', verifyUser, requireAdmin, searchUsers);

// Get user-specific feature flags
router.get('/admin/feature-flags/user/:userId', verifyUser, requireAdmin, getUserSpecificFlags);

// Update user-specific feature flag
router.put('/admin/feature-flags/user/:userId', verifyUser, requireAdmin, updateUserFeatureFlag);

// Delete user-specific feature flag (revert to global)
router.delete('/admin/feature-flags/user/:userId/:featureName', verifyUser, requireAdmin, deleteUserFlag);

module.exports = router;

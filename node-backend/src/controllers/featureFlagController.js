const {
  getAllFeatureFlags,
  setUserFeatureFlag,
  setGlobalFeatureFlag,
  deleteUserFeatureFlag
} = require('../services/featureFlagService');
const database = require('../config/db');

/**
 * Get feature flags for current user
 * GET /api/node/feature-flags
 */
async function getUserFeatureFlags(req, res) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'User not authenticated'
      });
    }

    const flags = await getAllFeatureFlags(userId);

    console.log(`[FeatureFlagController] Sending flags for user ${userId}:`, flags);

    return res.json({
      ok: true,
      flags
    });
  } catch (error) {
    console.error('[FeatureFlag] Error getting user flags:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to get feature flags'
    });
  }
}

/**
 * Get all global feature flags (Admin only)
 * GET /api/node/admin/feature-flags/global
 */
async function getGlobalFeatureFlags(req, res) {
  try {
    const pool = database.getInstance();

    const query = `
      SELECT feature_name, is_enabled, reason, updated_at
      FROM user_feature_access
      WHERE user_id IS NULL
      ORDER BY feature_name
    `;

    const result = await pool.query(query);

    // Create object with all features, defaulting to enabled if not found
    const flags = {
      auction_enabled: { enabled: true, reason: null },
      chat_enabled: { enabled: true, reason: null },
      checkout_enabled: { enabled: true, reason: null }
    };

    result.rows.forEach(row => {
      flags[row.feature_name] = {
        enabled: row.is_enabled,
        reason: row.reason,
        updatedAt: row.updated_at
      };
    });

    return res.json({
      ok: true,
      flags
    });
  } catch (error) {
    console.error('[FeatureFlag] Error getting global flags:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to get global feature flags'
    });
  }
}

/**
 * Set global feature flag (Admin only)
 * PUT /api/node/admin/feature-flags/global
 * Body: { feature_name, is_enabled, reason }
 */
async function updateGlobalFeatureFlag(req, res) {
  try {
    const { feature_name, is_enabled, reason } = req.body;

    // Validate feature name
    const validFeatures = ['auction_enabled', 'chat_enabled', 'checkout_enabled'];
    if (!validFeatures.includes(feature_name)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid feature name'
      });
    }

    if (typeof is_enabled !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: 'is_enabled must be a boolean'
      });
    }

    await setGlobalFeatureFlag(feature_name, is_enabled, reason || null);

    return res.json({
      ok: true,
      message: 'Global feature flag updated successfully'
    });
  } catch (error) {
    console.error('[FeatureFlag] Error updating global flag:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to update global feature flag'
    });
  }
}

/**
 * Get user-specific feature flags (Admin only)
 * GET /api/node/admin/feature-flags/user/:userId
 */
async function getUserSpecificFlags(req, res) {
  try {
    const { userId } = req.params;
    const pool = database.getInstance();

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT user_id, email, full_name, role FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'User not found'
      });
    }

    const user = userCheck.rows[0];

    // Get user-specific flags
    const query = `
      SELECT feature_name, is_enabled, reason, updated_at
      FROM user_feature_access
      WHERE user_id = $1
      ORDER BY feature_name
    `;

    const result = await pool.query(query, [userId]);

    // Determine which features are available based on role
    const availableFeatures = user.role === 'seller'
      ? ['auction_enabled', 'chat_enabled']
      : ['auction_enabled', 'chat_enabled', 'checkout_enabled'];

    const flags = {};
    availableFeatures.forEach(feature => {
      flags[feature] = { enabled: null, reason: null }; // null means using global/default
    });

    result.rows.forEach(row => {
      if (availableFeatures.includes(row.feature_name)) {
        flags[row.feature_name] = {
          enabled: row.is_enabled,
          reason: row.reason,
          updatedAt: row.updated_at
        };
      }
    });

    return res.json({
      ok: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      flags
    });
  } catch (error) {
    console.error('[FeatureFlag] Error getting user flags:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to get user feature flags'
    });
  }
}

/**
 * Set user-specific feature flag (Admin only)
 * PUT /api/node/admin/feature-flags/user/:userId
 * Body: { feature_name, is_enabled, reason }
 */
async function updateUserFeatureFlag(req, res) {
  try {
    const { userId } = req.params;
    const { feature_name, is_enabled, reason } = req.body;
    const pool = database.getInstance();

    // Check if user exists and get role
    const userCheck = await pool.query(
      'SELECT user_id, role FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'User not found'
      });
    }

    const user = userCheck.rows[0];

    // Validate feature name based on role
    const validFeatures = user.role === 'seller'
      ? ['auction_enabled', 'chat_enabled']
      : ['auction_enabled', 'chat_enabled', 'checkout_enabled'];

    if (!validFeatures.includes(feature_name)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid feature name for ${user.role}`
      });
    }

    if (typeof is_enabled !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: 'is_enabled must be a boolean'
      });
    }

    await setUserFeatureFlag(userId, feature_name, is_enabled, reason || null);

    return res.json({
      ok: true,
      message: 'User feature flag updated successfully'
    });
  } catch (error) {
    console.error('[FeatureFlag] Error updating user flag:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to update user feature flag'
    });
  }
}

/**
 * Delete user-specific feature flag (revert to global/default)
 * DELETE /api/node/admin/feature-flags/user/:userId/:featureName
 */
async function deleteUserFlag(req, res) {
  try {
    const { userId, featureName } = req.params;

    await deleteUserFeatureFlag(userId, featureName);

    return res.json({
      ok: true,
      message: 'User feature flag deleted successfully'
    });
  } catch (error) {
    console.error('[FeatureFlag] Error deleting user flag:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to delete user feature flag'
    });
  }
}

/**
 * Search users for feature flag management (Admin only)
 * GET /api/node/admin/feature-flags/users/search?q=email
 */
async function searchUsers(req, res) {
  try {
    const { q } = req.query;
    const pool = database.getInstance();

    if (!q || q.length < 2) {
      return res.status(400).json({
        ok: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const query = `
      SELECT user_id, email, full_name, role
      FROM users
      WHERE (email ILIKE $1 OR full_name ILIKE $1)
        AND role IN ('buyer', 'seller')
      ORDER BY email
      LIMIT 20
    `;

    const result = await pool.query(query, [`%${q}%`]);

    return res.json({
      ok: true,
      users: result.rows
    });
  } catch (error) {
    console.error('[FeatureFlag] Error searching users:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to search users'
    });
  }
}

module.exports = {
  getUserFeatureFlags,
  getGlobalFeatureFlags,
  updateGlobalFeatureFlag,
  getUserSpecificFlags,
  updateUserFeatureFlag,
  deleteUserFlag,
  searchUsers
};

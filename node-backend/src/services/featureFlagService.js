/**
 * Feature Flag Service
 * Handles server-side feature flag checks for Node.js backend
 */

const database = require('../config/db');
const pool = database.getInstance();

/**
 * Check if a feature is enabled for a specific user
 *
 * Logic:
 * 1. Check global setting (user_id IS NULL)
 * 2. Check user-specific setting (user_id is set)
 * 3. If EITHER global OR user is disabled → result is DISABLED
 * 4. If no records found, default to enabled (true)
 *
 * @param {string} featureName - Feature name (checkout_enabled, chat_enabled, auction_enabled)
 * @param {number|null} userId - User ID to check for, null to check only global
 * @returns {Promise<{enabled: boolean, reason: string|null, isGlobal: boolean}>}
 */
async function isFeatureEnabled(featureName, userId = null) {
  try {
    let globalEnabled = true;
    let globalReason = null;
    let userEnabled = true;
    let userReason = null;

    // Check global setting (user_id IS NULL)
    const globalQuery = `
      SELECT is_enabled, reason
      FROM user_feature_access
      WHERE feature_name = $1 AND user_id IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const globalResult = await pool.query(globalQuery, [featureName]);

    if (globalResult.rows.length > 0) {
      const row = globalResult.rows[0];
      globalEnabled = row.is_enabled;
      globalReason = row.reason;
    }

    // If user is specified, check user-specific setting
    if (userId !== null) {
      const userQuery = `
        SELECT is_enabled, reason
        FROM user_feature_access
        WHERE feature_name = $1 AND user_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      const userResult = await pool.query(userQuery, [featureName, userId]);

      if (userResult.rows.length > 0) {
        const row = userResult.rows[0];
        userEnabled = row.is_enabled;
        userReason = row.reason;
      }
    }

    // Feature is enabled ONLY if BOTH global AND user are enabled
    // If either is disabled, the feature is disabled
    const finalEnabled = globalEnabled && userEnabled;
    const finalReason = !globalEnabled ? globalReason : (!userEnabled ? userReason : null);
    const isGlobal = !globalEnabled;

    console.log(`[FeatureFlag] ${featureName} for user ${userId}:`, {
      globalEnabled,
      userEnabled,
      finalEnabled,
      finalReason
    });

    return {
      enabled: finalEnabled,
      reason: finalReason,
      isGlobal: isGlobal
    };
  } catch (error) {
    console.error('[FeatureFlagService] Error checking feature flag:', error);
    // On error, default to enabled to avoid breaking the application
    return {
      enabled: true,
      reason: null,
      isGlobal: false
    };
  }
}

/**
 * Check if checkout is enabled for a user
 */
async function isCheckoutEnabled(userId = null) {
  return isFeatureEnabled('checkout_enabled', userId);
}

/**
 * Check if chat is enabled for a user
 */
async function isChatEnabled(userId = null) {
  return isFeatureEnabled('chat_enabled', userId);
}

/**
 * Check if auction is enabled for a user
 */
async function isAuctionEnabled(userId = null) {
  return isFeatureEnabled('auction_enabled', userId);
}

/**
 * Get all feature flags for a user (for frontend)
 */
async function getAllFeatureFlags(userId = null) {
  const [checkout, chat, auction] = await Promise.all([
    isCheckoutEnabled(userId),
    isChatEnabled(userId),
    isAuctionEnabled(userId)
  ]);

  return {
    checkout_enabled: checkout,
    chat_enabled: chat,
    auction_enabled: auction
  };
}

/**
 * Set feature flag for a user (Admin function)
 */
async function setUserFeatureFlag(userId, featureName, isEnabled, reason = null) {
  try {
    // Check if entry exists
    const checkQuery = `
      SELECT access_id FROM user_feature_access
      WHERE user_id = $1 AND feature_name = $2
    `;
    const checkResult = await pool.query(checkQuery, [userId, featureName]);

    if (checkResult.rows.length > 0) {
      // Update existing
      const updateQuery = `
        UPDATE user_feature_access
        SET is_enabled = $1, reason = $2, updated_at = NOW()
        WHERE access_id = $3
      `;
      await pool.query(updateQuery, [isEnabled, reason, checkResult.rows[0].access_id]);
    } else {
      // Insert new
      const insertQuery = `
        INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
      `;
      await pool.query(insertQuery, [userId, featureName, isEnabled, reason]);
    }

    return true;
  } catch (error) {
    console.error('[FeatureFlagService] Error setting user feature flag:', error);
    throw error;
  }
}

/**
 * Set global feature flag (Admin function)
 */
async function setGlobalFeatureFlag(featureName, isEnabled, reason = null) {
  try {
    // Check if global entry exists
    const checkQuery = `
      SELECT access_id FROM user_feature_access
      WHERE user_id IS NULL AND feature_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [featureName]);

    if (checkResult.rows.length > 0) {
      // Update existing
      const updateQuery = `
        UPDATE user_feature_access
        SET is_enabled = $1, reason = $2, updated_at = NOW()
        WHERE access_id = $3
      `;
      await pool.query(updateQuery, [isEnabled, reason, checkResult.rows[0].access_id]);
    } else {
      // Insert new
      const insertQuery = `
        INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
        VALUES (NULL, $1, $2, $3, NOW())
      `;
      await pool.query(insertQuery, [featureName, isEnabled, reason]);
    }

    return true;
  } catch (error) {
    console.error('[FeatureFlagService] Error setting global feature flag:', error);
    throw error;
  }
}

/**
 * Delete user-specific feature flag (reverts to global/default)
 */
async function deleteUserFeatureFlag(userId, featureName) {
  try {
    const deleteQuery = `
      DELETE FROM user_feature_access
      WHERE user_id = $1 AND feature_name = $2
    `;
    await pool.query(deleteQuery, [userId, featureName]);
    return true;
  } catch (error) {
    console.error('[FeatureFlagService] Error deleting user feature flag:', error);
    throw error;
  }
}

module.exports = {
  isFeatureEnabled,
  isCheckoutEnabled,
  isChatEnabled,
  isAuctionEnabled,
  getAllFeatureFlags,
  setUserFeatureFlag,
  setGlobalFeatureFlag,
  deleteUserFeatureFlag
};

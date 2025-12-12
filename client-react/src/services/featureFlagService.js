/**
 * Feature Flag Service
 * Handles fetching and caching feature flags from the backend
 */

const API_BASE_URL = '/api/node';

// In-memory cache for feature flags
let flagsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch feature flags for current user from server
 */
export async function fetchFeatureFlags() {
  try {
    // Check cache first
    if (flagsCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
      console.log('[FeatureFlags] Using cached flags');
      return flagsCache;
    }

    console.log('[FeatureFlags] Fetching from server...');

    // Get user_id from session
    const userId = await getUserIdFromSession();
    
    if (!userId) {
      console.warn('[FeatureFlags] No user_id found, using defaults');
      return getDefaultFlags();
    }

    const response = await fetch(`${API_BASE_URL}/feature-flags?user_id=${userId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('[FeatureFlags] Failed to fetch flags');
      return getDefaultFlags();
    }

    const data = await response.json();
    
    if (!data.ok || !data.flags) {
      console.error('[FeatureFlags] Invalid response format');
      return getDefaultFlags();
    }

    flagsCache = data.flags;
    cacheTimestamp = Date.now();

    console.log('[FeatureFlags] Flags fetched:', flagsCache);
    return flagsCache;
  } catch (error) {
    console.error('[FeatureFlags] Error fetching flags:', error);
    return getDefaultFlags();
  }
}

/**
 * Get default enabled flags
 */
function getDefaultFlags() {
  return {
    auction_enabled: { enabled: true, reason: null, isGlobal: false },
    chat_enabled: { enabled: true, reason: null, isGlobal: false },
    checkout_enabled: { enabled: true, reason: null, isGlobal: false }
  };
}

/**
 * Clear feature flags cache (call when user logs in/out or when flags change)
 */
export function clearFeatureFlagsCache() {
  flagsCache = null;
  cacheTimestamp = null;
  console.log('[FeatureFlags] Cache cleared');
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(featureName) {
  const flags = await fetchFeatureFlags();
  return flags[featureName]?.enabled !== false;
}

/**
 * Check if auction is enabled
 */
export async function isAuctionEnabled() {
  return isFeatureEnabled('auction_enabled');
}

/**
 * Check if chat is enabled
 */
export async function isChatEnabled() {
  return isFeatureEnabled('chat_enabled');
}

/**
 * Check if checkout is enabled
 */
export async function isCheckoutEnabled() {
  return isFeatureEnabled('checkout_enabled');
}

/**
 * Get reason for feature being disabled (if any)
 */
export async function getDisabledReason(featureName) {
  const flags = await fetchFeatureFlags();
  const flag = flags[featureName];

  if (!flag || flag.enabled) {
    return null;
  }

  return {
    reason: flag.reason || (flag.isGlobal ? 'Maintenance' : 'Feature temporarily unavailable'),
    isGlobal: flag.isGlobal
  };
}

/**
 * Helper to get user ID from session
 */
async function getUserIdFromSession() {
  try {
    const response = await fetch('/api/me', {
      credentials: 'include'
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.authenticated || !data.user) {
      return null;
    }

    return data.user.user_id || data.user.id;
  } catch (error) {
    console.error('[FeatureFlags] Error getting user session:', error);
    return null;
  }
}

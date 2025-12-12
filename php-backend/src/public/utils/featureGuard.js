import { api } from './api.js';

/**
 * Feature Guard for PHP Backend
 * Checks if user has access to a feature, redirects to disabled page if not
 */

class FeatureGuard {
  constructor() {
    this.flagsCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch feature flags for current user
   */
  async fetchFeatureFlags() {
    try {
      // Check cache first
      if (this.flagsCache && this.cacheTimestamp && Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
        console.log('[FeatureGuard] Using cached flags');
        return this.flagsCache;
      }

      console.log('[FeatureGuard] Fetching feature flags from server...');

      // Get user session first
      const session = await api.get('/me');
      
      if (!session || !session.authenticated || !session.user) {
        console.warn('[FeatureGuard] User not authenticated');
        return this.getDefaultFlags();
      }

      const userId = session.user.user_id || session.user.id;

      // Fetch flags with user_id
      const response = await api.get(`/node/feature-flags?user_id=${userId}`);

      if (!response || !response.ok || !response.flags) {
        console.error('[FeatureGuard] Invalid flags response');
        return this.getDefaultFlags();
      }

      this.flagsCache = response.flags;
      this.cacheTimestamp = Date.now();

      console.log('[FeatureGuard] Flags loaded:', this.flagsCache);
      return this.flagsCache;

    } catch (error) {
      console.error('[FeatureGuard] Error fetching flags:', error);
      return this.getDefaultFlags();
    }
  }

  /**
   * Get default enabled flags
   */
  getDefaultFlags() {
    return {
      auction_enabled: { enabled: true, reason: null, isGlobal: false },
      chat_enabled: { enabled: true, reason: null, isGlobal: false },
      checkout_enabled: { enabled: true, reason: null, isGlobal: false }
    };
  }

  /**
   * Check if feature is enabled
   */
  async isFeatureEnabled(featureName) {
    const flags = await this.fetchFeatureFlags();
    return flags[featureName]?.enabled !== false;
  }

  /**
   * Get disabled reason
   */
  async getDisabledReason(featureName) {
    const flags = await this.fetchFeatureFlags();
    const flag = flags[featureName];

    if (!flag || flag.enabled) {
      return null;
    }

    return {
      reason: flag.reason || (flag.isGlobal ? 'Fitur ini sedang dalam pemeliharaan (maintenance)' : 'Akses Anda ke fitur ini telah dibatasi'),
      isGlobal: flag.isGlobal
    };
  }

  /**
   * Guard a page - redirect if feature is disabled
   */
  async guardPage(featureName, redirectPath = '/feature-disabled') {
    const isEnabled = await this.isFeatureEnabled(featureName);
    
    if (!isEnabled) {
      console.log(`[FeatureGuard] Feature ${featureName} is disabled, redirecting...`);
      const reason = await this.getDisabledReason(featureName);
      
      // Store reason in sessionStorage for disabled page to access
      sessionStorage.setItem('disabledFeatureInfo', JSON.stringify({
        featureName: this.getFeatureDisplayName(featureName),
        reason: reason?.reason,
        isGlobal: reason?.isGlobal || false,
        timestamp: Date.now()
      }));

      // Redirect to disabled page
      window.location.href = redirectPath;
      return false;
    }

    return true;
  }

  /**
   * Get feature display name
   */
  getFeatureDisplayName(featureName) {
    switch (featureName) {
      case 'auction_enabled':
        return 'Lelang (Auction)';
      case 'chat_enabled':
        return 'Chat';
      case 'checkout_enabled':
        return 'Checkout';
      default:
        return 'Fitur';
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.flagsCache = null;
    this.cacheTimestamp = null;
    console.log('[FeatureGuard] Cache cleared');
  }
}

// Export singleton instance
export const featureGuard = new FeatureGuard();

// Export guard functions for easy use
export async function guardAuction() {
  return featureGuard.guardPage('auction_enabled');
}

export async function guardChat() {
  return featureGuard.guardPage('chat_enabled');
}

export async function guardCheckout() {
  return featureGuard.guardPage('checkout_enabled');
}

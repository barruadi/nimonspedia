import { useState, useEffect, useCallback } from 'react';
import { fetchFeatureFlags, clearFeatureFlagsCache } from '../services/featureFlagService';

/**
 * Custom hook to manage feature flags
 * @returns {object} Feature flags state and helpers
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const fetchedFlags = await fetchFeatureFlags();
      setFlags(fetchedFlags);
    } catch (err) {
      console.error('[useFeatureFlags] Error loading flags:', err);
      setError(err.message);

      // Set default flags on error
      setFlags({
        auction_enabled: { enabled: true, reason: null, isGlobal: false },
        chat_enabled: { enabled: true, reason: null, isGlobal: false },
        checkout_enabled: { enabled: true, reason: null, isGlobal: false }
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const refreshFlags = useCallback(() => {
    clearFeatureFlagsCache();
    loadFlags();
  }, [loadFlags]);

  const isEnabled = useCallback((featureName) => {
    if (!flags) return true; // Default to enabled while loading
    return flags[featureName]?.enabled !== false;
  }, [flags]);

  const getDisabledReason = useCallback((featureName) => {
    if (!flags || !flags[featureName]) return null;

    const flag = flags[featureName];
    if (flag.enabled) return null;

    return {
      reason: flag.reason || (flag.isGlobal ? 'Maintenance' : 'Feature temporarily unavailable'),
      isGlobal: flag.isGlobal
    };
  }, [flags]);

  return {
    flags,
    loading,
    error,
    isEnabled,
    isAuctionEnabled: isEnabled('auction_enabled'),
    isChatEnabled: isEnabled('chat_enabled'),
    isCheckoutEnabled: isEnabled('checkout_enabled'),
    getDisabledReason,
    refreshFlags
  };
}

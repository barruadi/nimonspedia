import { useState, useEffect, useCallback } from 'react';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isSubscribed as checkIsSubscribed,
  updateNotificationPreferences,
  getNotificationPreferences
} from '../utils/pushNotifications';

/**
 * Custom hook for managing push notifications
 */
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState({
    chat: true,
    auction: true,
    order: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check support and permission on mount
  useEffect(() => {
    const checkSupport = () => {
      const supported = isPushNotificationSupported();
      setIsSupported(supported);

      if (supported) {
        const perm = getNotificationPermission();
        setPermission(perm);
      }
    };

    checkSupport();
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const subscribed = await checkIsSubscribed();
      setIsSubscribed(subscribed);

      if (subscribed) {
        const prefs = await getNotificationPreferences();
        setPreferences(prefs);
      }
    } catch (err) {
      console.error('[usePushNotifications] Error checking subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load subscription status on mount
  useEffect(() => {
    if (isSupported) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [isSupported, checkSubscription]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (initialPreferences) => {
    try {
      setLoading(true);
      setError(null);

      await subscribeToPushNotifications(initialPreferences || preferences);

      setIsSubscribed(true);
      setPermission('granted');

      if (initialPreferences) {
        setPreferences(initialPreferences);
      }

      return true;
    } catch (err) {
      console.error('[usePushNotifications] Error subscribing:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [preferences]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await unsubscribeFromPushNotifications();

      setIsSubscribed(false);

      return true;
    } catch (err) {
      console.error('[usePushNotifications] Error unsubscribing:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update preferences
  const updatePreferences = useCallback(async (newPreferences) => {
    try {
      setLoading(true);
      setError(null);

      await updateNotificationPreferences(newPreferences);

      setPreferences(newPreferences);

      return true;
    } catch (err) {
      console.error('[usePushNotifications] Error updating preferences:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    loading,
    error,
    subscribe,
    unsubscribe,
    updatePreferences,
    checkSubscription
  };
}

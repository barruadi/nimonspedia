/**
 * usePushNotifications - React Hook for Push Notifications
 * Integrates with AuthContext to subscribe/unsubscribe users
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const VAPID_PUBLIC_KEY_ENDPOINT = '/api/node/push/public-key';
const SUBSCRIBE_ENDPOINT = '/api/node/push/subscribe';
const UNSUBSCRIBE_ENDPOINT = '/api/node/push/unsubscribe';

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if browser supports push notifications
 */
export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get VAPID public key from server
 */
async function getVapidPublicKey() {
  try {
    const response = await fetch(VAPID_PUBLIC_KEY_ENDPOINT);
    const data = await response.json();
    return data.publicKey;
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
    throw error;
  }
}

/**
 * React Hook for Push Notifications
 */
export const usePushNotifications = () => {
  const { user, authenticated, loading: authLoading } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  // Check subscription status on mount
  useEffect(() => {
    if (!isPushNotificationSupported() || authLoading) {
      return;
    }

    checkSubscriptionStatus();
  }, [authLoading]);

  const checkSubscriptionStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        setSubscribed(false);
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(subscription !== null);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setSubscribed(false);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isPushNotificationSupported()) {
      console.warn('Push notifications are not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setError(error.message);
      return false;
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isPushNotificationSupported()) {
      setError('Push notifications are not supported');
      return false;
    }

    if (!authenticated || !user?.userId) {
      setError('User must be authenticated to subscribe');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[Push] Starting subscription process for user:', user.userId);

      // Request permission
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      // Register or get service worker
      let registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        console.log('[Push] Registering service worker...');
        registration = await navigator.serviceWorker.register('/service-worker.js');
        await navigator.serviceWorker.ready;
      }

      console.log('[Push] Service worker ready');

      // Get VAPID public key
      const vapidPublicKey = await getVapidPublicKey();
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push manager
      console.log('[Push] Subscribing to push manager...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      console.log('[Push] Push subscription created');

      // Send subscription to server
      console.log('[Push] Sending subscription to server...');
      const response = await fetch(SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          subscription: subscription.toJSON(),
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to subscribe');
      }

      console.log('[Push] Successfully subscribed to push notifications');
      setSubscribed(true);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('[Push] Error subscribing to push notifications:', error);
      setError(error.message);
      setLoading(false);
      return false;
    }
  }, [authenticated, user, requestPermission]);

  const unsubscribe = useCallback(async () => {
    if (!isPushNotificationSupported()) {
      return false;
    }

    if (!authenticated || !user?.userId) {
      setError('User must be authenticated to unsubscribe');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        console.log('No active subscription found');
        setSubscribed(false);
        setLoading(false);
        return true;
      }

      // Unsubscribe from push manager
      const unsubscribed = await subscription.unsubscribe();

      if (unsubscribed) {
        // Notify server
        const response = await fetch(UNSUBSCRIBE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.userId,
            endpoint: subscription.endpoint,
          }),
        });

        const result = await response.json();

        if (!result.ok) {
          console.error('Failed to notify server of unsubscription');
        }

        console.log('Successfully unsubscribed from push notifications');
        setSubscribed(false);
      }

      setLoading(false);
      return unsubscribed;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setError(error.message);
      setLoading(false);
      return false;
    }
  }, [authenticated, user]);

  return {
    subscribed,
    loading,
    error,
    permission,
    isSupported: isPushNotificationSupported(),
    subscribe,
    unsubscribe,
    requestPermission,
  };
};

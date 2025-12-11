// Push Notification Utility Functions

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/node';

/**
 * Get current authenticated user from /api/me
 */
async function getCurrentUser() {
  try {
    const response = await fetch('/api/me', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to get current user');
    }

    const data = await response.json();

    if (!data.authenticated || !data.user) {
      throw new Error('User not authenticated');
    }

    // Normalize user object
    return {
      user_id: data.user.user_id || data.user.id || data.user.userId,
      full_name: data.user.full_name || data.user.fullName || data.user.name,
      role: data.user.role,
      email: data.user.email,
      ...data.user
    };
  } catch (error) {
    console.error('[Push] Error getting current user:', error);
    throw error;
  }
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Register service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    console.log('[Push] Service worker registered:', registration);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    throw error;
  }
}

/**
 * Get VAPID public key from server
 */
async function getVapidPublicKey() {
  try {
    console.log('[Push] Fetching VAPID public key...');
    const response = await fetch(`${API_BASE_URL}/push/public-key`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Push] Error fetching VAPID key:', errorData);
      throw new Error('Failed to fetch VAPID public key');
    }

    const data = await response.json();
    console.log('[Push] VAPID public key received');
    return data.publicKey;
  } catch (error) {
    console.error('[Push] Error fetching VAPID public key:', error);
    throw error;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(preferences = {}) {
  try {
    // Check if push notifications are supported
    if (!isPushNotificationSupported()) {
      throw new Error('Push notifications are not supported');
    }

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    // Register service worker
    const registration = await registerServiceWorker();

    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    console.log('[Push] Push subscription created:', subscription);

    // Get current authenticated user
    const currentUser = await getCurrentUser();
    console.log('[Push] Current user:', currentUser);

    // Send subscription to server
    console.log('[Push] Sending subscription to server...');

    const response = await fetch(`${API_BASE_URL}/push/subscribe?user_id=${currentUser.user_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        user_id: currentUser.user_id,
        subscription: subscription.toJSON(),
        preferences: {
          chat: preferences.chat !== undefined ? preferences.chat : true,
          auction: preferences.auction !== undefined ? preferences.auction : true,
          order: preferences.order !== undefined ? preferences.order : true
        }
      })
    });

    console.log('[Push] Server response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Push] Server error:', errorData);
      throw new Error(errorData.error || `Failed to save push subscription (${response.status})`);
    }

    const result = await response.json();
    console.log('[Push] Subscription saved to server:', result);

    return subscription;
  } catch (error) {
    console.error('[Push] Error subscribing to push notifications:', error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications() {
  try {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[Push] No subscription found');
      return;
    }

    // Get current user
    const currentUser = await getCurrentUser();

    // Unsubscribe from push manager
    await subscription.unsubscribe();
    console.log('[Push] Unsubscribed from push notifications');

    // Remove subscription from server
    const response = await fetch(`${API_BASE_URL}/push/unsubscribe?user_id=${currentUser.user_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        user_id: currentUser.user_id,
        endpoint: subscription.endpoint
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('[Push] Failed to remove subscription from server:', errorData);
    } else {
      console.log('[Push] Subscription removed from server');
    }
  } catch (error) {
    console.error('[Push] Error unsubscribing from push notifications:', error);
    throw error;
  }
}

/**
 * Check if user is currently subscribed
 */
export async function isSubscribed() {
  try {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription !== null;
  } catch (error) {
    console.error('[Push] Error checking subscription status:', error);
    return false;
  }
}

/**
 * Get current subscription
 */
export async function getSubscription() {
  try {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription;
  } catch (error) {
    console.error('[Push] Error getting subscription:', error);
    return null;
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(preferences) {
  try {
    const subscription = await getSubscription();

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Get current user
    const currentUser = await getCurrentUser();

    const response = await fetch(`${API_BASE_URL}/push/subscribe?user_id=${currentUser.user_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        user_id: currentUser.user_id,
        subscription: subscription.toJSON(),
        preferences: {
          chat: preferences.chat !== undefined ? preferences.chat : true,
          auction: preferences.auction !== undefined ? preferences.auction : true,
          order: preferences.order !== undefined ? preferences.order : true
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Push] Error updating preferences:', errorData);
      throw new Error('Failed to update preferences');
    }

    const result = await response.json();
    console.log('[Push] Preferences updated:', result);

    return result;
  } catch (error) {
    console.error('[Push] Error updating preferences:', error);
    throw error;
  }
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences() {
  try {
    // Get current user
    const currentUser = await getCurrentUser();

    const response = await fetch(`${API_BASE_URL}/push/preferences?user_id=${currentUser.user_id}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Push] Error fetching preferences:', errorData);
      throw new Error('Failed to fetch preferences');
    }

    const data = await response.json();
    return data.preferences || { chat: true, auction: true, order: true };
  } catch (error) {
    console.error('[Push] Error fetching preferences:', error);
    throw error;
  }
}

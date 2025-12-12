// Push Notification Helper
// Utility functions for managing push notifications

const VAPID_PUBLIC_KEY_ENDPOINT = '/api/node/push/public-key';
const SUBSCRIBE_ENDPOINT = '/api/node/push/subscribe';
const UNSUBSCRIBE_ENDPOINT = '/api/node/push/unsubscribe';

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

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
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
    if (!isPushNotificationSupported()) {
        console.warn('Push notifications are not supported');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
    }
}

/**
 * Register service worker
 */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker not supported');
    }

    try {
        // Get existing registration (should be registered by serviceWorkerManager)
        let registration = await navigator.serviceWorker.getRegistration();
        
        if (!registration) {
            // If not registered yet, import and use the manager
            const { registerServiceWorker } = await import('/utils/serviceWorkerManager.js');
            registration = await registerServiceWorker();
            console.log('Service Worker registered via manager:', registration);
        } else {
            console.log('Service Worker already registered:', registration);
        }
        
        if (!registration) {
            throw new Error('Failed to get service worker registration');
        }
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Service worker ready timeout')), 10000);
        });
        
        await Promise.race([
            navigator.serviceWorker.ready,
            timeoutPromise
        ]);
        
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
    }
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
 * Subscribe user to push notifications
 */
export async function subscribeToPushNotifications(userId) {
    if (!isPushNotificationSupported()) {
        throw new Error('Push notifications are not supported');
    }

    if (!userId) {
        console.error('[Push] userId is required but received:', userId);
        throw new Error('User ID is required');
    }

    try {
        console.log('[Push] Starting subscription process for user:', userId);
        
        const permission = await requestNotificationPermission();
        console.log('[Push] Permission result:', permission);
        
        if (!permission) {
            throw new Error('Notification permission denied');
        }

        console.log('[Push] Registering service worker...');
        const registration = await registerServiceWorker();
        console.log('[Push] Service worker registered');

        console.log('[Push] Fetching VAPID public key...');
        const vapidPublicKey = await getVapidPublicKey();
        console.log('[Push] VAPID key received');
        
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        console.log('[Push] Subscribing to push manager...');
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });
        console.log('[Push] Push subscription created');

        console.log('[Push] Sending subscription to server...');
        const response = await fetch(SUBSCRIBE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for session
            body: JSON.stringify({
                userId: userId,
                subscription: subscription.toJSON()
            })
        });

        const result = await response.json();
        console.log('[Push] Server response:', result);
        
        if (!result.ok) {
            throw new Error(result.error?.message || 'Failed to subscribe');
        }

        console.log('[Push] Successfully subscribed to push notifications');
        return subscription;
    } catch (error) {
        console.error('[Push] Error subscribing to push notifications:', error);
        throw error;
    }
}

/**
 * Unsubscribe user from push notifications
 */
export async function unsubscribeFromPushNotifications(userId) {
    if (!isPushNotificationSupported()) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            console.log('No active subscription found');
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
                credentials: 'include', // Include cookies for session
                body: JSON.stringify({
                    userId: userId,
                    endpoint: subscription.endpoint
                })
            });

            const result = await response.json();
            
            if (!result.ok) {
                console.error('Failed to notify server of unsubscription');
            }

            console.log('Successfully unsubscribed from push notifications');
        }

        return unsubscribed;
    } catch (error) {
        console.error('Error unsubscribing from push notifications:', error);
        throw error;
    }
}

/**
 * Check if user is currently subscribed
 */
export async function isUserSubscribed() {
    if (!isPushNotificationSupported()) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (!registration) {
            console.warn('Service worker not registered yet');
            return false;
        }
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Service worker ready timeout')), 10000);
        });
        
        await Promise.race([
            navigator.serviceWorker.ready,
            timeoutPromise
        ]);
        
        const subscription = await registration.pushManager.getSubscription();
        return subscription !== null;
    } catch (error) {
        console.error('Error checking subscription status:', error);
        return false;
    }
}

/**
 * Get current subscription
 */
export async function getCurrentSubscription() {
    if (!isPushNotificationSupported()) {
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        return await registration.pushManager.getSubscription();
    } catch (error) {
        console.error('Error getting current subscription:', error);
        return null;
    }
}

/**
 * Get notification permission status
 */
export function getNotificationPermissionStatus() {
    if (!('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
}

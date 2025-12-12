/**
 * Notification Manager
 * Handles push notification subscriptions and preferences
 */

class NotificationManager {
    constructor() {
        this.swRegistration = null;
        this.vapidPublicKey = null;
    }

    /**
     * Initialize and auto-subscribe (called on app load/login)
     */
    async initAndSubscribe() {
        const initialized = await this.init();
        if (!initialized) {
            return false;
        }

        // Check if user already has a subscription
        const hasPermission = Notification.permission === 'granted';
        if (!hasPermission) {
            // Don't auto-request permission, wait for user action
            return true;
        }

        // Auto-subscribe if permission already granted
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (!subscription) {
                console.log('[NotificationManager] Auto-subscribing user...');
                await this.subscribeToPush();
            }
            return true;
        } catch (error) {
            console.error('[NotificationManager] Auto-subscribe failed:', error);
            return false;
        }
    }

    /**
     * Initialize notification manager
     */
    async init() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('[NotificationManager] Push notifications not supported');
            return false;
        }

        try {
            this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('[NotificationManager] Service worker registered');

            await navigator.serviceWorker.ready;

            const response = await fetch('/api/notifications/vapid-public-key');
            const data = await response.json();

            if (data.ok) {
                this.vapidPublicKey = data.publicKey;
                console.log('[NotificationManager] VAPID key loaded');

                const subscription = await this.swRegistration.pushManager.getSubscription();
                if (subscription) {
                    console.log('[NotificationManager] Existing subscription found, syncing with server...');
                    await this.syncSubscriptionWithServer(subscription);
                }

                return true;
            } else {
                console.error('[NotificationManager] Failed to get VAPID key');
                return false;
            }
        } catch (error) {
            console.error('[NotificationManager] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Sync existing subscription with server
     */
    async syncSubscriptionWithServer(subscription) {
        try {
            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    subscription: subscription.toJSON()
                })
            });

            const data = await response.json();

            if (data.ok) {
                console.log('[NotificationManager] Subscription synced with server');
                return true;
            } else {
                console.error('[NotificationManager] Failed to sync subscription:', data.error);
                return false;
            }
        } catch (error) {
            console.error('[NotificationManager] Sync failed:', error);
            return false;
        }
    }

    /**
     * Request notification permission
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('[NotificationManager] Notifications not supported');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission === 'denied') {
            console.warn('[NotificationManager] Notification permission denied');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('[NotificationManager] Permission request failed:', error);
            return false;
        }
    }

    /**
     * Subscribe to push notifications
     */
    async subscribeToPush() {
        if (!this.swRegistration) {
            console.error('[NotificationManager] Service worker not registered, initializing...');
            const initialized = await this.init();
            if (!initialized) {
                console.error('[NotificationManager] Failed to initialize');
                return false;
            }
        }

        if (!this.vapidPublicKey) {
            console.error('[NotificationManager] VAPID public key not loaded');
            return false;
        }

        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
            console.error('[NotificationManager] Notification permission not granted');
            return false;
        }

        try {
            await navigator.serviceWorker.ready;
            
            let subscription = await this.swRegistration.pushManager.getSubscription();

            if (!subscription) {
                const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

                subscription = await this.swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });

                console.log('[NotificationManager] New push subscription created');
            } else {
                console.log('[NotificationManager] Using existing push subscription');
            }

            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    subscription: subscription.toJSON()
                })
            });

            const data = await response.json();

            if (data.ok) {
                console.log('[NotificationManager] Subscription saved to server');

                if (data.queued_notifications_sent > 0) {
                    console.log(`[NotificationManager] Sent ${data.queued_notifications_sent} queued notifications`);
                }

                return true;
            } else {
                console.error('[NotificationManager] Failed to save subscription:', data.error);
                return false;
            }
        } catch (error) {
            console.error('[NotificationManager] Subscribe failed:', error);
            return false;
        }
    }

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribeFromPush() {
        if (!this.swRegistration) {
            return false;
        }

        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();

            if (subscription) {
                const endpoint = subscription.endpoint;

                // Unsubscribe locally
                await subscription.unsubscribe();

                // Notify server
                await fetch('/api/notifications/unsubscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ endpoint })
                });

                console.log('[NotificationManager] Unsubscribed from push notifications');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[NotificationManager] Unsubscribe failed:', error);
            return false;
        }
    }

    /**
     * Get notification preferences
     */
    async getPreferences() {
        try {
            const response = await fetch('/api/notifications/preferences', {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.ok) {
                return data.preferences;
            } else {
                console.error('[NotificationManager] Failed to get preferences:', data.error);
                return null;
            }
        } catch (error) {
            console.error('[NotificationManager] Get preferences failed:', error);
            return null;
        }
    }

    /**
     * Update notification preference
     */
    async updatePreference(notificationType, isEnabled) {
        try {
            const response = await fetch('/api/notifications/preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    notification_type: notificationType,
                    is_enabled: Boolean(isEnabled)
                })
            });

            console.log("UDGOW: ", response)

            if (!response.ok) {
                const text = await response.text();
                console.error('[NotificationManager] Server error:', response.status, text);
                
                let errorData;
                try {
                    errorData = JSON.parse(text);
                } catch (e) {
                    throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
                }
                
                throw new Error(errorData.error || errorData.message || 'Update failed');
            }

            const data = await response.json();

            if (data.ok) {
                console.log(`[NotificationManager] Preference updated: ${notificationType} = ${isEnabled}`);

                if (isEnabled && Notification.permission !== 'granted') {
                    const permissionGranted = await this.requestPermission();

                    if (permissionGranted) {
                        await this.subscribeToPush();
                    } else {
                        console.warn('[NotificationManager] Permission not granted, cannot enable notifications');
                        return false;
                    }
                }

                if (isEnabled && Notification.permission === 'granted') {
                    await this.subscribeToPush();
                }

                return true;
            } else {
                console.error('[NotificationManager] Failed to update preference:', data.error);
                return false;
            }
        } catch (error) {
            console.error('[NotificationManager] Update preference failed:', error);
            throw error;
        }
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
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
     * Check if notifications are supported
     */
    isSupported() {
        return ('serviceWorker' in navigator) &&
               ('PushManager' in window) &&
               ('Notification' in window);
    }

    /**
     * Get current permission status
     */
    getPermissionStatus() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    }
}

// Export singleton instance
export const notificationManager = new NotificationManager();

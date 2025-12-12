/**
 * Push Notification Service Helper
 * Helper functions to send push notifications from various parts of the application
 */

const database = require('../config/db');
const webPush = require('web-push');

const pool = database.getInstance();

// Setup web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.MAILTO_CONTACT || 'mailto:admin@nimonspedia.com';

if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/**
 * Send push notification to a specific user
 * @param {number} userId - Target user ID
 * @param {object} notification - Notification data
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body/message
 * @param {string} notification.url - URL to open when clicked
 * @param {string} notification.notificationType - Type: 'chat', 'auction', or 'order'
 * @returns {Promise<object>} Result of sending
 */
async function sendPushNotification(userId, notification) {
    try {
        const { title, body, url, notificationType } = notification;

        if (!userId || !title || !body) {
            console.error('Missing required notification fields');
            return { success: false, error: 'Missing required fields' };
        }

        // Check user's notification preferences
        const prefQuery = `
            SELECT chat_enabled, auction_enabled, order_enabled
            FROM push_preferences
            WHERE user_id = $1
        `;
        const prefResult = await pool.query(prefQuery, [userId]);
        
        if (prefResult.rows.length > 0) {
            const prefs = prefResult.rows[0];
            
            // Check if this notification type is enabled
            if (notificationType === 'chat' && !prefs.chat_enabled) {
                console.log(`Chat notifications disabled for user ${userId}`);
                return { success: true, message: 'Notifications disabled', skipped: true };
            }
            if (notificationType === 'auction' && !prefs.auction_enabled) {
                console.log(`Auction notifications disabled for user ${userId}`);
                return { success: true, message: 'Notifications disabled', skipped: true };
            }
            if (notificationType === 'order' && !prefs.order_enabled) {
                console.log(`Order notifications disabled for user ${userId}`);
                return { success: true, message: 'Notifications disabled', skipped: true };
            }
        }

        // Get all subscriptions for this user
        const subQuery = `
            SELECT endpoint, p256dh_key, auth_key
            FROM push_subscriptions
            WHERE user_id = $1
        `;
        const subscriptions = await pool.query(subQuery, [userId]);

        if (subscriptions.rows.length === 0) {
            console.log(`No subscriptions found for user ${userId}`);
            return { success: false, error: 'No subscriptions found' };
        }

        // Build notification payload matching service worker format
        const notificationPayload = {
            title,
            body,
            icon: '/logo-192.png',
            badge: '/logo-192.png',
            tag: notificationType || 'notification',
            data: {
                url: url || '/',
                type: notificationType,
                timestamp: Date.now(),
                ...(notification.data || {})
            }
        };

        const payload = JSON.stringify(notificationPayload);
        
        console.log(`[Push] Sending notification to user ${userId}:`, notificationPayload);

        // Send to all user's subscriptions
        const sendPromises = subscriptions.rows.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh_key,
                    auth: sub.auth_key
                }
            };

            try {
                await webPush.sendNotification(pushSubscription, payload);
                return { success: true, endpoint: sub.endpoint };
            } catch (error) {
                console.error('Error sending to endpoint:', sub.endpoint, error);
                
                // Remove invalid subscriptions (410 Gone, 404 Not Found)
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await pool.query(
                        'DELETE FROM push_subscriptions WHERE endpoint = $1',
                        [sub.endpoint]
                    );
                    console.log(`Removed invalid subscription: ${sub.endpoint}`);
                }
                
                return { success: false, endpoint: sub.endpoint, error: error.message };
            }
        });

        const results = await Promise.all(sendPromises);
        const successCount = results.filter(r => r.success).length;

        console.log(`Push notification sent to ${successCount}/${results.length} devices for user ${userId}`);

        return {
            success: successCount > 0,
            message: `Sent to ${successCount}/${results.length} devices`,
            results
        };
    } catch (error) {
        console.error('Error in sendPushNotification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send push notification to multiple users
 * @param {number[]} userIds - Array of user IDs
 * @param {object} notification - Notification data
 * @returns {Promise<object>} Results for all users
 */
async function sendPushNotificationToMultipleUsers(userIds, notification) {
    const results = await Promise.all(
        userIds.map(userId => sendPushNotification(userId, notification))
    );

    const successCount = results.filter(r => r.success).length;

    return {
        success: successCount > 0,
        message: `Sent to ${successCount}/${userIds.length} users`,
        results
    };
}

/**
 * Send chat notification
 * @param {number} receiverId - Receiver user ID
 * @param {string} senderName - Sender's name
 * @param {string} messagePreview - Message preview
 * @param {number} storeId - Store ID (for URL)
 * @param {number} buyerId - Buyer ID (for URL)
 */
async function sendChatNotification(receiverId, senderName, messagePreview, storeId, buyerId) {
    console.log(`[Push] Preparing chat notification for user ${receiverId} from ${senderName}`);
    
    return sendPushNotification(receiverId, {
        title: senderName,
        body: messagePreview,
        url: `/chat/${storeId}/${buyerId}`,
        notificationType: 'chat',
        data: {
            type: 'chat',
            storeId,
            buyerId,
            senderName
        }
    });
}

/**
 * Send auction notification
 * @param {number} userId - User ID to notify
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} auctionId - Auction ID (for URL)
 */
async function sendAuctionNotification(userId, title, message, auctionId) {
    return sendPushNotification(userId, {
        title: title,
        body: message,
        url: `/auction/${auctionId}`,
        notificationType: 'auction',
        data: {
            type: 'auction',
            auctionId
        }
    });
}

/**
 * Send order notification
 * @param {number} userId - User ID to notify
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} orderId - Order ID (optional, for URL)
 */
async function sendOrderNotification(userId, title, message, orderId = null) {
    const url = orderId ? `/orders?id=${orderId}` : '/orders';

    return sendPushNotification(userId, {
        title: title,
        body: message,
        url: url,
        notificationType: 'order',
        data: {
            type: 'order',
            orderId
        }
    });
}

module.exports = {
    sendPushNotification,
    sendPushNotificationToMultipleUsers,
    sendChatNotification,
    sendAuctionNotification,
    sendOrderNotification
};

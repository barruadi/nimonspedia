const express = require('express');
const webPush = require('web-push');
const database = require('../config/db');
const verifyUser = require('../middlewares/authMiddleware');

const router = express.Router();
const pool = database.getInstance();

// Setup web-push with VAPID keys from environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.MAILTO_CONTACT || 'mailto:admin@nimonspedia.com';

if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys are not set in environment variables!');
} else {
    webPush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
    );
    console.log('Web Push configured successfully');
}

/**
 * Get VAPID public key
 * GET /api/node/push/public-key
 */
router.get('/push/public-key', (req, res) => {
    return res.json({ publicKey: vapidPublicKey });
});

/**
 * Subscribe to push notifications
 * POST /api/node/push/subscribe
 */
router.post('/push/subscribe', verifyUser, async (req, res) => {
    try {
        const userId = req.userId;
        const { subscription, preferences } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                ok: false,
                error: { message: 'Invalid request data' }
            });
        }

        // Check if subscription already exists
        const checkQuery = `
            SELECT subscription_id
            FROM push_subscriptions
            WHERE user_id = $1 AND endpoint = $2
        `;
        const existingResult = await pool.query(checkQuery, [userId, subscription.endpoint]);

        if (existingResult.rows.length > 0) {
            // Update existing subscription
            const updateQuery = `
                UPDATE push_subscriptions
                SET p256dh_key = $1, auth_key = $2, created_at = NOW()
                WHERE user_id = $3 AND endpoint = $4
                RETURNING subscription_id
            `;
            await pool.query(updateQuery, [
                subscription.keys.p256dh,
                subscription.keys.auth,
                userId,
                subscription.endpoint
            ]);
        } else {
            // Insert new subscription
            const insertQuery = `
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
                VALUES ($1, $2, $3, $4)
                RETURNING subscription_id
            `;
            await pool.query(insertQuery, [
                userId,
                subscription.endpoint,
                subscription.keys.p256dh,
                subscription.keys.auth
            ]);
        }

        // Update or insert preferences
        if (preferences) {
            const prefQuery = `
                INSERT INTO push_preferences (user_id, chat_enabled, auction_enabled, order_enabled)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id) DO UPDATE SET
                    chat_enabled = $2,
                    auction_enabled = $3,
                    order_enabled = $4,
                    updated_at = NOW()
            `;
            await pool.query(prefQuery, [
                userId,
                preferences.chat !== undefined ? preferences.chat : true,
                preferences.auction !== undefined ? preferences.auction : true,
                preferences.order !== undefined ? preferences.order : true
            ]);
        } else {
            // Ensure push preferences exist with defaults
            const prefQuery = `
                INSERT INTO push_preferences (user_id)
                VALUES ($1)
                ON CONFLICT (user_id) DO NOTHING
            `;
            await pool.query(prefQuery, [userId]);
        }

        return res.status(201).json({
            ok: true,
            message: 'Subscription saved successfully'
        });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        return res.status(500).json({
            ok: false,
            error: { message: 'Failed to save subscription' }
        });
    }
});

/**
 * Unsubscribe from push notifications
 * POST /api/node/push/unsubscribe
 */
router.post('/push/unsubscribe', verifyUser, async (req, res) => {
    try {
        const userId = req.userId;
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                ok: false,
                error: { message: 'Invalid request data' }
            });
        }

        const deleteQuery = `
            DELETE FROM push_subscriptions
            WHERE user_id = $1 AND endpoint = $2
            RETURNING subscription_id
        `;
        const result = await pool.query(deleteQuery, [userId, endpoint]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: { message: 'Subscription not found' }
            });
        }

        return res.json({
            ok: true,
            message: 'Unsubscribed successfully'
        });
    } catch (error) {
        console.error('Error unsubscribing:', error);
        return res.status(500).json({
            ok: false,
            error: { message: 'Failed to unsubscribe' }
        });
    }
});

/**
 * Send push notification to specific user
 * POST /api/node/push/send
 * Body: { userId, title, body, url }
 */
router.post('/push/send', async (req, res) => {
    try {
        const { userId, title, body, url, notificationType } = req.body;

        if (!userId || !title || !body) {
            return res.status(400).json({
                ok: false,
                error: { message: 'Missing required fields' }
            });
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
                return res.json({ ok: true, message: 'Chat notifications disabled for user' });
            }
            if (notificationType === 'auction' && !prefs.auction_enabled) {
                return res.json({ ok: true, message: 'Auction notifications disabled for user' });
            }
            if (notificationType === 'order' && !prefs.order_enabled) {
                return res.json({ ok: true, message: 'Order notifications disabled for user' });
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
            return res.status(404).json({
                ok: false,
                error: { message: 'No subscriptions found for user' }
            });
        }

        const payload = JSON.stringify({
            title,
            body,
            url: url || '/',
            timestamp: Date.now()
        });

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
                }

                return { success: false, endpoint: sub.endpoint, error: error.message };
            }
        });

        const results = await Promise.all(sendPromises);
        const successCount = results.filter(r => r.success).length;

        return res.json({
            ok: true,
            message: `Notification sent to ${successCount}/${results.length} devices`,
            results
        });
    } catch (error) {
        console.error('Error sending push notification:', error);
        return res.status(500).json({
            ok: false,
            error: { message: 'Failed to send notification' }
        });
    }
});

/**
 * Get user's push notification preferences
 * GET /api/node/push/preferences
 */
router.get('/push/preferences', verifyUser, async (req, res) => {
    try {
        const userId = req.userId;

        const prefQuery = `
            SELECT chat_enabled, auction_enabled, order_enabled, updated_at
            FROM push_preferences
            WHERE user_id = $1
        `;
        const result = await pool.query(prefQuery, [userId]);

        if (result.rows.length === 0) {
            // Return defaults if no preferences found
            return res.json({
                ok: true,
                preferences: {
                    chat: true,
                    auction: true,
                    order: true
                }
            });
        }

        const prefs = result.rows[0];
        return res.json({
            ok: true,
            preferences: {
                chat: prefs.chat_enabled,
                auction: prefs.auction_enabled,
                order: prefs.order_enabled,
                updatedAt: prefs.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching preferences:', error);
        return res.status(500).json({
            ok: false,
            error: { message: 'Failed to fetch preferences' }
        });
    }
});

/**
 * Update user's push notification preferences
 * PUT /api/node/push/preferences
 */
router.put('/push/preferences', verifyUser, async (req, res) => {
    try {
        const userId = req.userId;
        const { chat, auction, order } = req.body;

        const prefQuery = `
            INSERT INTO push_preferences (user_id, chat_enabled, auction_enabled, order_enabled)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                chat_enabled = $2,
                auction_enabled = $3,
                order_enabled = $4,
                updated_at = NOW()
            RETURNING chat_enabled, auction_enabled, order_enabled, updated_at
        `;

        const result = await pool.query(prefQuery, [
            userId,
            chat !== undefined ? chat : true,
            auction !== undefined ? auction : true,
            order !== undefined ? order : true
        ]);

        const prefs = result.rows[0];
        return res.json({
            ok: true,
            message: 'Preferences updated successfully',
            preferences: {
                chat: prefs.chat_enabled,
                auction: prefs.auction_enabled,
                order: prefs.order_enabled,
                updatedAt: prefs.updated_at
            }
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        return res.status(500).json({
            ok: false,
            error: { message: 'Failed to update preferences' }
        });
    }
});

/**
 * Send order notification (called from PHP backend)
 * POST /api/node/notifications/send-order
 * Body: { userId, title, message, orderId }
 */
router.post('/notifications/send-order', async (req, res) => {
    try {
        const { userId, title, message, orderId } = req.body;

        console.log('[Push Routes] Received order notification request:', { userId, title, message, orderId });

        if (!userId || !title || !message) {
            console.error('[Push Routes] Missing required fields for order notification');
            return res.status(400).json({
                ok: false,
                error: 'Missing required fields: userId, title, message'
            });
        }

        // Use the sendOrderNotification helper from push notification service
        const { sendOrderNotification } = require('../services/pushNotificationService');
        
        const result = await sendOrderNotification(userId, title, message, orderId);

        if (result.success) {
            console.log('[Push Routes] Order notification sent successfully to user', userId);
            return res.json({
                ok: true,
                message: 'Order notification sent successfully'
            });
        } else {
            console.warn('[Push Routes] Failed to send order notification:', result);
            return res.status(500).json({
                ok: false,
                error: result.error || 'Failed to send notification'
            });
        }

    } catch (error) {
        console.error('[Push Routes] Error sending order notification:', error);
        return res.status(500).json({
            ok: false,
            error: error.message || 'Internal server error'
        });
    }
});

module.exports = router;

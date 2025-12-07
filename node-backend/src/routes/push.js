const express = require('express');
const router = express.Router();
const webPush = require('web-push');
const database = require('../config/db');

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
    res.json({ 
        publicKey: vapidPublicKey 
    });
});

/**
 * Subscribe to push notifications
 * POST /api/node/push/subscribe
 */
router.post('/push/subscribe', async (req, res) => {
    try {
        const { userId, subscription } = req.body;

        if (!userId || !subscription || !subscription.endpoint) {
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

        // Ensure push preferences exist
        const prefQuery = `
            INSERT INTO push_preferences (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO NOTHING
        `;
        await pool.query(prefQuery, [userId]);

        res.status(201).json({ 
            ok: true,
            message: 'Subscription saved successfully' 
        });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ 
            ok: false,
            error: { message: 'Failed to save subscription' }
        });
    }
});

/**
 * Unsubscribe from push notifications
 * POST /api/node/push/unsubscribe
 */
router.post('/push/unsubscribe', async (req, res) => {
    try {
        const { userId, endpoint } = req.body;

        if (!userId || !endpoint) {
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

        res.json({ 
            ok: true,
            message: 'Unsubscribed successfully' 
        });
    } catch (error) {
        console.error('Error unsubscribing:', error);
        res.status(500).json({ 
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

        res.json({ 
            ok: true,
            message: `Notification sent to ${successCount}/${results.length} devices`,
            results
        });
    } catch (error) {
        console.error('Error sending push notification:', error);
        res.status(500).json({ 
            ok: false,
            error: { message: 'Failed to send notification' }
        });
    }
});

module.exports = router;
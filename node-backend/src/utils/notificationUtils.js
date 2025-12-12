/**
 * Notification Utilities for Push Notifications
 * Helper functions to send push notifications with preference checking
 */

const webPush = require('web-push');
const pool = require('../config/db');

/**
 * Initialize web-push with VAPID keys
 * Called once at server startup
 */
const initializeWebPush = () => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.MAILTO_CONTACT || 'mailto:admin@nimonspedia.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[Notification] VAPID keys are not set in environment variables!');
    return false;
  }

  try {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('[Notification] Web Push initialized successfully');
    return true;
  } catch (error) {
    console.error('[Notification] Error initializing web-push:', error.message);
    return false;
  }
};

/**
 * Send push notification to a user
 * Checks user preferences and sends to all registered devices
 * 
 * @param {number} userId - Target user ID
 * @param {object} options - Notification options
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body message
 * @param {string} options.url - Deep link URL (default: '/')
 * @param {string} options.type - Notification type: 'auction', 'chat', 'order'
 * @returns {Promise<object>} Result object with sent count
 */
const sendPushNotification = async (userId, options = {}) => {
  const pgPool = pool.getInstance();

  try {
    const { title, body, url = '/', type = 'auction', data = {} } = options;

    if (!userId || !title || !body) {
      console.error('[Notification]  Missing required fields:', { userId, title, body });
      return { ok: false, error: 'Missing required fields' };
    }

    // Step 1: Check user preferences
    const prefQuery = `
      SELECT auction_enabled, chat_enabled, order_enabled
      FROM push_preferences
      WHERE user_id = $1
    `;
    const prefResult = await pgPool.query(prefQuery, [userId]);

    // Check if user disabled this notification type
    if (prefResult.rows.length > 0) {
      const prefs = prefResult.rows[0];

      if (type === 'auction' && !prefs.auction_enabled) {
        console.log(`[Notification] User ${userId} has disabled auction notifications`);
        return { ok: true, sentCount: 0, message: 'User disabled notifications' };
      }
      if (type === 'chat' && !prefs.chat_enabled) {
        console.log(`[Notification] User ${userId} has disabled chat notifications`);
        return { ok: true, sentCount: 0, message: 'User disabled notifications' };
      }
      if (type === 'order' && !prefs.order_enabled) {
        console.log(`[Notification] User ${userId} has disabled order notifications`);
        return { ok: true, sentCount: 0, message: 'User disabled notifications' };
      }
    }

    // Step 2: Get user subscriptions
    const subQuery = `
      SELECT subscription_id, endpoint, p256dh_key, auth_key
      FROM push_subscriptions
      WHERE user_id = $1
    `;
    const subResult = await pgPool.query(subQuery, [userId]);

    if (subResult.rows.length === 0) {
      console.log(`[Notification] No subscriptions found for user ${userId}`);
      return { ok: true, sentCount: 0, message: 'No subscriptions found' };
    }

    // Step 3: Prepare payload
    const payload = JSON.stringify({
      title,
      body,
      icon: '/uploads/logo-192.png',
      badge: '/uploads/badge-96.png',
      url,
      data: {
        url,
        type,
        timestamp: Date.now(),
        ...data  // Merge additional data (e.g., auctionId, orderId)
      }
    });

    // Step 4: Send to all subscriptions
    let sentCount = 0;
    const results = [];

    console.log(`[Notification] Attempting to send to user ${userId} with ${subResult.rows.length} subscription(s)`);

    for (const subscription of subResult.rows) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        };

        await webPush.sendNotification(pushSubscription, payload);
        sentCount++;
        results.push({ success: true, subscriptionId: subscription.subscription_id });
        console.log(`[Notification] Successfully sent to user ${userId} (subscription: ${subscription.subscription_id})`);

      } catch (error) {
        // Handle invalid subscriptions (410 Gone, 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Notification] Deleting invalid subscription ${subscription.subscription_id}`);
          try {
            await pgPool.query(
              'DELETE FROM push_subscriptions WHERE subscription_id = $1',
              [subscription.subscription_id]
            );
          } catch (delError) {
            console.error('[Notification] Error deleting subscription:', delError.message);
          }
        }
        results.push({ success: false, subscriptionId: subscription.subscription_id, error: error.message });
        console.error(`[Notification] Failed to send to user ${userId}:`, error.message);
      }
    }

    console.log(`[Notification] Sent ${sentCount}/${subResult.rows.length} notifications to user ${userId}`);
    return {
      ok: true,
      sentCount,
      totalSubscriptions: subResult.rows.length,
      results
    };

  } catch (error) {
    console.error('[NotificatiError in sendPushNotification:', error.message);
    return { ok: false, error: error.message };
  }
};

/**
 * Send outbid notification
 * Notify previous bidder that they've been outbid
 * 
 * @param {number} previousBidderId - User ID of previous bidder
 * @param {string} auctionName - Name of the auction/product
 * @param {number} auctionId - Auction ID (for link)
 * @param {string} newBidderName - Name of new highest bidder
 * @param {number} newBidAmount - New bid amount
 * @param {string} previousBidderName - Name of previous bidder (who got outbid)
 */
const sendOutbidNotification = async (previousBidderId, auctionName, auctionId, newBidderName, newBidAmount, previousBidderName = 'Anda') => {
  console.log(`[Notification] Sending outbid notification to user ${previousBidderId} for auction ${auctionId}`);
  
  return sendPushNotification(previousBidderId, {
    title: `${previousBidderName}, Anda telah tertandingi!`,
    body: `${newBidderName} menawar lebih tinggi Rp ${newBidAmount.toLocaleString('id-ID')} di "${auctionName}"`,
    url: `/pages/auction-detail.html?id=${auctionId}`,
    type: 'auction',
    data: {
      auctionId
    }
  });
};

/**
 * Send auction won notification
 * Notify winner that they won the auction
 * 
 * @param {number} winnerId - User ID of winner
 * @param {string} auctionName - Name of the auction/product
 * @param {number} winningBid - Final winning bid amount
 * @param {string} sellerName - Name of seller (optional)
 */
const sendAuctionWonNotification = async (winnerId, auctionName, winningBid, auctionId = null) => {
  console.log(`[Notification] Sending win notification to user ${winnerId} for auction ${auctionId}`);
  
  return sendPushNotification(winnerId, {
    title: 'Selamat! Anda Menang Lelang',
    body: `Anda memenangkan "${auctionName}" dengan harga Rp ${winningBid.toLocaleString('id-ID')}`,
    url: '/pages/orders.html',
    type: 'auction',
    data: {
      auctionId
    }
  });
};

/**
 * Send auction ended notification to seller
 * Notify seller that their auction has ended
 * 
 * @param {number} sellerId - User ID of seller
 * @param {string} auctionName - Name of the auction/product
 * @param {string} winnerName - Name of winner (if any)
 * @param {number} finalPrice - Final selling price
 */
const sendAuctionEndedSellerNotification = async (sellerId, auctionName, winnerName, finalPrice, auctionId = null) => {
  console.log(`[Notification] Sending auction ended notification to seller ${sellerId} for auction ${auctionId}`);
  
  const message = winnerName
    ? `Lelang "${auctionName}" telah berakhir. Pemenang: ${winnerName} (Rp ${finalPrice.toLocaleString('id-ID')})`
    : `Lelang "${auctionName}" telah berakhir tanpa pemenang`;

  return sendPushNotification(sellerId, {
    title: 'Lelang Berakhir',
    body: message,
    url: '/pages/seller-orders.html',
    type: 'auction',
    data: {
      auctionId
    }
  });
};

module.exports = {
  initializeWebPush,
  sendPushNotification,
  sendOutbidNotification,
  sendAuctionWonNotification,
  sendAuctionEndedSellerNotification
};

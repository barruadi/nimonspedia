/**
 * Auction WebSocket Handlers - Real-time Bidding System
 * 
 * Features:
 * - Database transactions with row-level locking
 * - 15-second anti-sniping timer
 * - Automatic balance deduction & refund
 * - Order auto-creation on auction end
 * - Real-time bid broadcasting
 * - Push notifications for auction events
 */

const pool = require('../config/db');
const { sendAuctionNotification } = require('../services/pushNotificationService');

// Map to track active auction timers: { auctionId: timeoutHandle }
const auctionTimers = new Map();

/**
 * Initialize auction socket handlers
 * @param {Socket.IO} io - Socket.IO instance
 */
const setupAuctionSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Auction Socket] User connected: ${socket.id}`);

    /**
     * EVENT: auction:join
     * Client joins auction room to receive real-time updates
     * 
     * Payload: { auctionId: number, userId: number }
     */
    socket.on('auction:join', (data, callback) => {
      try {
        const { auctionId, userId } = data;

        if (!auctionId || !userId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId or userId'
          });
        }

        socket.join(`auction-${auctionId}`);
        socket.auctionId = auctionId;
        socket.userId = userId;

        console.log(`[Auction Socket] User ${userId} joined auction ${auctionId} (socket: ${socket.id})`);

        io.to(`auction-${auctionId}`).emit('auction:user-joined', {
          userId,
          timestamp: new Date().toISOString()
        });

        callback?.({
          success: true,
          message: 'Successfully joined auction room'
        });

      } catch (error) {
        console.error('[Auction Socket] Error in join:', error.message);
        callback?.({
          success: false,
          error: 'Failed to join auction room'
        });
      }
    });

    /**
     * EVENT: auction:leave
     * Client leaves auction room
     * 
     * Payload: { auctionId: number }
     */
    socket.on('auction:leave', (data, callback) => {
      try {
        const { auctionId } = data;

        if (!auctionId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId'
          });
        }

        socket.leave(`auction-${auctionId}`);
        console.log(`[Auction Socket] User ${socket.userId} left auction ${auctionId}`);

        io.to(`auction-${auctionId}`).emit('auction:user-left', {
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

        callback?.({
          success: true,
          message: 'Successfully left auction room'
        });

      } catch (error) {
        console.error('[Auction Socket] Error in leave:', error);
        callback?.({
          success: false,
          error: 'Failed to leave auction room'
        });
      }
    });

    /**
     * EVENT: auction:place-bid
     * Place a bid with ACID transaction guarantees
     * 
     * Payload: { auctionId: number, bidderId: number, bidAmount: number }
     * Callback: { success: boolean, error?: string, data?: {...} }
     * 
     * TRANSACTION STEPS:
     * 1. Lock buyer row (FOR UPDATE) & check balance
     * 2. Lock auction row (FOR UPDATE) & check status
     * 3. Validate bid amount
     * 4. Deduct balance from buyer
     * 5. Refund previous highest bidder (if exists)
     * 6. Insert new bid record
     * 7. Update auction: current_price + reset end_time to NOW + 15s
     * 8. COMMIT
     * 9. Broadcast to room
     */
    socket.on('auction:place-bid', async (data, callback) => {
      const client = await pool.connect();
      
      try {
        const { auctionId, bidderId, bidAmount } = data;

        console.log(`[Auction Socket] Bid attempt - Auction ${auctionId}, Bidder ${bidderId}, Amount ${bidAmount}`);

        // ===== VALIDATION =====
        if (!auctionId || !bidderId || !bidAmount) {
          return callback?.({
            success: false,
            error: 'Missing required fields'
          });
        }

        if (isNaN(bidAmount) || bidAmount <= 0) {
          return callback?.({
            success: false,
            error: 'Invalid bid amount'
          });
        }

        // ===== BEGIN TRANSACTION =====
        await client.query('BEGIN');
        console.log(`[Auction Socket] Transaction started for auction ${auctionId}`);

        // STEP 1: LOCK BUYER USER ROW & CHECK BALANCE
        const buyerQuery = `
          SELECT user_id, balance, full_name 
          FROM users 
          WHERE user_id = $1 
          FOR UPDATE
        `;
        const buyerResult = await client.query(buyerQuery, [bidderId]);
        
        if (buyerResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return callback?.({
            success: false,
            error: 'Bidder user not found'
          });
        }

        const buyer = buyerResult.rows[0];
        
        if (buyer.balance < bidAmount) {
          await client.query('ROLLBACK');
          console.log(`[Auction Socket] Insufficient balance: ${buyer.balance} < ${bidAmount}`);
          return callback?.({
            success: false,
            error: 'Saldo tidak cukup untuk menempatkan bid'
          });
        }

        // STEP 2: LOCK AUCTION ROW & CHECK STATUS
        const auctionQuery = `
          SELECT 
            auction_id, status, current_price, min_increment, 
            product_id, quantity, start_time, end_time, seller_id
          FROM auctions 
          WHERE auction_id = $1 
          FOR UPDATE
        `;
        const auctionResult = await client.query(auctionQuery, [auctionId]);
        
        if (auctionResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return callback?.({
            success: false,
            error: 'Lelang tidak ditemukan'
          });
        }

        const auction = auctionResult.rows[0];
        
        if (auction.status !== 'active') {
          await client.query('ROLLBACK');
          return callback?.({
            success: false,
            error: 'Lelang tidak sedang berlangsung'
          });
        }

        // STEP 3: VALIDATE BID AMOUNT
        const minimumBid = auction.current_price + auction.min_increment;
        
        if (bidAmount < minimumBid) {
          await client.query('ROLLBACK');
          return callback?.({
            success: false,
            error: `Bid minimal: Rp ${minimumBid.toLocaleString('id-ID')}`
          });
        }

        // STEP 4: GET PREVIOUS HIGHEST BIDDER
        const highestBidQuery = `
          SELECT bidder_id, bid_amount 
          FROM auction_bids 
          WHERE auction_id = $1 
          ORDER BY bid_amount DESC, bid_id DESC 
          LIMIT 1
        `;
        const highestBidResult = await client.query(highestBidQuery, [auctionId]);
        const previousBid = highestBidResult.rows[0] || null;

        // STEP 5: DEDUCT BALANCE FROM BUYER
        const deductQuery = `
          UPDATE users 
          SET balance = balance - $1, updated_at = NOW()
          WHERE user_id = $2
        `;
        await client.query(deductQuery, [bidAmount, bidderId]);
        console.log(`[Auction Socket] Deducted ${bidAmount} from bidder ${bidderId}`);

        // STEP 6: REFUND PREVIOUS BIDDER (if exists)
        if (previousBid && previousBid.bidder_id !== bidderId) {
          const refundQuery = `
            UPDATE users 
            SET balance = balance + $1, updated_at = NOW()
            WHERE user_id = $2
          `;
          await client.query(refundQuery, [previousBid.bid_amount, previousBid.bidder_id]);
          console.log(`[Auction Socket] Refunded ${previousBid.bid_amount} to previous bidder ${previousBid.bidder_id}`);
        }

        // STEP 7: INSERT NEW BID
        const insertBidQuery = `
          INSERT INTO auction_bids (auction_id, bidder_id, bid_amount, bid_time)
          VALUES ($1, $2, $3, NOW())
          RETURNING bid_id, bid_time
        `;
        const bidResult = await client.query(insertBidQuery, [auctionId, bidderId, bidAmount]);
        const newBid = bidResult.rows[0];

        // STEP 8: UPDATE AUCTION - SET NEW PRICE & RESET TIMER (15 seconds)
        const newEndTime = new Date();
        newEndTime.setSeconds(newEndTime.getSeconds() + 15);

        const updateAuctionQuery = `
          UPDATE auctions 
          SET current_price = $1, end_time = $2, updated_at = NOW()
          WHERE auction_id = $3
        `;
        await client.query(updateAuctionQuery, [bidAmount, newEndTime.toISOString(), auctionId]);
        console.log(`[Auction Socket] Auction ${auctionId} updated: price=${bidAmount}, end_time=${newEndTime.toISOString()}`);

        // STEP 9: FETCH UPDATED BID HISTORY
        const bidHistoryQuery = `
          SELECT 
            ab.bid_id, ab.auction_id, ab.bidder_id, ab.bid_amount, ab.bid_time,
            u.full_name as bidder_name
          FROM auction_bids ab
          LEFT JOIN users u ON ab.bidder_id = u.user_id
          WHERE ab.auction_id = $1
          ORDER BY ab.bid_amount DESC, ab.bid_id DESC
        `;
        const bidHistoryResult = await client.query(bidHistoryQuery, [auctionId]);

        // COMMIT TRANSACTION
        await client.query('COMMIT');
        console.log(`[Auction Socket] Transaction committed for auction ${auctionId}`);

        // Clear old timer if exists
        if (auctionTimers.has(auctionId)) {
          clearTimeout(auctionTimers.get(auctionId));
        }

        // Set new 15-second timer
        const timer = setTimeout(() => {
          closeAuction(io, auctionId);
        }, 15000);
        auctionTimers.set(auctionId, timer);
        console.log(`[Auction Socket] 15s timer set for auction ${auctionId}`);

        // SUCCESS - Callback to bidder
        callback?.({
          success: true,
          data: {
            newBalance: buyer.balance - bidAmount,
            bidId: newBid.bid_id,
            newPrice: bidAmount
          }
        });

        // BROADCAST TO ROOM
        io.to(`auction-${auctionId}`).emit('auction:bid-update', {
          auction_id: auctionId,
          bidder_id: bidderId,
          bidder_name: buyer.full_name,
          bid_amount: bidAmount,
          bid_time: newBid.bid_time,
          new_end_time: newEndTime.toISOString(),
          is_first_bid: !previousBid,
          bid_history: bidHistoryResult.rows
        });

        console.log(`[Auction Socket] Broadcast bid-update to auction ${auctionId}`);

        // SEND PUSH NOTIFICATION TO SELLER
        try {
          const productQuery = `SELECT product_name FROM auctions WHERE auction_id = $1`;
          const productResult = await pool.query(productQuery, [auctionId]);
          const productName = productResult.rows[0]?.product_name || 'produk';

          const sellerQuery = `
            SELECT s.owner_id 
            FROM auctions a
            JOIN products p ON a.product_id = p.product_id
            JOIN stores s ON p.store_id = s.store_id
            WHERE a.auction_id = $1
          `;
          const sellerResult = await pool.query(sellerQuery, [auctionId]);
          const sellerId = sellerResult.rows[0]?.owner_id;

          if (sellerId) {
            await sendAuctionNotification(
              sellerId,
              'Penawaran Baru!',
              `${buyer.full_name} menawar Rp ${bidAmount.toLocaleString('id-ID')} untuk ${productName}`,
              auctionId
            );
            console.log(`[Auction Socket] Push notification sent to seller ${sellerId}`);
          }
        } catch (notifError) {
          console.error('[Auction Socket] Error sending push notification:', notifError);
        }

      } catch (error) {
        // ROLLBACK on error
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          console.error('[Auction Socket] Rollback error:', rollbackErr);
        }

        console.error('[Auction Socket] Error in place-bid:', error.message);
        callback?.({
          success: false,
          error: error.message || 'Gagal menempatkan penawaran'
        });

      } finally {
        client.release();
      }
    });

    /**
     * EVENT: auction:request-time-sync
     * Client requests server time to sync countdown timer
     * 
     * Payload: { auctionId: number }
     * Response: { server_time: ISO8601, end_time: ISO8601, auction_id: number }
     */
    socket.on('auction:request-time-sync', async (data, callback) => {
      try {
        const { auctionId } = data;

        if (!auctionId) {
          return callback?.({
            error: 'Missing auctionId'
          });
        }

        const query = `
          SELECT end_time FROM auctions WHERE auction_id = $1
        `;
        const result = await pool.query(query, [auctionId]);

        if (result.rows.length === 0) {
          return callback?.({
            error: 'Auction not found'
          });
        }

        callback?.({
          server_time: new Date().toISOString(),
          end_time: result.rows[0].end_time,
          auction_id: auctionId
        });

      } catch (error) {
        console.error('[Auction Socket] Error in time-sync:', error);
        callback?.({
          error: 'Failed to sync time'
        });
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log(`[Auction Socket] User ${socket.userId} disconnected (socket: ${socket.id})`);
      
      if (socket.auctionId) {
        io.to(`auction-${socket.auctionId}`).emit('auction:user-left', {
          userId: socket.userId
        });
      }
    });
  });
};

/**
 * AUTO-CLOSE AUCTION (called by 15-second timer)
 * 
 * Steps:
 * 1. Determine winner (highest bidder)
 * 2. Update auction status to 'ended'
 * 3. Create order automatically
 * 4. Broadcast auction:ended to room
 * 
 * @param {Socket.IO} io
 * @param {number} auctionId
 */
async function closeAuction(io, auctionId) {
  const client = await pool.connect();
  
  try {
    console.log(`[Auction Socket] ⏰ Auto-closing auction ${auctionId}`);

    // BEGIN transaction
    await client.query('BEGIN');

    // LOCK auction & get details
    const auctionQuery = `
      SELECT 
        auction_id, product_id, current_price, seller_id, status
      FROM auctions 
      WHERE auction_id = $1 
      FOR UPDATE
    `;
    const auctionResult = await client.query(auctionQuery, [auctionId]);

    if (auctionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    const auction = auctionResult.rows[0];

    if (auction.status !== 'active') {
      await client.query('ROLLBACK');
      return;
    }

    // Get highest bidder (winner)
    const winnerQuery = `
      SELECT bidder_id, bid_amount 
      FROM auction_bids 
      WHERE auction_id = $1 
      ORDER BY bid_amount DESC, bid_id DESC 
      LIMIT 1
    `;
    const winnerResult = await client.query(winnerQuery, [auctionId]);
    const winner = winnerResult.rows[0] || null;

    let winnerId = null;
    let finalPrice = auction.current_price;

    if (winner) {
      winnerId = winner.bidder_id;

      // Get product & store info
      const productQuery = `
        SELECT product_id, store_id FROM products WHERE product_id = $1
      `;
      const productResult = await client.query(productQuery, [auction.product_id]);
      const product = productResult.rows[0];

      // CREATE ORDER AUTOMATICALLY
      const orderQuery = `
        INSERT INTO orders (buyer_id, store_id, status, total_amount, created_at)
        VALUES ($1, $2, 'approved', $3, NOW())
        RETURNING order_id
      `;
      const orderResult = await client.query(orderQuery, [winnerId, product.store_id, finalPrice]);
      const orderId = orderResult.rows[0].order_id;

      // Insert order item
      const orderItemQuery = `
        INSERT INTO order_items (order_id, product_id, price_at, qty)
        VALUES ($1, $2, $3, 1)
      `;
      await client.query(orderItemQuery, [orderId, auction.product_id, finalPrice]);

      console.log(`[Auction Socket] Order ${orderId} created for auction ${auctionId}`);
    }

    // UPDATE AUCTION STATUS TO ENDED
    const updateQuery = `
      UPDATE auctions 
      SET status = 'ended', winner_id = $1, updated_at = NOW()
      WHERE auction_id = $2
    `;
    await client.query(updateQuery, [winnerId, auctionId]);

    // GET WINNER NAME
    let winnerName = null;
    if (winnerId) {
      const winnerNameQuery = `SELECT full_name FROM users WHERE user_id = $1`;
      const winnerNameResult = await client.query(winnerNameQuery, [winnerId]);
      winnerName = winnerNameResult.rows[0]?.full_name;
    }

    // COMMIT
    await client.query('COMMIT');

    // BROADCAST auction:ended to room
    io.to(`auction-${auctionId}`).emit('auction:ended', {
      auction_id: auctionId,
      status: 'ended',
      winner_id: winnerId,
      winner_name: winnerName,
      final_price: finalPrice
    });

    console.log(`[Auction Socket] ✅ Auction ${auctionId} closed. Winner: ${winnerId} (${winnerName})`);

    // SEND PUSH NOTIFICATIONS
    try {
      const productQuery = `SELECT product_name FROM auctions WHERE auction_id = $1`;
      const productResult = await client.query(productQuery, [auctionId]);
      const productName = productResult.rows[0]?.product_name || 'produk';

      // Notify winner
      if (winnerId) {
        await sendAuctionNotification(
          winnerId,
          'Selamat! Anda Menang Lelang',
          `Anda memenangkan lelang ${productName} dengan harga Rp ${finalPrice.toLocaleString('id-ID')}`,
          auctionId
        );
        console.log(`[Auction Socket] Push notification sent to winner ${winnerId}`);
      }

      // Notify seller
      const sellerQuery = `
        SELECT s.owner_id 
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        WHERE a.auction_id = $1
      `;
      const sellerResult = await client.query(sellerQuery, [auctionId]);
      const sellerId = sellerResult.rows[0]?.owner_id;

      if (sellerId) {
        const message = winnerId 
          ? `Lelang ${productName} telah berakhir. Pemenang: ${winnerName} (Rp ${finalPrice.toLocaleString('id-ID')})`
          : `Lelang ${productName} telah berakhir tanpa pemenang`;
        
        await sendAuctionNotification(
          sellerId,
          'Lelang Berakhir',
          message,
          auctionId
        );
        console.log(`[Auction Socket] Push notification sent to seller ${sellerId}`);
      }
    } catch (notifError) {
      console.error('[Auction Socket] Error sending end auction notifications:', notifError);
    }

    // Clean up timer
    auctionTimers.delete(auctionId);

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Auction Socket] Rollback error in closeAuction:', rollbackErr);
    }
    console.error('[Auction Socket] Error closing auction:', error);
  } finally {
    client.release();
  }
}

module.exports = setupAuctionSocket;

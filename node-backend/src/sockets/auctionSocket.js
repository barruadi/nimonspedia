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
const { sendOutbidNotification, sendAuctionWonNotification, sendAuctionEndedSellerNotification } = require('../utils/notificationUtils');

// Map to track active auction timers: { auctionId: timeoutHandle }
const auctionTimers = new Map();

/**
 * Initialize auction socket handlers
 * @param {Socket.IO} io - Socket.IO instance
 */
const setupAuctionSocket = (io) => {
  console.log('[Auction Socket Setup] Starting auction socket setup...');
  
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    console.log(`[Auction Socket Auth] New connection attempt: ${socket.id}`);
    console.log(`[Auction Socket Auth] Handshake headers:`, socket.handshake.headers);
    console.log(`[Auction Socket Auth] Handshake auth:`, socket.handshake.auth);
    
    try {
      const userId = socket.handshake.auth.userId;
      const userRole = socket.handshake.auth.userRole;

      console.log(`[Auction Socket Auth] Extracted from handshake - userId: "${userId}" (type: ${typeof userId}), userRole: "${userRole}" (type: ${typeof userRole})`);

      // Validate required auth data
      if (!userId || !userRole) {
        console.warn(`[Auction Socket Auth] ❌ Authentication failed: missing data. userId: ${userId}, userRole: ${userRole}`);
        return next(new Error('Authentication required: missing userId or userRole'));
      }

      // Verify userId is a valid integer
      const parsedUserId = parseInt(userId);
      console.log(`[Auction Socket Auth] Parsed userId: ${parsedUserId}, isNaN: ${isNaN(parsedUserId)}`);
      
      if (isNaN(parsedUserId)) {
        console.warn(`[Auction Socket Auth] ❌ Invalid userId format: "${userId}"`);
        return next(new Error('Invalid userId format'));
      }

      console.log(`[Auction Socket Auth] Querying database for user ${parsedUserId}...`);
      
      // Verify user exists in database
      const userQuery = `
        SELECT user_id, role, full_name
        FROM users
        WHERE user_id = $1
      `;
      const pgPool = pool.getInstance();
      const userResult = await pgPool.query(userQuery, [parsedUserId]);

      console.log(`[Auction Socket Auth] Database query result: ${userResult.rows.length} row(s) found`);

      if (userResult.rows.length === 0) {
        console.warn(`[Auction Socket Auth] ❌ User ${parsedUserId} not found in database`);
        return next(new Error('User not found'));
      }

      const dbUser = userResult.rows[0];
      console.log(`[Auction Socket Auth] Database user data:`, dbUser);

      // Verify role matches (prevent role spoofing)
      if (dbUser.role !== userRole) {
        console.warn(`[Auction Socket Auth] ❌ Role mismatch - DB: "${dbUser.role}", provided: "${userRole}"`);
        return next(new Error('Role mismatch'));
      }

      // Store authenticated user data on socket
      socket.userId = parsedUserId;
      socket.userRole = userRole;
      socket.userName = dbUser.full_name;

      console.log(`[Auction Socket Auth] ✅ User authenticated - socket: ${socket.id}, userId: ${parsedUserId}, role: ${userRole}, name: ${dbUser.full_name}`);
      next();
    } catch (error) {
      console.error('[Auction Socket Auth] ❌ Authentication error:', error.message);
      console.error('[Auction Socket Auth] Error stack:', error.stack);
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  console.log('[Auction Socket Setup] Middleware registered, setting up connection handler...');

  io.on('connection', (socket) => {
    console.log(`[Auction Socket] ✅ User CONNECTED: ${socket.id} (userId: ${socket.userId}, role: ${socket.userRole}, name: ${socket.userName})`);

    /**
     * EVENT: auction:join
     * Client joins auction room to receive real-time updates
     * 
     * Payload: { auctionId: number }
     * Uses authenticated userId from socket
     */
    socket.on('auction:join', (data, callback) => {
      try {
        const { auctionId } = data;

        // Validate auctionId
        if (!auctionId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId'
          });
        }

        const parsedAuctionId = parseInt(auctionId);
        if (isNaN(parsedAuctionId)) {
          return callback?.({
            success: false,
            error: 'Invalid auctionId format'
          });
        }

        // Join auction room
        socket.join(`auction-${parsedAuctionId}`);
        socket.auctionId = parsedAuctionId;

        console.log(`[Auction Socket] User ${socket.userId} (${socket.userName}) joined auction ${parsedAuctionId} (socket: ${socket.id})`);

        io.to(`auction-${parsedAuctionId}`).emit('auction:user-joined', {
          userId: socket.userId,
          userName: socket.userName,
          userRole: socket.userRole,
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
      const pgPool = pool.getInstance();
      let client;
      
      try {
        const { auctionId, bidAmount } = data;
        // Use authenticated userId instead of trusting client data
        const bidderId = socket.userId;
        
        client = await pgPool.connect();

        console.log(`[Auction Socket] Bid attempt - Auction ${auctionId}, Bidder ${bidderId} (${socket.userName}), Amount ${bidAmount}`);

        // ===== VALIDATION =====
        if (!auctionId || !bidAmount) {
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

        // Verify user role (only buyers can bid, not sellers)
        if (socket.userRole === 'seller') {
          return callback?.({
            success: false,
            error: 'Sellers cannot place bids'
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
            product_id, quantity, start_time, end_time
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

        // STEP 4: GET PREVIOUS HIGHEST BIDDER (do this first to determine minimum bid)
        const highestBidQuery = `
          SELECT bidder_id, bid_amount 
          FROM auction_bids 
          WHERE auction_id = $1 
          ORDER BY bid_amount DESC, bid_id DESC 
          LIMIT 1
        `;
        const highestBidResult = await client.query(highestBidQuery, [auctionId]);
        const previousBid = highestBidResult.rows[0] || null;

        // STEP 3: VALIDATE BID AMOUNT
        // First bid must be >= starting_price, subsequent bids must be >= current_price + min_increment
        const minimumBid = previousBid 
          ? auction.current_price + auction.min_increment 
          : auction.starting_price;
        
        if (bidAmount < minimumBid) {
          await client.query('ROLLBACK');
          return callback?.({
            success: false,
            error: `Bid minimal: Rp ${minimumBid.toLocaleString('id-ID')}`
          });
        }

        // STEP 5: DEDUCT BALANCE FROM BUYER
        const deductQuery = `
          UPDATE users 
          SET balance = balance - $1
          WHERE user_id = $2
        `;
        await client.query(deductQuery, [bidAmount, bidderId]);
        console.log(`[Auction Socket] Deducted ${bidAmount} from bidder ${bidderId}`);

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
          SET current_price = $1, end_time = $2
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
          server_time: new Date().toISOString(),
          is_first_bid: !previousBid,
          bid_history: bidHistoryResult.rows
        });

        console.log(`[Auction Socket] Broadcast bid-update to auction ${auctionId}`);

        // SEND OUTBID NOTIFICATION TO PREVIOUS BIDDER
        if (previousBid && previousBid.bidder_id !== bidderId) {
          try {
            const productQuery = `
              SELECT p.name as product_name
              FROM auctions a
              JOIN products p ON a.product_id = p.product_id
              WHERE a.auction_id = $1
            `;
            const productResult = await pgPool.query(productQuery, [auctionId]);
            const productName = productResult.rows[0]?.product_name || 'produk';

            await sendOutbidNotification(
              previousBid.bidder_id,
              productName,
              auctionId,
              buyer.full_name,
              bidAmount
            );
            console.log(`[Auction Socket] Outbid notification sent to user ${previousBid.bidder_id}`);
          } catch (notifError) {
            console.error('[Auction Socket] Error sending outbid notification:', notifError.message);
          }
        }

        // SEND PUSH NOTIFICATION TO SELLER
        try {
          const productQuery = `
            SELECT p.name as product_name
            FROM auctions a
            JOIN products p ON a.product_id = p.product_id
            WHERE a.auction_id = $1
          `;
          const productResult = await pgPool.query(productQuery, [auctionId]);
          const productName = productResult.rows[0]?.product_name || 'produk';

          const sellerQuery = `
            SELECT s.owner_id 
            FROM auctions a
            JOIN products p ON a.product_id = p.product_id
            JOIN stores s ON p.store_id = s.store_id
            WHERE a.auction_id = $1
          `;
          const sellerResult = await pgPool.query(sellerQuery, [auctionId]);
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
          if (client) {
            await client.query('ROLLBACK');
          }
        } catch (rollbackErr) {
          console.error('[Auction Socket] Rollback error:', rollbackErr);
        }

        console.error('[Auction Socket] Error in place-bid:', error.message);
        callback?.({
          success: false,
          error: error.message || 'Gagal menempatkan penawaran'
        });

      } finally {
        if (client) {
          client.release();
        }
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
        const pgPool = pool.getInstance();
        const result = await pgPool.query(query, [auctionId]);

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
  const pgPool = pool.getInstance();
  const client = await pgPool.connect();
  
  try {
    console.log(`[Auction Socket] ⏰ Auto-closing auction ${auctionId}`);

    // BEGIN transaction
    await client.query('BEGIN');

    // LOCK auction & get details
    const auctionQuery = `
      SELECT 
        auction_id, product_id, current_price, status, quantity
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
    let orderId = null;
    let productName = null;

    if (winner) {
      winnerId = winner.bidder_id;

      // Get product & store info
      const productQuery = `
        SELECT product_id, store_id, name FROM products WHERE product_id = $1
      `;
      const productResult = await client.query(productQuery, [auction.product_id]);
      const product = productResult.rows[0];
      productName = product?.name || 'produk';

      // CREATE ORDER AUTOMATICALLY
      const orderQuery = `
        INSERT INTO orders (buyer_id, store_id, status, total_amount, created_at)
        VALUES ($1, $2, 'approved', $3, NOW())
        RETURNING order_id, status, created_at
      `;
      console.log(`[Auction Socket] Creating order with: buyer=${winnerId}, store=${product.store_id}, amount=${finalPrice}`);
      const orderResult = await client.query(orderQuery, [winnerId, product.store_id, finalPrice]);
      
      if (!orderResult.rows[0]) {
        console.error(`[Auction Socket] ❌ ORDER INSERT FAILED for auction ${auctionId}`);
        throw new Error('Order insert returned no rows');
      }
      
      orderId = orderResult.rows[0].order_id;
      console.log(`[Auction Socket] Order insert result:`, orderResult.rows[0]);

      // Insert order item
      const orderItemQuery = `
        INSERT INTO order_items (order_id, product_id, price_at, qty)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(orderItemQuery, [orderId, auction.product_id, finalPrice, auction.quantity]);

      console.log(`[Auction Socket] ✅ Order ${orderId} created for auction ${auctionId}:`);
      console.log(`  - Buyer: ${winnerId}`);
      console.log(`  - Store: ${product.store_id}`);
      console.log(`  - Amount: Rp ${finalPrice}`);
      console.log(`  - Status: approved`);
    }

    // REFUND NON-WINNING BIDS
    // Winner: refund all bids EXCEPT the highest (winning) bid
    // Losers: refund ALL bids
    
    if (winnerId) {
      // Refund winner's previous bids (all except max)
      const winnerPreviousBidsQuery = `
        SELECT SUM(bid_amount) as total_refund
        FROM auction_bids
        WHERE auction_id = $1 AND bidder_id = $2
        AND bid_amount != (
          SELECT MAX(bid_amount) 
          FROM auction_bids 
          WHERE auction_id = $1 AND bidder_id = $2
        )
      `;
      const winnerRefundResult = await client.query(winnerPreviousBidsQuery, [auctionId, winnerId]);
      const winnerRefundAmount = winnerRefundResult.rows[0]?.total_refund || 0;
      
      if (winnerRefundAmount > 0) {
        const winnerRefundQuery = `
          UPDATE users 
          SET balance = balance + $1
          WHERE user_id = $2
        `;
        await client.query(winnerRefundQuery, [winnerRefundAmount, winnerId]);
        console.log(`[Auction Socket] Refunded Rp ${winnerRefundAmount} (previous bids) to winner ${winnerId}`);
      }
    }
    
    // Refund all losing bidders - ALL their bids
    const losingBidsQuery = `
      SELECT bidder_id, SUM(bid_amount) as total_bid_amount
      FROM auction_bids
      WHERE auction_id = $1 AND bidder_id != $2
      GROUP BY bidder_id
    `;
    const losingBidsResult = await client.query(losingBidsQuery, [auctionId, winnerId || -1]);
    
    if (losingBidsResult.rows.length > 0) {
      console.log(`[Auction Socket] Refunding ${losingBidsResult.rows.length} losing bidders for auction ${auctionId}`);
      
      for (const losingBid of losingBidsResult.rows) {
        const refundQuery = `
          UPDATE users 
          SET balance = balance + $1
          WHERE user_id = $2
        `;
        await client.query(refundQuery, [losingBid.total_bid_amount, losingBid.bidder_id]);
        console.log(`[Auction Socket] Refunded Rp ${losingBid.total_bid_amount} (all bids) to losing bidder ${losingBid.bidder_id}`);
      }
    }

    // UPDATE AUCTION STATUS TO ENDED
    const updateQuery = `
      UPDATE auctions 
      SET status = 'ended', winner_id = $1
      WHERE auction_id = $2
    `;
    await client.query(updateQuery, [winner?.bidder_id || null, auctionId]);

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

    // EMIT order:created event to winner
    if (winnerId) {
      io.to(`user-${winnerId}`).emit('order:created', {
        order_id: orderId || null,
        auction_id: auctionId,
        product_name: productName || 'produk',
        final_price: finalPrice,
        status: 'approved',
        message: 'Order Anda dari hasil lelang sudah dibuat dengan status approved'
      });
      console.log(`[Auction Socket] Emitted order:created event to winner ${winnerId} (order: ${orderId})`);
    }

    console.log(`[Auction Socket] ✅ Auction ${auctionId} closed. Winner: ${winnerId} (${winnerName})`);

    // SEND PUSH NOTIFICATIONS
    try {
      const productQuery = `
        SELECT p.name as product_name
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        WHERE a.auction_id = $1
      `;
      const productResult = await client.query(productQuery, [auctionId]);
      const productName = productResult.rows[0]?.product_name || 'produk';

      // Notify winner
      if (winnerId && winnerName) {
        await sendAuctionWonNotification(
          winnerId,
          productName,
          finalPrice,
          winnerName
        );
        console.log(`[Auction Socket] Win notification sent to winner ${winnerId}`);
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
        await sendAuctionEndedSellerNotification(
          sellerId,
          productName,
          winnerName || 'Tidak ada pemenang',
          finalPrice
        );
        console.log(`[Auction Socket] Seller ended notification sent to seller ${sellerId}`);
      }
    } catch (notifError) {
      console.error('[Auction Socket] Error sending auction end notifications:', notifError.message);
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

/**
 * Check and transition scheduled auctions to active when start_time is reached
 * @param {Socket.IO} io - Socket.IO instance
 */
async function checkAndStartScheduledAuctions(io) {
  try {
    const pgPool = pool.getInstance();
    
    // Get all scheduled auctions where start_time <= NOW
    const result = await pgPool.query(
      `SELECT a.auction_id, a.product_id, p.name as product_name, p.image_path, 
              a.starting_price, a.current_price, a.start_time, s.store_name,
              COUNT(DISTINCT b.bid_id) as bid_count
       FROM auctions a
       JOIN products p ON a.product_id = p.product_id
       JOIN stores s ON p.store_id = s.store_id
       LEFT JOIN auction_bids b ON a.auction_id = b.auction_id
       WHERE a.status = 'scheduled' AND a.start_time <= NOW()
       GROUP BY a.auction_id, a.product_id, p.name, p.image_path, 
                a.starting_price, a.current_price, a.start_time, s.store_name`
    );

    if (result.rows.length === 0) {
      return; // No scheduled auctions to start
    }

    console.log(`[Auction Check] Found ${result.rows.length} scheduled auctions to start`);

    // Update all these auctions to 'active' status
    for (const auction of result.rows) {
      try {
        const updateResult = await pgPool.query(
          `UPDATE auctions 
           SET status = 'active' 
           WHERE auction_id = $1 AND status = 'scheduled'
           RETURNING *`,
          [auction.auction_id]
        );

        if (updateResult.rows.length > 0) {
          console.log(`[Auction Check] Transitioned auction ${auction.auction_id} to active`);
          
          // Emit auction:started event to all connected clients
          io.emit('auction:started', {
            auction_id: auction.auction_id,
            product_id: auction.product_id,
            product_name: auction.product_name,
            image_path: auction.image_path,
            starting_price: parseInt(auction.starting_price),
            current_price: parseInt(auction.current_price),
            start_time: auction.start_time,
            end_time: null,
            status: 'active',
            store_name: auction.store_name,
            bid_count: parseInt(auction.bid_count) || 0,
            winner_id: null
          });
        }
      } catch (err) {
        console.error(`[Auction Check] Error updating auction ${auction.auction_id}:`, err);
      }
    }
  } catch (error) {
    console.error('[Auction Check] Error checking scheduled auctions:', error);
  }
}

module.exports = { setupAuctionSocket, checkAndStartScheduledAuctions };

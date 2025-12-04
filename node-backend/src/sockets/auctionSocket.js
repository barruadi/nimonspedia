// Auction WebSocket Handlers - Mockup
const Auction = require('../models/Auction');

const setupAuctionSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('[Auction] User connected:', socket.id);

    /**
     * Join auction room
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
        socket.userId = userId;
        socket.currentAuction = auctionId;

        console.log(`[Auction] User ${userId} (socket: ${socket.id}) joined auction ${auctionId}`);

        io.to(`auction-${auctionId}`).emit('auction:user-joined', {
          userId,
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });

        callback?.({
          success: true,
          message: 'Successfully joined auction room'
        });

      } catch (error) {
        console.error('[Auction] Error in join:', error.message);
        callback?.({
          success: false,
          error: 'Failed to join auction room'
        });
      }
    });

    /**
     * Leave auction room
     * Client emits: { auctionId: number }
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
        console.log(`[Auction] User ${socket.userId} (socket: ${socket.id}) left auction ${auctionId}`);

        // Notify others that user left
        io.to(`auction-${auctionId}`).emit('auction:user-left', {
          userId: socket.userId,
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });

        socket.currentAuction = null;

        callback?.({
          success: true,
          message: 'Successfully left auction room'
        });

      } catch (error) {
        console.error('[Auction] Error in leave:', error);
        callback?.({
          success: false,
          error: 'Failed to leave auction room'
        });
      }
    });

    /**
     * Place bid with real-time validation and broadcasting
     * + 15-second anti-sniping rule
     * 
     * Client emits: { auctionId: number, bidderId: number, bidAmount: number }
     * Callback: { success: boolean, error?: string, data?: {...} }
     */
    socket.on('auction:place-bid', async (data, callback) => {
      try {
        const { auctionId, bidderId, bidAmount } = data;

        // Validate input
        if (!auctionId || !bidderId || !bidAmount) {
          return callback?.({
            success: false,
            error: 'Missing required fields: auctionId, bidderId, bidAmount'
          });
        }

        if (isNaN(bidAmount) || bidAmount <= 0) {
          return callback?.({
            success: false,
            error: 'Invalid bid amount'
          });
        }

        console.log(`[Auction] Bid attempt - Auction ${auctionId}, Bidder ${bidderId}, Amount ${bidAmount}`);

        // Get auction details BEFORE placing bid (for time check)
        const auctionBefore = await Auction.findById(auctionId);
        if (!auctionBefore) {
          return callback?.({
            success: false,
            error: 'Auction not found'
          });
        }

        const now = new Date();
        const endTime = new Date(auctionBefore.end_time);
        const timeRemaining = (endTime - now) / 1000; // in seconds

        console.log(`[Auction] Time remaining before bid: ${timeRemaining}s`);

        // Get previous highest bidder
        const previousBids = await Auction.getBids(auctionId);
        const previousHighestBid = previousBids.length > 0 ? previousBids[0] : null;

        // Place new bid
        const result = await Auction.placeBid(auctionId, {
          bidder_id: bidderId,
          bid_amount: bidAmount
        });

        // **AUTOMATIC REFUND**: Refund previous bidder's balance
        if (previousHighestBid && previousHighestBid.bidder_id !== bidderId) {
          try {
            await Auction.refundPreviousBid(auctionId, previousHighestBid.bidder_id);
            
            // Notify previous bidder via socket
            io.to(`user-${previousHighestBid.bidder_id}`).emit('auction:outbid', {
              auction_id: auctionId,
              new_bid_amount: bidAmount,
              new_bidder_id: bidderId,
              refunded_amount: previousHighestBid.bid_amount
            });
          } catch (refundError) {
            console.error('Error refunding previous bid:', refundError);
          }
        }

        // Anti-snipping logic (15 second rule)
        let newEndTime = endTime;
        let timeExtended = false;

        if (timeRemaining < 15) {
          // Extend auction end time to 15 seconds from now
          newEndTime = new Date(now.getTime() + 15 * 1000);
          timeExtended = true;

          console.log(`[Auction] Anti-sniping triggered! Extending auction ${auctionId} by ${Math.ceil(15 - timeRemaining)}s`);

          // Update auction end_time in database
          try {
            await Auction.update(auctionId, {
              end_time: newEndTime.toISOString()
            });
            console.log(`[Auction] Auction ${auctionId} end_time extended to ${newEndTime.toISOString()}`);
          } catch (updateError) {
            console.error('[Auction] Error extending auction time:', updateError);
            // Log error but don't fail the bid - it's already recorded
          }
        }

        // Success callback
        callback?.({
          success: true,
          data: {
            bid_id: result.bid.bid_id,
            bid_amount: result.auction_current_price,
            bid_time: result.bid.bid_time,
            time_extended: timeExtended,
            new_end_time: timeExtended ? newEndTime.toISOString() : null
          },
          message: 'Bid placed successfully'
        });

        // Broadcast new bid to all users in auction room
        io.to(`auction-${auctionId}`).emit('auction:bid-update', {
          auction_id: auctionId,
          bidder_id: bidderId,
          bid_amount: result.auction_current_price,
          bid_id: result.bid.bid_id,
          bid_time: result.bid.bid_time,
          total_bids: await getAuctionBidCount(auctionId),
          time_extended: timeExtended,
          new_end_time: timeExtended ? newEndTime.toISOString() : null,
          timestamp: new Date().toISOString()
        });

        console.log(`[Auction] Bid successful - Auction ${auctionId}, New price: ${result.auction_current_price}`);

      } catch (error) {
        console.error('[Auction] Error in place-bid:', error);

        // Error callback
        callback?.({
          success: false,
          error: error.message || 'Failed to place bid'
        });

        // Notify others of failed bid attempt (optional)
        io.to(`auction-${data.auctionId}`).emit('auction:bid-failed', {
          auction_id: data.auctionId,
          bidder_id: data.bidderId,
          reason: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    /**
     * Stop Auction (Seller Action)
     * Seller can stop active auction - auction ends with current winner
     * 
     * Client emits: { auctionId: number, sellerId: number }
     * Callback: { success: boolean, error?: string, data?: {...} }
     */
    socket.on('auction:stop', async (data, callback) => {
      try {
        const { auctionId, sellerId } = data;

        if (!auctionId || !sellerId) {
          return callback?.({
            success: false,
            error: 'Missing required fields: auctionId, sellerId'
          });
        }

        console.log(`[Auction] Stop request - Auction ${auctionId}, Seller ${sellerId}`);

        // Get auction to verify seller ownership
        const auction = await Auction.findById(auctionId);
        if (!auction) {
          return callback?.({
            success: false,
            error: 'Auction not found'
          });
        }

        // Verify seller ownership
        // Check if seller owns the product/store
        const productCheck = await Auction.verifySellerOwnership(auctionId, sellerId);
        if (!productCheck) {
          return callback?.({
            success: false,
            error: 'You do not have permission to stop this auction'
          });
        }

        // Stop the auction
        const result = await Auction.stopAuction(auctionId, sellerId);

        // Success callback
        callback?.({
          success: true,
          data: {
            auction_id: result.auction_id,
            status: result.status,
            message: result.message
          }
        });

        // Broadcast auction ended to all users in room
        io.to(`auction-${auctionId}`).emit('auction:ended', {
          auction_id: auctionId,
          status: 'ended',
          winner_id: auction.winner_id || null,
          final_price: parseInt(auction.current_price),
          reason: 'stopped_by_seller',
          timestamp: new Date().toISOString()
        });

        console.log(`[Auction] Auction ${auctionId} stopped by seller ${sellerId}. Winner: ${auction.winner_id}`);

      } catch (error) {
        console.error('[Auction] Error in auction:stop:', error);

        callback?.({
          success: false,
          error: error.message || 'Failed to stop auction'
        });
      }
    });

    /**
     * Cancel Auction (Seller Action)
     * Seller can cancel auction ONLY if no bids yet
     * 
     * Client emits: { auctionId: number, sellerId: number }
     * Callback: { success: boolean, error?: string }
     */
    socket.on('auction:cancel', async (data, callback) => {
      try {
        const { auctionId, sellerId } = data;

        if (!auctionId || !sellerId) {
          return callback?.({
            success: false,
            error: 'Missing required fields: auctionId, sellerId'
          });
        }

        console.log(`[Auction] Cancel request - Auction ${auctionId}, Seller ${sellerId}`);

        // Get auction
        const auction = await Auction.findById(auctionId);
        if (!auction) {
          return callback?.({
            success: false,
            error: 'Auction not found'
          });
        }

        // Verify seller ownership
        const productCheck = await Auction.verifySellerOwnership(auctionId, sellerId);
        if (!productCheck) {
          return callback?.({
            success: false,
            error: 'You do not have permission to cancel this auction'
          });
        }

        // Check if auction has bids
        const bidCount = await getAuctionBidCount(auctionId);
        if (bidCount > 0) {
          return callback?.({
            success: false,
            error: 'Cannot cancel auction with existing bids. Use "Stop" instead.'
          });
        }

        // Cancel the auction
        const result = await Auction.delete(auctionId);

        // Success callback
        callback?.({
          success: true,
          data: {
            auction_id: auctionId,
            message: 'Auction cancelled successfully'
          }
        });

        // Broadcast auction cancelled to all users in room
        io.to(`auction-${auctionId}`).emit('auction:cancelled', {
          auction_id: auctionId,
          status: 'cancelled',
          reason: 'cancelled_by_seller',
          timestamp: new Date().toISOString()
        });

        console.log(`[Auction] Auction ${auctionId} cancelled by seller ${sellerId}`);

      } catch (error) {
        console.error('[Auction] Error in auction:cancel:', error);

        callback?.({
          success: false,
          error: error.message || 'Failed to cancel auction'
        });
      }
    });

    /**
     * Time Synchronization
     * Client requests server time to sync countdown timer
     * 
     * Client emits: { auctionId: number }
     * Callback: { success: boolean, server_time: string, end_time: string, time_remaining: number }
     */
    socket.on('auction:sync-time', async (data, callback) => {
      try {
        const { auctionId } = data;

        if (!auctionId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId'
          });
        }

        // Get auction to get end_time
        const auction = await Auction.findById(auctionId);
        if (!auction) {
          return callback?.({
            success: false,
            error: 'Auction not found'
          });
        }

        const serverTime = new Date();
        const endTime = new Date(auction.end_time);
        const timeRemaining = Math.max(0, (endTime - serverTime) / 1000); // in seconds

        console.log(`[Auction] Time sync - Auction ${auctionId}: ${timeRemaining.toFixed(2)}s remaining`);

        callback?.({
          success: true,
          data: {
            auction_id: auctionId,
            server_time: serverTime.toISOString(),
            end_time: auction.end_time,
            time_remaining: Math.ceil(timeRemaining),
            auction_status: auction.status
          }
        });

      } catch (error) {
        console.error('[Auction] Error in sync-time:', error);

        callback?.({
          success: false,
          error: 'Failed to sync time'
        });
      }
    });

    /**
     * Get current auction stats (for countdown timer updates)
     * Client emits: { auctionId: number }
     */
    socket.on('auction:get-stats', async (data, callback) => {
      try {
        const { auctionId } = data;

        if (!auctionId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId'
          });
        }

        const stats = await Auction.getAuctionStats(auctionId);
        const auction = await Auction.findById(auctionId);
        const minBid = await Auction.getMinimumBidAmount(auctionId);

        if (!auction) {
          return callback?.({
            success: false,
            error: 'Auction not found'
          });
        }

        const serverTime = new Date();
        const endTime = new Date(auction.end_time);
        const timeRemaining = Math.max(0, (endTime - serverTime) / 1000);

        callback?.({
          success: true,
          data: {
            auction_id: auctionId,
            current_price: parseInt(auction.current_price),
            status: auction.status,
            end_time: auction.end_time,
            time_remaining: Math.ceil(timeRemaining),
            minimum_bid_amount: minBid?.minimum_bid_amount || null,
            total_bids: parseInt(stats.total_bids) || 0,
            unique_bidders: parseInt(stats.unique_bidders) || 0,
            highest_bid: stats.highest_bid ? parseInt(stats.highest_bid) : null,
            server_time: serverTime.toISOString(),
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('[Auction] Error in get-stats:', error.message);
        callback?.({
          success: false,
          error: 'Failed to get auction stats'
        });
      }
    });

    /**
     * Get latest bids (for bid history)
     * Client emits: { auctionId: number, limit: number }
     */
    socket.on('auction:get-bids', async (data, callback) => {
      try {
        const { auctionId, limit = 10 } = data;

        if (!auctionId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId'
          });
        }

        const bids = await Auction.getBids(auctionId);

        callback?.({
          success: true,
          data: {
            auction_id: auctionId,
            bids: bids.slice(0, limit).map(bid => ({
              bid_id: bid.bid_id,
              bidder_id: bid.bidder_id,
              bidder_name: bid.bidder_name,
              bid_amount: parseInt(bid.bid_amount),
              bid_time: bid.bid_time
            })),
            total_bids: bids.length
          }
        });

      } catch (error) {
        console.error('[Auction] Error in get-bids:', error.message);
        callback?.({
          success: false,
          error: 'Failed to get bid history'
        });
      }
    });

    /**
     * Subscribe to real-time bid updates
     * Client emits: { auctionId: number }
     * Server emits: 'auction:bid-update' events to this socket
     */
    socket.on('auction:subscribe-updates', (data, callback) => {
      try {
        const { auctionId } = data;

        if (!auctionId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId'
          });
        }

        socket.join(`auction-updates-${auctionId}`);
        console.log(`[Auction] User ${socket.userId} subscribed to updates for auction ${auctionId}`);

        callback?.({
          success: true,
          message: 'Subscribed to auction updates'
        });

      } catch (error) {
        console.error('[Auction] Error in subscribe-updates:', error);
        callback?.({
          success: false,
          error: 'Failed to subscribe to updates'
        });
      }
    });

    /**
     * Unsubscribe from real-time bid updates
     */
    socket.on('auction:unsubscribe-updates', (data, callback) => {
      try {
        const { auctionId } = data;

        if (!auctionId) {
          return callback?.({
            success: false,
            error: 'Missing auctionId'
          });
        }

        socket.leave(`auction-updates-${auctionId}`);
        console.log(`[Auction] User ${socket.userId} unsubscribed from updates for auction ${auctionId}`);

        callback?.({
          success: true,
          message: 'Unsubscribed from auction updates'
        });

      } catch (error) {
        console.error('[Auction] Error in unsubscribe-updates:', error);
        callback?.({
          success: false,
          error: 'Failed to unsubscribe'
        });
      }
    });

    /**
     * Update Auction Status (Admin or Seller Action)
     * Client emits: { auctionId: number, status: string }
     * Callback: { success: boolean, error?: string, data?: {...} }
     */
    socket.on('auction:update-status', async (data, callback) => {
      try {
        const { auctionId, status } = data;
        
        // Validate status change
        const validTransitions = {
          'scheduled': ['active', 'cancelled'],
          'active': ['ended', 'cancelled'],
          'ended': [],
          'cancelled': []
        };

        const auction = await Auction.findById(auctionId);
        if (!validTransitions[auction.status].includes(status)) {
          return callback?.({
            success: false,
            error: `Cannot transition from ${auction.status} to ${status}`
          });
        }

        const updated = await Auction.updateAuctionStatus(auctionId, status);

        callback?.({
          success: true,
          data: updated
        });

        // Broadcast status change to all users
        io.to(`auction-${auctionId}`).emit('auction:status-changed', {
          auction_id: auctionId,
          old_status: auction.status,
          new_status: status,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('[Auction] Error in update-status:', error);
        callback?.({
          success: false,
          error: error.message
        });
      }
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      console.log('[Auction] User disconnected:', socket.id);
      
      // Notify auction room that user left
      if (socket.currentAuction) {
        io.to(`auction-${socket.currentAuction}`).emit('auction:user-left', {
          userId: socket.userId,
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  /**
   * Background Job: Process ended auctions every 30 seconds
   */
  const backgroundJobInterval = setInterval(async () => {
    try {
      console.log('[Background Job] Running processEndedAuctions...');
      await Auction.processEndedAuctions(io);

    } catch (error) {
      console.error('[Background Job] Error:', error.message);
    }
  }, 30000);

  process.on('SIGTERM', () => {
    clearInterval(backgroundJobInterval);
  });

  process.on('SIGINT', () => {
    clearInterval(backgroundJobInterval);
  });

  return io;
};

/**
 * Helper function
 */
async function getAuctionBidCount(auctionId) {
  try {
    const stats = await Auction.getAuctionStats(auctionId);
    return parseInt(stats.total_bids) || 0;
  } catch (error) {
    console.error('Error getting bid count:', error.message);
    return 0;
  }
}

module.exports = setupAuctionSocket;

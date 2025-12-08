const Auction = require('../models/Auction');

class AuctionController {
  /**
   * Get all auctions with requested filters & pagination
   */
  static async getAllAuctions(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || null;
      const search = req.query.q || null;

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid pagination parameters. Page and limit must be positive, limit max 100.'
        });
      }

      // Validate status if provided
      const validStatuses = ['scheduled', 'active', 'ended', 'cancelled'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          ok: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const result = await Auction.findAll({
        page,
        limit,
        status,
        search
      });

      return res.status(200).json({
        ok: true,
        data: result.data.map(row => ({
          auction_id: row.auction_id,
          product_id: row.product_id,
          product_name: row.product_name,
          image_path: row.image_path,
          starting_price: parseInt(row.starting_price),
          current_price: parseInt(row.current_price),
          start_time: row.start_time,
          end_time: row.end_time,
          status: row.status,
          store_name: row.store_name,
          bid_count: parseInt(row.bid_count) || 0,
          winner_id: row.winner_id
        })),
        meta: {
          page: result.meta.page,
          limit: result.meta.limit,
          totalCount: result.meta.totalCount,
          totalPages: result.meta.totalPages
        }
      });

    } catch (error) {
      console.error('Error in getAllAuctions:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get auction detail by ID
   */
  static async getAuctionById(req, res) {
    try {
      const auctionId = parseInt(req.params.id);

      // Validate auction ID
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid auction ID'
        });
      }

      const auction = await Auction.findById(auctionId);

      if (!auction) {
        return res.status(404).json({
          ok: false,
          error: 'Auction not found'
        });
      }

      console.log('[auctionController] Auction data from DB:', {
        auction_id: auction.auction_id,
        starting_price: auction.starting_price,
        current_price: auction.current_price,
        min_increment: auction.min_increment,
        quantity: auction.quantity,
        status: auction.status
      });

      const bids = await Auction.getBids(auctionId);
      const stats = await Auction.getAuctionStats(auctionId);

      console.log('[auctionController] Fetched auction from DB:', {
        auction_id: auction.auction_id,
        status: auction.status,
        winner_id: auction.winner_id,
        winner_name: auction.winner_name
      });

      // Return all relevant information regarding the auction
      return res.status(200).json({
        ok: true,
        data: {
          auction: {
            auction_id: auction.auction_id,
            product_id: auction.product_id,
            starting_price: parseInt(auction.starting_price),
            current_price: parseInt(auction.current_price),
            min_increment: parseInt(auction.min_increment),
            quantity: parseInt(auction.quantity),
            start_time: auction.start_time,
            end_time: auction.end_time,
            status: auction.status,
            winner_id: auction.winner_id,
            winner_name: auction.winner_name || null,
            seller_id: parseInt(auction.seller_id)
          },
          product: {
            product_id: auction.product_id,
            name: auction.product_name,
            image_path: auction.image_path
          },
          store: {
            store_id: auction.store_id,
            store_name: auction.store_name
          },
          stats: {
            total_bids: parseInt(stats.total_bids) || 0,
            highest_bid: stats.highest_bid ? parseInt(stats.highest_bid) : null,
            lowest_bid: stats.lowest_bid ? parseInt(stats.lowest_bid) : null,
            unique_bidders: parseInt(stats.unique_bidders) || 0
          },
          bid_history: bids.map(bid => ({
            bid_id: bid.bid_id,
            bidder_id: bid.bidder_id,
            bidder_name: bid.bidder_name,
            bid_amount: parseInt(bid.bid_amount),
            bid_time: bid.bid_time
          }))
        }
      });

    } catch (error) {
      console.error('Error in getAuctionById:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Create a new auction using provided data
   */
  static async createAuction(req, res) {
    try {
      const auctionData = req.body;

      // DEBUG: Log the entire request body
      console.log('[auctionController.createAuction] Full request body:', JSON.stringify(auctionData, null, 2));
      console.log('[auctionController.createAuction] min_increment:', {
        value: auctionData.min_increment,
        type: typeof auctionData.min_increment,
        isNumber: typeof auctionData.min_increment === 'number'
      });

      // Validate required fields (end_time is NOT required - will be set on first bid)
      if (!auctionData.product_id || !auctionData.starting_price || !auctionData.start_time) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields: product_id, starting_price, start_time'
        });
      }

      // Get seller_id from auth middleware
      const sellerId = req.userId;

      if (!sellerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized: User not authenticated'
        });
      }

      // Get seller's store ID from product
      const productCheck = await Auction.getPool().query(
        `SELECT p.product_id, p.store_id, s.owner_id 
         FROM products p 
         JOIN stores s ON p.store_id = s.store_id 
         WHERE p.product_id = $1`,
        [auctionData.product_id]
      );

      if (productCheck.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          error: 'Product not found'
        });
      }

      const ownerId = productCheck.rows[0].owner_id;

      // Verify that the authenticated user is the owner of this product's store
      if (ownerId !== sellerId) {
        return res.status(403).json({
          ok: false,
          error: 'Unauthorized: You do not own this product'
        });
      }

      // Check if seller already has an active OR scheduled auction (GLOBAL RULE)
      // BUSINESS RULE: Seller dapat hanya memiliki SATU lelang aktif/terjadwal secara global
      const globalAuctionCheck = await Auction.getPool().query(
        `SELECT COUNT(*) as count FROM auctions a
         JOIN products p ON a.product_id = p.product_id
         JOIN stores s ON p.store_id = s.store_id
         WHERE s.owner_id = $1 AND a.status IN ('active', 'scheduled')`,
        [sellerId]
      );

      const globalAuctionCount = parseInt(globalAuctionCheck.rows[0].count);

      if (globalAuctionCount > 0) {
        return res.status(400).json({
          ok: false,
          error: 'Anda sedang memiliki lelang berjalan. Harap selesaikan terlebih dahulu.'
        });
      }

      const newAuction = await Auction.create(auctionData);

      // Emit Socket.IO event to notify all connected clients about new auction
      if (global.ioInstance) {
        console.log('[auctionController] Emitting auction:created event for auction', newAuction.auction_id);
        
        // Get complete auction data with store name for real-time list
        const fullAuction = await Auction.findById(newAuction.auction_id);
        
        global.ioInstance.emit('auction:created', {
          auction_id: newAuction.auction_id,
          product_id: newAuction.product_id,
          product_name: fullAuction?.product_name,
          image_path: fullAuction?.image_path,
          starting_price: parseInt(newAuction.starting_price),
          current_price: parseInt(newAuction.current_price),
          start_time: newAuction.start_time,
          end_time: newAuction.end_time,
          status: newAuction.status,
          store_name: fullAuction?.store_name,
          bid_count: 0,
          winner_id: null
        });
      }

      return res.status(201).json({
        ok: true,
        message: 'Auction created successfully',
        data: {
          auction_id: newAuction.auction_id,
          product_id: newAuction.product_id,
          starting_price: parseInt(newAuction.starting_price),
          current_price: parseInt(newAuction.current_price),
          start_time: newAuction.start_time,
          end_time: newAuction.end_time,
          status: newAuction.status
        }
      });

    } catch (error) {
      console.error('Error in createAuction:', error);
      return res.status(400).json({
        ok: false,
        error: error.message || 'Failed to create auction'
      });
    }
  }

  /**
   * Get active auction for the authenticated seller
   */
  static async getSellerActiveAuction(req, res) {
    try {
      // Fetched from auth middleware
      const sellerId = req.userId; 

      // Validate seller ID
      if (!sellerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized'
        });
      }

      const auction = await Auction.findSellerActiveAuction(sellerId);

      // Validate auction
      if (!auction) {
        return res.status(404).json({
          ok: false,
          error: 'No active auction found'
        });
      }

      return res.status(200).json({
        ok: true,
        data: auction
      });

    } catch (error) {
      console.error('Error in getSellerActiveAuction:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get all seller auctions with pagination and optional status filter
   */
  static async getSellerAuctions(req, res) {
    try {
      const sellerId = req.userId; // Fetched from auth middleware
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || null;

      if (!sellerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized'
        });
      }

      const result = await Auction.findSellerAuctions(sellerId, { page, limit, status });

      return res.status(200).json({
        ok: true,
        data: result.data,
        meta: result.meta
      });

    } catch (error) {
      console.error('Error in getSellerAuctions:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get buyer's bid history with pagination
   */
  static async getBuyerBidHistory(req, res) {
    try {
      const buyerId = req.userId; // dari middleware auth
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      // Validate buyer ID
      if (!buyerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized'
        });
      }

      const result = await Auction.findBuyerBidHistory(buyerId, { page, limit });

      return res.status(200).json({
        ok: true,
        data: result.data,
        meta: result.meta
      });

    } catch (error) {
      console.error('Error in getBuyerBidHistory:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get auctions won by the buyer with pagination
   */
  static async getBuyerWonAuctions(req, res) {
    try {
      const buyerId = req.userId; // Fetched from auth middleware
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      // Validate buyer ID
      if (!buyerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized'
        });
      }

      const result = await Auction.findBuyerWonAuctions(buyerId, { page, limit });

      return res.status(200).json({
        ok: true,
        data: result.data,
        meta: result.meta
      });

    } catch (error) {
      console.error('Error in getBuyerWonAuctions:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Stop Auction (Seller Action)
   * Seller can stop active auction - auction ends with current winner
   * PUT /api/node/auction/:id/stop
   */
  static async stopAuction(req, res) {
    try {
      const auctionId = parseInt(req.params.id);
      const sellerId = req.userId; // From auth middleware

      // Validate auction ID
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid auction ID'
        });
      }

      // Validate seller ID
      if (!sellerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized'
        });
      }

      // Verify auction exists
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({
          ok: false,
          error: 'Auction not found'
        });
      }

      // Verify auction is active
      if (auction.status !== 'active') {
        return res.status(400).json({
          ok: false,
          error: `Cannot stop auction with status '${auction.status}'. Only active auctions can be stopped.`
        });
      }

      // Verify seller ownership
      const isOwner = await Auction.verifySellerOwnership(auctionId, sellerId);
      if (!isOwner) {
        return res.status(403).json({
          ok: false,
          error: 'You do not have permission to stop this auction'
        });
      }

      // Stop the auction
      const result = await Auction.stopAuction(auctionId, sellerId);

      // Fetch updated auction to get the new winner information
      const updatedAuction = await Auction.findById(auctionId);

      return res.status(200).json({
        ok: true,
        data: {
          auction_id: result.auction_id,
          status: result.status,
          winner_id: updatedAuction.winner_id || null,
          winner_name: updatedAuction.winner_name || null,
          final_price: parseInt(updatedAuction.current_price),
          order_id: result.order_id || null,
          message: result.message
        }
      });

    } catch (error) {
      console.error('Error in stopAuction:', error);
      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to stop auction'
      });
    }
  }

  /**
   * Cancel Auction (Seller Action)
   * Seller can cancel auction ONLY if no bids have been placed yet
   * PUT /api/node/auction/:id/cancel
   */
  static async cancelAuction(req, res) {
    try {
      const auctionId = parseInt(req.params.id);
      const sellerId = req.userId; // From auth middleware

      // Validate auction ID
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid auction ID'
        });
      }

      // Validate seller ID
      if (!sellerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized'
        });
      }

      // Verify auction exists
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({
          ok: false,
          error: 'Auction not found'
        });
      }

      // Verify auction is scheduled or active
      if (auction.status !== 'scheduled' && auction.status !== 'active') {
        return res.status(400).json({
          ok: false,
          error: `Cannot cancel auction with status '${auction.status}'. Only scheduled or active auctions can be cancelled.`
        });
      }

      // Verify seller ownership
      const isOwner = await Auction.verifySellerOwnership(auctionId, sellerId);
      if (!isOwner) {
        return res.status(403).json({
          ok: false,
          error: 'You do not have permission to cancel this auction'
        });
      }

      // Check if auction has bids
      const bids = await Auction.getBids(auctionId);
      if (bids.length > 0) {
        return res.status(400).json({
          ok: false,
          error: 'Cannot cancel auction with existing bids. Use "Stop" instead to end the auction with current winner.'
        });
      }

      // Cancel the auction
      const result = await Auction.delete(auctionId);

      // Emit Socket.IO event to notify all connected clients about cancelled auction
      if (global.ioInstance) {
        console.log('[auctionController] Emitting auction:deleted event for auction', auctionId);
        global.ioInstance.emit('auction:deleted', {
          auction_id: auctionId
        });
      }

      return res.status(200).json({
        ok: true,
        data: {
          auction_id: auctionId,
          message: result.message
        }
      });

    } catch (error) {
      console.error('Error in cancelAuction:', error);
      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to cancel auction'
      });
    }
  }

  /**
   * Get bids for an auction (paginated)
   * GET /api/node/auction/:id/bids
   */
  static async getBidHistory(req, res) {
    try {
      const auctionId = parseInt(req.params.id);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      // Validate auction ID
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid auction ID'
        });
      }

      // Verify auction exists
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({
          ok: false,
          error: 'Auction not found'
        });
      }

      // Get all bids for pagination
      const allBids = await Auction.getBids(auctionId);
      const offset = (page - 1) * limit;
      const paginatedBids = allBids.slice(offset, offset + limit);
      const totalCount = allBids.length;
      const totalPages = Math.ceil(totalCount / limit);

      return res.status(200).json({
        ok: true,
        data: {
          auction_id: auctionId,
          bids: paginatedBids.map(bid => ({
            bid_id: bid.bid_id,
            bidder_id: bid.bidder_id,
            bidder_name: bid.bidder_name,
            bid_amount: parseInt(bid.bid_amount),
            bid_time: bid.bid_time
          }))
        },
        meta: {
          page,
          limit,
          totalCount,
          totalPages
        }
      });

    } catch (error) {
      console.error('Error in getBidHistory:', error);
      return res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Place a bid on an auction
   * POST /api/node/auction/:id/bids
   */
  static async placeBid(req, res) {
    try {
      const auctionId = parseInt(req.params.id);
      const { bidAmount } = req.body;
      const bidderId = req.userId; // From auth middleware

      // Validate auction ID
      if (!auctionId || isNaN(auctionId)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid auction ID'
        });
      }

      // Validate bidder ID
      if (!bidderId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized'
        });
      }

      // Validate bid amount
      if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid bid amount. Must be a positive number.'
        });
      }

      // Verify auction exists
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({
          ok: false,
          error: 'Auction not found'
        });
      }

      // Verify auction is active
      if (auction.status !== 'active') {
        return res.status(400).json({
          ok: false,
          error: `Cannot bid on auction with status '${auction.status}'. Only active auctions accept bids.`
        });
      }

      // Check if auction hasn't ended
      const now = new Date();
      if (auction.end_time && new Date(auction.end_time) < now) {
        return res.status(400).json({
          ok: false,
          error: 'Auction has already ended'
        });
      }

      // Place the bid (will validate bid amount, seller ownership, etc.)
      const result = await Auction.placeBid(auctionId, {
        bidder_id: bidderId,
        bid_amount: parseInt(bidAmount)
      });

      return res.status(201).json({
        ok: true,
        data: {
          bid_id: result.bid.bid_id,
          auction_id: auctionId,
          bidder_id: bidderId,
          bid_amount: parseInt(result.bid.bid_amount),
          bid_time: result.bid.bid_time,
          new_current_price: parseInt(result.auction_current_price)
        }
      });

    } catch (error) {
      console.error('Error in placeBid:', error);
      return res.status(400).json({
        ok: false,
        error: error.message || 'Failed to place bid'
      });
    }
  }

  /**
   * Get seller's auction status (for Product Management page)
   * Returns: Current active/scheduled auction + Last auction history per product
   * 
   * Endpoint: GET /api/node/seller/auction/status?seller_id={ID}
   */
  static async getSellerAuctionStatus(req, res) {
    try {
      const sellerId = req.userId;

      if (!sellerId) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized: User not authenticated'
        });
      }

      // 1. Get active or scheduled auction (if any)
      const activeAuctionQuery = await Auction.getPool().query(
        `SELECT a.auction_id, a.product_id, a.status, p.name as product_name
         FROM auctions a
         JOIN products p ON a.product_id = p.product_id
         JOIN stores s ON p.store_id = s.store_id
         WHERE s.owner_id = $1 AND a.status IN ('active', 'scheduled')
         LIMIT 1`,
        [sellerId]
      );

      const activeAuction = activeAuctionQuery.rows.length > 0 
        ? {
            auction_id: activeAuctionQuery.rows[0].auction_id,
            product_id: activeAuctionQuery.rows[0].product_id,
            product_name: activeAuctionQuery.rows[0].product_name,
            status: activeAuctionQuery.rows[0].status
          }
        : null;

      // 2. Get last auction (ended or cancelled) for each product
      // This shows auction history for each product
      const historyQuery = await Auction.getPool().query(
        `SELECT DISTINCT ON (p.product_id)
           p.product_id,
           a.auction_id,
           a.status,
           a.created_at
         FROM products p
         LEFT JOIN auctions a ON p.product_id = a.product_id 
           AND a.status IN ('ended', 'cancelled')
         JOIN stores s ON p.store_id = s.store_id
         WHERE s.owner_id = $1
         ORDER BY p.product_id, a.created_at DESC`,
        [sellerId]
      );

      // Transform history into object: { product_id: { last_auction_id, status } }
      const history = {};
      historyQuery.rows.forEach(row => {
        if (row.auction_id) { // Only add if auction exists
          history[row.product_id] = {
            last_auction_id: row.auction_id,
            status: row.status
          };
        }
      });

      return res.status(200).json({
        ok: true,
        data: {
          activeAuction,
          history
        }
      });

    } catch (error) {
      console.error('Error in getSellerAuctionStatus:', error);
      return res.status(400).json({
        ok: false,
        error: error.message || 'Failed to get auction status'
      });
    }
  }
}

module.exports = AuctionController;

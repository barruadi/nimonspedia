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

      const bids = await Auction.getBids(auctionId);
      const stats = await Auction.getAuctionStats(auctionId);

      // Return all relevant information regarding the auction
      return res.status(200).json({
        ok: true,
        data: {
          auction: {
            auction_id: auction.auction_id,
            product_id: auction.product_id,
            starting_price: parseInt(auction.starting_price),
            current_price: parseInt(auction.current_price),
            start_time: auction.start_time,
            end_time: auction.end_time,
            status: auction.status,
            winner_id: auction.winner_id,
            winner_name: auction.winner_name || null
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

      // Validate required fields
      if (!auctionData.product_id || !auctionData.starting_price || !auctionData.start_time || !auctionData.end_time) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields: product_id, starting_price, start_time, end_time'
        });
      }

      const newAuction = await Auction.create(auctionData);

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
}

module.exports = AuctionController;

const db = require('../config/db');

class Auction {
  /**
   * Get pool instance
   */
  static getPool() {
    return db.getInstance();
  }

  static async findAll({ page = 1, limit = 10, status = null, search = null }) {
    try {
      const pool = this.getPool();
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
          a.min_increment,
          a.quantity,
          a.start_time,
          a.end_time,
          a.status,
          a.winner_id,
          p.name as product_name,
          p.image_path,
          s.store_id,
          s.store_name,
          COUNT(DISTINCT b.bid_id) as bid_count,
          COUNT(*) OVER () as total_count
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        LEFT JOIN auction_bids b ON a.auction_id = b.auction_id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;

      if (status) {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (search) {
        query += ` AND p.name ILIKE $${paramCount}`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ` GROUP BY a.auction_id, p.product_id, s.store_id ORDER BY a.start_time DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: result.rows,
        meta: {
          page,
          limit,
          totalCount,
          totalPages
        }
      };

    } catch (error) {
      console.error('Error in Auction.findAll:', error);
      throw error;
    }
  }

  static async findById(auctionId) {
    try {
      const pool = this.getPool();
      const query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
          a.min_increment,
          a.quantity,
          a.start_time,
          a.end_time,
          a.status,
          a.winner_id,
          p.name as product_name,
          p.image_path,
          s.store_id,
          s.store_name,
          s.owner_id as seller_id,
          u.full_name as winner_name
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        LEFT JOIN users u ON a.winner_id = u.user_id
        WHERE a.auction_id = $1
      `;

      const result = await pool.query(query, [auctionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      console.log('[Auction.findById] Query result for auction', auctionId, ':', {
        status: row.status,
        winner_id: row.winner_id,
        winner_name: row.winner_name,
        seller_id: row.seller_id
      });

      return row;

    } catch (error) {
      console.error('Error in Auction.findById:', error);
      throw error;
    }
  }

  static async getBids(auctionId) {
    try {
      const pool = this.getPool();
      const query = `
        SELECT 
          ab.bid_id,
          ab.auction_id,
          ab.bidder_id,
          ab.bid_amount,
          ab.bid_time,
          u.full_name as bidder_name
        FROM auction_bids ab
        JOIN users u ON ab.bidder_id = u.user_id
        WHERE ab.auction_id = $1
        ORDER BY ab.bid_amount DESC, ab.bid_time DESC
      `;

      const result = await pool.query(query, [auctionId]);

      return result.rows;

    } catch (error) {
      console.error('Error in Auction.getBids:', error);
      throw error;
    }
  }

  static async getAuctionStats(auctionId) {
    try {
      const pool = this.getPool();
      const query = `
        SELECT 
          COUNT(*) as total_bids,
          MAX(ab.bid_amount) as highest_bid,
          MIN(ab.bid_amount) as lowest_bid,
          COUNT(DISTINCT ab.bidder_id) as unique_bidders
        FROM auction_bids ab
        WHERE ab.auction_id = $1
      `;

      const result = await pool.query(query, [auctionId]);

      return result.rows[0] || {
        total_bids: 0,
        highest_bid: null,
        lowest_bid: null,
        unique_bidders: 0
      };

    } catch (error) {
      console.error('Error in Auction.getAuctionStats:', error);
      throw error;
    }
  }

  static async create(auctionData) {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        product_id,
        starting_price,
        current_price,
        min_increment = 1000,
        quantity,
        start_time,
        end_time = null, // NEW LOGIC: end_time is optional, will be set when first bid comes
        status = 'scheduled'
      } = auctionData;

      // NEW VALIDATION: end_time is NOT required anymore
      if (!product_id || starting_price === undefined || !quantity || !start_time) {
        throw new Error('Missing required fields: product_id, starting_price, quantity, start_time');
      }

      // Validate that product exists and has enough stock
      const productCheck = await client.query(
        'SELECT product_id, stock FROM products WHERE product_id = $1 AND is_deleted = FALSE',
        [product_id]
      );

      if (productCheck.rows.length === 0) {
        throw new Error('Product not found or is deleted');
      }

      const productStock = productCheck.rows[0].stock;
      if (productStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${productStock}, Requested: ${quantity}`);
      }

      // Validate status
      const validStatuses = ['scheduled', 'active', 'ended', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Validate start_time (but NOT end_time anymore since it can be NULL)
      const startDate = new Date(start_time);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid start_time format');
      }

      // If end_time is provided, validate it
      if (end_time) {
        const endDate = new Date(end_time);
        if (isNaN(endDate.getTime())) {
          throw new Error('Invalid end_time format');
        }
        if (endDate <= startDate) {
          throw new Error('End time must be after start time');
        }
      }

      // Validate prices
      if (starting_price < 0) {
        throw new Error('Starting price must be >= 0');
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be > 0');
      }

      //  Schema: current_price >= starting_price
      const finalCurrentPrice = current_price !== undefined ? current_price : starting_price;
      if (finalCurrentPrice < starting_price) {
        throw new Error('Current price must be >= starting price');
      }

      //  Insert dengan semua fields dari schema
      const query = `
        INSERT INTO auctions 
          (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING 
          auction_id, product_id, starting_price, current_price, min_increment, quantity, 
          start_time, end_time, status, created_at
      `;

      const result = await client.query(query, [
        product_id,
        starting_price,
        finalCurrentPrice,
        min_increment,
        quantity,
        start_time,
        end_time,
        status
      ]);

      // Deduct stock from product when auction is created
      const updateStockQuery = `
        UPDATE products 
        SET stock = stock - $1 
        WHERE product_id = $2
      `;
      await client.query(updateStockQuery, [quantity, product_id]);

      await client.query('COMMIT');

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in Auction.create:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(auctionId, auctionData) {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if auction exists
      const auctionCheck = await client.query(
        'SELECT auction_id, status FROM auctions WHERE auction_id = $1',
        [auctionId]
      );

      if (auctionCheck.rows.length === 0) {
        throw new Error('Auction not found');
      }

      const currentAuction = auctionCheck.rows[0];
      const {
        starting_price,
        current_price,
        min_increment,
        quantity,
        start_time,
        end_time,
        status,
        winner_id
      } = auctionData;

      // Prevent updating active or ended auctions
      if (['active', 'ended'].includes(currentAuction.status)) {
        throw new Error(`Cannot update auction with status: ${currentAuction.status}`);
      }

      // Validate status if provided
      if (status) {
        const validStatuses = ['scheduled', 'active', 'ended', 'cancelled'];
        if (!validStatuses.includes(status)) {
          throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
      }

      // Validate dates if provided
      if (start_time && end_time) {
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);
        if (endDate <= startDate) {
          throw new Error('End time must be after start time');
        }
      }

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (starting_price !== undefined) {
        updateFields.push(`starting_price = $${paramCount}`);
        updateValues.push(starting_price);
        paramCount++;
      }

      if (current_price !== undefined) {
        updateFields.push(`current_price = $${paramCount}`);
        updateValues.push(current_price);
        paramCount++;
      }

      if (min_increment !== undefined) {
        updateFields.push(`min_increment = $${paramCount}`);
        updateValues.push(min_increment);
        paramCount++;
      }

      if (quantity !== undefined) {
        updateFields.push(`quantity = $${paramCount}`);
        updateValues.push(quantity);
        paramCount++;
      }

      if (start_time !== undefined) {
        updateFields.push(`start_time = $${paramCount}`);
        updateValues.push(start_time);
        paramCount++;
      }

      if (end_time !== undefined) {
        updateFields.push(`end_time = $${paramCount}`);
        updateValues.push(end_time);
        paramCount++;
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramCount}`);
        updateValues.push(status);
        paramCount++;
      }

      if (winner_id !== undefined) {
        if (winner_id !== null) {
          // Validate winner exists
          const winnerCheck = await client.query(
            'SELECT user_id FROM users WHERE user_id = $1',
            [winner_id]
          );
          if (winnerCheck.rows.length === 0) {
            throw new Error('Winner user not found');
          }
        }
        updateFields.push(`winner_id = $${paramCount}`);
        updateValues.push(winner_id);
        paramCount++;
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateValues.push(auctionId);

      const query = `
        UPDATE auctions
        SET ${updateFields.join(', ')}
        WHERE auction_id = $${paramCount}
        RETURNING 
          auction_id, product_id, starting_price, current_price, min_increment, quantity,
          start_time, end_time, status, winner_id, created_at
      `;

      const result = await client.query(query, updateValues);

      await client.query('COMMIT');

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in Auction.update:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(auctionId) {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get auction details (product_id and quantity) before deleting
      const auctionCheck = await client.query(
        'SELECT auction_id, status, product_id, quantity FROM auctions WHERE auction_id = $1',
        [auctionId]
      );

      if (auctionCheck.rows.length === 0) {
        throw new Error('Auction not found');
      }

      const auction = auctionCheck.rows[0];

      // Prevent deleting active or ended auctions
      if (['active', 'ended'].includes(auction.status)) {
        throw new Error(`Cannot delete auction with status: ${auction.status}`);
      }

      // Check if auction has bids
      const bidsCheck = await client.query(
        'SELECT COUNT(*) as bid_count FROM auction_bids WHERE auction_id = $1',
        [auctionId]
      );

      if (parseInt(bidsCheck.rows[0].bid_count) > 0) {
        throw new Error('Cannot delete auction with existing bids');
      }

      // Delete auction
      const deleteQuery = `
        DELETE FROM auctions 
        WHERE auction_id = $1 
        RETURNING auction_id
      `;

      const result = await client.query(deleteQuery, [auctionId]);

      // Refund stock to product
      const refundStockQuery = `
        UPDATE products 
        SET stock = stock + $1 
        WHERE product_id = $2
      `;
      await client.query(refundStockQuery, [auction.quantity, auction.product_id]);

      await client.query('COMMIT');

      return {
        success: true,
        message: `Auction ${auctionId} deleted successfully and stock refunded`,
        deleted_id: result.rows[0].auction_id
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in Auction.delete:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async placeBid(auctionId, bidData) {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { bidder_id, bid_amount } = bidData;

      // Validate required fields
      if (!bidder_id || !bid_amount) {
        throw new Error('Missing required fields: bidder_id, bid_amount');
      }

      // Check if auction exists and is active
      const auctionCheck = await client.query(
        'SELECT * FROM auctions WHERE auction_id = $1',
        [auctionId]
      );

      if (auctionCheck.rows.length === 0) {
        throw new Error('Auction not found');
      }

      const auction = auctionCheck.rows[0];

      if (auction.status !== 'active') {
        throw new Error(`Cannot place bid on auction with status: ${auction.status}`);
      }

      //  Check if auction hasn't ended (end_time is nullable)
      const now = new Date();
      if (auction.end_time && new Date(auction.end_time) < now) {
        throw new Error('Auction has ended');
      }

      // Check if bidder exists
      const bidderCheck = await client.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [bidder_id]
      );

      if (bidderCheck.rows.length === 0) {
        throw new Error('Bidder not found');
      }

      // Validate bid amount
      if (bid_amount <= auction.current_price) {
        throw new Error(`Bid amount must be greater than current price (${auction.current_price})`);
      }

      if (bid_amount <= auction.starting_price) {
        throw new Error(`Bid amount must be at least ${auction.starting_price}`);
      }

      // Check if bidder is not the seller (product owner)
      const sellerCheck = await client.query(`
        SELECT p.store_id FROM products p 
        WHERE p.product_id = $1
      `, [auction.product_id]);

      if (sellerCheck.rows.length === 0) {
        throw new Error('Product not found');
      }

      const seller = sellerCheck.rows[0];
      const storeOwnerCheck = await client.query(
        'SELECT owner_id FROM stores WHERE store_id = $1',
        [seller.store_id]
      );

      if (storeOwnerCheck.rows.length === 0) {
        throw new Error('Store not found');
      }

      const storeOwner = storeOwnerCheck.rows[0];

      if (storeOwner.owner_id === bidder_id) {
        throw new Error('Seller cannot bid on their own auction');
      }

      // Insert bid
      const bidQuery = `
        INSERT INTO auction_bids (auction_id, bidder_id, bid_amount, bid_time)
        VALUES ($1, $2, $3, NOW())
        RETURNING bid_id, auction_id, bidder_id, bid_amount, bid_time
      `;

      const bidResult = await client.query(bidQuery, [auctionId, bidder_id, bid_amount]);

      // Update auction current price
      const updateAuctionQuery = `
        UPDATE auctions 
        SET current_price = $1
        WHERE auction_id = $2
      `;

      await client.query(updateAuctionQuery, [bid_amount, auctionId]);

      await client.query('COMMIT');

      return {
        bid: bidResult.rows[0],
        auction_current_price: bid_amount,
        message: 'Bid placed successfully'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in Auction.placeBid:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findSellerActiveAuction(sellerId) {
    try {
      const pool = this.getPool();
      const query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
          a.min_increment,
          a.quantity,
          a.start_time,
          a.end_time,
          a.status,
          a.winner_id,
          p.name as product_name,
          p.image_path,
          s.store_id,
          s.store_name
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        WHERE s.owner_id = $1 AND a.status = 'active'
        LIMIT 1
      `;

      const result = await pool.query(query, [sellerId]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('Error in Auction.findSellerActiveAuction:', error);
      throw error;
    }
  }

  static async findSellerAuctions(sellerId, { page = 1, limit = 10, status = null }) {
    try {
      const pool = this.getPool();
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
          a.min_increment,
          a.quantity,
          a.start_time,
          a.end_time,
          a.status,
          a.winner_id,
          p.name as product_name,
          p.image_path,
          s.store_id,
          s.store_name,
          COUNT(*) OVER () as total_count
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        WHERE s.owner_id = $1
      `;

      const params = [sellerId];
      let paramCount = 2;

      if (status) {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      query += ` ORDER BY a.start_time DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: result.rows,
        meta: {
          page,
          limit,
          totalCount,
          totalPages
        }
      };

    } catch (error) {
      console.error('Error in Auction.findSellerAuctions:', error);
      throw error;
    }
  }

  static async stopAuction(auctionId, sellerId) {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if auction exists
      const auctionCheck = await client.query(
        'SELECT auction_id, status, winner_id, product_id FROM auctions WHERE auction_id = $1',
        [auctionId]
      );

      if (auctionCheck.rows.length === 0) {
        throw new Error('Auction not found');
      }

      const auction = auctionCheck.rows[0];

      // Check seller ownership
      const productCheck = await client.query(
        'SELECT p.store_id FROM products p WHERE p.product_id = $1',
        [auction.product_id]
      );

      if (productCheck.rows.length === 0) {
        throw new Error('Product not found');
      }

      const storeCheck = await client.query(
        'SELECT owner_id FROM stores WHERE store_id = $1',
        [productCheck.rows[0].store_id]
      );

      if (storeCheck.rows.length === 0 || storeCheck.rows[0].owner_id !== sellerId) {
        throw new Error('You do not have permission to stop this auction');
      }

      // Get highest bidder (winner)
      const highestBidQuery = `
        SELECT bidder_id FROM auction_bids
        WHERE auction_id = $1
        ORDER BY bid_amount DESC
        LIMIT 1
      `;
      const highestBidResult = await client.query(highestBidQuery, [auctionId]);
      const winnerId = highestBidResult.rows.length > 0 ? highestBidResult.rows[0].bidder_id : null;

      // Update status to 'ended' and set winner
      const updateQuery = `
        UPDATE auctions
        SET status = 'ended', winner_id = $2
        WHERE auction_id = $1
        RETURNING auction_id, status, winner_id
      `;

      const result = await client.query(updateQuery, [auctionId, winnerId]);

      await client.query('COMMIT');

      return {
        success: true,
        message: `Auction ${auctionId} stopped successfully`,
        auction_id: result.rows[0].auction_id,
        status: result.rows[0].status,
        winner_id: result.rows[0].winner_id
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in Auction.stopAuction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMinimumBidAmount(auctionId) {
    try {
      const pool = this.getPool();
      const query = `
        SELECT 
          a.current_price,
          a.min_increment
        FROM auctions a
        WHERE a.auction_id = $1
      `;

      const result = await pool.query(query, [auctionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        current_price: parseInt(row.current_price),
        min_increment: parseInt(row.min_increment),
        minimum_bid_amount: parseInt(row.current_price) + parseInt(row.min_increment)
      };

    } catch (error) {
      console.error('Error in getMinimumBidAmount:', error);
      throw error;
    }
  }

  static async refundPreviousBid(auctionId, buyerId) {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the previous highest bid for this buyer
      const bidCheck = await client.query(
        `SELECT ab.bid_id, ab.bid_amount, ab.auction_id
         FROM auction_bids ab
         WHERE ab.auction_id = $1 AND ab.bidder_id = $2
         ORDER BY ab.bid_amount DESC
         LIMIT 1`,
        [auctionId, buyerId]
      );

      if (bidCheck.rows.length === 0) {
        throw new Error('No bid found to refund');
      }

      const bid = bidCheck.rows[0];
      const refundAmount = parseInt(bid.bid_amount);

      // Refund balance to buyer
      const refundQuery = `
        UPDATE users
        SET balance = balance + $1
        WHERE user_id = $2
        RETURNING user_id, balance
      `;

      const refundResult = await client.query(refundQuery, [refundAmount, buyerId]);

      if (!refundResult.rows[0]) {
        throw new Error('Failed to refund bid amount');
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Bid refunded successfully',
        bid_id: bid.bid_id,
        refunded_amount: refundAmount,
        new_balance: parseInt(refundResult.rows[0].balance)
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in refundPreviousBid:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async processEndedAuctions(io) {
    try {
      const pool = this.getPool();

      const query = `
        SELECT a.auction_id, a.winner_id, a.current_price, a.product_id, a.status
        FROM auctions a
        WHERE a.status = 'active' 
        AND a.end_time IS NOT NULL
        AND a.end_time <= NOW()
      `;

      const endedAuctions = await pool.query(query);

      for (const auction of endedAuctions.rows) {
        try {
          // Update status to ended
          await this.updateAuctionStatus(auction.auction_id, 'ended');

          console.log(`[Background Job] Auction ${auction.auction_id} ended`);
          
          if (io) {
            if (auction.winner_id) {
              io.to(`auction-${auction.auction_id}`).emit('auction:ended', {
                auction_id: auction.auction_id,
                status: 'ended',
                winner_id: auction.winner_id,
                final_price: auction.current_price,
                reason: 'time_ended',
                timestamp: new Date().toISOString()
              });
            } else {
              io.to(`auction-${auction.auction_id}`).emit('auction:ended', {
                auction_id: auction.auction_id,
                status: 'ended',
                winner_id: null,
                reason: 'no_bids',
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error(`[Background Job] Error processing auction ${auction.auction_id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Background Job] Error in processEndedAuctions:', error.message);
    }
  }

  static async findBuyerBidHistory(buyerId, { page = 1, limit = 10 }) {
    try {
      const pool = this.getPool();
      const offset = (page - 1) * limit;
      
      const countQuery = `
        SELECT COUNT(*) as total_count
        FROM auction_bids ab
        WHERE ab.bidder_id = $1
      `;

      const countResult = await pool.query(countQuery, [buyerId]);
      const totalCount = parseInt(countResult.rows[0]?.total_count) || 0;
      const totalPages = Math.ceil(totalCount / limit);

      const query = `
        SELECT 
          ab.bid_id,
          ab.auction_id,
          ab.bidder_id,
          ab.bid_amount,
          ab.bid_time,
          a.status,
          a.current_price,
          a.min_increment,
          a.quantity,
          p.name as product_name,
          p.image_path,
          s.store_id,
          s.store_name
        FROM auction_bids ab
        JOIN auctions a ON ab.auction_id = a.auction_id
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        WHERE ab.bidder_id = $1
        ORDER BY ab.bid_time DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [buyerId, limit, offset]);

      return {
        data: result.rows,
        meta: {
          page,
          limit,
          totalCount,
          totalPages
        }
      };

    } catch (error) {
      console.error('Error in findBuyerBidHistory:', error);
      throw error;
    }
  }

  static async findBuyerWonAuctions(buyerId, { page = 1, limit = 10 }) {
    try {
      const pool = this.getPool();
      const offset = (page - 1) * limit;
      
      const countQuery = `
        SELECT COUNT(*) as total_count
        FROM auctions a
        WHERE a.winner_id = $1 AND a.status = 'ended'
      `;

      const countResult = await pool.query(countQuery, [buyerId]);
      const totalCount = parseInt(countResult.rows[0]?.total_count) || 0;
      const totalPages = Math.ceil(totalCount / limit);

      const query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
          a.min_increment,
          a.quantity,
          a.start_time,
          a.end_time,
          a.status,
          a.winner_id,
          p.name as product_name,
          p.image_path,
          s.store_id,
          s.store_name
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        WHERE a.winner_id = $1 AND a.status = 'ended'
        ORDER BY a.end_time DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [buyerId, limit, offset]);

      return {
        data: result.rows,
        meta: {
          page,
          limit,
          totalCount,
          totalPages
        }
      };

    } catch (error) {
      console.error('Error in findBuyerWonAuctions:', error);
      throw error;
    }
  }

  static async updateAuctionStatus(auctionId, status) {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if auction exists
      const auctionCheck = await client.query(
        'SELECT auction_id, status FROM auctions WHERE auction_id = $1',
        [auctionId]
      );

      if (auctionCheck.rows.length === 0) {
        throw new Error('Auction not found');
      }

      const auction = auctionCheck.rows[0];

      // Validate status transition
      const validTransitions = {
        scheduled: ['active', 'cancelled'],
        active: ['ended', 'cancelled'],
        ended: [],
        cancelled: []
      };

      if (!validTransitions[auction.status].includes(status)) {
        throw new Error(`Invalid status transition from ${auction.status} to ${status}`);
      }

      // Update status
      const updateQuery = `
        UPDATE auctions
        SET status = $1
        WHERE auction_id = $2
        RETURNING auction_id, status
      `;

      const result = await client.query(updateQuery, [status, auctionId]);

      await client.query('COMMIT');

      return {
        auction_id: result.rows[0].auction_id,
        status: result.rows[0].status,
        message: `Auction status updated to ${status}`
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in Auction.updateAuctionStatus:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async verifySellerOwnership(auctionId, sellerId) {
    try {
      const pool = this.getPool();
      const query = `
        SELECT p.store_id
        FROM auctions a
        JOIN products p ON a.product_id = p.product_id
        JOIN stores s ON p.store_id = s.store_id
        WHERE a.auction_id = $1 AND s.owner_id = $2
        LIMIT 1
      `;

      const result = await pool.query(query, [auctionId, sellerId]);

      return result.rows.length > 0;

    } catch (error) {
      console.error('Error in verifySellerOwnership:', error);
      throw error;
    }
  }
}

module.exports = Auction;

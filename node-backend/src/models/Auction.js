const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/nimonspedia'
});

class Auction {
  static async findAll({ page = 1, limit = 10, status = null, search = null }) {
    try {
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
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
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;

      // Filter by status
      if (status) {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      // Search by product name
      if (search) {
        query += ` AND p.name ILIKE $${paramCount}`;
        params.push(`%${search}%`);
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
      console.error('Error in Auction.findAll:', error);
      throw error;
    }
  }

  static async findById(auctionId) {
    try {
      const query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
          a.start_time,
          a.end_time,
          a.status,
          a.winner_id,
          p.name as product_name,
          p.image_path,
          p.product_id,
          s.store_id,
          s.store_name,
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

      return result.rows[0];

    } catch (error) {
      console.error('Error in Auction.findById:', error);
      throw error;
    }
  }

  static async getBids(auctionId) {
    try {
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

      return result.rows[0];

    } catch (error) {
      console.error('Error in Auction.getAuctionStats:', error);
      throw error;
    }
  }

  static async create(auctionData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        product_id,
        starting_price,
        current_price,
        start_time,
        end_time,
        status = 'scheduled'
      } = auctionData;

      // Validate required fields
      if (!product_id || !starting_price || !start_time || !end_time) {
        throw new Error('Missing required fields: product_id, starting_price, start_time, end_time');
      }

      // Validate that product exists
      const productCheck = await client.query(
        'SELECT product_id FROM products WHERE product_id = $1',
        [product_id]
      );

      if (productCheck.rows.length === 0) {
        throw new Error('Product not found');
      }

      // Validate status
      const validStatuses = ['scheduled', 'active', 'ended', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Validate dates
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (endDate <= startDate) {
        throw new Error('End time must be after start time');
      }

      const query = `
        INSERT INTO auctions (product_id, starting_price, current_price, start_time, end_time, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING auction_id, product_id, starting_price, current_price, start_time, end_time, status, created_at
      `;

      const result = await client.query(query, [
        product_id,
        starting_price,
        current_price || starting_price,
        start_time,
        end_time,
        status
      ]);

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

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(auctionId);

      const query = `
        UPDATE auctions
        SET ${updateFields.join(', ')}
        WHERE auction_id = $${paramCount}
        RETURNING auction_id, product_id, starting_price, current_price, start_time, end_time, status, winner_id, updated_at
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

      await client.query('COMMIT');

      return {
        success: true,
        message: `Auction ${auctionId} deleted successfully`,
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

      // Check if auction hasn't ended
      const now = new Date();
      if (new Date(auction.end_time) < now) {
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

      const seller = sellerCheck.rows[0];
      const storeOwnerCheck = await client.query(
        'SELECT owner_id FROM stores WHERE store_id = $1',
        [seller.store_id]
      );

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
        SET current_price = $1, updated_at = NOW()
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
      const query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
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
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT 
          a.auction_id,
          a.product_id,
          a.starting_price,
          a.current_price,
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
      let paramCount = 1;

      // Filter by status
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if auction exists
      const auctionCheck = await client.query(
        'SELECT auction_id, status, winner_id FROM auctions WHERE auction_id = $1',
        [auctionId]
      );

      if (auctionCheck.rows.length === 0) {
        throw new Error('Auction not found');
      }

      const auction = auctionCheck.rows[0];

      // Check seller ownership
      const productCheck = await client.query(
        'SELECT p.store_id FROM products p JOIN stores s ON p.store_id = s.store_id WHERE p.product_id = $1',
        [auction.product_id]
      );

      if (productCheck.rows.length === 0 || productCheck.rows[0].store_id !== sellerId) {
        throw new Error('You do not have permission to stop this auction');
      }

      // Update status to 'ended'
      const updateQuery = `
        UPDATE auctions
        SET status = 'ended', updated_at = NOW()
        WHERE auction_id = $1
        RETURNING auction_id, status, winner_id
      `;

      const result = await client.query(updateQuery, [auctionId]);

      // If auction has a winner, create order
      if (result.rows[0].winner_id) {
        await this.createOrderFromAuction(auctionId);
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: `Auction ${auctionId} stopped successfully`,
        auction_id: result.rows[0].auction_id,
        status: result.rows[0].status
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
      const query = `
        SELECT 
          a.current_price,
          COALESCE(a.min_increment, 1000) as min_increment
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
        SET balance = balance + $1,
            updated_at = NOW()
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

  static async processEndedAuctions(io, pool) {
    try {
      const query = `
        SELECT a.auction_id, a.winner_id, a.current_price, a.product_id, a.status
        FROM auctions a
        WHERE a.status = 'active' 
        AND a.end_time <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM orders o 
          WHERE o.auction_id = a.auction_id
        )
      `;

      const endedAuctions = await pool.query(query);

      for (const auction of endedAuctions.rows) {
        try {
          // Update status to ended
          await this.updateAuctionStatus(auction.auction_id, 'ended');

          // Create order if winner exists
          if (auction.winner_id) {
            const order = await this.createOrderFromAuction(auction.auction_id);
            
            console.log(`[Cron] Order created for auction ${auction.auction_id}, Order ID: ${order.order.order_id}`);
            
            // Broadcast to socket room
            if (io) {
              io.to(`auction-${auction.auction_id}`).emit('auction:order-created', {
                auction_id: auction.auction_id,
                order_id: order.order.order_id,
                winner_id: auction.winner_id,
                final_price: auction.current_price,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            // No winner, just update status
            console.log(`[Cron] Auction ${auction.auction_id} ended with no winner`);
            
            if (io) {
              io.to(`auction-${auction.auction_id}`).emit('auction:ended', {
                auction_id: auction.auction_id,
                status: 'ended',
                winner_id: null,
                reason: 'no_winner',
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error(`[Cron] Error processing ended auction ${auction.auction_id}:`, error);
        }
      }
    } catch (error) {
      console.error('[Cron] Error in processEndedAuctions:', error);
    }
  }

  static async findBuyerBidHistory(buyerId, { page = 1, limit = 10 }) {
    try {
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
        active: ['ended'],
        ended: []
      };

      if (!validTransitions[auction.status].includes(status)) {
        throw new Error(`Invalid status transition from ${auction.status} to ${status}`);
      }

      // Update status
      const updateQuery = `
        UPDATE auctions
        SET status = $1, updated_at = NOW()
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

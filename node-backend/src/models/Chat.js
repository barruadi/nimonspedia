const db = require('../config/db');

class Chat {
  /**
   * Get pool instance
   */
  static getPool() {
    return db.getInstance();
  }

  /**
   * Get all chat rooms for a user
   * @param {number} userId - User ID
   * @param {string} role - User role (buyer/seller)
   * @returns {Promise<Array>} - List of chat rooms with last message
   */
  static async getChatRooms(userId, role) {
    try {
      const pool = this.getPool();

      let query;
      let params;

      if (role === 'buyer') {
        // Buyer sees all chats they initiated
        query = `
          SELECT
            cr.store_id,
            cr.buyer_id,
            cr.last_message_at,
            cr.created_at,
            s.store_name,
            s.logo_path as store_logo,
            u.full_name as seller_name,
            COUNT(CASE WHEN cm.is_read = false AND cm.sender_id != $1 THEN 1 END) as unread_count,
            (
              SELECT json_build_object(
                'message_id', message_id,
                'message_type', message_type,
                'content', content,
                'sender_id', sender_id,
                'created_at', created_at
              )
              FROM chat_messages
              WHERE store_id = cr.store_id AND buyer_id = cr.buyer_id
              ORDER BY created_at DESC
              LIMIT 1
            ) as last_message
          FROM chat_rooms cr
          JOIN stores s ON cr.store_id = s.store_id
          JOIN users u ON s.owner_id = u.user_id
          LEFT JOIN chat_messages cm ON cr.store_id = cm.store_id AND cr.buyer_id = cm.buyer_id
          WHERE cr.buyer_id = $1
          GROUP BY cr.store_id, cr.buyer_id, s.store_name, s.logo_path, u.full_name, cr.last_message_at, cr.created_at
          ORDER BY cr.last_message_at DESC NULLS LAST, cr.created_at DESC
        `;
        params = [userId];
      } else if (role === 'seller') {
        // Seller sees all chats for their stores
        query = `
          SELECT
            cr.store_id,
            cr.buyer_id,
            cr.last_message_at,
            cr.created_at,
            s.store_name,
            s.logo_path as store_logo,
            u.full_name as buyer_name,
            u.email as buyer_email,
            COUNT(CASE WHEN cm.is_read = false AND cm.sender_id != $1 THEN 1 END) as unread_count,
            (
              SELECT json_build_object(
                'message_id', message_id,
                'message_type', message_type,
                'content', content,
                'sender_id', sender_id,
                'created_at', created_at
              )
              FROM chat_messages
              WHERE store_id = cr.store_id AND buyer_id = cr.buyer_id
              ORDER BY created_at DESC
              LIMIT 1
            ) as last_message
          FROM chat_rooms cr
          JOIN stores s ON cr.store_id = s.store_id
          JOIN users u ON cr.buyer_id = u.user_id
          LEFT JOIN chat_messages cm ON cr.store_id = cm.store_id AND cr.buyer_id = cm.buyer_id
          WHERE s.owner_id = $1
          GROUP BY cr.store_id, cr.buyer_id, s.store_name, s.logo_path, u.full_name, u.email, cr.last_message_at, cr.created_at
          ORDER BY cr.last_message_at DESC NULLS LAST, cr.created_at DESC
        `;
        params = [userId];
      } else {
        throw new Error('Invalid role');
      }

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error in Chat.getChatRooms:', error);
      throw error;
    }
  }

  /**
   * Get or create a chat room
   * @param {number} storeId - Store ID
   * @param {number} buyerId - Buyer ID
   * @returns {Promise<Object>} - Chat room details
   */
  static async getChatRoom(storeId, buyerId) {
    try {
      const pool = this.getPool();

      // Check if chat room exists
      let query = `
        SELECT
          cr.store_id,
          cr.buyer_id,
          cr.last_message_at,
          cr.created_at,
          s.store_name,
          s.logo_path as store_logo,
          s.owner_id as seller_id,
          seller.full_name as seller_name,
          buyer.full_name as buyer_name,
          buyer.email as buyer_email
        FROM chat_rooms cr
        JOIN stores s ON cr.store_id = s.store_id
        JOIN users seller ON s.owner_id = seller.user_id
        JOIN users buyer ON cr.buyer_id = buyer.user_id
        WHERE cr.store_id = $1 AND cr.buyer_id = $2
      `;

      let result = await pool.query(query, [storeId, buyerId]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create new chat room if it doesn't exist
      const insertQuery = `
        INSERT INTO chat_rooms (store_id, buyer_id)
        VALUES ($1, $2)
        RETURNING *
      `;

      await pool.query(insertQuery, [storeId, buyerId]);

      // Fetch the newly created chat room with full details
      result = await pool.query(query, [storeId, buyerId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in Chat.getChatRoom:', error);
      throw error;
    }
  }

  /**
   * Get messages for a chat room
   * @param {number} storeId - Store ID
   * @param {number} buyerId - Buyer ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Messages with metadata
   */
  static async getMessages(storeId, buyerId, { page = 1, limit = 50 } = {}) {
    try {
      const pool = this.getPool();
      const offset = (page - 1) * limit;

      const query = `
        SELECT
          cm.message_id,
          cm.sender_id,
          cm.message_type,
          cm.content,
          cm.product_id,
          cm.is_read,
          cm.created_at,
          u.full_name as sender_name,
          u.role as sender_role,
          CASE
            WHEN cm.message_type = 'item_preview' AND cm.product_id IS NOT NULL THEN
              json_build_object(
                'product_id', p.product_id,
                'name', p.name,
                'price', p.price,
                'image_path', p.image_path,
                'stock', p.stock
              )
            ELSE NULL
          END as product_preview,
          COUNT(*) OVER () as total_count
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.user_id
        LEFT JOIN products p ON cm.product_id = p.product_id
        WHERE cm.store_id = $1 AND cm.buyer_id = $2
        ORDER BY cm.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await pool.query(query, [storeId, buyerId, limit, offset]);

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Reverse the array so oldest messages are first (for chat UI display)
      const messagesInChatOrder = result.rows.reverse();

      return {
        data: messagesInChatOrder,
        meta: {
          page,
          limit,
          totalCount,
          totalPages
        }
      };
    } catch (error) {
      console.error('Error in Chat.getMessages:', error);
      throw error;
    }
  }

  /**
   * Send a message
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} - Created message with full details
   */
  static async sendMessage({ storeId, buyerId, senderId, messageType, content, productId = null }) {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Ensure chat room exists
      const roomCheck = `
        INSERT INTO chat_rooms (store_id, buyer_id)
        VALUES ($1, $2)
        ON CONFLICT (store_id, buyer_id) DO NOTHING
      `;
      await client.query(roomCheck, [storeId, buyerId]);

      // Insert message
      const messageQuery = `
        INSERT INTO chat_messages (store_id, buyer_id, sender_id, message_type, content, product_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const messageResult = await client.query(messageQuery, [
        storeId,
        buyerId,
        senderId,
        messageType,
        content,
        productId
      ]);

      // Update last_message_at in chat_rooms
      const updateRoomQuery = `
        UPDATE chat_rooms
        SET last_message_at = NOW(), updated_at = NOW()
        WHERE store_id = $1 AND buyer_id = $2
      `;
      await client.query(updateRoomQuery, [storeId, buyerId]);

      await client.query('COMMIT');

      // Fetch the complete message with sender details and product preview
      const fullMessageQuery = `
        SELECT
          cm.message_id,
          cm.sender_id,
          cm.message_type,
          cm.content,
          cm.product_id,
          cm.is_read,
          cm.created_at,
          u.full_name as sender_name,
          u.role as sender_role,
          CASE
            WHEN cm.message_type = 'item_preview' AND cm.product_id IS NOT NULL THEN
              json_build_object(
                'product_id', p.product_id,
                'name', p.name,
                'price', p.price,
                'image_path', p.image_path,
                'stock', p.stock
              )
            ELSE NULL
          END as product_preview
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.user_id
        LEFT JOIN products p ON cm.product_id = p.product_id
        WHERE cm.message_id = $1
      `;

      const fullMessageResult = await client.query(fullMessageQuery, [messageResult.rows[0].message_id]);

      return fullMessageResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in Chat.sendMessage:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark messages as read
   * @param {number} storeId - Store ID
   * @param {number} buyerId - Buyer ID
   * @param {number} userId - User ID (who is reading)
   * @returns {Promise<number>} - Number of messages marked as read
   */
  static async markAsRead(storeId, buyerId, userId) {
    try {
      const pool = this.getPool();

      // Mark all messages in the chat room as read, except those sent by the current user
      const query = `
        UPDATE chat_messages
        SET is_read = true
        WHERE store_id = $1
          AND buyer_id = $2
          AND sender_id != $3
          AND is_read = false
        RETURNING message_id
      `;

      const result = await pool.query(query, [storeId, buyerId, userId]);
      return result.rowCount;
    } catch (error) {
      console.error('Error in Chat.markAsRead:', error);
      throw error;
    }
  }

  /**
   * Get unread message count for a user
   * @param {number} userId - User ID
   * @param {string} role - User role (buyer/seller)
   * @returns {Promise<number>} - Unread message count
   */
  static async getUnreadCount(userId, role) {
    try {
      const pool = this.getPool();

      let query;
      let params;

      if (role === 'buyer') {
        query = `
          SELECT COUNT(*) as unread_count
          FROM chat_messages cm
          JOIN chat_rooms cr ON cm.store_id = cr.store_id AND cm.buyer_id = cr.buyer_id
          WHERE cr.buyer_id = $1
            AND cm.sender_id != $1
            AND cm.is_read = false
        `;
        params = [userId];
      } else if (role === 'seller') {
        query = `
          SELECT COUNT(*) as unread_count
          FROM chat_messages cm
          JOIN chat_rooms cr ON cm.store_id = cr.store_id AND cm.buyer_id = cr.buyer_id
          JOIN stores s ON cr.store_id = s.store_id
          WHERE s.owner_id = $1
            AND cm.sender_id != $1
            AND cm.is_read = false
        `;
        params = [userId];
      } else {
        throw new Error('Invalid role');
      }

      const result = await pool.query(query, params);
      return parseInt(result.rows[0].unread_count);
    } catch (error) {
      console.error('Error in Chat.getUnreadCount:', error);
      throw error;
    }
  }

  /**
   * Get store details by ID
   * @param {number} storeId - Store ID
   * @returns {Promise<Object>} - Store details
   */
  static async getStoreById(storeId) {
    try {
      const pool = this.getPool();

      const query = `
        SELECT
          s.store_id,
          s.store_name,
          s.logo_path,
          s.owner_id,
          u.full_name as owner_name,
          u.email as owner_email
        FROM stores s
        JOIN users u ON s.owner_id = u.user_id
        WHERE s.store_id = $1
      `;

      const result = await pool.query(query, [storeId]);

      if (result.rows.length === 0) {
        throw new Error('Store not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error in Chat.getStoreById:', error);
      throw error;
    }
  }

  /**
   * Validate if a user can access a chat room
   * @param {number} storeId - Store ID
   * @param {number} buyerId - Buyer ID
   * @param {number} userId - User ID attempting access
   * @param {string} role - User role
   * @returns {Promise<boolean>} - Whether user can access the chat
   */
  static async canAccessChat(storeId, buyerId, userId, role) {
    try {
      const pool = this.getPool();

      if (role === 'buyer') {
        // Buyer can only access their own chats
        return buyerId === userId;
      } else if (role === 'seller') {
        // Seller can only access chats for their stores
        const query = `
          SELECT 1
          FROM stores
          WHERE store_id = $1 AND owner_id = $2
        `;
        const result = await pool.query(query, [storeId, userId]);
        return result.rows.length > 0;
      }

      return false;
    } catch (error) {
      console.error('Error in Chat.canAccessChat:', error);
      throw error;
    }
  }
}

module.exports = Chat;

const Chat = require('../models/Chat');

/**
 * Get all chat rooms for the authenticated user
 */
exports.getAllChats = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    const chatRooms = await Chat.getChatRooms(userId, userRole);

    res.json({
      ok: true,
      data: chatRooms
    });
  } catch (error) {
    console.error('Error in getAllChats:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch chat rooms',
      message: error.message
    });
  }
};

/**
 * Get or create a specific chat room
 */
exports.getChatRoom = async (req, res) => {
  try {
    const { storeId, buyerId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    // Validate access
    const canAccess = await Chat.canAccessChat(
      parseInt(storeId),
      parseInt(buyerId),
      userId,
      userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        ok: false,
        error: 'You do not have permission to access this chat'
      });
    }

    const chatRoom = await Chat.getChatRoom(parseInt(storeId), parseInt(buyerId));

    res.json({
      ok: true,
      data: chatRoom
    });
  } catch (error) {
    console.error('Error in getChatRoom:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch chat room',
      message: error.message
    });
  }
};

/**
 * Get messages for a chat room
 */
exports.getChatMessages = async (req, res) => {
  try {
    const { storeId, buyerId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.userId;
    const userRole = req.userRole;

    // Validate access
    const canAccess = await Chat.canAccessChat(
      parseInt(storeId),
      parseInt(buyerId),
      userId,
      userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        ok: false,
        error: 'You do not have permission to access this chat'
      });
    }

    const messages = await Chat.getMessages(
      parseInt(storeId),
      parseInt(buyerId),
      { page: parseInt(page), limit: parseInt(limit) }
    );

    res.json({
      ok: true,
      data: messages.data,
      meta: messages.meta
    });
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch messages',
      message: error.message
    });
  }
};

/**
 * Create a new chat room (buyer initiates with seller)
 */
exports.createChat = async (req, res) => {
  try {
    const { storeId } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;

    // Only buyers can create chats
    if (userRole !== 'buyer') {
      return res.status(403).json({
        ok: false,
        error: 'Only buyers can initiate chats'
      });
    }

    // Verify store exists
    const store = await Chat.getStoreById(parseInt(storeId));

    // Get or create chat room
    const chatRoom = await Chat.getChatRoom(parseInt(storeId), userId);

    res.json({
      ok: true,
      data: chatRoom,
      message: 'Chat room created successfully'
    });
  } catch (error) {
    console.error('Error in createChat:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create chat',
      message: error.message
    });
  }
};

/**
 * Mark messages as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { storeId, buyerId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    // Validate access
    const canAccess = await Chat.canAccessChat(
      parseInt(storeId),
      parseInt(buyerId),
      userId,
      userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        ok: false,
        error: 'You do not have permission to access this chat'
      });
    }

    const count = await Chat.markAsRead(
      parseInt(storeId),
      parseInt(buyerId),
      userId
    );

    res.json({
      ok: true,
      data: { markedCount: count },
      message: `${count} message(s) marked as read`
    });
  } catch (error) {
    console.error('Error in markAsRead:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to mark messages as read',
      message: error.message
    });
  }
};

/**
 * Get unread message count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    const count = await Chat.getUnreadCount(userId, userRole);

    res.json({
      ok: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get unread count',
      message: error.message
    });
  }
};

/**
 * Get all stores (for buyer to initiate chat)
 */
exports.getStores = async (req, res) => {
  try {
    const db = require('../config/db');
    const pool = db.getInstance();

    const query = `
      SELECT
        s.store_id,
        s.store_name,
        s.logo_path,
        s.description,
        u.full_name as owner_name,
        COUNT(p.product_id) as product_count
      FROM stores s
      JOIN users u ON s.owner_id = u.user_id
      LEFT JOIN products p ON s.store_id = p.store_id AND p.is_deleted = false
      GROUP BY s.store_id, s.store_name, s.logo_path, s.description, u.full_name
      ORDER BY s.store_name ASC
    `;

    const result = await pool.query(query);

    res.json({
      ok: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getStores:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch stores',
      message: error.message
    });
  }
};

/**
 * Upload chat image
 */
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No file uploaded'
      });
    }

    // Return the file path relative to uploads directory
    const imagePath = `/uploads/chat/${req.file.filename}`;

    res.json({
      ok: true,
      data: {
        imagePath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error in uploadImage:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to upload image',
      message: error.message
    });
  }
};

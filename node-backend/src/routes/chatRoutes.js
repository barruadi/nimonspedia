const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// All chat routes require authentication
router.use(authMiddleware);

/**
 * Chat Room Routes
 */

// GET /api/node/chats - Get all chat rooms for the authenticated user
router.get('/chats', async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    const chatRooms = await Chat.getChatRooms(userId, userRole);

    return res.json({
      ok: true,
      data: chatRooms
    });
  } catch (error) {
    console.error('Error in getAllChats:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch chat rooms',
      message: error.message
    });
  }
});

/**
 * Utility Routes (must come before parameterized routes)
 */

// GET /api/node/chat/unread-count - Get unread message count
router.get('/chat/unread-count', async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    const count = await Chat.getUnreadCount(userId, userRole);

    return res.json({
      ok: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to get unread count',
      message: error.message
    });
  }
});

// GET /api/node/chat/stores - Get all stores (for buyer to initiate chat)
router.get('/chat/stores', async (req, res) => {
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

    return res.json({
      ok: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getStores:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch stores',
      message: error.message
    });
  }
});

// GET /api/node/chat/:storeId/:buyerId - Get or create a specific chat room
router.get('/chat/:storeId/:buyerId', async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const buyerId = req.params.buyerId;
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

    return res.json({
      ok: true,
      data: chatRoom
    });
  } catch (error) {
    console.error('Error in getChatRoom:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch chat room',
      message: error.message
    });
  }
});

// POST /api/node/chat - Create new chat room (buyer initiates with seller)
router.post('/chat', async (req, res) => {
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

    return res.json({
      ok: true,
      data: chatRoom,
      message: 'Chat room created successfully'
    });
  } catch (error) {
    console.error('Error in createChat:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to create chat',
      message: error.message
    });
  }
});

/**
 * Message Routes
 */

// GET /api/node/chat/:storeId/:buyerId/messages - Get messages for a chat room
router.get('/chat/:storeId/:buyerId/messages', async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const buyerId = req.params.buyerId;
    const page = req.query.page || '1';
    const limit = req.query.limit || '50';
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

    return res.json({
      ok: true,
      data: messages.data,
      meta: messages.meta
    });
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch messages',
      message: error.message
    });
  }
});

// PUT /api/node/chat/:storeId/:buyerId/read - Mark messages as read
router.put('/chat/:storeId/:buyerId/read', async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const buyerId = req.params.buyerId;
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

    return res.json({
      ok: true,
      data: { markedCount: count },
      message: `${count} message(s) marked as read`
    });
  } catch (error) {
    console.error('Error in markAsRead:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to mark messages as read',
      message: error.message
    });
  }
});

// POST /api/node/chat/upload-image - Upload chat image
router.post('/chat/upload-image', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        error: 'No file uploaded'
      });
    }

    // Return the file path relative to uploads directory
    const imagePath = `/uploads/chat/${file.filename}`;

    return res.json({
      ok: true,
      data: {
        imagePath,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      },
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error in uploadImage:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to upload image',
      message: error.message
    });
  }
});

module.exports = router;

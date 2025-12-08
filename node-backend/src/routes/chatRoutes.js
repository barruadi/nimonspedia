const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// All chat routes require authentication
router.use(authMiddleware);

/**
 * Chat Room Routes
 */

// GET /api/node/chats - Get all chat rooms for the authenticated user
router.get('/chats', chatController.getAllChats);

/**
 * Utility Routes (must come before parameterized routes)
 */

// GET /api/node/chat/unread-count - Get unread message count
router.get('/chat/unread-count', chatController.getUnreadCount);

// GET /api/node/chat/stores - Get all stores (for buyer to initiate chat)
router.get('/chat/stores', chatController.getStores);

// GET /api/node/chat/:storeId/:buyerId - Get or create a specific chat room
router.get('/chat/:storeId/:buyerId', chatController.getChatRoom);

// POST /api/node/chat - Create new chat room (buyer initiates with seller)
router.post('/chat', chatController.createChat);

/**
 * Message Routes
 */

// GET /api/node/chat/:storeId/:buyerId/messages - Get messages for a chat room
router.get('/chat/:storeId/:buyerId/messages', chatController.getChatMessages);

// PUT /api/node/chat/:storeId/:buyerId/read - Mark messages as read
router.put('/chat/:storeId/:buyerId/read', chatController.markAsRead);

// POST /api/node/chat/upload-image - Upload chat image
router.post('/chat/upload-image', upload.single('image'), chatController.uploadImage);

module.exports = router;

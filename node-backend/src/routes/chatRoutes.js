const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Chat API routes (to be implemented)
// GET /api/node/chats - Get all chat rooms
// GET /api/node/chat/:id/messages - Get chat messages
// POST /api/node/chat - Create new chat room
// POST /api/node/chat/:id/message - Send a message

router.get('/chats', chatController.getAllChats);
router.get('/chat/:id/messages', chatController.getChatMessages);
router.post('/chat', chatController.createChat);
router.post('/chat/:id/message', chatController.sendMessage);

module.exports = router;

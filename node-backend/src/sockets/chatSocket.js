// Chat WebSocket Handlers
const { sendChatNotification } = require('../services/pushNotificationService');

const setupChatSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('[Chat] User connected:', socket.id);

    // Join chat room
    socket.on('chat:join', (chatId) => {
      socket.join(`chat-${chatId}`);
      console.log(`[Chat] User ${socket.id} joined chat ${chatId}`);

      // Send mockup chat data
      socket.emit('chat:joined', {
        chatId,
        message: 'Successfully joined chat room',
        mockData: {
          id: chatId,
          name: 'Sample Chat Room',
          participants: [],
          messages: [
            {
              id: 1,
              userId: 'user1',
              userName: 'Alice',
              message: 'Hello!',
              timestamp: new Date().toISOString()
            },
            {
              id: 2,
              userId: 'user2',
              userName: 'Bob',
              message: 'Hi there!',
              timestamp: new Date().toISOString()
            }
          ]
        }
      });
    });

    // Leave chat room
    socket.on('chat:leave', (chatId) => {
      socket.leave(`chat-${chatId}`);
      console.log(`[Chat] User ${socket.id} left chat ${chatId}`);
    });

    // Send message (mockup)
    socket.on('chat:send-message', async (data) => {
      const { chatId, userId, userName, message, receiverId, storeId, buyerId } = data;
      console.log(`[Chat] Message sent:`, data);

      // Broadcast message to all users in chat room
      const newMessage = {
        id: Date.now(),
        userId,
        userName,
        message,
        timestamp: new Date().toISOString()
      };
      
      io.to(`chat-${chatId}`).emit('chat:new-message', newMessage);

      // Send push notification to receiver if they're not in the room
      if (receiverId) {
        try {
          // Check if receiver is online in this chat room
          const roomSockets = await io.in(`chat-${chatId}`).fetchSockets();
          const receiverOnline = roomSockets.some(s => s.data?.userId === receiverId);

          if (!receiverOnline) {
            // Receiver is not in the room, send push notification
            const messagePreview = message.length > 50 
              ? message.substring(0, 50) + '...' 
              : message;
            
            await sendChatNotification(
              receiverId,
              userName,
              messagePreview,
              storeId,
              buyerId
            );
            console.log(`[Chat] Push notification sent to user ${receiverId}`);
          }
        } catch (error) {
          console.error('[Chat] Error sending push notification:', error);
        }
      }
    });

    // Typing indicator
    socket.on('chat:typing', (data) => {
      const { chatId, userName } = data;
      socket.to(`chat-${chatId}`).emit('chat:user-typing', {
        userName
      });
    });

    // Stop typing indicator
    socket.on('chat:stop-typing', (data) => {
      const { chatId, userName } = data;
      socket.to(`chat-${chatId}`).emit('chat:user-stop-typing', {
        userName
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('[Chat] User disconnected:', socket.id);
    });
  });
};

module.exports = setupChatSocket;

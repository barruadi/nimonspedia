// Chat WebSocket Handlers - Mockup

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
    socket.on('chat:send-message', (data) => {
      const { chatId, userId, userName, message } = data;
      console.log(`[Chat] Message sent:`, data);

      // Broadcast message to all users in chat room
      io.to(`chat-${chatId}`).emit('chat:new-message', {
        id: Date.now(),
        userId,
        userName,
        message,
        timestamp: new Date().toISOString()
      });
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

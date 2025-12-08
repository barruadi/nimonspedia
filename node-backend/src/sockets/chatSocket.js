const Chat = require('../models/Chat');
// Chat WebSocket Handlers
const { sendChatNotification } = require('../services/pushNotificationService');

/**
 * Setup Chat WebSocket Handlers
 * @param {SocketIO.Server} io - Socket.IO server instance
 */
const setupChatSocket = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth.userId;
      const userRole = socket.handshake.auth.userRole;

      if (!userId || !userRole) {
        return next(new Error('Authentication required'));
      }

      socket.userId = parseInt(userId);
      socket.userRole = userRole;
      next();
    } catch (error) {
      console.error('[Chat Socket] Authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Chat] User connected: ${socket.id} (userId: ${socket.userId}, role: ${socket.userRole})`);

    // Join user-specific room for global notifications
    const userRoom = `user-${socket.userId}`;
    socket.join(userRoom);
    console.log(`[Chat] User ${socket.userId} joined personal room ${userRoom}`);

    /**
     * Join a chat room
     * Event: chat:join
     * Data: { storeId, buyerId }
     */
    socket.on('chat:join', async (data) => {
      try {
        const { storeId, buyerId } = data;
        const roomId = `chat-${storeId}-${buyerId}`;

        // Validate access
        const canAccess = await Chat.canAccessChat(
          parseInt(storeId),
          parseInt(buyerId),
          socket.userId,
          socket.userRole
        );

        if (!canAccess) {
          socket.emit('chat:error', {
            error: 'You do not have permission to access this chat'
          });
          return;
        }

        // Join the room
        socket.join(roomId);
        socket.currentChatRoom = roomId;

        console.log(`[Chat] User ${socket.userId} joined room ${roomId}`);

        // Get chat room details
        const chatRoom = await Chat.getChatRoom(parseInt(storeId), parseInt(buyerId));

        // Notify user they've joined
        socket.emit('chat:joined', {
          roomId,
          chatRoom,
          message: 'Successfully joined chat room'
        });

        // Notify others in the room that user joined
        socket.to(roomId).emit('chat:user-joined', {
          userId: socket.userId,
          userRole: socket.userRole
        });
      } catch (error) {
        console.error('[Chat] Error joining room:', error);
        socket.emit('chat:error', {
          error: 'Failed to join chat room',
          message: error.message
        });
      }
    });

    /**
     * Leave a chat room
     * Event: chat:leave
     * Data: { storeId, buyerId }
     */
    socket.on('chat:leave', (data) => {
      try {
        const { storeId, buyerId } = data;
        const roomId = `chat-${storeId}-${buyerId}`;

        socket.leave(roomId);
        socket.currentChatRoom = null;

        console.log(`[Chat] User ${socket.userId} left room ${roomId}`);

        // Notify others in the room
        socket.to(roomId).emit('chat:user-left', {
          userId: socket.userId,
          userRole: socket.userRole
        });
      } catch (error) {
        console.error('[Chat] Error leaving room:', error);
      }
    });

    /**
     * Send a message
     * Event: chat:send-message
     * Data: { storeId, buyerId, messageType, content, productId? }
     */
    socket.on('chat:send-message', async (data, callback) => {
      try {
        const { storeId, buyerId, messageType, content, productId } = data;
        const roomId = `chat-${storeId}-${buyerId}`;

        // Validate access
        const canAccess = await Chat.canAccessChat(
          parseInt(storeId),
          parseInt(buyerId),
          socket.userId,
          socket.userRole
        );

        if (!canAccess) {
          if (callback) {
            callback({
              ok: false,
              error: 'You do not have permission to send messages in this chat'
            });
          }
          return;
        }

        // Save message to database
        const message = await Chat.sendMessage({
          storeId: parseInt(storeId),
          buyerId: parseInt(buyerId),
          senderId: socket.userId,
          messageType: messageType || 'text',
          content,
          productId: productId ? parseInt(productId) : null
        });

        // Add store_id and buyer_id to message for sidebar updates
        const messageWithRoomInfo = {
          ...message,
          store_id: parseInt(storeId),
          buyer_id: parseInt(buyerId)
        };

        // Broadcast message to all users in the room
        io.to(roomId).emit('chat:new-message', messageWithRoomInfo);

        // Get chat room info to determine the other participant
        const chatRoom = await Chat.getChatRoom(parseInt(storeId), parseInt(buyerId));

        // Notify both participants in their personal rooms for sidebar updates
        const sellerRoom = `user-${chatRoom.seller_id}`;
        const buyerRoom = `user-${parseInt(buyerId)}`;

        io.to(sellerRoom).emit('chat:new-message', messageWithRoomInfo);
        io.to(buyerRoom).emit('chat:new-message', messageWithRoomInfo);

        console.log(`[Chat] Message sent in room ${roomId}:`, message.message_id);

        // Send push notification to receiver if they're not in the room
        try {
          // Determine receiver based on sender role
          const receiverId = socket.userRole === 'buyer'
            ? chatRoom.seller_id
            : parseInt(buyerId);

          // Check if receiver is online in this chat room
          const roomSockets = await io.in(roomId).fetchSockets();
          const receiverOnline = roomSockets.some(s => s.userId === receiverId);

          if (!receiverOnline) {
            // Receiver is not in the room, send push notification
            const messagePreview = message.message_type === 'text'
              ? (message.content.length > 50
                  ? message.content.substring(0, 50) + '...'
                  : message.content)
              : message.message_type === 'image'
                ? '📷 Photo'
                : '🏷️ Product';

            await sendChatNotification(
              receiverId,
              message.sender_name,
              messagePreview,
              parseInt(storeId),
              parseInt(buyerId)
            );
            console.log(`[Chat] Push notification sent to user ${receiverId}`);
          }
        } catch (error) {
          console.error('[Chat] Error sending push notification:', error);
          // Don't fail the message send if push notification fails
        }

        // Send success callback
        if (callback) {
          callback({
            ok: true,
            data: message
          });
        }
      } catch (error) {
        console.error('[Chat] Error sending message:', error);
        if (callback) {
          callback({
            ok: false,
            error: 'Failed to send message',
            message: error.message
          });
        }
      }
    });

    /**
     * Mark messages as read
     * Event: chat:mark-read
     * Data: { storeId, buyerId }
     */
    socket.on('chat:mark-read', async (data) => {
      try {
        const { storeId, buyerId } = data;
        const roomId = `chat-${storeId}-${buyerId}`;

        // Validate access
        const canAccess = await Chat.canAccessChat(
          parseInt(storeId),
          parseInt(buyerId),
          socket.userId,
          socket.userRole
        );

        if (!canAccess) {
          return;
        }

        // Mark messages as read
        const count = await Chat.markAsRead(
          parseInt(storeId),
          parseInt(buyerId),
          socket.userId
        );

        // Get chat room info to determine the other participant
        const chatRoom = await Chat.getChatRoom(parseInt(storeId), parseInt(buyerId));

        const readData = {
          storeId: parseInt(storeId),
          buyerId: parseInt(buyerId),
          readBy: socket.userId,
          count
        };

        // Notify the sender in the chat room
        socket.to(roomId).emit('chat:messages-read', readData);

        // Notify both participants in their personal rooms for sidebar updates
        const sellerRoom = `user-${chatRoom.seller_id}`;
        const buyerRoom = `user-${parseInt(buyerId)}`;

        io.to(sellerRoom).emit('chat:messages-read', readData);
        io.to(buyerRoom).emit('chat:messages-read', readData);

        console.log(`[Chat] User ${socket.userId} marked ${count} messages as read in room ${roomId}`);
      } catch (error) {
        console.error('[Chat] Error marking messages as read:', error);
      }
    });

    /**
     * Typing indicator
     * Event: chat:typing
     * Data: { storeId, buyerId }
     */
    socket.on('chat:typing', (data) => {
      try {
        const { storeId, buyerId } = data;
        const roomId = `chat-${storeId}-${buyerId}`;

        // Broadcast typing indicator to others in the room
        socket.to(roomId).emit('chat:user-typing', {
          userId: socket.userId,
          userRole: socket.userRole
        });

        console.log(`[Chat] User ${socket.userId} is typing in room ${roomId}`);
      } catch (error) {
        console.error('[Chat] Error broadcasting typing:', error);
      }
    });

    /**
     * Stop typing indicator
     * Event: chat:stop-typing
     * Data: { storeId, buyerId }
     */
    socket.on('chat:stop-typing', (data) => {
      try {
        const { storeId, buyerId } = data;
        const roomId = `chat-${storeId}-${buyerId}`;

        // Broadcast stop typing to others in the room
        socket.to(roomId).emit('chat:user-stop-typing', {
          userId: socket.userId,
          userRole: socket.userRole
        });

        console.log(`[Chat] User ${socket.userId} stopped typing in room ${roomId}`);
      } catch (error) {
        console.error('[Chat] Error broadcasting stop typing:', error);
      }
    });

    /**
     * Message delivered confirmation
     * Event: chat:message-delivered
     * Data: { storeId, buyerId, messageId }
     */
    socket.on('chat:message-delivered', (data) => {
      try {
        const { storeId, buyerId, messageId } = data;
        const roomId = `chat-${storeId}-${buyerId}`;

        // Broadcast delivery confirmation to the sender
        socket.to(roomId).emit('chat:message-delivered', {
          messageId,
          deliveredAt: new Date().toISOString()
        });

        console.log(`[Chat] Message ${messageId} delivered in room ${roomId}`);
      } catch (error) {
        console.error('[Chat] Error broadcasting message delivery:', error);
      }
    });

    /**
     * Disconnect
     */
    socket.on('disconnect', () => {
      console.log(`[Chat] User disconnected: ${socket.id} (userId: ${socket.userId})`);

      // Leave current chat room if any
      if (socket.currentChatRoom) {
        socket.to(socket.currentChatRoom).emit('chat:user-left', {
          userId: socket.userId,
          userRole: socket.userRole
        });
      }
    });
  });
};

module.exports = setupChatSocket;

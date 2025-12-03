// Auction WebSocket Handlers - Mockup

const setupAuctionSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('[Auction] User connected:', socket.id);

    // Join auction room
    socket.on('auction:join', (auctionId) => {
      socket.join(`auction-${auctionId}`);
      console.log(`[Auction] User ${socket.id} joined auction ${auctionId}`);

      // Send mockup auction data
      socket.emit('auction:joined', {
        auctionId,
        message: 'Successfully joined auction room',
        mockData: {
          id: auctionId,
          product: 'Sample Product',
          currentPrice: 1000,
          timeLeft: 300, // 5 minutes in seconds
          bids: []
        }
      });
    });

    // Leave auction room
    socket.on('auction:leave', (auctionId) => {
      socket.leave(`auction-${auctionId}`);
      console.log(`[Auction] User ${socket.id} left auction ${auctionId}`);
    });

    // Place bid (mockup)
    socket.on('auction:bid', (data) => {
      const { auctionId, userId, userName, amount } = data;
      console.log(`[Auction] Bid placed:`, data);

      // Broadcast bid to all users in auction room
      io.to(`auction-${auctionId}`).emit('auction:new-bid', {
        userId,
        userName,
        amount,
        timestamp: new Date().toISOString()
      });

      // Send confirmation to bidder
      socket.emit('auction:bid-success', {
        message: 'Bid placed successfully',
        amount
      });
    });

    // Timer mockup (to be implemented with actual timer logic)
    socket.on('auction:start-timer', (data) => {
      const { auctionId, duration } = data;
      console.log(`[Auction] Timer started for auction ${auctionId}, duration: ${duration}s`);

      // TODO: Implement actual timer with setInterval
      // For now, just acknowledge
      socket.emit('auction:timer-started', {
        auctionId,
        duration,
        message: 'Timer started (mockup)'
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('[Auction] User disconnected:', socket.id);
    });
  });
};

module.exports = setupAuctionSocket;

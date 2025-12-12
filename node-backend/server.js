// Load environment variables
require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const db = require('./src/config/db');

// Import Express routes
const adminApp = require('./src/routes/admin');
const auctionApp = require('./src/routes/auctionRoutes');
const chatApp = require('./src/routes/chatRoutes');
const pushApp = require('./src/routes/push');
const paymentApp = require('./src/routes/paymentRoutes');
const orderApp = require('./src/routes/orderRoutes');
const featureFlagApp = require('./src/routes/featureFlagRoutes');

// Import socket handlers
const { setupAuctionSocket, checkAndStartScheduledAuctions } = require('./src/sockets/auctionSocket');
const setupChatSocket = require('./src/sockets/chatSocket');

// Create main Express app
const app = express();

// Custom CORS middleware with Express - MUST BE FIRST
app.use((req, res, next) => {
  // Allow all origins in development (you can restrict this in production)
  const origin = req.headers.origin;

  // Set CORS headers for ALL requests
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight OPTIONS request IMMEDIATELY
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS preflight for:', req.path);
    return res.status(204).end();
  }

  console.log(`[CORS] ${req.method} ${req.path} from origin: ${origin || 'none'}`);
  next();
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test database connection
db.testConnection();

// Root route
app.get('/', (req, res) => {
  res.send('Node.js Backend with Express is Running!');
});

// Mount sub-apps
// Note: NGINX strips /api/node/ prefix, so mount at root
app.use('/admin', adminApp);
app.use('/', auctionApp);
app.use('/', chatApp);
app.use('/', pushApp);
app.use('/', paymentApp);
app.use('/', orderApp);
app.use('/', featureFlagApp);

// Create HTTP server for Socket.IO
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io instance available globally
global.ioInstance = io;

// Setup WebSocket handlers
setupAuctionSocket(io);
setupChatSocket(io);

// Periodically check and start scheduled auctions (every 5 seconds)
setInterval(() => {
  checkAndStartScheduledAuctions(io);
}, 5000);

console.log('[Server] Scheduled auction checker started (checks every 5 seconds)');

// Basic connection test
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Test event
  socket.on('test', (data) => {
    console.log('Test event received:', data);
    socket.emit('test-response', {
      message: 'Server received your test message',
      originalData: data,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

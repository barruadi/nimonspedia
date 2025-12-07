const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

// Import database singleton
const db = require('./src/config/db');

// Import routes
const auctionRoutes = require('./src/routes/auctionRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const pushRoutes = require('./src/routes/push');

// Import socket handlers
const { setupAuctionSocket, checkAndStartScheduledAuctions } = require('./src/sockets/auctionSocket');
const setupChatSocket = require('./src/sockets/chatSocket');

const app = express();

// Configure CORS to accept requests with credentials
app.use(cors({
    origin: [
        'http://localhost',
        'http://localhost:80',
        'http://127.0.0.1',
        'http://127.0.0.1:80'
    ],
    credentials: true, // Allow credentials (cookies) to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-ID']
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Make io instance available globally
global.ioInstance = io;

db.testConnection();

// API Routes
app.get('/', (req, res) => {
    res.send('Node.js Backend is Running!');
});

// Mount auction and chat routes
app.use('/api/node', auctionRoutes);
app.use('/api/node', chatRoutes);
app.use('/api/node', pushRoutes);

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
});

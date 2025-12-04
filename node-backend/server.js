const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();

// Import database singleton
const db = require('./src/config/db');

// Import routes
const auctionRoutes = require('./src/routes/auctionRoutes');
const chatRoutes = require('./src/routes/chatRoutes');

// Import socket handlers
const setupAuctionSocket = require('./src/sockets/auctionSocket');
const setupChatSocket = require('./src/sockets/chatSocket');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

db.testConnection();

// API Routes
app.get('/', (req, res) => {
    res.send('Node.js Backend is Running!');
});

// Mount auction and chat routes
app.use('/api/node', auctionRoutes);
app.use('/api/node', chatRoutes);

// Setup WebSocket handlers
setupAuctionSocket(io);
setupChatSocket(io);

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

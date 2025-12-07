const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const db = require('./src/config/db');

const auctionRoutes = require('./src/routes/auctionRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const pushRoutes = require('./src/routes/push');
const adminApp = require('./src/routes/admin');

const setupAuctionSocket = require('./src/sockets/auctionSocket');
const setupChatSocket = require('./src/sockets/chatSocket');

const app = express();

app.use(cors({
    origin: [
        'http://localhost',
        'http://localhost:80',
        'http://localhost:5173',
        'http://127.0.0.1',
        'http://127.0.0.1:80',
        'http://127.0.0.1:5173'
    ],
    credentials: true,
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

db.testConnection();

app.get('/', (req, res) => {
    res.send('Node.js Backend is Running!');
});

app.use('/api/node', auctionRoutes);
app.use('/api/node', chatRoutes);
app.use('/api/node', pushRoutes);

// Mount Hono admin app dengan proper adapter
app.use('/api/node/admin', async (req, res, next) => {
  console.log('Proxying request to Hono admin app:', req.method, req.originalUrl);
  
  // Strip /api/node/admin prefix untuk Hono
  const path = req.originalUrl.replace(/^\/api\/node\/admin/, '') || '/';
  const url = new URL(path, `http://${req.headers.host}`);
  
  console.log('Constructed URL for Hono admin app:', url.toString());
  
  const honoRequest = new Request(url, {
    method: req.method,
    headers: new Headers(req.headers),
    body: req.method !== 'GET' && req.method !== 'HEAD' && req.body 
      ? JSON.stringify(req.body) 
      : undefined
  });

  try {
    const honoResponse = await adminApp.fetch(honoRequest);
    console.log(honoRequest.body)
    console.log('Hono admin app response status:', honoResponse.status);
    
    res.status(honoResponse.status);
    
    honoResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    const body = await honoResponse.text();
    res.send(body);
  } catch (error) {
    console.error('Hono admin route error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

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

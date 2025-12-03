const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');

// Auction API routes (to be implemented)
// GET /api/node/auctions - Get all active auctions
// GET /api/node/auction/:id - Get auction by ID
// POST /api/node/auction - Create new auction
// POST /api/node/auction/:id/bid - Place a bid
// DELETE /api/node/auction/:id - Cancel auction

router.get('/auctions', auctionController.getAllAuctions);
router.get('/auction/:id', auctionController.getAuctionById);
router.post('/auction', auctionController.createAuction);
router.post('/auction/:id/bid', auctionController.placeBid);
router.delete('/auction/:id', auctionController.cancelAuction);

module.exports = router;

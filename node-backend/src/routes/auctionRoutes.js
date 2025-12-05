const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');


/**
 * List auctions with filters & pagination
 */
router.get('/auctions', auctionController.getAllAuctions);

/**
 * Get auction detail (initial load) 
 */
router.get('/auction/:id', auctionController.getAuctionById);

/**
 * Get bids for an auction
 */
router.get('/auction/:id/bids', auctionController.getBidHistory);

/**
 * Place bid on auction
 */
router.post('/auction/:id/bids', auctionController.placeBid);

/**
 * Stop auction (seller action - ends with current winner)
 */
router.put('/auction/:id/stop', auctionController.stopAuction);

/**
 * Cancel auction (seller action - only if no bids)
 */
router.put('/auction/:id/cancel', auctionController.cancelAuction);

/**
 * Create auction (seller action)
 */
router.post('/auction', auctionController.createAuction);

/**
 * Seller history routes
 */
router.get('/seller/auction/active', auctionController.getSellerActiveAuction);
router.get('/seller/auctions', auctionController.getSellerAuctions);

/**
 * Buyer history routes
 */
router.get('/buyer/bids', auctionController.getBuyerBidHistory);
router.get('/buyer/won-auctions', auctionController.getBuyerWonAuctions);



module.exports = router;

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

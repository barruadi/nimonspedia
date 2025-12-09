const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const verifyUser = require('../middlewares/authMiddleware');
const { requireAuction } = require('../middlewares/featureFlagMiddleware');


/**
 * List auctions with filters & pagination
 */
router.get('/auctions', requireAuction(), auctionController.getAllAuctions);

/**
 * Get auction detail (initial load)
 */
router.get('/auction/:id', requireAuction(), auctionController.getAuctionById);

/**
 * Get bids for an auction
 */
router.get('/auction/:id/bids', requireAuction(), auctionController.getBidHistory);

/**
 * Place bid on auction
 */
router.post('/auction/:id/bids', requireAuction(), auctionController.placeBid);

/**
 * Stop auction (seller action - ends with current winner)
 */
router.put('/auction/:id/stop', requireAuction(), verifyUser, auctionController.stopAuction);

/**
 * Cancel auction (seller action - only if no bids)
 */
router.put('/auction/:id/cancel', requireAuction(), verifyUser, auctionController.cancelAuction);

/**
 * Create auction (seller action)
 */
router.post('/auction', requireAuction(), verifyUser, auctionController.createAuction);

/**
 * Seller history routes
 */
router.get('/seller/auction/active', requireAuction(), verifyUser, auctionController.getSellerActiveAuction);
router.get('/seller/auction/status', requireAuction(), verifyUser, auctionController.getSellerAuctionStatus);
router.get('/seller/auctions', requireAuction(), verifyUser, auctionController.getSellerAuctions);

/**
 * Buyer history routes
 */
router.get('/buyer/bids', requireAuction(), verifyUser, auctionController.getBuyerBidHistory);
router.get('/buyer/won-auctions', requireAuction(), verifyUser, auctionController.getBuyerWonAuctions);



module.exports = router;
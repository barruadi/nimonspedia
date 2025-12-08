const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const verifyUser = require('../middlewares/authMiddleware');


/**
 * List auctions with filters & pagination
 */
router.get('/auctions', auctionController.getAllAuctions);

/**
 * Get auction detail (initial load) 
 * Protected: buyer & seller only (conditional page at frontend)
 */
router.get('/auction/:id', verifyUser, auctionController.getAuctionById);

/**
 * Get bids for an auction
 * Protected: buyer & seller only (conditional page at frontend)
 */
router.get('/auction/:id/bids', verifyUser, auctionController.getBidHistory);

/**
 * Place bid on auction
 * Protected: buyer & seller (seller validated in controller)
 */
router.post('/auction/:id/bids', verifyUser, auctionController.placeBid);

/**
 * Stop auction (seller action - ends with current winner)
 */
router.put('/auction/:id/stop', verifyUser, auctionController.stopAuction);

/**
 * Cancel auction (seller action - only if no bids)
 */
router.put('/auction/:id/cancel', verifyUser, auctionController.cancelAuction);

/**
 * Create auction (seller action)
 */
router.post('/auction', verifyUser, auctionController.createAuction);

/**
 * Seller history routes
 */
router.get('/seller/auction/active', verifyUser, auctionController.getSellerActiveAuction);
router.get('/seller/auction/status', verifyUser, auctionController.getSellerAuctionStatus);
router.get('/seller/auctions', verifyUser, auctionController.getSellerAuctions);

/**
 * Buyer history routes
 */
router.get('/buyer/bids', verifyUser, auctionController.getBuyerBidHistory);
router.get('/buyer/won-auctions', verifyUser, auctionController.getBuyerWonAuctions);



module.exports = router;
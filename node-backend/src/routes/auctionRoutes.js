const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');

/**
 * Global Auction Routes
 */
router.get('/auctions', auctionController.getAllAuctions);
router.get('/auction/:id', auctionController.getAuctionById);
router.get('/auction/:id/stats', auctionController.getAuctionStats);
router.get('/auction/:id/min-bid', auctionController.getMinimumBidAmount);

router.post('/auction', auctionController.createAuction);
router.post('/auction/:id/bid', auctionController.placeBid);
router.post('/auction/:id/create-order', auctionController.createOrderFromAuction);

router.put('/auction/:id/stop', auctionController.stopAuction);
router.put('/auction/:id/update-status', auctionController.updateAuctionStatus);
router.put('/auction/:id/refund-previous-bid', auctionController.refundPreviousBid);

router.delete('/auction/:id', auctionController.cancelAuction);

/**
 * Seller and Buyer Specific Routes
 */
router.get('/seller/auction/active', auctionController.getSellerActiveAuction);
router.get('/seller/auctions', auctionController.getSellerAuctions);

router.get('/buyer/bids', auctionController.getBuyerBidHistory);
router.get('/buyer/won-auctions', auctionController.getBuyerWonAuctions);


module.exports = router;

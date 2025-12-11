const express = require('express');
const verifyUser = require('../middlewares/authMiddleware');
const {
  getUserOrders,
  getOrderDetails,
  updateOrderStatus
} = require('../controllers/orderController');

const router = express.Router();

/**
 * Get all orders for the authenticated user
 * GET /api/node/orders
 * Query params: status (optional)
 */
router.get('/orders', verifyUser, getUserOrders);

/**
 * Get single order details
 * GET /api/node/orders/:orderId
 */
router.get('/orders/:orderId', verifyUser, getOrderDetails);

/**
 * Update order status
 * PUT /api/node/orders/:orderId/status
 * Body: { status, reject_reason (optional), delivery_time (optional) }
 */
router.put('/orders/:orderId/status', verifyUser, updateOrderStatus);

module.exports = router;

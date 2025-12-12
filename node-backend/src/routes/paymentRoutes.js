const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyUser = require('../middlewares/authMiddleware');

/**
 * Payment Routes
 */

// Create top-up payment transaction
// POST /api/node/payment/topup
// Body: { amount: number }
router.post('/payment/topup', verifyUser, paymentController.createTopUpPayment);

// Create order payment transaction
// POST /api/node/payment/order
// Body: { order_id: number }
router.post('/payment/order', verifyUser, paymentController.createOrderPayment);

// Get payment transaction status
// GET /api/node/payment/status/:order_id
router.get('/payment/status/:order_id', verifyUser, paymentController.getPaymentStatus);

// Check and process payment from Midtrans (for sandbox/localhost)
// POST /api/node/payment/check/:order_id
// Manually checks Midtrans API and processes payment (alternative to webhook for local development)
router.post('/payment/check/:order_id', verifyUser, paymentController.checkAndProcessPayment);

/**
 * Webhook Routes (No auth middleware - verified by signature)
 */

// Handle Midtrans payment notification webhook
// POST /api/node/webhook/payment
// This endpoint is called by Midtrans to notify payment status changes
router.post('/webhook/payment', paymentController.handlePaymentWebhook);

module.exports = router;

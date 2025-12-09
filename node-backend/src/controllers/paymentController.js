const midtransClient = require('midtrans-client');
const crypto = require('crypto');
const db = require('../config/db');

// Initialize Midtrans Snap client
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

/**
 * Create payment transaction for balance top-up
 * POST /api/node/payment/topup
 */
async function createTopUpPayment(req, res) {
  const pool = db.getInstance();

  try {
    const { amount } = req.body;
    const userId = req.userId || req.body.user_id;

    // Validation
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'User not authenticated'
      });
    }

    if (!amount || amount < 10000) {
      return res.status(400).json({
        ok: false,
        error: 'Minimum top-up amount is Rp 10,000'
      });
    }

    if (amount > 10000000) {
      return res.status(400).json({
        ok: false,
        error: 'Maximum top-up amount is Rp 10,000,000'
      });
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT user_id, email, full_name FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Generate unique order ID
    const orderId = `TOPUP-${user.user_id}-${Date.now()}`;

    // Create transaction parameter for Midtrans
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      customer_details: {
        first_name: user.full_name,
        email: user.email
      },
      item_details: [
        {
          id: 'topup-balance',
          price: amount,
          quantity: 1,
          name: 'Balance Top-Up'
        }
      ],
      callbacks: {
        finish: 'http://localhost/payment/success',
        error: 'http://localhost/payment/error',
        pending: 'http://localhost/payment/pending'
      }
    };

    console.log('[Payment/TopUp] Creating Snap token for user:', userId, 'amount:', amount);

    // Create Snap transaction
    const transaction = await snap.createTransaction(parameter);

    // Store initial transaction in database
    await pool.query(
      `INSERT INTO payment_transactions (
        transaction_id, order_id, user_id, related_order_id,
        type, gross_amount, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [orderId, orderId, userId, null, 'topup', amount, 'pending']
    );

    console.log('[Payment/TopUp] Snap token created:', transaction.token);

    return res.status(200).json({
      ok: true,
      data: {
        token: transaction.token,
        redirect_url: transaction.redirect_url,
        order_id: orderId
      }
    });

  } catch (error) {
    console.error('[Payment/TopUp] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to create payment transaction',
      details: error.message
    });
  }
}

/**
 * Create payment transaction for order checkout
 * POST /api/node/payment/order
 */
async function createOrderPayment(req, res) {
  const pool = db.getInstance();

  try {
    const { order_id } = req.body;
    const userId = req.userId || req.body.user_id;

    // Validation
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'User not authenticated'
      });
    }

    if (!order_id) {
      return res.status(400).json({
        ok: false,
        error: 'Order ID is required'
      });
    }

    // Get order details
    const orderResult = await pool.query(
      `SELECT o.order_id, o.buyer_id, o.total_price, o.status,
              u.email, u.full_name
       FROM orders o
       JOIN users u ON o.buyer_id = u.user_id
       WHERE o.order_id = $1 AND o.buyer_id = $2`,
      [order_id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Order not found or unauthorized'
      });
    }

    const order = orderResult.rows[0];

    // Check if order is in correct status for payment
    if (order.status !== 'waiting_approval') {
      return res.status(400).json({
        ok: false,
        error: 'Order is not in waiting_approval status'
      });
    }

    // Check if payment already exists for this order
    const existingPayment = await pool.query(
      `SELECT * FROM payment_transactions
       WHERE related_order_id = $1 AND status IN ('pending', 'success')
       LIMIT 1`,
      [order_id]
    );

    if (existingPayment.rows.length > 0) {
      const existing = existingPayment.rows[0];

      if (existing.status === 'success') {
        return res.status(400).json({
          ok: false,
          error: 'Order has already been paid'
        });
      }

      // If pending, return existing token
      try {
        const statusResponse = await snap.transaction.status(existing.transaction_id);

        if (statusResponse.transaction_status === 'pending') {
          return res.status(200).json({
            ok: true,
            data: {
              order_id: existing.order_id,
              message: 'Payment already in progress'
            }
          });
        }
      } catch (err) {
        console.log('[Payment/Order] Existing transaction expired, creating new one');
      }
    }

    // Generate unique transaction order ID
    const transactionOrderId = `ORDER-${order.order_id}-${Date.now()}`;

    // Get order items for item_details
    const itemsResult = await pool.query(
      `SELECT oi.product_id, oi.quantity, oi.price_at_order, p.name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = $1`,
      [order_id]
    );

    const itemDetails = itemsResult.rows.map(item => ({
      id: `product-${item.product_id}`,
      price: item.price_at_order,
      quantity: item.quantity,
      name: item.name
    }));

    // Create transaction parameter for Midtrans
    const parameter = {
      transaction_details: {
        order_id: transactionOrderId,
        gross_amount: order.total_price
      },
      customer_details: {
        first_name: order.full_name,
        email: order.email
      },
      item_details: itemDetails,
      callbacks: {
        finish: `http://localhost/orders/${order_id}`,
        error: 'http://localhost/payment/error',
        pending: 'http://localhost/payment/pending'
      }
    };

    console.log('[Payment/Order] Creating Snap token for order:', order_id);

    // Create Snap transaction
    const transaction = await snap.createTransaction(parameter);

    // Store initial transaction in database
    await pool.query(
      `INSERT INTO payment_transactions (
        transaction_id, order_id, user_id, related_order_id,
        type, gross_amount, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [transactionOrderId, transactionOrderId, userId, order_id, 'order', order.total_price, 'pending']
    );

    console.log('[Payment/Order] Snap token created:', transaction.token);

    return res.status(200).json({
      ok: true,
      data: {
        token: transaction.token,
        redirect_url: transaction.redirect_url,
        order_id: transactionOrderId
      }
    });

  } catch (error) {
    console.error('[Payment/Order] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to create payment transaction',
      details: error.message
    });
  }
}

/**
 * Handle payment notification webhook from Midtrans
 * POST /api/node/webhook/payment
 */
async function handlePaymentWebhook(req, res) {
  const pool = db.getInstance();

  try {
    const notification = req.body;

    console.log('[Webhook/Payment] Received notification:', JSON.stringify(notification, null, 2));

    // Verify signature
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key
    } = notification;

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const hash = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');

    if (hash !== signature_key) {
      console.error('[Webhook/Payment] Invalid signature');
      return res.status(403).json({
        ok: false,
        error: 'Invalid signature'
      });
    }

    console.log('[Webhook/Payment] Signature verified for order:', order_id);

    // Get transaction status from Midtrans API (best practice - don't trust webhook alone)
    let transactionStatus;
    try {
      transactionStatus = await snap.transaction.status(order_id);
      console.log('[Webhook/Payment] Transaction status from API:', transactionStatus.transaction_status);
    } catch (error) {
      console.error('[Webhook/Payment] Failed to get transaction status:', error.message);
      return res.status(500).json({
        ok: false,
        error: 'Failed to verify transaction status'
      });
    }

    const {
      transaction_status,
      fraud_status,
      payment_type,
      transaction_id,
      va_numbers,
      bank
    } = transactionStatus;

    // Start database transaction for atomic updates
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if transaction already exists and was processed (idempotency check)
      const existingTx = await client.query(
        `SELECT * FROM payment_transactions
         WHERE order_id = $1
         FOR UPDATE`,
        [order_id]
      );

      if (existingTx.rows.length === 0) {
        console.warn('[Webhook/Payment] Transaction not found in database:', order_id);
        await client.query('ROLLBACK');
        return res.status(404).json({
          ok: false,
          error: 'Transaction not found'
        });
      }

      const dbTransaction = existingTx.rows[0];

      // Increment retry count for monitoring
      const newRetryCount = dbTransaction.retry_count + 1;

      // Determine new status
      let newStatus = 'pending';

      if (transaction_status === 'capture') {
        newStatus = (fraud_status === 'accept') ? 'success' : 'pending';
      } else if (transaction_status === 'settlement') {
        newStatus = 'success';
      } else if (transaction_status === 'deny' || transaction_status === 'cancel') {
        newStatus = 'failed';
      } else if (transaction_status === 'expire') {
        newStatus = 'expired';
      }

      console.log('[Webhook/Payment] Status change:', dbTransaction.status, '->', newStatus);

      // Only process if status actually changed or first time processing
      if (dbTransaction.status !== newStatus || !dbTransaction.processed_at) {

        // Update payment transaction
        await client.query(
          `UPDATE payment_transactions
           SET status = $1,
               transaction_id = $2,
               payment_type_midtrans = $3,
               bank = $4,
               va_number = $5,
               midtrans_response = $6,
               signature_key = $7,
               processed_at = NOW(),
               retry_count = $8,
               updated_at = NOW()
           WHERE order_id = $9`,
          [
            newStatus,
            transaction_id || order_id,
            payment_type,
            bank || null,
            va_numbers ? va_numbers[0]?.va_number : null,
            JSON.stringify(transactionStatus),
            signature_key,
            newRetryCount,
            order_id
          ]
        );

        // Handle based on transaction type and status
        if (newStatus === 'success') {
          if (dbTransaction.type === 'topup') {
            // Update user balance
            await client.query(
              `UPDATE users
               SET balance = balance + $1, updated_at = NOW()
               WHERE user_id = $2`,
              [dbTransaction.gross_amount, dbTransaction.user_id]
            );

            console.log('[Webhook/Payment] Balance updated for user:', dbTransaction.user_id, 'amount:', dbTransaction.gross_amount);

          } else if (dbTransaction.type === 'order') {
            // Update order status to approved (payment received)
            await client.query(
              `UPDATE orders
               SET status = 'approved', updated_at = NOW()
               WHERE order_id = $1`,
              [dbTransaction.related_order_id]
            );

            console.log('[Webhook/Payment] Order approved:', dbTransaction.related_order_id);

            // TODO: Send push notification to user
            // TODO: Send notification to seller
          }
        }

        await client.query('COMMIT');

        console.log('[Webhook/Payment] Transaction processed successfully');

        return res.status(200).json({
          ok: true,
          message: 'Notification processed successfully'
        });

      } else {
        // Duplicate notification - already processed
        await client.query(
          `UPDATE payment_transactions
           SET retry_count = $1
           WHERE order_id = $2`,
          [newRetryCount, order_id]
        );

        await client.query('COMMIT');

        console.log('[Webhook/Payment] Duplicate notification ignored (retry:', newRetryCount, ')');

        return res.status(200).json({
          ok: true,
          message: 'Notification already processed (duplicate)'
        });
      }

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[Webhook/Payment] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to process webhook',
      details: error.message
    });
  }
}

/**
 * Get payment transaction status
 * GET /api/node/payment/status/:order_id
 */
async function getPaymentStatus(req, res) {
  const pool = db.getInstance();

  try {
    const { order_id } = req.params;
    const userId = req.userId || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'User not authenticated'
      });
    }

    const result = await pool.query(
      `SELECT * FROM payment_transactions
       WHERE order_id = $1 AND user_id = $2`,
      [order_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Transaction not found'
      });
    }

    const transaction = result.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        order_id: transaction.order_id,
        type: transaction.type,
        status: transaction.status,
        gross_amount: transaction.gross_amount,
        payment_type: transaction.payment_type_midtrans,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      }
    });

  } catch (error) {
    console.error('[Payment/Status] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to get payment status'
    });
  }
}

module.exports = {
  createTopUpPayment,
  createOrderPayment,
  handlePaymentWebhook,
  getPaymentStatus
};

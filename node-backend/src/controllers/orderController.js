const db = require('../config/db');
const { sendOrderNotification } = require('../services/pushNotificationService');

/**
 * Get all orders for a user (buyer or seller)
 * GET /api/node/orders
 */
async function getUserOrders(req, res) {
  const pool = db.getInstance();

  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { status } = req.query;

    let query;
    let params;

    if (userRole === 'buyer') {
      query = `
        SELECT o.*, s.store_name, s.logo_path as store_logo
        FROM orders o
        JOIN stores s ON o.store_id = s.store_id
        WHERE o.buyer_id = $1
        ${status ? 'AND o.status = $2' : ''}
        ORDER BY o.created_at DESC
      `;
      params = status ? [userId, status] : [userId];
    } else if (userRole === 'seller') {
      query = `
        SELECT o.*, u.full_name as buyer_name, u.email as buyer_email
        FROM orders o
        JOIN users u ON o.buyer_id = u.user_id
        WHERE o.store_id IN (SELECT store_id FROM stores WHERE owner_id = $1)
        ${status ? 'AND o.status = $2' : ''}
        ORDER BY o.created_at DESC
      `;
      params = status ? [userId, status] : [userId];
    } else {
      return res.status(403).json({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const result = await pool.query(query, params);

    return res.json({
      ok: true,
      orders: result.rows
    });
  } catch (error) {
    console.error('[Order] Error fetching orders:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch orders'
    });
  }
}

/**
 * Get single order details
 * GET /api/node/orders/:orderId
 */
async function getOrderDetails(req, res) {
  const pool = db.getInstance();

  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { orderId } = req.params;

    // Get order with items
    const orderQuery = `
      SELECT o.*, s.store_name, s.logo_path as store_logo, u.full_name as buyer_name
      FROM orders o
      JOIN stores s ON o.store_id = s.store_id
      JOIN users u ON o.buyer_id = u.user_id
      WHERE o.order_id = $1
    `;
    const orderResult = await pool.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check authorization
    if (userRole === 'buyer' && order.buyer_id !== userId) {
      return res.status(403).json({
        ok: false,
        error: 'Unauthorized'
      });
    }

    if (userRole === 'seller') {
      const storeCheck = await pool.query(
        'SELECT store_id FROM stores WHERE store_id = $1 AND owner_id = $2',
        [order.store_id, userId]
      );

      if (storeCheck.rows.length === 0) {
        return res.status(403).json({
          ok: false,
          error: 'Unauthorized'
        });
      }
    }

    // Get order items
    const itemsQuery = `
      SELECT oi.*, p.name as product_name, p.image_path
      FROM order_items oi
      JOIN products p ON oi.product_id = p.product_id
      WHERE oi.order_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [orderId]);

    return res.json({
      ok: true,
      order: {
        ...order,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('[Order] Error fetching order details:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch order details'
    });
  }
}

/**
 * Update order status (seller only for approve/reject/delivery, buyer for received)
 * PUT /api/node/orders/:orderId/status
 */
async function updateOrderStatus(req, res) {
  const pool = db.getInstance();

  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { orderId } = req.params;
    const { status, reject_reason, delivery_time } = req.body;

    // Validate status
    const validStatuses = ['approved', 'rejected', 'on_delivery', 'received'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid status'
      });
    }

    // Get order
    const orderResult = await pool.query(
      `SELECT o.*, s.owner_id as seller_id
       FROM orders o
       JOIN stores s ON o.store_id = s.store_id
       WHERE o.order_id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check authorization based on action
    if (status === 'received') {
      // Only buyer can mark as received
      if (userRole !== 'buyer' || order.buyer_id !== userId) {
        return res.status(403).json({
          ok: false,
          error: 'Only the buyer can mark order as received'
        });
      }

      if (order.status !== 'on_delivery') {
        return res.status(400).json({
          ok: false,
          error: 'Order must be on delivery to mark as received'
        });
      }
    } else {
      // Seller actions (approve, reject, on_delivery)
      if (userRole !== 'seller' || order.seller_id !== userId) {
        return res.status(403).json({
          ok: false,
          error: 'Only the seller can perform this action'
        });
      }

      // Validate state transitions
      if (status === 'approved' && order.status !== 'waiting_approval') {
        return res.status(400).json({
          ok: false,
          error: 'Can only approve orders that are waiting approval'
        });
      }

      if (status === 'rejected' && order.status !== 'waiting_approval') {
        return res.status(400).json({
          ok: false,
          error: 'Can only reject orders that are waiting approval'
        });
      }

      if (status === 'on_delivery' && order.status !== 'approved') {
        return res.status(400).json({
          ok: false,
          error: 'Can only set to on_delivery for approved orders'
        });
      }

      if (status === 'rejected' && !reject_reason) {
        return res.status(400).json({
          ok: false,
          error: 'Reject reason is required'
        });
      }
    }

    // Update order status
    const updateQuery = `
      UPDATE orders
      SET status = $1,
          reject_reason = $2,
          delivery_time = $3,
          confirmed_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE confirmed_at END,
          received_at = CASE WHEN $1 = 'received' THEN NOW() ELSE received_at END,
          updated_at = NOW()
      WHERE order_id = $4
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      status,
      reject_reason || null,
      delivery_time || null,
      orderId
    ]);

    const updatedOrder = updateResult.rows[0];

    // Send push notification to the affected party
    try {
      let notificationTitle;
      let notificationBody;
      let recipientId;

      if (status === 'approved') {
        recipientId = order.buyer_id;
        notificationTitle = 'Pesanan Disetujui';
        notificationBody = `Pesanan #${orderId} telah disetujui oleh penjual`;
      } else if (status === 'rejected') {
        recipientId = order.buyer_id;
        notificationTitle = 'Pesanan Ditolak';
        notificationBody = `Pesanan #${orderId} ditolak. Alasan: ${reject_reason}`;
      } else if (status === 'on_delivery') {
        recipientId = order.buyer_id;
        notificationTitle = 'Pesanan Sedang Dikirim';
        notificationBody = `Pesanan #${orderId} sedang dalam pengiriman${delivery_time ? `. Estimasi: ${new Date(delivery_time).toLocaleString('id-ID')}` : ''}`;
      } else if (status === 'received') {
        recipientId = order.seller_id;
        notificationTitle = 'Pesanan Diterima';
        notificationBody = `Pesanan #${orderId} telah diterima oleh pembeli`;
      }

      if (recipientId) {
        console.log(`[Order] Sending notification to user ${recipientId}: ${notificationTitle}`);
        const notifResult = await sendOrderNotification(recipientId, notificationTitle, notificationBody, orderId);
        console.log(`[Order] Notification result:`, notifResult);
      }
    } catch (notifError) {
      console.error('[Order] Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    return res.json({
      ok: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('[Order] Error updating order status:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to update order status'
    });
  }
}

module.exports = {
  getUserOrders,
  getOrderDetails,
  updateOrderStatus
};

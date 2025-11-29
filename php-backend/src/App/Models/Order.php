<?php

namespace App\Models;

use App\Core\Database;
use PDO;
use Exception;

class Order
{
    // Order statuses
    const STATUS_WAITING_APPROVAL = 'waiting_approval';
    const STATUS_APPROVED = 'approved';
    const STATUS_ON_DELIVERY = 'on_delivery';
    const STATUS_RECEIVED = 'received';
    const STATUS_REJECTED = 'rejected';

    private static function getDB(): PDO
    {
        return Database::getInstance();
    }

    // Get all orders for a specific store with buyer information
    public static function findByStoreId(int $storeId): array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT 
                o.order_id,
                o.buyer_id,
                o.store_id,
                o.total_amount,
                o.status,
                o.shipping_address,       
                o.delivery_time,
                o.reject_reason,
                o.confirmed_at,            
                o.received_at,            
                o.created_at,
                o.updated_at,
                u.full_name as buyer_name,
                u.email as buyer_email,
                u.address as buyer_address,
                COUNT(oi.order_item_id) as item_count
            FROM orders o
            JOIN users u ON o.buyer_id = u.user_id
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.store_id = :store_id
            GROUP BY o.order_id, u.user_id  -- Simplified GROUP BY using user_id
            ORDER BY 
                CASE o.status
                    WHEN 'waiting_approval' THEN 1
                    WHEN 'approved' THEN 2
                    WHEN 'on_delivery' THEN 3
                    WHEN 'received' THEN 4
                    WHEN 'rejected' THEN 5
                END,
                o.created_at DESC
        ");
        
        $stmt->execute(['store_id' => $storeId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Find order by ID and verify it belongs to a specific store owner
    public static function findByIdAndOwner(int $orderId, int $ownerId): ?array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT 
                o.order_id, 
                o.buyer_id,
                o.store_id,
                o.status, 
                o.delivery_time, 
                o.total_amount, 
                o.reject_reason,
                o.created_at,
                o.updated_at
            FROM orders o
            JOIN stores s ON o.store_id = s.store_id
            WHERE o.order_id = :order_id
            AND s.owner_id = :owner_id
            LIMIT 1
        ");
        
        $stmt->execute([
            'order_id' => $orderId,
            'owner_id' => $ownerId
        ]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    public static function findByBuyerId(int $buyerId): array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT 
                o.order_id,
                o.buyer_id,
                o.store_id,
                o.total_amount,
                o.status,
                o.shipping_address,       
                o.delivery_time,
                o.reject_reason,
                o.confirmed_at,            
                o.received_at,            
                o.created_at,
                o.updated_at,
                s.store_name
            FROM orders o
            JOIN stores s ON o.store_id = s.store_id
            WHERE o.buyer_id = :buyer_id
            ORDER BY o.created_at DESC
        ");
        
        $stmt->execute(['buyer_id' => $buyerId]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($orders as &$order) {
            $order['items'] = self::getOrderItems($order['order_id']);
        }

        return $orders;
    }

    // Update order status to approved
    public static function approve(int $orderId): bool
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            UPDATE orders 
            SET status = 'approved',
                confirmed_at = NOW(),
                updated_at = NOW()
            WHERE order_id = :order_id
            AND status = 'waiting_approval'
        ");
        
        return $stmt->execute(['order_id' => $orderId]);
    }

    // Set delivery time and update status to on_delivery
    public static function setDeliveryTime(int $orderId, string $deliveryTime): bool
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            UPDATE orders 
            SET delivery_time = :delivery_time,
                status = 'on_delivery',
                confirmed_at = COALESCE(confirmed_at, NOW()),
                updated_at = NOW()
            WHERE order_id = :order_id
            AND status = 'approved'
        ");
        
        return $stmt->execute([
            'delivery_time' => $deliveryTime,
            'order_id' => $orderId
        ]);
    }

    // Verify if order can be approved
    public static function canBeApproved(array $order): bool
    {
        return $order['status'] === self::STATUS_WAITING_APPROVAL;
    }

    // Verify if delivery time can be set for order
    public static function canSetDeliveryTime(array $order): bool
    {
        return $order['status'] === self::STATUS_APPROVED;
    }

    public static function canBeReceived(array $order): bool
    {
        if ($order['status'] !== self::STATUS_ON_DELIVERY) {
            return false;
        }

        if (empty($order['delivery_time'])) {
            return false;
        }

        $deliveryTime = strtotime($order['delivery_time']);
        $now = time();

        return $now >= $deliveryTime;
    }

    public static function markAsReceived(int $orderId): bool
    {
        $db = self::getDB();

        $stmt = $db->prepare("
            UPDATE orders
            SET status = 'received',
                received_at = NOW(),
                updated_at = NOW()
            WHERE order_id = :order_id
            AND status = 'on_delivery'
        ");

        return $stmt->execute(['order_id' => $orderId]);
    }

    // Get order details with items
    public static function findByIdWithItems(int $orderId): ?array
    {
        $db = self::getDB();
        
        // Get order info with all new columns
        $stmt = $db->prepare("
            SELECT 
                o.order_id,
                o.buyer_id,
                o.store_id,
                o.status,
                o.total_amount,
                o.shipping_address,      
                o.delivery_time,
                o.reject_reason,
                o.confirmed_at,           
                o.received_at,          
                o.created_at,
                o.updated_at,
                u.full_name as buyer_name,
                u.email as buyer_email,
                u.address as buyer_address 
            FROM orders o
            JOIN users u ON o.buyer_id = u.user_id
            WHERE o.order_id = :order_id
        ");
        $stmt->execute(['order_id' => $orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            return null;
        }
        
        // Get order items with product details
        $order['items'] = self::getOrderItems($orderId);
        
        return $order;
    }

    // Get order statistics for a store
    public static function getStoreStats(int $storeId): array
    {
        $db = self::getDB();
        
        // Pending orders count (waiting_approval, approved, on_delivery)
        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM orders
            WHERE store_id = :store_id
            AND status IN ('waiting_approval', 'approved', 'on_delivery')
        ");
        $stmt->execute(['store_id' => $storeId]);
        $pendingOrders = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Total revenue from completed orders (received)
        $stmt = $db->prepare("
            SELECT COALESCE(SUM(total_amount), 0) as total_revenue
            FROM orders
            WHERE store_id = :store_id
            AND status = 'received'
        ");
        $stmt->execute(['store_id' => $storeId]);
        $totalRevenue = (float)$stmt->fetch(PDO::FETCH_ASSOC)['total_revenue'];

        return [
            'pending_orders' => $pendingOrders,
            'total_revenue' => $totalRevenue,
        ];
    }

    // Check if order can be rejected (only waiting_approval)
    public static function canBeRejected(array $order): bool
    {
        return $order['status'] === 'waiting_approval';
    }

    // Reject order and refund buyer balance
    public static function rejectWithRefund(int $orderId, string $rejectReason): bool
    {
        $db = self::getDB();
        
        try {
            $db->beginTransaction();

            // 1. Get order details with lock
            $stmt = $db->prepare("
                SELECT buyer_id, total_amount, status 
                FROM orders 
                WHERE order_id = :order_id
                FOR UPDATE
            ");
            $stmt->execute(['order_id' => $orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                throw new Exception('Order not found');
            }

            if ($order['status'] !== 'waiting_approval') {
                throw new Exception('Order cannot be rejected. Current status: ' . $order['status']);
            }

            // 2. Refund buyer balance
            $refundStmt = $db->prepare("
                UPDATE users 
                SET balance = balance + :amount,
                    updated_at = NOW()
                WHERE user_id = :buyer_id
            ");
            $refundResult = $refundStmt->execute([
                'amount' => $order['total_amount'],
                'buyer_id' => $order['buyer_id']
            ]);

            if (!$refundResult) {
                throw new Exception('Failed to refund buyer balance');
            }

            // 3. Update order status to rejected
            $updateStmt = $db->prepare("
                UPDATE orders 
                SET status = 'rejected',
                    reject_reason = :reason,
                    confirmed_at = NOW(),
                    updated_at = NOW()
                WHERE order_id = :order_id
                AND status = 'waiting_approval'
            ");
            $updateResult = $updateStmt->execute([
                'reason' => $rejectReason,
                'order_id' => $orderId
            ]);

            if (!$updateResult || $updateStmt->rowCount() === 0) {
                throw new Exception('Failed to update order status');
            }

            $db->commit();
            return true;

        } catch (Exception $e) {
            $db->rollBack();
            error_log("Reject order failed: " . $e->getMessage());
            throw $e;
        }
    }

    // Search orders by order ID or buyer name
    public static function searchByStoreId(int $storeId, string $query): array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT 
                o.order_id,
                o.buyer_id,
                o.store_id,
                o.status,
                o.total_amount,
                o.delivery_time,
                o.reject_reason,
                o.created_at,
                o.updated_at,
                u.full_name AS buyer_name,
                u.email AS buyer_email
            FROM orders o
            JOIN users u ON o.buyer_id = u.user_id
            WHERE o.store_id = :store_id
            AND (
                CAST(o.order_id AS TEXT) ILIKE :query
                OR u.full_name ILIKE :query
            )
            ORDER BY o.created_at DESC
        ");
        
        $searchQuery = '%' . $query . '%';
        $stmt->execute([
            'store_id' => $storeId,
            'query' => $searchQuery
        ]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get orders by store and status (for filtering/tabs)
    public static function findByStoreIdAndStatus(int $storeId, string $status): array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT 
                o.order_id,
                o.buyer_id,
                o.store_id,
                o.status,
                o.total_amount,
                o.delivery_time,
                o.reject_reason,
                o.created_at,
                o.updated_at,
                u.full_name AS buyer_name,
                u.email AS buyer_email
            FROM orders o
            JOIN users u ON o.buyer_id = u.user_id
            WHERE o.store_id = :store_id
            AND o.status = :status
            ORDER BY o.created_at DESC
        ");
        
        $stmt->execute([
            'store_id' => $storeId,
            'status' => $status
        ]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get order items with product details
    public static function getOrderItems(int $orderId): array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT 
                oi.order_item_id,
                oi.product_id,
                oi.price_at,
                oi.qty,
                oi.subtotal,
                p.name AS product_name,
                p.image_path,
                p.description
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = :order_id
            ORDER BY oi.order_item_id ASC
        ");
        
        $stmt->execute(['order_id' => $orderId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
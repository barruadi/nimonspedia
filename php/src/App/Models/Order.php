<?php

namespace App\Models;

use App\Core\Database;
use PDO;

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
                o.total_amount,
                o.status,
                o.delivery_time,
                o.created_at,
                u.full_name as buyer_name,
                u.email as buyer_email,
                COUNT(oi.order_item_id) as item_count
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            JOIN users u ON o.buyer_id = u.user_id
            WHERE p.store_id = :store_id
            GROUP BY o.order_id, o.buyer_id, o.total_amount, o.status, o.delivery_time, o.created_at, u.full_name, u.email
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
            SELECT o.order_id, o.status, o.delivery_time
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            JOIN stores s ON p.store_id = s.store_id
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

    // Update order status to approved
    public static function approve(int $orderId): bool
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            UPDATE orders 
            SET status = :status
            WHERE order_id = :order_id
        ");
        
        return $stmt->execute([
            'status' => self::STATUS_APPROVED,
            'order_id' => $orderId
        ]);
    }

    // Set delivery time and update status to on_delivery
    public static function setDeliveryTime(int $orderId, string $deliveryTime): bool
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            UPDATE orders 
            SET delivery_time = :delivery_time,
                status = :status
            WHERE order_id = :order_id
        ");
        
        return $stmt->execute([
            'delivery_time' => $deliveryTime,
            'status' => self::STATUS_ON_DELIVERY,
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

    // Get order details with items
    public static function findByIdWithItems(int $orderId): ?array
    {
        $db = self::getDB();
        
        // Get order info
        $stmt = $db->prepare("
            SELECT 
                o.*,
                u.full_name as buyer_name,
                u.email as buyer_email
            FROM orders o
            JOIN users u ON o.buyer_id = u.user_id
            WHERE o.order_id = :order_id
        ");
        $stmt->execute(['order_id' => $orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            return null;
        }
        
        // Get order items
        $stmt = $db->prepare("
            SELECT 
                oi.*,
                p.name as product_name,
                p.image_path
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = :order_id
        ");
        $stmt->execute(['order_id' => $orderId]);
        $order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return $order;
    }

    // Reject order
    public static function reject(int $orderId): bool
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            UPDATE orders 
            SET status = :status
            WHERE order_id = :order_id
        ");
        
        return $stmt->execute([
            'status' => self::STATUS_REJECTED,
            'order_id' => $orderId
        ]);
    }

    // Get order statistics for a store
    public static function getStoreStats(int $storeId): array
    {
        $db = self::getDB();
        
        // Pending orders count - FIXED: Use OR instead of IN
        $stmt = $db->prepare("
            SELECT COUNT(DISTINCT o.order_id) as total
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE p.store_id = :store_id
            AND (o.status = 'waiting_approval' OR o.status = 'approved' OR o.status = 'on_delivery')
        ");
        $stmt->execute(['store_id' => $storeId]);
        $pendingOrders = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Total revenue from completed orders
        $stmt = $db->prepare("
            SELECT COALESCE(SUM(oi.qty * oi.price_at), 0) as total_revenue
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE p.store_id = :store_id
            AND o.status = 'received'
        ");
        $stmt->execute(['store_id' => $storeId]);
        $totalRevenue = (float)$stmt->fetch(PDO::FETCH_ASSOC)['total_revenue'];

        return [
            'pending_orders' => $pendingOrders,
            'total_revenue' => $totalRevenue,
        ];
    }
}
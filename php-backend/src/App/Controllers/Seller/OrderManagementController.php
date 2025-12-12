<?php

namespace App\Controllers\Seller;

use App\Models\{Store, Order};
use Exception;

class OrderManagementController
{
    // Returns orders for the seller's store
    public static function getStoreOrders(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        $store = Store::findByOwnerId($user['user_id']);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        $orders = Order::findByStoreId($store['store_id']);
        
        // Fetch items for each order
        foreach ($orders as &$order) {
            $order['items'] = Order::getOrderItems($order['order_id']);
        }

        http_response_code(200);
        return [
            'ok' => true,
            'data' => ['orders' => $orders]
        ];
    }

    // Updates order status to approved
    public static function approveOrder(int $orderId): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        $order = Order::findByIdAndOwner($orderId, $user['user_id']);

        if (!$order) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Order not found or unauthorized'];
        }

        if (!Order::canBeApproved($order)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Order cannot be approved. Current status: ' . $order['status']];
        }

        $success = Order::approve($orderId);

        if (!$success) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to approve order'];
        }

        http_response_code(200);
        return [
            'ok' => true,
            'message' => 'Order approved successfully'
        ];
    }

    // Get detailed information about a specific order
    public static function getOrderDetail(int $orderId): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        // Verify order belongs to seller's store
        $order = Order::findByIdAndOwner($orderId, $user['user_id']);

        if (!$order) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Order not found or unauthorized'];
        }

        // Get full order details with items
        $orderDetail = Order::findByIdWithItems($orderId);

        if (!$orderDetail) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Order details not found'];
        }

        http_response_code(200);
        return [
            'ok' => true,
            'data' => ['order' => $orderDetail]
        ];
    }

    // Updates order status to rejected and refund buyer funds
    public static function rejectOrder(int $orderId, string $rejectReason): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        // Validate reject reason
        if (empty(trim($rejectReason))) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Reject reason is required'];
        }

        $order = Order::findByIdAndOwner($orderId, $user['user_id']);

        if (!$order) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Order not found or unauthorized'];
        }

        if (!Order::canBeRejected($order)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Order cannot be rejected. Current status: ' . $order['status']];
        }

        // Reject order with refund
        try {
            $success = Order::rejectWithRefund($orderId, $rejectReason);

            // Check if operation was successful
            if (!$success) {
                throw new Exception('Failed to reject order in database');
            }

            http_response_code(200);
            return [
                'ok' => true,
                'message' => 'Order rejected and buyer refunded successfully'
            ];
        } catch (Exception $e) {
            error_log("Reject order controller error: " . $e->getMessage());
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to reject order: ' . $e->getMessage()];
        }
    }

    // Updates order delivery time
    public static function setDeliveryTime(int $orderId, int $deliveryDays): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        // Validate delivery days
        if ($deliveryDays < 0 || $deliveryDays > 30) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Delivery days must be between 1 and 30'];
        }

        $order = Order::findByIdAndOwner($orderId, $user['user_id']);

        if (!$order) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Order not found or unauthorized'];
        }

        if (!Order::canSetDeliveryTime($order)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Delivery time can only be set for approved orders. Current status: ' . $order['status']];
        }

        // Calculate delivery time (NOW + days) in PostgreSQL TIMESTAMPTZ format
        $deliveryTime = date('Y-m-d H:i:sP', strtotime("+{$deliveryDays} days"));
        
        $success = Order::setDeliveryTime($orderId, $deliveryTime);

        if (!$success) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to set delivery time'];
        }

        http_response_code(200);
        return [
            'ok' => true,
            'message' => 'Delivery time set successfully',
            'data' => [
                'delivery_time' => $deliveryTime,
                'delivery_days' => $deliveryDays
            ]
        ];
    }
}
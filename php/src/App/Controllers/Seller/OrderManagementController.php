<?php

namespace App\Controllers\Seller;

use App\Models\Store;
use App\Models\Order;

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

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'store' => [
                    'store_id' => $store['store_id'],
                    'store_name' => $store['store_name'],
                    'description' => $store['description'] ?? null,
                    'logo_path' => $store['logo_path'] ?? null,
                ],
                'orders' => $orders,
            ]
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

    // Updates order delivery time
    public static function setDeliveryTime(int $orderId, string $deliveryTime): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        // Validate delivery time
        if (empty($deliveryTime)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Delivery time is required'];
        }

        $order = Order::findByIdAndOwner($orderId, $user['user_id']);

        if (!$order) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Order not found or unauthorized'];
        }

        if (!Order::canSetDeliveryTime($order)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Delivery time can only be set for approved orders'];
        }

        $success = Order::setDeliveryTime($orderId, $deliveryTime);

        if (!$success) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to set delivery time'];
        }

        http_response_code(200);
        return [
            'ok' => true,
            'message' => 'Delivery time set successfully'
        ];
    }
}
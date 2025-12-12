<?php

namespace App\Controllers\Buyer;

use App\Models\Order;
use App\Models\Store;
use App\Services\NotificationService;
use Exception;

class OrderController
{
    public function showHistory(array $req): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;

        if (!$user) {
            http_response_code(401);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $buyerId = $user['user_id'];

        $orders = Order::findByBuyerId($buyerId);

        // Add review status for each product in each order
        foreach ($orders as &$order) {
            foreach ($order['items'] as &$item) {
                // Check if this product has been reviewed for this order
                $item['can_review'] = \App\Models\Review::canReview(
                    $order['order_id'],
                    $item['product_id'],
                    $buyerId
                );

                // Only products from received orders can be reviewed
                $item['show_review_button'] = $order['status'] === 'received' && $item['can_review'];
            }
        }

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'orders' => $orders
            ]
        ];
    }

    public function markAsReceived(array $req): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;

        if (!$user) {
            http_response_code(401);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $orderId = $req['body']['order_id'] ?? null;

        if (!$orderId) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Order ID is required'];
        }

        $orders = Order::findByBuyerId($user['user_id']);
        $order = null;

        foreach ($orders as $o) {
            if ($o['order_id'] == $orderId) {
                $order = $o;
                break;
            }
        }

        if (!$order) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Order not found or unauthorized'];
        }

        // Check apakah order dapat diterima (received)
        if (!Order::canBeReceived($order)) {
            http_response_code(400);
            return [
                'ok' => false,
                'error' => 'Order belum bisa dikonfirmasi. Tunggu hingga waktu pengiriman tercapai.'
            ];
        }

        // Tandai sebagai received dan transfer uang ke seller
        $success = Order::markAsReceived($orderId);

        if (!$success) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'Gagal mengkonfirmasi penerimaan barang'];
        }

        // Send push notification to seller
        try {
            $store = Store::findById($order['store_id']);
            if ($store) {
                $sellerId = $store['owner_id'];
                NotificationService::sendOrderNotification(
                    $sellerId,
                    'Order Received',
                    "Order #{$orderId} has been received by the buyer",
                    $orderId
                );
                error_log("[OrderController] Sent received notification to seller {$sellerId} for order {$orderId}");
            }
        } catch (Exception $notifErr) {
            error_log("[OrderController] Failed to send received notification: " . $notifErr->getMessage());
            // Don't fail the request if notification fails
        }

        http_response_code(200);
        return [
            'ok' => true,
            'message' => 'Penerimaan barang berhasil dikonfirmasi'
        ];
    }
}
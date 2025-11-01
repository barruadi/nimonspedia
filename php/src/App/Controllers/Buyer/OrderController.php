<?php

namespace App\Controllers\Buyer;

use App\Models\Order;

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

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'orders' => $orders
            ]
        ];
    }
}
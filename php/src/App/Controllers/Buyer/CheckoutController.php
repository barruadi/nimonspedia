<?php

namespace App\Controllers\Buyer;

use App\Core\View;
use App\Models\Cart;

class CheckoutController
{
    public function showCheckout(): void
    {
        if (!isset($_SESSION['user'])) {
            header('location: /login');
            exit;
        }

        $user_id = $_SESSION['user']['user_id'];

        $cart_items = Cart::getByUserId($user_id);
        $summary = Cart::getSummary($user_id);

        View::render('CheckoutView.php', [
            'cartItems' => $cart_items,
            'summary' => $summary,
            'user' => $_SESSION['user']
        ]);

        return;
    }
    
    public function confirmOrder(): array
    {
        if (!isset($_SESSION['user'])) {
            header('Location: /login');
            exit;
        }

        $userId = $_SESSION['user']['user_id'];

        // 1. load cart from DB
        $snapshot = Cart::getSnapshot($userId);
        $items = $snapshot['items'];
        $total = $snapshot['summary']['total'];
        
        if ($_SESSION['user']['balance'] < $total) {
            return [
                'ok' => false,
                'error' => 'balance not enough'
            ];
        }

        // [TODO]: masukin order ke order history
        

        // 3. clear cart
        Cart::clear($userId);

        // 4. redirect
        header("Location: /checkout/success?order_id=".$userId);
        exit;
    }
    
    public function successPage(): void {
        $orderId = $_GET['order_id'] ?? null;
        // [TODO]: sesuaiin kalau udah ada order
        // $order   = Order::findByIdAndUser($orderId, $_SESSION['user']['user_id']);

        View::render('CheckoutSuccess.php', [
            // 'order' => $order,
            'user'  => $_SESSION['user'],
        ]);
    }
}
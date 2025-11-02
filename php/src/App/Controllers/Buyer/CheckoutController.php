<?php

namespace App\Controllers\Buyer;

use App\Core\View;
use App\Models\{Cart, User, Order};

class CheckoutController
{
    public function saveSelection($req): array
    {
        $uid = $_SESSION['user']['user_id'] ?? null;
        if (!$uid) {
            return [];
        }

        $items = $req['body']['items'] ?? [];
        if (!is_array($items) || empty($items)) {
            return [];
        }

        // Optional: ensure each (pid, qty) exists in user's cart
        $legal = Cart::validateSelection($uid, $items);
        
        if ($legal['ok'] === false) {
            return [];
        };

        $_SESSION['checkout_selection'] = $legal['items']; // normalized {product_id, qty}
        return [
            'ok' => true
        ];
    }
    
    public function showCheckout(): void
    {
        if (!isset($_SESSION['user'])) {
            header('location: /login');
            exit;
        }

        $user_id = $_SESSION['user']['user_id'];
        
        $sel = $_SESSION['checkout_selection'] ?? [];

        $cart_items = Cart::getByUserId($user_id);
        $summary = Cart::getSummary($user_id);
        
        $snapshot = Cart::snapshotSelection($sel);

        View::render('CheckoutView.php', [
            'title'       => 'Checkout',
            'items'       => $snapshot['items'],
            'summary'     => $snapshot['summary'],
            'sessionUser' => $_SESSION['user'] ?? null,
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
        $sel = $_SESSION['checkout_selection'] ?? [];

        $snapshot = Cart::snapshotSelection($sel);
        $items = $snapshot['items'];
        $total = $snapshot['summary']['total'];

        $user_balance = User::getBalance($userId);
        
        if ($user_balance < $total) {
            return [
                'ok' => false,
                'error' => 'balance not enough'
            ];
        }
        
        // $result = Order::createFromCartSelection($userId, $snapshot, "dsadsa"); 

        $ok = Cart::finalizeOrderFromSelection($userId, $sel, "dsadsa");
        
        if (!$ok['ok']) {
            $_SESSION['flash'] = $ok['error'] ?? 'Gagal checkout';
            header('Location: /cart'); exit;
        }
        
        unset($_SESSION['checkout_selection']);

        // 3. clear cart
        
        
        // Set the balance
        User::setBalance((int) floor($user_balance - $total), $userId);

        // 4. redirect
        header("Location: /checkout/success?order_id=".$userId);
        exit;
    }
    
    public function successPage(): void {
        $user = $_SESSION['user'] ?? null;
        if (!$user) { header('Location: /login'); exit; }
    
        $ids = isset($_GET['order_id']) ? explode(',', $_GET['order_id']) : [];
        $ids = array_values(array_filter(array_map('intval', $ids)));
    
        // if (!$ids) { header('Location: /orders'); exit; }
    
        // Load orders (and items) by ID, verify they belong to this buyer:
        $orders = [];
        $grand  = 0.0;
        foreach ($ids as $oid) {
            $o = Order::findByIdWithItems($oid);
            if (!$o || (int)$o['buyer_id'] !== (int)$user['user_id']) continue;
            $orders[] = [
                'order_id'   => $o['order_id'],
                'store_name' => $o['store_name'] ?? null,
                'total'      => $o['total_amount'] ?? 0,
                'items'      => array_map(fn($it)=>[
                    'name'  => $it['product_name'],
                    'qty'   => (int)$it['qty'],
                    'price' => (float)$it['price_at'],
                ], $o['items'] ?? []),
            ];
            $grand += (float)($o['total_amount'] ?? 0);
        }
    
        // if (!$orders) { header('Location: /orders'); exit; }
    
        View::render('CheckoutSuccess.php', [
            'user'   => ['name'=>$user['full_name'], 'email'=>$user['email']],
            'orders' => $orders,
            'total'  => $grand,
        ]);
    }
}
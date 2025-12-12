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
        if (!isset($_SESSION['user'])) { header('location: /login'); exit; }
        
        $user   = $_SESSION['user'];
        $userId = (int)$user['user_id'];
    
        // selection prepared by saveSelection()
        $sel      = $_SESSION['checkout_selection'] ?? [];
        $snapshot = Cart::snapshotSelection($sel);
    
        $items   = $snapshot['items'] ?? [];
        $summary = $snapshot['summary'] ?? ['subtotal'=>0,'shipping'=>0,'total'=>0];
    
        // ---- group by store for left column + per-store lines for summary
        $groups = [];                // [store_id => ['store_name','items'=>[], 'subtotal'=>int, 'count'=>int]]
        foreach ($items as $it) {
            $sid = (int)$it['store_id'];
            if (!isset($groups[$sid])) {
                $groups[$sid] = [
                    'store_name' => $it['store_name'] ?: 'Toko',
                    'items'      => [],
                    'subtotal'   => 0,
                    'count'      => 0,
                ];
            }
            $groups[$sid]['items'][] = $it;
            $groups[$sid]['subtotal'] += ((int)$it['price']) * (int)$it['qty'];
            $groups[$sid]['count']    += (int)$it['qty'];
        }
    
        // wallet & address from session user (adjust if you load from DB)
        $address = (string)($user['address'] ?? '');
        $balance = (int)  ($user['balance'] ?? 0);
    
        $totalItems   = array_sum(array_column($groups, 'count')) ?: 0;
        $grandTotal   = (int)($summary['total'] ?? 0);
        $afterBalance = $balance - $grandTotal;
        $canCheckout  = $grandTotal > 0 && $afterBalance >= 0;
    
        View::render('CheckoutView.php', [
            'title'        => 'Checkout',
            'groups'       => $groups,
            'summary'      => $summary,
            'address'      => $address,
            'balance'      => $balance,
            'totalItems'   => $totalItems,
            'afterBalance' => $afterBalance,
            'canCheckout'  => $canCheckout,
        ]);

        return;
    }
    
    public function confirmOrder($req): array
    {
        if (!isset($_SESSION['user'])) { header('Location: /login'); exit; }

        $userId = (int)$_SESSION['user']['user_id'];
        $sel    = $_SESSION['checkout_selection'] ?? [];

        $snapshot     = Cart::snapshotSelection($sel);
        $total        = (int)($snapshot['summary']['total'] ?? 0);

        $address = $_POST['address'] ?? null;

        // Create order WITHOUT deducting balance
        // Payment will be handled by Midtrans payment gateway
        $result = Cart::finalizeOrderFromSelection($userId, $sel, $address);
        if (!$result['ok']) {
            $_SESSION['flash'] = $result['error'] ?? 'Gagal checkout';
            header('Location: /cart'); exit;
        }

        unset($_SESSION['checkout_selection']);

        // Collect created order ids
        $orderIds = array_map(fn($o)=>(int)$o['order_id'], $result['orders'] ?? []);

        // Store order IDs in session for payment page
        $_SESSION['pending_payment_orders'] = $orderIds;

        // Redirect to payment page instead of success page
        // The payment page will call Node.js API to create Midtrans payment
        $qs = $orderIds ? implode(',', $orderIds) : '';
        header('Location: /checkout/payment'.($qs ? '?order_id='.$qs : ''));
        exit;
    }
    
    public function paymentPage(): void {
        $user = $_SESSION['user'] ?? null;
        if (!$user) { header('Location: /login'); exit; }

        $ids = isset($_GET['order_id']) ? explode(',', $_GET['order_id']) : [];
        $ids = array_values(array_filter(array_map('intval', $ids)));

        if (!$ids) { header('Location: /orders'); exit; }

        // Load orders to display
        $orders = [];
        $grandTotal = 0;
        foreach ($ids as $oid) {
            $o = Order::findByIdWithItems($oid);
            if (!$o || (int)$o['buyer_id'] !== (int)$user['user_id']) continue;
            $orders[] = [
                'order_id'   => $o['order_id'],
                'store_name' => $o['store_name'] ?? 'Toko',
                'total'      => $o['total_amount'] ?? 0,
                'items'      => $o['items'] ?? [],
            ];
            $grandTotal += (int)($o['total_amount'] ?? 0);
        }

        if (!$orders) { header('Location: /orders'); exit; }

        View::render('CheckoutPayment.php', [
            'user'         => $user,
            'orders'       => $orders,
            'total'        => $grandTotal,
            'first_order_id' => $ids[0] ?? null
        ]);
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
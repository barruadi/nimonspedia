<?php
namespace App\Controllers\Buyer;

use App\Models\Cart;
use App\Models\Product;

class CartController
{
    public function addItemToCart($req)
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'buyer') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Hanya buyer yang bisa menambah keranjang'];
        }

        $productId = $req['body']['product_id'] ?? null;
        $qty = (int)($req['body']['qty'] ?? 0);

        if (!$productId || $qty <= 0) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Data produk tidak valid'];
        }

        $product = Product::findById($productId);
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Produk tidak ditemukan'];
        }
        
        if ($product['stock'] < $qty) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Stok produk tidak mencukupi'];
        }

        try {
            $buyerId = $user['user_id'];

            $cart = Cart::findOrCreateByBuyerId($buyerId);

            if (!$cart || !isset($cart['cart_id'])) {
                throw new \Exception('Gagal menemukan atau membuat keranjang untuk user ' . $buyerId);
            }

            Cart::addItem($cart['cart_id'], $productId, $qty);

            http_response_code(200);
            return ['ok' => true, 'message' => 'Produk ditambahkan ke keranjang'];

        } catch (\Exception $e) {
            error_log('Cart Error: ' . $e->getMessage()); 
            
            http_response_code(500);
            return ['ok' => false, 'error' => 'Server error: ' . $e->getMessage()];
        }
    }
}
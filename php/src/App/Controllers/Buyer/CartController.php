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
        $qty = (int) ($req['body']['qty'] ?? 0);

        if (!$productId || $qty <= 0) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Data produk tidak valid'];
        }

        $product = Product::findById($productId);
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Produk tidak ditemukan'];
        }

        try {
            $buyerId = $user['user_id'];
            $cart = Cart::findOrCreateByBuyerId($buyerId);

            if (!$cart || !isset($cart['cart_id'])) {
                throw new \Exception('Gagal menemukan atau membuat keranjang untuk user ' . $buyerId);
            }

            $currentInCart = Cart::getCurrentQty($cart['cart_id'], $productId);
            $newTotalQty = $currentInCart + $qty;
            $stock = (int)$product['stock'];

            if ($stock < $newTotalQty) {
                http_response_code(400);
                $remaining = $stock - $currentInCart;
                $canAdd = $remaining > 0 ? $remaining : 0;
                return [
                    'ok' => false, 
                    'error' => "Stok tidak mencukupi. Sisa stok: $stock. \nAnda sudah punya $currentInCart di keranjang. \nAnda hanya bisa menambah $canAdd item lagi."
                ];
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

    public function addProduct($req): array
    {
        $user_id = $_SESSION['user']['user_id'];
        
        $product_id = (int) $req['body']['product_id'];
        $qty = (int) $req['body']['qty'] ?? 1;
        
        // [ TODO ]: harusnya validasi product id valid atau ngga ke db
        if ($product_id <= 0 || $qty === 0) {
            return [
                'ok' => false,
                'error' => 'invalid params'
            ];
        }

        Cart::add($user_id, $product_id);
        Cart::syncWithStock($user_id);

        $snap = Cart::getSnapshot($user_id);
        return [
            'ok' => true,
            'snap' => $snap
        ];
    }
    
    public function setQuantity($req): array
    {
        $user_id = $_SESSION['user']['user_id'];
        
        $product_id = (int) $req['body']['product_id'];
        $qty = (int) $req['body']['qty'];

        Cart::setQuantity($user_id, $product_id, $qty);
        Cart::syncWithStock($user_id);
        
        $snap = Cart::getSnapshot($user_id);
        return [
            'ok' => true,
            'snap' => $snap
        ];
    }
    
    public function removeProduct($req): array
    {
        $product_id = (int) $req['body']['product_id'];
        $qty = (int) $req['body']['qty'] ?? 1;

        // [ TODO ]: harusnya validasi product id valid atau ngga ke db
        if ($product_id <= 0 || $qty === 0) {
            return [
                'ok' => false,
                'error' => 'invalid params'
            ];
        }
        
        $newQty = Cart::reduceProduct($product_id, $qty);
        return [
            'ok' => true,
            'newQty' => $newQty
        ];
    }
    
    public function clearCart(): array
    {
        $user_id = $_SESSION['user']['user_id'];

        Cart::clear($user_id);

        return [
            'ok' => true,
            'items' => [],
            'summary' => [
                'subtotal' => 0,
                'shipping' => 0,
                'total' => 0
            ]
        ];
    }
    
    public function showCart(): array
    {
        $user_id = $_SESSION['user']['user_id'];
        $snap = Cart::getSnapshot($user_id);

        return [
            'ok' => true,
            'cart' => $snap
        ];
    }
}
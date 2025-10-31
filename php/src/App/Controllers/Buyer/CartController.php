<?php

namespace App\Controllers\Buyer;

use App\Models\Cart;

class CartController
{
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
}
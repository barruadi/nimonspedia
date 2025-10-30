<?php

namespace App\Models;

use App\Core\Database;

class Cart
{
    public function addProduct(int $cart_id, int $product_id, int $qty = 1): bool
    {
        $query = "
            INSERT INTO cart_items (cart_id, product_id, qty)
            VALUES (:cart_id, :product_id, :qty)
            ON CONFLICT (cart_id, product_id)
            DO UPDATE
            SET qty = cart_items.qty + EXCLUDED.qty,
                updated_at = NOW()
            RETURNING cart_item_id, cart_id, product_id, qty;
        ";
        
        $row = Database::fetchOne($query, [
            ':cart_id'   => $cart_id,
            'product_id' => $product_id,
            'qty'        => $qty
        ]);
        return $row ?? [];
    }
    
    public function calculatePrice(): float
    {
        
    }
    
    public function uniqueProduct(int $cart_id): int
    {
        $query = "
            SELECT COUNT(*)
            FROM cart_items ci
            JOIN carts c ON c.cart_id = ci.cart_id
            WHERE c.buyer_id = :user_id
        ";
        
        $row = Database::fetchOne($query, [
            
        ]);
        
    }
    
    public function 
}
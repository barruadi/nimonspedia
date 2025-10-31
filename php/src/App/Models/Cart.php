<?php
namespace App\Models;

use App\Core\Database;
use PDO;

class Cart
{
    private static function getDB(): PDO
    {
        return Database::getInstance();
    }

    public static function findByBuyerId(int $buyerId): ?array
    {
        $sql = "SELECT * FROM carts WHERE buyer_id = :buyer_id LIMIT 1";
        return Database::fetchOne($sql, ['buyer_id' => $buyerId]);
    }

    public static function create(int $buyerId): ?array
    {
        $sql = "INSERT INTO carts (buyer_id) VALUES (:buyer_id) RETURNING *";
        return Database::fetchOne($sql, ['buyer_id' => $buyerId]);
    }

    public static function findOrCreateByBuyerId(int $buyerId): ?array
    {
        $cart = self::findByBuyerId($buyerId);
        if ($cart) {
            return $cart;
        }
        return self::create($buyerId);
    }
    
    public static function addItem(int $cartId, int $productId, int $qty)
    {
        $sql = "
            INSERT INTO cart_items (cart_id, product_id, qty)
            VALUES (:cart_id, :product_id, :qty)
            ON CONFLICT (cart_id, product_id)
            DO UPDATE SET 
                qty = cart_items.qty + EXCLUDED.qty,
                updated_at = NOW()
        ";
        
        return Database::executeQuery($sql, [
            'cart_id' => $cartId,
            'product_id' => $productId,
            'qty' => $qty
        ]);
    }
}
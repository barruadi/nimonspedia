<?php

namespace App\Models;

use App\Core\Database;
use PDO;
use PDOException;

class Cart
{
    private static function db(): PDO
        {
            return Database::getInstance();
        }
    
        public static function getByUserId(int $userId): array
        {
            $cartId = self::getCardByUserId($userId);
            
            $sql = "
                SELECT
                    ci.product_id,
                    ci.qty,
                    p.name,
                    p.price,
                    p.stock,
                    p.image_path,
                    p.store_id,
                    s.store_name,
                    (ci.qty * p.price) AS line_total
                FROM cart_items ci
                JOIN products p ON p.product_id = ci.product_id
                LEFT JOIN stores  s ON s.store_id = p.store_id
                WHERE ci.cart_id = :cartId
                ORDER BY ci.updated_at DESC, ci.created_at DESC
            ";
            $stmt = self::db()->prepare($sql);
            $stmt->execute(['cartId' => $cartId]);
        
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
    
        public static function getSummary(int $userId): array
        {
            $cartId = self::getCardByUserId($userId);
            
            $sql = "
                SELECT COALESCE(SUM(ci.qty * p.price), 0) AS subtotal
                FROM cart_items ci
                JOIN products p ON p.product_id = ci.product_id
                WHERE ci.cart_id = :cartId
            ";
            $stmt = self::db()->prepare($sql);
            $stmt->execute(['cartId' => $cartId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['subtotal' => 0];
        
            $subtotal = (float)$row['subtotal'];
        
            $hasItems = self::countItems($userId) > 0;
            $shipping = 0.0;
        
            return [
                'subtotal' => $subtotal,
                'shipping' => $shipping,
                'total'    => $subtotal + $shipping,
            ];
        }
    
        public static function add(int $userId, int $productId, int $qty = 1): bool
        {
            $cartId = self::getCardByUserId($userId);
            
            if ($qty <= 0) return true;
            $sql = "
                INSERT INTO cart_items (cart_id, product_id, qty, created_at, updated_at)
                VALUES (:cid, :pid, :qty, NOW(), NOW())
                ON CONFLICT (cart_id, product_id)
                DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty,
                              updated_at = NOW()
            ";
            $stmt = self::db()->prepare($sql);
            return $stmt->execute(['cid' => $cartId, 'pid' => $productId, 'qty' => $qty]);
        }
        
        public static function getCardByUserId(int $userId): int
        {
            $sql = "
                INSERT INTO carts (buyer_id, created_at, updated_at)
                VALUES (:uid, NOW(), NOW())
                ON CONFLICT (buyer_id)
                DO UPDATE SET updated_at = EXCLUDED.updated_at
                RETURNING cart_id
            ";
        
            $stmt = self::db()->prepare($sql);
            $stmt->execute(['uid' => $userId]);
            $id = $stmt->fetchColumn();
        
            if ($id === false) {
                throw new \RuntimeException('Failed to obtain cart_id');
            }
            return (int)$id;
        }
    
        public static function setQuantity(int $userId, int $productId, int $qty): bool
        {
            if ($qty <= 0) {
                return self::remove($userId, $productId);
            }
            $sql = "
                UPDATE cart_items
                SET qty = :qty, updated_at = NOW()
                WHERE user_id = :uid AND product_id = :pid
            ";
            $stmt = self::db()->prepare($sql);
            return $stmt->execute(['qty' => $qty, 'uid' => $userId, 'pid' => $productId]);
        }
    
        public static function remove(int $userId, int $productId): bool
        {
            $stmt = self::db()->prepare("
                DELETE FROM cart_items
                WHERE user_id = :uid AND product_id = :pid
            ");
            return $stmt->execute(['uid' => $userId, 'pid' => $productId]);
        }
        
        public static function hasSufficientStock(int $productId, int $qty): bool
        {
            $stmt = self::db()->prepare("
                SELECT stock >= :qty AS ok
                  FROM products
                 WHERE product_id = :pid
            ");
            $stmt->execute([':pid' => $productId, ':qty' => $qty]);
            $ok = $stmt->fetchColumn();
            return (bool)$ok;
        }
        
        public static function reduceProduct(int $productId, int $qty)
        {
            if ($qty <= 0) {
                throw new \InvalidArgumentException('qty must be > 0');
            }
            
            if (!self::hasSufficientStock($productId, $qty)) {
                return null;
            }
    
            $sql = "
                UPDATE products
                    SET stock = stock - :qty,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE product_id = :pid
                    AND stock >= :qty
                RETURNING stock
            ";
    
            $stmt = self::db()->prepare($sql);
            $stmt->bindValue(':pid', $productId, PDO::PARAM_INT);
            $stmt->bindValue(':qty', $qty, PDO::PARAM_INT);
    
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
            return $row ? (int)$row['stock'] : null;
        }
    
        public static function clear(int $userId): bool
        {
            $cartId = self::getCardByUserId($userId);
            $stmt = self::db()->prepare("DELETE FROM cart_items WHERE cart_id = :cid");
            return $stmt->execute(['cid' => $cartId]);
        }
    
        public static function countItems(int $userId): int
        {
            $cartId = self::getCardByUserId($userId);
            $stmt = self::db()->prepare("SELECT COUNT(*) FROM cart_items WHERE cart_id = :cartId");
            $stmt->execute(['cartId' => $cartId]);
            return (int)$stmt->fetchColumn();
        }
    
        public static function syncWithStock(int $userId): array
        {
            $db = self::db();
            $removed  = [];
            $adjusted = [];
        
            $cartId = self::getCardByUserId($userId);
        
            $db->beginTransaction();
            try {
                // Lock current cart lines while we reconcile with stock
                $stmt = $db->prepare("
                    SELECT ci.product_id, ci.qty, p.stock
                    FROM cart_items ci
                    JOIN products p ON p.product_id = ci.product_id
                    WHERE ci.cart_id = :cartId
                    FOR UPDATE
                ");
                $stmt->execute(['cartId' => $cartId]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
                // Prepare UPDATE / DELETE once
                $upd = $db->prepare("
                    UPDATE cart_items
                        SET qty = :q, updated_at = NOW()
                        WHERE cart_id = :cartId AND product_id = :pid
                ");
                $del = $db->prepare("
                    DELETE FROM cart_items
                        WHERE cart_id = :cartId AND product_id = :pid
                ");
        
                foreach ($rows as $r) {
                    $pid   = (int)$r['product_id'];
                    $qty   = (int)$r['qty'];
                    $stock = (int)$r['stock'];
        
                    if ($stock <= 0) {
                        // Remove line entirely
                        $del->execute(['cartId' => $cartId, 'pid' => $pid]);
                        $removed[] = $pid;
                        continue;
                    }
        
                    if ($qty > $stock) {
                        // Clamp to available stock
                        $upd->execute(['q' => $stock, 'cartId' => $cartId, 'pid' => $pid]);
                        $adjusted[] = [
                            'product_id' => $pid,
                            'old_qty'    => $qty,
                            'new_qty'    => $stock,
                        ];
                    }
                }
        
                $db->commit();
            } catch (PDOException $e) {
                $db->rollBack();
                throw $e;
            }
        
            return ['removed' => $removed, 'adjusted' => $adjusted];
        }
    
        /**
         * Helper to compute a fresh detailed summary (items + totals) in one call.
         * Useful for API responses after an update.
         */
        public static function getSnapshot(int $userId): array
        {
            return [
                'items'   => self::getByUserId($userId),
                'summary' => self::getSummary($userId),
            ];
        }
}
<?php

namespace App\Models;

use App\Core\Database;
use PDO;
use PDOException;

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
    
    public static function getCurrentQty(int $cartId, int $productId): int
    {
        $sql = "SELECT qty FROM cart_items WHERE cart_id = :cart_id AND product_id = :product_id";
        $row = Database::fetchOne($sql, ['cart_id' => $cartId, 'product_id' => $productId]);
        return $row ? (int)$row['qty'] : 0;
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
            UPDATE cart_items ci
            SET qty = :qty,
                updated_at = NOW()
            FROM carts c
            WHERE ci.cart_id  = c.cart_id
            AND c.buyer_id  = :uid
            AND ci.product_id = :pid;
        ";
        $stmt = self::db()->prepare($sql);
        return $stmt->execute(['qty' => $qty, 'uid' => $userId, 'pid' => $productId]);
    }

    public static function remove(int $userId, int $productId): bool
    {
        $stmt = self::db()->prepare("
            DELETE FROM cart_items ci
            USING carts c
            WHERE ci.cart_id   = c.cart_id
            AND c.buyer_id   = :uid
            AND ci.product_id = :pid;
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
    
    public static function validateSelection(int $userId, array $items): array
    {
        $cartId = self::getCardByUserId($userId);

        $want = [];
        foreach ($items as $it) {
            $pid = (int)($it['product_id'] ?? 0);
            $qty = max(1, (int)($it['qty'] ?? 1));
            if ($pid <= 0) continue;
            $want[$pid] = $qty; // dedupe by pid
        }
        if (!$want) return ['ok'=>false, 'error'=>'invalid selection'];

        $in = implode(',', array_fill(0, count($want), '?'));
        
        $sql = "
            SELECT product_id 
            FROM cart_items 
            WHERE cart_id = ? AND product_id IN ($in)
        ";
        
        $params = array_merge([$cartId], array_keys($want));
        $st = self::db()->prepare($sql);
        $st->execute($params);
        $existing = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));

        if (!$existing) return ['ok'=>false, 'error'=>'items not in cart'];

        $valid = [];
        foreach ($existing as $pid) {
            $valid[] = ['product_id'=>$pid, 'qty'=>$want[$pid]];
        }
        return ['ok'=>true, 'items'=>$valid];
    }

    /**
        * Build a fresh snapshot of selected items (name/price/stock) and totals.
        * Clamps qty by current stock; drops lines with 0 stock.
        */
    public static function snapshotSelection(array $sel): array
    {
        $db = self::db();
        if (empty($sel)) {
            return ['items'=>[], 'summary'=>['subtotal'=>0,'shipping'=>0,'total'=>0]];
        }

        $pids = array_map(fn($i)=>(int)$i['product_id'], $sel);
        $qtys = array_column($sel, 'qty', 'product_id');

        $in = implode(',', array_fill(0, count($pids), '?'));
        $st = $db->prepare("
            SELECT p.product_id, p.store_id, p.name, p.price, p.stock, p.image_path, s.store_name
                FROM products p
                LEFT JOIN stores s ON s.store_id = p.store_id
                WHERE p.product_id IN ($in)
        ");
        $st->execute($pids);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        $items = []; $sub = 0.0;
        foreach ($rows as $r) {
            $pid    = (int)$r['product_id'];
            $wanted = (int)($qtys[$pid] ?? 1);
            $qty    = max(1, min($wanted, (int)$r['stock']));
            if ($qty <= 0) continue;

            $price = (float)$r['price'];
            $items[] = [
                'product_id' => $pid,
                'store_id'   => (int)$r['store_id'],
                'name'       => $r['name'],
                'price'      => $price,
                'qty'        => $qty,
                'image_path' => $r['image_path'],
                'store_name' => $r['store_name'] ?? '',
            ];
            $sub += $price * $qty;
        }

        $shipping = 0.0;
        return [
            'items'   => $items,
            'summary' => ['subtotal'=>$sub, 'shipping'=>$shipping, 'total'=>$sub+$shipping]
        ];
    }

    /**
        * Finalize order from selection:
        *  - recheck & decrement stock atomically
        *  - remove those items from user's cart
        * (Create orders/order_items here when you’re ready.)
        */
    public static function finalizeOrderFromSelection(int $userId, array $sel, string $shippingAddress): array
    {
        $db = self::db();
        $cartId = self::getCardByUserId($userId);
    
        if ($shippingAddress === null) {
            $adrStmt = $db->prepare("SELECT address FROM users WHERE user_id = :uid");
            $adrStmt->execute(['uid'=>$userId]);
            $shippingAddress = (string)($adrStmt->fetchColumn() ?: '');
        }
    
        $snap = self::snapshotSelection($sel);
        if (empty($snap['items'])) {
            return ['ok'=>false, 'error'=>'stok tidak mencukupi atau keranjang kosong'];
        }
    
        // Group items by store
        $byStore = [];
        foreach ($snap['items'] as $it) {
            $sid = (int)$it['store_id'];
            $byStore[$sid][] = $it;
        }
    
        $ordersCreated = [];
    
        $db->beginTransaction();
        try {
            // 1) Lock-in stock and remove from cart
            $upd = $db->prepare("
                UPDATE products
                SET stock = stock - :q, updated_at = NOW()
                WHERE product_id = :pid AND stock >= :q
            ");
    
            $delCart = $db->prepare("
                DELETE FROM cart_items
                WHERE cart_id = :cid AND product_id = :pid
            ");
    
            foreach ($snap['items'] as $it) {
                $pid = (int)$it['product_id'];
                $qty = (int)$it['qty'];
    
                $upd->execute(['q'=>$qty, 'pid'=>$pid]);
                if ($upd->rowCount() === 0) {
                    throw new \RuntimeException("Stok berubah untuk produk #$pid, silakan ulangi.");
                }
    
                $delCart->execute(['cid'=>$cartId, 'pid'=>$pid]);
            }
    
            // 2) Create orders per store
            $orderIns = $db->prepare("
                INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address)
                VALUES (:buyer_id, :store_id, 'waiting_approval', :total_amount, :shipping_address)
                RETURNING order_id
            ");
    
            $oiIns = $db->prepare("
                INSERT INTO order_items (order_id, product_id, price_at, qty)
                VALUES (:order_id, :product_id, :price_at, :qty)
            ");
    
            foreach ($byStore as $storeId => $items) {
                // Compute total per store
                $total = 0.0;
                foreach ($items as $it) {
                    $total += ((float)$it['price']) * (int)$it['qty'];
                }
    
                // Insert order
                $orderIns->execute([
                    'buyer_id'         => $userId,
                    'store_id'         => $storeId,
                    'total_amount'     => $total,
                    'shipping_address' => $shippingAddress,
                ]);
                $orderId = (int)$orderIns->fetchColumn();
    
                // Insert order_items
                foreach ($items as $it) {
                    $oiIns->execute([
                        'order_id'   => $orderId,
                        'product_id' => (int)$it['product_id'],
                        'price_at'   => (float)$it['price'],
                        'qty'        => (int)$it['qty'],
                    ]);
                }
    
                $ordersCreated[] = [
                    'order_id'   => $orderId,
                    'store_id'   => $storeId,
                    'status'     => 'waiting_approval',
                    'total'      => $total,
                    'items'      => array_map(fn($x) => [
                        'product_id' => (int)$x['product_id'],
                        'name'       => $x['name'],
                        'qty'        => (int)$x['qty'],
                        'price_at'   => (float)$x['price'],
                        'subtotal'   => (float)$x['price'] * (int)$x['qty'],
                    ], $items),
                ];
            }
    
            $db->commit();
            return [
                'ok'      => true,
                'summary' => $snap['summary'],
                'orders'  => $ordersCreated,
            ];
    
        } catch (\Throwable $e) {
            $db->rollBack();
            return ['ok'=>false, 'error'=>$e->getMessage()];
        }
    }
}
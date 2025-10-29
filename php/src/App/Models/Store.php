<?php

namespace App\Models;

use App\Core\Database;
use PDO;
use PDOException;

class Store
{
    public int    $store_id;
    public int    $owner_id;
    public string $store_name;
    public string $description;
    public string $logo_path;
    public string $created_at;
    public string $updated_at;
    
    private static function getDB(): PDO
    {
        return Database::getInstance();
    }

    // Find store by owner ID
    public static function findByOwnerId(int $ownerId): ?array
    {
        $db = self::getDB();
        $stmt = $db->prepare("
            SELECT store_id, owner_id, store_name, description, logo_path, created_at, updated_at
            FROM stores 
            WHERE owner_id = :owner_id 
            LIMIT 1
        ");
        $stmt->execute(['owner_id' => $ownerId]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    // Update store information
    public static function update(int $storeId, array $data): bool
    {
        $db = self::getDB();
        
        $fields = [];
        $params = ['store_id' => $storeId];
        
        if (isset($data['store_name'])) {
            $fields[] = "store_name = :store_name";
            $params['store_name'] = $data['store_name'];
        }
        
        if (isset($data['description'])) {
            $fields[] = "description = :description";
            $params['description'] = $data['description'];
        }
        
        if (isset($data['logo_path'])) {
            $fields[] = "logo_path = :logo_path";
            $params['logo_path'] = $data['logo_path'];
        }
        
        if (empty($fields)) {
            return false;
        }
        
        $fields[] = "updated_at = NOW()";
        
        $sql = "UPDATE stores SET " . implode(', ', $fields) . " WHERE store_id = :store_id";
        $stmt = $db->prepare($sql);
        
        return $stmt->execute($params);
    }
    
    public static function create(
        int    $owner_id,
        string $store_name,
        string $description,
        string $logo_path
    ): ?array
    {
        $query = "
            INSERT INTO stores (owner_id, store_name, description, logo_path)
            VALUES (:owner_id, :store_name, :description, :logo_path)
            RETURNING store_id, owner_id, store_name, description, logo_path, created_at, updated_at
        ";
        
        try {
            $pdo = self::getDB();
            $stmt = $pdo->prepare($query);
            $stmt->execute([
                ':owner_id'     => $owner_id,
                ':store_name'   => $store_name,
                ':description'  => $description,
                ':logo_path'    => $logo_path,
            ]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row === false ? null : $row;

        } catch (PDOException $e) {
            error_log("Store::create error: " . $e->getMessage());
            return null;
        }
    }

    // Get store stats (for dashboard)
    public static function getStats(int $storeId): array
    {
        $db = self::getDB();
        
        // Total unique products
        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM products
            WHERE store_id = :store_id
            AND deleted_at IS NULL
        ");
        $stmt->execute(['store_id' => $storeId]);
        $totalProducts = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Low stock products
        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM products
            WHERE store_id = :store_id
            AND stock < 10
            AND stock > 0
            AND deleted_at IS NULL
        ");
        $stmt->execute(['store_id' => $storeId]);
        $lowStockProducts = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Get order stats
        $orderStats = Order::getStoreStats($storeId);

        return [
            'total_products' => $totalProducts,
            'pending_orders' => $orderStats['pending_orders'],
            'low_stock_products' => $lowStockProducts,
            'total_revenue' => $orderStats['total_revenue'],
        ];
    }
}
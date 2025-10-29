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
            $pdo = Database::pdo();
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

        $orderStats = Order::getStoreStats($storeId);

        return [
            'total_products' => $totalProducts,
            'pending_orders' => $orderStats['pending_orders'],
            'low_stock_products' => $lowStockProducts,
            'total_revenue' => $orderStats['total_revenue'],
        ];
    }
}
<?php

namespace App\Controllers\Buyer;

use App\Core\Database;
use App\Models\Store;
use App\Models\Product;
use PDO;
use App\Core\View; 

class StoreController
{
    public function showStoreDetail(array $req, int $storeId): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare("
            SELECT store_id, owner_id, store_name, description, logo_path
            FROM stores
            WHERE store_id = :id
            LIMIT 1
        ");
        $stmt->execute(['id' => $storeId]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            echo "404 Toko Tidak Ditemukan"; 
            return;
        }

        $stmt = $db->prepare("
            SELECT 
                p.product_id, p.name, p.description, p.price, p.stock, p.image_path,
                p.category_id,
                c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.store_id = :id
            AND p.is_deleted <> TRUE
            ORDER BY p.created_at DESC
        ");
        $stmt->execute(['id' => $storeId]);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

        View::render('StoreDetail.php', [
            'store'       => $store,
            'products'    => $products,
            'sessionUser' => $_SESSION['user'] ?? null
        ]);
    }

    public static function getStoreDetail(array $req, int $storeId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare("
            SELECT store_id, owner_id, store_name, description, logo_path
            FROM stores
            WHERE store_id = :id
            LIMIT 1
        ");
        $stmt->execute(['id' => $storeId]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Toko tidak ditemukan'];
        }

        $stmt = $db->prepare("
            SELECT 
                p.product_id, p.name, p.description, p.price, p.stock, p.image_path,
                p.category_id,
                c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.store_id = :id
            AND p.is_deleted <> TRUE
            ORDER BY p.created_at DESC
        ");
        $stmt->execute(['id' => $storeId]);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'store'    => $store,
                'products' => $products
            ]
        ];
    }
}
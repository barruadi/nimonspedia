<?php

namespace App\Models;

use App\Core\Database;
use PDO;

class Product
{
    // Get database connection
    private static function getDB(): PDO
    {
        return Database::getInstance();
    }

    // Get product by product ID
    public static function findById(int $productId): ?array
    {
        $db = self::getDB();
        $stmt = $db->prepare("
            SELECT * FROM products 
            WHERE product_id = :id 
            AND is_deleted <> TRUE
        ");
        $stmt->execute(['id' => $productId]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    // Get product details by ID
    public static function findDetailById(int $productId): ?array
    {
        $db = self::getDB();
        $stmt = $db->prepare("
            SELECT 
                p.*, 
                c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.product_id = :id 
            AND p.is_deleted <> TRUE
        ");
        $stmt->execute(['id' => $productId]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    // Get all products by store ID
    public static function findByStoreId(int $storeId): array
    {
        $db = self::getDB();
        $stmt = $db->prepare("
            SELECT * FROM products 
            WHERE store_id = :store_id AND is_deleted <> TRUE
            ORDER BY created_at DESC
        ");
        $stmt->execute(['store_id' => $storeId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get all products for a store with category info
    public static function findByStoreIdWithCategory(int $storeId): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT 
                p.product_id,
                p.name,
                p.description,
                p.price,
                p.stock,
                p.image_path,
                p.created_at,
                p.updated_at,
                c.category_id,
                c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.store_id = :store_id
            AND p.is_deleted <> TRUE
            ORDER BY p.created_at DESC
        ");
        $stmt->execute(['store_id' => $storeId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Create new product
    public static function create(array $data): ?int
    {
        $db = Database::getInstance();
        
        $stmt = $db->prepare("
            INSERT INTO products (store_id, category_id, name, description, price, stock, image_path)
            VALUES (:store_id, :category_id, :name, :description, :price, :stock, :image_path)
            RETURNING product_id
        ");
        

        $price = is_numeric($data['price']) ? (int)$data['price'] : 0;
        
        $stmt->execute([
            'store_id' => $data['store_id'],
            'category_id' => $data['category_id'],
            'name' => $data['name'],
            'description' => $data['description'],
            'price' => $price,
            'stock' => (int)$data['stock'],
            'image_path' => $data['image_path'],
        ]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? (int)$result['product_id'] : null;
    }

    // Update product by ID
    public static function update(int $productId, array $data): bool
    {
        $db = Database::getInstance();
        
        $sql = "UPDATE products SET updated_at = NOW()";
        $params = ['product_id' => $productId];
        
        if (isset($data['name'])) {
            $sql .= ", name = :name";
            $params['name'] = $data['name'];
        }
        
        if (isset($data['description'])) {
            $sql .= ", description = :description";
            $params['description'] = $data['description'];
        }
        
        if (isset($data['category_id'])) {
            $sql .= ", category_id = :category_id";
            $params['category_id'] = $data['category_id'];
        }
        
        if (isset($data['price'])) {
            $sql .= ", price = :price";
            $params['price'] = (int)$data['price'];
        }
        
        if (isset($data['stock'])) {
            $sql .= ", stock = :stock";
            $params['stock'] = (int)$data['stock'];
        }
        
        if (isset($data['image_path'])) {
            $sql .= ", image_path = :image_path";
            $params['image_path'] = $data['image_path'];
        }
        
        $sql .= " WHERE product_id = :product_id";
        
        $stmt = $db->prepare($sql);
        return $stmt->execute($params);
    }
    
    // Get total product quantity
    public static function countAll(): int
    {
        $db = self::getDB();
        
        $stmt = $db->query("
            SELECT COUNT(*) AS total 
            FROM products 
            WHERE is_deleted <> TRUE
        ");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int) ($row['total'] ?? 0);
    }
    
    // Get products according to page offsets
    public static function getPerPage(int $limit, int $offset): array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT product_id, name, price, stock, image_path
            FROM products
            WHERE is_deleted <> TRUE
            ORDER BY product_id DESC
            LIMIT :limit OFFSET :offset
        ");

        $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get quantity of total filtered products
    public static function countFiltered(
        ?string $q,
        array $categories = [],
        ?float $minPrice = null,
        ?float $maxPrice = null
    ): int
    {
        $db = self::getDB();
    
        $where = ['is_deleted <> TRUE'];
        $params = [];
    
        if ($q !== null && $q !== '') {
            $where[] = "name ILIKE :q";
            $params['q'] = '%' . $q . '%';
        }
    
        // categories as array of IDs
        $categories = array_values(array_filter(array_map(
            fn($v) => (string)$v !== '' ? (int)$v : null,
            (array)$categories
        ), fn($v) => $v !== null));
    
        if (!empty($categories)) {
            $ph = [];
            foreach ($categories as $i => $catId) {
                $k = "cat{$i}";
                $ph[] = ":{$k}";
                $params[$k] = $catId;
            }
            $where[] = "category_id IN (" . implode(', ', $ph) . ")";
        }
    
        if ($minPrice !== null) {
            $where[] = "price >= :minPrice";
            $params['minPrice'] = $minPrice;
        }
    
        if ($maxPrice !== null) {
            $where[] = "price <= :maxPrice";
            $params['maxPrice'] = $maxPrice;
        }
    
        $whereSql = 'WHERE ' . implode(' AND ', $where);
    
        $stmt = $db->prepare("
            SELECT COUNT(*) AS total
            FROM products
            $whereSql
        ");
    
        foreach ($params as $key => $val) {
            $stmt->bindValue(':' . $key, $val);
        }
    
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int) ($row['total'] ?? 0);
    }
    
    // Get products according to filters
    public static function findFiltered(
        ?string $q,
        array $categories = [],
        ?float $minPrice = null,
        ?float $maxPrice = null,
        int $limit = 20,
        int $offset = 0
    ): array
    {
        $db = self::getDB();
    
        $where = ['p.is_deleted <> TRUE'];
        $params = [];
    
        if ($q !== null && $q !== '') {
            $where[] = "p.name ILIKE :q";
            $params['q'] = '%' . $q . '%';
        }
    
        // categories as array of IDs
        $categories = array_values(array_filter(array_map(
            fn($v) => (string)$v !== '' ? (int)$v : null,
            (array)$categories
        ), fn($v) => $v !== null));
    
        if (!empty($categories)) {
            $ph = [];
            foreach ($categories as $i => $catId) {
                $k = "cat{$i}";
                $ph[] = ":{$k}";
                $params[$k] = $catId;
            }
            $where[] = "p.category_id IN (" . implode(', ', $ph) . ")";
        }
    
        if ($minPrice !== null) {
            $where[] = "p.price >= :minPrice";
            $params['minPrice'] = $minPrice;
        }
    
        if ($maxPrice !== null) {
            $where[] = "p.price <= :maxPrice";
            $params['maxPrice'] = $maxPrice;
        }
    
        $whereSql = 'WHERE ' . implode(' AND ', $where);
    
        $sql = "
            SELECT
                p.product_id,
                p.name,
                p.price,
                p.stock,
                p.image_path,
                p.store_id,
                p.is_deleted,
                s.store_name
            FROM products p
            JOIN stores s ON s.store_id = p.store_id
            $whereSql
            ORDER BY p.product_id DESC
            LIMIT :limit OFFSET :offset
        ";
    
        $stmt = $db->prepare($sql);
    
        foreach ($params as $key => $val) {
            $stmt->bindValue(':' . $key, $val);
        }
        $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Check if product has pending orders (waiting_approval, approved, on_delivery)
    // Returns count of pending orders
    public static function hasPendingOrders(int $productId): int
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id = :product_id
            AND o.status IN ('waiting_approval', 'approved', 'on_delivery')
        ");
        $stmt->execute(['product_id' => $productId]);
        return (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];
    }

    // Check if product has active or scheduled auctions
    public static function hasActiveAuctions(int $productId): int
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM auctions
            WHERE product_id = :product_id
            AND status IN ('active', 'scheduled')
        ");
        $stmt->execute(['product_id' => $productId]);
        return (int)$stmt->fetch(PDO::FETCH_ASSOC)['count'];
    }

    // Soft delete a product
    public static function softDelete(int $productId): bool
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            UPDATE products 
            SET is_deleted = TRUE,
                deleted_at = NOW(),
                updated_at = NOW()
            WHERE product_id = :product_id
        ");
        return $stmt->execute(['product_id' => $productId]);
    }
}
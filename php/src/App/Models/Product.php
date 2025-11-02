<?php

namespace App\Models;

use App\Core\Database;
use PDO;

class Product
{
    // Properties
    public ?int $product_id = null;
    public ?int $store_id = null;
    public ?int $category_id = null;
    public ?string $name = null;
    public ?string $description = null;
    public ?float $price = null;
    public ?int $stock = null;
    public ?string $image_path = null;
    public ?string $created_at = null;
    public ?string $updated_at = null;

    // Get database connection
    private static function getDB(): PDO
    {
        return Database::getInstance();
    }

    // Find product by ID
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
        
        // Ensure price is integer
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
    
    public static function countAll(): int
    {
        $db = self::getDB();
        
        $stmt = $db->query("SELECT COUNT(*) AS total FROM products");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int) ($row['total'] ?? 0);
    }
    
    public static function getPerPage(int $limit, int $offset): array
    {
        $db = self::getDB();
        
        $stmt = $db->prepare("
            SELECT product_id, name, price, stock, image_path
            FROM products
            ORDER BY product_id DESC
            LIMIT :limit OFFSET :offset
        ");

        $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public static function countFiltered(
        ?string $q,
        ?string $category,
        ?float $minPrice,
        ?float $maxPrice
    ): int
    {
        $db = self::getDB();
    
        $where = [];
        $params = [];
    
        if ($q !== null && $q !== '') {
            $where[] = "name ILIKE :q";
            $params['q'] = '%' . $q . '%';
        }
    
        if ($category !== null && $category !== '') {
            $where[] = "category_id = :cat";
            $params['cat'] = $category;
        }
    
        if ($minPrice !== null) {
            $where[] = "price >= :minPrice";
            $params['minPrice'] = $minPrice;
        }
    
        if ($maxPrice !== null) {
            $where[] = "price <= :maxPrice";
            $params['maxPrice'] = $maxPrice;
        }
    
        $whereSql = '';
        if (!empty($where)) {
            $whereSql = 'WHERE ' . implode(' AND ', $where);
        }
    
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
    
    public static function findFiltered(
        ?string $q,
        ?string $category,
        ?float $minPrice,
        ?float $maxPrice,
        int $limit,
        int $offset
    ): array
    {
        $db = self::getDB();
    
        $where = [];
        $params = [];
    
        // search by name (ILIKE for case-insensitive substring in Postgres)
        if ($q !== null && $q !== '') {
            $where[] = "name ILIKE :q";
            $params['q'] = '%' . $q . '%';
        }
    
        // filter by category
        if ($category !== null && $category !== '') {
            $where[] = "category_id = :cat";
            $params['cat'] = $category;
        }
    
        // min price
        if ($minPrice !== null) {
            $where[] = "price >= :minPrice";
            $params['minPrice'] = $minPrice;
        }
    
        // max price
        if ($maxPrice !== null) {
            $where[] = "price <= :maxPrice";
            $params['maxPrice'] = $maxPrice;
        }
    
        $whereSql = '';
        if (!empty($where)) {
            $whereSql = 'WHERE ' . implode(' AND ', $where);
        }
    
        $sql = "
            SELECT
                p.product_id,
                p.name,
                p.price,
                p.stock,
                p.image_path,
                p.store_id,
                s.store_name
            FROM products p
            JOIN stores s ON s.store_id = p.store_id
            $whereSql
            ORDER BY p.product_id DESC
            LIMIT :limit OFFSET :offset
        ";
    
        $stmt = $db->prepare($sql);
    
        // bind dynamic params
        foreach ($params as $key => $val) {
            $stmt->bindValue(':' . $key, $val);
        }
        $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }


    // Check if product has pending orders
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
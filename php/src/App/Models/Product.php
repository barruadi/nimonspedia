<?php

namespace App\Models;

use App\Core\Database;
use PDO;

class Product
{
    // Properties
    public ?int $product_id = null;
    public ?int $store_id = null;
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
            WHERE store_id = :store_id 
            ORDER BY created_at DESC
        ");
        $stmt->execute(['store_id' => $storeId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Create new product
    public static function create(array $data): ?int
    {
        $db = self::getDB();
        $stmt = $db->prepare("
            INSERT INTO products (store_id, name, description, price, stock, image_path)
            VALUES (:store_id, :name, :description, :price, :stock, :image_path)
            RETURNING product_id
        ");
        
        $stmt->execute([
            'store_id'    => $data['store_id'],
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'price'       => $data['price'],
            'stock'       => $data['stock'],
            'image_path'  => $data['image_path'] ?? null,
        ]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['product_id'] ?? null;
    }

    // Update product by ID
    public static function update(int $productId, array $data): bool
    {
        $db = self::getDB();
        
        $fields = [];
        $params = ['id' => $productId];
        
        if (isset($data['name'])) {
            $fields[] = "name = :name";
            $params['name'] = $data['name'];
        }
        if (isset($data['description'])) {
            $fields[] = "description = :description";
            $params['description'] = $data['description'];
        }
        if (isset($data['price'])) {
            $fields[] = "price = :price";
            $params['price'] = $data['price'];
        }
        if (isset($data['stock'])) {
            $fields[] = "stock = :stock";
            $params['stock'] = $data['stock'];
        }
        if (isset($data['image_path'])) {
            $fields[] = "image_path = :image_path";
            $params['image_path'] = $data['image_path'];
        }
        
        if (empty($fields)) {
            return false; // Nothing to update
        }
        
        $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE product_id = :id";
        $stmt = $db->prepare($sql);
        
        return $stmt->execute($params);
    }
}
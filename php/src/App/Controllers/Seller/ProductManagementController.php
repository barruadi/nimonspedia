<?php

namespace App\Controllers\Seller;

use App\Models\Product;

class ProductManagementController
{
    // Returns the list of products for the seller's store
    public static function getStoreProducts(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        $db = \App\Core\Database::getInstance();
        
        // Get seller's store
        $stmt = $db->prepare("
            SELECT store_id, store_name, description, logo_path 
            FROM stores 
            WHERE owner_id = :owner_id 
            LIMIT 1
        ");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Get ALL products with category info (for client-side filtering)
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
        $stmt->execute(['store_id' => $store['store_id']]);
        $products = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'store' => [
                    'store_id' => $store['store_id'],
                    'store_name' => $store['store_name'],
                    'description' => $store['description'] ?? null,
                    'logo_path' => $store['logo_path'] ?? null,
                ],
                'products' => $products,
            ]
        ];
    }

    //  Returns store information for the add product form
    public static function showAddProductForm(): array
    {
        // Start session
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Validate user and role
        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        $db = \App\Core\Database::getInstance();
        
        // Get seller's store
        $stmt = $db->prepare("
            SELECT store_id, store_name, description, logo_path 
            FROM stores 
            WHERE owner_id = :owner_id 
            LIMIT 1
        ");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found. Please create a store first.'];
        }

        // Get categories
        $stmt = $db->query("SELECT category_id, name FROM categories ORDER BY name");
        $categories = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'store_id' => $store['store_id'],
                'store_name' => $store['store_name'],
                'store_description' => $store['description'] ?? null,
                'store_logo' => $store['logo_path'] ?? null,
                'categories' => $categories,
            ]
        ];
    }
    
    // Handles the submission of the add product form
    public static function handleAddProduct(array $req): array
    {
        // Start session
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        // Get seller's store
        $db = \App\Core\Database::getInstance();
        $stmt = $db->prepare("SELECT store_id FROM stores WHERE owner_id = :owner_id");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Get data from request
        $name = $req['body']['name'] ?? null;
        $description = $req['body']['description'] ?? '';
        $categoryId = $req['body']['category_id'] ?? null;
        $price = $req['body']['price'] ?? null;
        $stock = $req['body']['stock'] ?? 0; // Default to 0

        // Server-side validation
        if (!$name || strlen($name) > 200) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Name required (max 200 chars)'];
        }

        if (strlen($description) > 1000) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Description max 1000 chars'];
        }

        if (!$categoryId) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Category required'];
        }

        if (!$price || $price < 1000) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Price must be at least 1000'];
        }

        if ($stock < 0) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Stock must be 0 or more'];
        }

        // Handle file upload
        $imagePath = null;
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadResult = self::handleImageUpload($_FILES['image']);
            if (!$uploadResult['ok']) {
                http_response_code(400);
                return $uploadResult;
            }
            $imagePath = $uploadResult['path'];
        } else {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Product image required'];
        }

        // Insert to database
        try {
            $productId = Product::create([
                'store_id' => $store['store_id'],
                'name' => $name,
                'description' => $description,
                'category_id' => $categoryId,
                'price' => $price,
                'stock' => $stock,
                'image_path' => $imagePath,
            ]);

            if (!$productId) {
                throw new \Exception('Failed to create product');
            }

            http_response_code(201);
            return [
                'ok' => true,
                'data' => ['product_id' => $productId]
            ];
            
        } catch (\Exception $e) {
            // Clean up uploaded file if DB insert fails
            if ($imagePath && file_exists(__DIR__ . '/../../../public' . $imagePath)) {
                unlink(__DIR__ . '/../../../public' . $imagePath);
            }
            
            http_response_code(500);
            return ['ok' => false, 'error' => 'Database error: ' . $e->getMessage()];
        }
    }

    // Utility function: Handles image upload and validation
    private static function handleImageUpload(array $file): array
    {
        // Validate file type
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, $allowedTypes)) {
            return ['ok' => false, 'error' => 'Invalid file type. Only JPG, PNG, WEBP allowed'];
        }

        // Validate file size (max 2MB)
        $maxSize = 2 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            return ['ok' => false, 'error' => 'File size must be less than 2MB'];
        }

        // Create upload directory
        $uploadDir = __DIR__ . '/../../../public/uploads/products/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid('product_', true) . '.' . $extension;
        $filepath = $uploadDir . $filename;

        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            return ['ok' => false, 'error' => 'Failed to upload file'];
        }

        return [
            'ok' => true,
            'path' => '/uploads/products/' . $filename
        ];
    }

    // TO-DO: Image optimization
    private static function optimizeImage(string $filepath): void
    {
        // Implement with GD or Imagick
        // Resize to max 800x800, compress quality 85%
    }
        
    // Returns all the product information needed to show on the edit form
    public static function showEditProductForm(int $productId): array
    {
        // Start session
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        // Get product data
        $product = Product::findById($productId);
        
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Product not found'];
        }

        // Get seller's store
        $db = \App\Core\Database::getInstance();
        $stmt = $db->prepare("SELECT store_id, store_name FROM stores WHERE owner_id = :owner_id");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Check if product belongs to seller's store
        if ($product['store_id'] !== $store['store_id']) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Product does not belong to your store'];
        }

        // Get categories
        $stmt = $db->query("SELECT category_id, name FROM categories ORDER BY name");
        $categories = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'product' => $product,
                'store' => $store,
                'categories' => $categories
            ]
        ];
    }

    // Handles the submission of the edit product form
    public static function handleEditProduct(array $req, int $productId): array
    {
        // Start session
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        // Get product data
        $product = Product::findById($productId);
        
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Product not found'];
        }

        // Get seller's store
        $db = \App\Core\Database::getInstance();
        $stmt = $db->prepare("SELECT store_id FROM stores WHERE owner_id = :owner_id");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Authorization: Check if product belongs to seller's store
        if ($product['store_id'] !== $store['store_id']) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Product does not belong to your store'];
        }

        // Get data from request
        $name = $req['body']['name'] ?? null;
        $description = $req['body']['description'] ?? '';
        $categoryId = $req['body']['category_id'] ?? null;
        $price = $req['body']['price'] ?? null;
        $stock = $req['body']['stock'] ?? 0;

        // Server-side validation
        if (!$name || strlen($name) > 200) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Name required (max 200 chars)'];
        }

        if (strlen($description) > 1000) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Description max 1000 chars'];
        }

        if (!$categoryId) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Category required'];
        }

        if (!$price || $price < 1000) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Price must be at least 1000'];
        }

        if ($stock < 0) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Stock must be 0 or more'];
        }

        // Prepare update data
        $updateData = [
            'name' => $name,
            'description' => $description,
            'category_id' => $categoryId,
            'price' => $price,
            'stock' => $stock,
        ];

        // Handle image upload (optional for edit)
        $oldImagePath = $product['image_path'];
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadResult = self::handleImageUpload($_FILES['image']);
            if (!$uploadResult['ok']) {
                http_response_code(400);
                return $uploadResult;
            }
            $updateData['image_path'] = $uploadResult['path'];
        }

        // Update product in database
        try {
            $success = Product::update($productId, $updateData);
            
            if (!$success) {
                throw new \Exception('Failed to update product');
            }

            // Delete old image if new image uploaded successfully
            if (isset($updateData['image_path']) && $oldImagePath) {
                $oldFilePath = __DIR__ . '/../../../public' . $oldImagePath;
                if (file_exists($oldFilePath)) {
                    unlink($oldFilePath);
                }
            }

            http_response_code(200);
            return [
                'ok' => true,
                'data' => ['product_id' => $productId]
            ];
            
        } catch (\Exception $e) {
            // Clean up new uploaded file if DB update fails
            if (isset($updateData['image_path']) && file_exists(__DIR__ . '/../../../public' . $updateData['image_path'])) {
                unlink(__DIR__ . '/../../../public' . $updateData['image_path']);
            }
            
            http_response_code(500);
            return ['ok' => false, 'error' => 'Database error: ' . $e->getMessage()];
        }
    }

    // Handles selected product soft delection (sets is_deleted to TRUE)
    public static function deleteProduct(int $productId): array
    {
        // Start session
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Validate user and role
        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $db = \App\Core\Database::getInstance();

        // Get product
        $product = Product::findById($productId);
        
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Product not found'];
        }

        // Get seller's store
        $stmt = $db->prepare("SELECT store_id FROM stores WHERE owner_id = :owner_id");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$store || $product['store_id'] !== $store['store_id']) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Product does not belong to your store'];
        }

        // Check if product has pending orders (cascade validation)
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.product_id = :product_id
            AND o.order_status IN ('pending', 'processing', 'shipped')
        ");
        $stmt->execute(['product_id' => $productId]);
        $pendingOrders = (int)$stmt->fetch(\PDO::FETCH_ASSOC)['count'];

        if ($pendingOrders > 0) {
            http_response_code(400);
            return [
                'ok' => false,
                'error' => "Cannot delete product: $pendingOrders pending order(s) exist"
            ];
        }

        // Soft delete
        try {
            $stmt = $db->prepare("
                UPDATE products 
                SET deleted_at = NOW() 
                WHERE product_id = :product_id
            ");
            $stmt->execute(['product_id' => $productId]);

            // Delete image file
            if ($product['image_path']) {
                $imagePath = __DIR__ . '/../../../public' . $product['image_path'];
                if (file_exists($imagePath)) {
                    unlink($imagePath);
                }
            }

            http_response_code(200);
            return ['ok' => true, 'message' => 'Product deleted successfully'];

        } catch (\Exception $e) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to delete product'];
        }
    }
}
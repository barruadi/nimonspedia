<?php

namespace App\Controllers\Seller;

use App\Models\{Product, Store, Category};

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

        // Get seller's store
        $store = Store::findByOwnerIdWithDetails($user['user_id']);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Get products with category info
        $products = Product::findByStoreIdWithCategory($store['store_id']);

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

    // Returns store information for the add product form
    public static function showAddProductForm(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        // Get seller's store
        $store = Store::findByOwnerId($user['user_id']);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found. Please create a store first.'];
        }

        // Get categories
        $categories = Category::findAll();

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
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        // Get seller's store
        $store = Store::findByOwnerId($user['user_id']);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Get data from request
        $name = $req['body']['name'] ?? null;
        $description = $req['body']['description'] ?? '';
        $categoryId = $req['body']['category_id'] ?? null;
        $priceInput = $req['body']['price'] ?? null;
        $stockInput = $req['body']['stock'] ?? 0;

        // Convert to integer and validate
        $price = is_numeric($priceInput) ? (int)$priceInput : 0;
        $stock = is_numeric($stockInput) ? (int)$stockInput : 0;

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

        // Price must be integer >= 1000
        if ($price < 1000) {
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
        // Check if file was uploaded
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            error_log("Upload failed: No file uploaded or invalid upload");
            return ['ok' => false, 'error' => 'No file uploaded'];
        }

        error_log("File uploaded: " . $file['name'] . " (" . $file['size'] . " bytes)");

        // Validate file type using MIME type
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        error_log("MIME type detected: $mimeType");
        
        if (!in_array($mimeType, $allowedTypes)) {
            error_log("Invalid MIME type: $mimeType");
            return ['ok' => false, 'error' => 'Invalid file type. Only JPG, PNG, WEBP allowed'];
        }

        // Validate file size (max 2MB)
        $maxSize = 2 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            error_log("File too large: " . $file['size'] . " bytes (max: $maxSize bytes)");
            return ['ok' => false, 'error' => 'File size must be less than 2MB'];
        }

        // Create upload directory
        $uploadDir = __DIR__ . '/../../../public/uploads/products/';
        if (!is_dir($uploadDir)) {
            error_log("Creating upload directory: $uploadDir");
            if (!mkdir($uploadDir, 0755, true)) {
                error_log("Failed to create upload directory: $uploadDir");
                return ['ok' => false, 'error' => 'Failed to create upload directory'];
            }
        }

        // Check if directory is writable
        if (!is_writable($uploadDir)) {
            error_log("Upload directory not writable: $uploadDir");
            return ['ok' => false, 'error' => 'Upload directory not writable'];
        }

        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (!$extension) {
            // Fallback to MIME type
            $extension = match($mimeType) {
                'image/jpeg', 'image/jpg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => 'jpg'
            };
        }
        
        $filename = uniqid('product_', true) . '.' . $extension;
        $filepath = $uploadDir . $filename;

        error_log("Attempting to save to: $filepath");

        // Move uploaded file (DIRECT UPLOAD - NO OPTIMIZATION)
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            error_log("Failed to move uploaded file from " . $file['tmp_name'] . " to $filepath");
            return ['ok' => false, 'error' => 'Failed to upload file'];
        }

        error_log("File uploaded successfully: $filepath");

        // OPTIMIZATION DISABLED FOR TESTING
        // Uncomment below to enable image optimization
        /*
        try {
            self::optimizeImage($filepath, $mimeType);
            error_log("Image optimized successfully");
        } catch (\Exception $e) {
            // Log warning but DON'T delete file - continue with original
            error_log("Image optimization failed (using original): " . $e->getMessage());
        }
        */

        $finalSize = filesize($filepath);
        error_log("Final file size: " . ($finalSize / 1024) . " KB");

        return [
            'ok' => true,
            'path' => '/uploads/products/' . $filename
        ];
    }

    /*
    // IMAGE OPTIMIZATION - CURRENTLY DISABLED
    //
    // Uncomment this function to enable image optimization
    // 
    // Optimize image: resize to max 800x800 and compress quality to 85%
    private static function optimizeImage(string $filepath, string $mimeType): void
    {
        // Check if GD library is available
        if (!extension_loaded('gd')) {
            throw new \Exception('GD library not available');
        }

        // Verify file exists
        if (!file_exists($filepath)) {
            throw new \Exception('File does not exist: ' . $filepath);
        }

        error_log("Optimizing image: $filepath (type: $mimeType)");

        // Load image based on type
        $sourceImage = null;
        switch ($mimeType) {
            case 'image/jpeg':
            case 'image/jpg':
                $sourceImage = @imagecreatefromjpeg($filepath);
                break;
            case 'image/png':
                $sourceImage = @imagecreatefrompng($filepath);
                break;
            case 'image/webp':
                if (function_exists('imagecreatefromwebp')) {
                    $sourceImage = @imagecreatefromwebp($filepath);
                } else {
                    throw new \Exception('WebP not supported by GD library');
                }
                break;
            default:
                throw new \Exception('Unsupported image type: ' . $mimeType);
        }

        if (!$sourceImage) {
            throw new \Exception('Failed to load image (corrupted or invalid format)');
        }

        // Get original dimensions
        $originalWidth = imagesx($sourceImage);
        $originalHeight = imagesy($sourceImage);

        error_log("Original dimensions: {$originalWidth}x{$originalHeight}");

        // Calculate new dimensions (max 800x800, maintain aspect ratio)
        $maxDimension = 800;
        $newWidth = $originalWidth;
        $newHeight = $originalHeight;

        if ($originalWidth > $maxDimension || $originalHeight > $maxDimension) {
            $ratio = $originalWidth / $originalHeight;
            
            if ($originalWidth > $originalHeight) {
                // Landscape
                $newWidth = $maxDimension;
                $newHeight = (int)($maxDimension / $ratio);
            } else {
                // Portrait
                $newHeight = $maxDimension;
                $newWidth = (int)($maxDimension * $ratio);
            }
        }

        error_log("New dimensions: {$newWidth}x{$newHeight}");

        // Create new image with calculated dimensions
        $optimizedImage = imagecreatetruecolor($newWidth, $newHeight);

        if (!$optimizedImage) {
            imagedestroy($sourceImage);
            throw new \Exception('Failed to create optimized image');
        }

        // Preserve transparency for PNG and WebP
        if ($mimeType === 'image/png' || $mimeType === 'image/webp') {
            imagealphablending($optimizedImage, false);
            imagesavealpha($optimizedImage, true);
            $transparent = imagecolorallocatealpha($optimizedImage, 0, 0, 0, 127);
            imagefilledrectangle($optimizedImage, 0, 0, $newWidth, $newHeight, $transparent);
        }

        // Copy and resize
        $resized = imagecopyresampled(
            $optimizedImage,
            $sourceImage,
            0, 0, 0, 0,
            $newWidth, $newHeight,
            $originalWidth, $originalHeight
        );

        if (!$resized) {
            imagedestroy($sourceImage);
            imagedestroy($optimizedImage);
            throw new \Exception('Failed to resize image');
        }

        // Save optimized image (overwrite original)
        $saved = false;
        switch ($mimeType) {
            case 'image/jpeg':
            case 'image/jpg':
                // Quality: 85% (0-100)
                $saved = imagejpeg($optimizedImage, $filepath, 85);
                break;
            case 'image/png':
                // Compression level: 6 (0-9, where 9 is max compression)
                $saved = imagepng($optimizedImage, $filepath, 6);
                break;
            case 'image/webp':
                // Quality: 85% (0-100)
                if (function_exists('imagewebp')) {
                    $saved = imagewebp($optimizedImage, $filepath, 85);
                } else {
                    throw new \Exception('WebP save not supported');
                }
                break;
        }

        // Clean up memory
        imagedestroy($sourceImage);
        imagedestroy($optimizedImage);

        if (!$saved) {
            throw new \Exception('Failed to save optimized image');
        }

        // Log optimization result
        $finalSize = filesize($filepath);
        error_log(sprintf(
            "Image optimized: %dx%d -> %dx%d, Size: %.2f KB",
            $originalWidth,
            $originalHeight,
            $newWidth,
            $newHeight,
            $finalSize / 1024
        ));
    }
    */
        
    // Returns all the product information needed to show on the edit form
    public static function showEditProductForm(int $productId): array
    {
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
        $store = Store::findByOwnerId($user['user_id']);

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
        $categories = Category::findAll();

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
        $store = Store::findByOwnerId($user['user_id']);

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
        $priceInput = $req['body']['price'] ?? null;
        $stockInput = $req['body']['stock'] ?? 0;

        // Convert to integer and validate
        $price = is_numeric($priceInput) ? (int)$priceInput : 0;
        $stock = is_numeric($stockInput) ? (int)$stockInput : 0;

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

        if ($price < 1000) {
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

    // Handles selected product soft deletion (sets is_deleted to TRUE)
    public static function deleteProduct(int $productId): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        // Get product
        $product = Product::findById($productId);
        
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Product not found'];
        }

        // Get seller's store
        $store = Store::findByOwnerId($user['user_id']);

        if (!$store || $product['store_id'] !== $store['store_id']) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Product does not belong to your store'];
        }

        // Cascade Validation: Checks for number of pending orders
        $pendingOrders = Product::hasPendingOrders($productId);

        if ($pendingOrders > 0) {
            http_response_code(400);
            return [
                'ok' => false,
                'error' => "Tidak dapat menghapus produk: Masih ada {$pendingOrders} pesanan yang belum selesai"
            ];
        }

        // Soft delete
        try {
            $success = Product::softDelete($productId);

            if (!$success) {
                throw new \Exception('Failed to delete product');
            }

            //Delete image file (commented out to preserve for order history)
            /*
            if ($product['image_path']) {
                $imagePath = __DIR__ . '/../../../public' . $product['image_path'];
                if (file_exists($imagePath)) {
                    unlink($imagePath);
                }
            }
            */

            http_response_code(200);
            return [
                'ok' => true,
                'message' => 'Product berhasil dihapus!'
            ];

        } catch (\Exception $e) {
            error_log("Delete product error: " . $e->getMessage());
            http_response_code(500);
            return [
                'ok' => false,
                'error' => 'Gagal menghapus produk: ' . $e->getMessage()
            ];
        }
    }
}
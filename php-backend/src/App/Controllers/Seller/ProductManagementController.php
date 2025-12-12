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
                'product_id' => $productId
            ];
            
        } catch (\Exception $e) {
            error_log("Product creation error: " . $e->getMessage());
            
            // Clean up uploaded file if DB insert fails
            if ($imagePath && file_exists(__DIR__ . '/../../../public' . $imagePath)) {
                @unlink(__DIR__ . '/../../../public' . $imagePath);
            }
            
            http_response_code(500);
            return ['ok' => false, 'error' => 'Database error: ' . $e->getMessage()];
        }
    }

    // Utility function: Handles image upload and validation
    private static function handleImageUpload(array $file): array
    {
        // Start output buffering to prevent premature output
        if (!ob_get_level()) {
            ob_start();
        }

        // Check if file was uploaded
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            error_log("Upload failed: No file uploaded");
            return ['ok' => false, 'error' => 'No file uploaded'];
        }

        error_log("File uploaded: " . $file['name'] . " (" . $file['size'] . " bytes)");

        // Validate file type using MIME type
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        error_log("MIME type: $mimeType");
        
        if (!in_array($mimeType, $allowedTypes)) {
            error_log("Invalid MIME type: $mimeType");
            return ['ok' => false, 'error' => 'Invalid file type. Only JPG, PNG, WEBP allowed'];
        }

        // Validate file size (max 4MB)
        $maxSize = 4 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            error_log("File too large: " . $file['size'] . " bytes");
            return ['ok' => false, 'error' => 'File size must be less than 4MB'];
        }

        // Create upload directory
        $uploadDir = __DIR__ . '/../../../public/uploads/products/';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0755, true);
        }

        // Generate unique filename
        $extension = match($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg'
        };
        
        $filename = uniqid('product_', true) . '.' . $extension;
        $filepath = $uploadDir . $filename;

        error_log("Saving to: $filepath");

        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            error_log("Failed to move file");
            return ['ok' => false, 'error' => 'Failed to upload file'];
        }

        @chmod($filepath, 0644);
        $originalSize = filesize($filepath);
        error_log("Original size: " . round($originalSize / 1024, 2) . " KB");

        $optimizationSuccess = false;
        try {
            self::optimizeImage($filepath, $mimeType);
            $optimizationSuccess = true;
            
            clearstatcache(true, $filepath);
            $optimizedSize = filesize($filepath);
            
            if ($optimizedSize > 0) {
                $reduction = (($originalSize - $optimizedSize) / $originalSize) * 100;
                error_log(sprintf(
                    "Optimized: %.2f KB → %.2f KB (%.1f%% reduction)",
                    $originalSize / 1024,
                    $optimizedSize / 1024,
                    $reduction
                ));
            }
            
        } catch (\Exception $e) {
            error_log("Optimization warning: " . $e->getMessage());
            error_log("Continuing with original image");
        }

        return [
            'ok' => true,
            'path' => '/uploads/products/' . $filename
        ];
    }

    private static function optimizeImage(string $filepath, string $mimeType): void
    {
        try {
            if (!extension_loaded('gd')) {
                throw new \Exception('GD not available');
            }

            if (!file_exists($filepath) || !is_readable($filepath)) {
                throw new \Exception('File not readable');
            }

            error_log("Starting optimization: $filepath");

            // Load image with error suppression
            $sourceImage = match($mimeType) {
                'image/jpeg' => @imagecreatefromjpeg($filepath),
                'image/png' => @imagecreatefrompng($filepath),
                'image/webp' => function_exists('imagecreatefromwebp') 
                    ? @imagecreatefromwebp($filepath) 
                    : false,
                default => false
            };

            if (!$sourceImage) {
                throw new \Exception('Failed to load image');
            }

            // Get dimensions
            $originalWidth = imagesx($sourceImage);
            $originalHeight = imagesy($sourceImage);
            
            if (!$originalWidth || !$originalHeight) {
                imagedestroy($sourceImage);
                throw new \Exception('Invalid dimensions');
            }

            error_log("Original: {$originalWidth}x{$originalHeight}");

            // Calculate new dimensions (max 800x800)
            $maxDimension = 800;
            $newWidth = $originalWidth;
            $newHeight = $originalHeight;

            if ($originalWidth > $maxDimension || $originalHeight > $maxDimension) {
                $ratio = $originalWidth / $originalHeight;
                
                if ($ratio > 1) {
                    $newWidth = $maxDimension;
                    $newHeight = (int)round($maxDimension / $ratio);
                } else {
                    $newHeight = $maxDimension;
                    $newWidth = (int)round($maxDimension * $ratio);
                }
            }

            error_log("Target: {$newWidth}x{$newHeight}");

            // Create new image
            $optimizedImage = @imagecreatetruecolor($newWidth, $newHeight);
            
            if (!$optimizedImage) {
                imagedestroy($sourceImage);
                throw new \Exception('Failed to create canvas');
            }

            // Preserve transparency for PNG/WebP
            if ($mimeType === 'image/png' || $mimeType === 'image/webp') {
                imagealphablending($optimizedImage, false);
                imagesavealpha($optimizedImage, true);
                $transparent = imagecolorallocatealpha($optimizedImage, 0, 0, 0, 127);
                if ($transparent !== false) {
                    imagefilledrectangle($optimizedImage, 0, 0, $newWidth, $newHeight, $transparent);
                }
            }

            // Resize
            $resized = @imagecopyresampled(
                $optimizedImage, $sourceImage,
                0, 0, 0, 0,
                $newWidth, $newHeight,
                $originalWidth, $originalHeight
            );

            if (!$resized) {
                imagedestroy($sourceImage);
                imagedestroy($optimizedImage);
                throw new \Exception('Failed to resample');
            }

            // Save to temp file
            $tempPath = $filepath . '.tmp';
            
            $saved = match($mimeType) {
                'image/jpeg' => @imagejpeg($optimizedImage, $tempPath, 85),
                'image/png' => @imagepng($optimizedImage, $tempPath, 6),
                'image/webp' => function_exists('imagewebp') 
                    ? @imagewebp($optimizedImage, $tempPath, 85)
                    : false,
                default => false
            };

            // Clean up resources immediately
            imagedestroy($sourceImage);
            imagedestroy($optimizedImage);

            if (!$saved || !file_exists($tempPath) || filesize($tempPath) === 0) {
                if (file_exists($tempPath)) @unlink($tempPath);
                throw new \Exception('Failed to save optimized image');
            }

            // Replace original (atomic operation)
            if (!@rename($tempPath, $filepath)) {
                @unlink($tempPath);
                throw new \Exception('Failed to replace original');
            }

            @chmod($filepath, 0644);
            error_log("Optimization complete");

        } catch (\Exception $e) {
            error_log("Optimization failed (non-fatal): " . $e->getMessage());
        }
    }
        
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

        $price = is_numeric($priceInput) ? (int)$priceInput : 0;
        $stock = is_numeric($stockInput) ? (int)$stockInput : 0;

        // Validation
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

        // Handle image upload (optional)
        $oldImagePath = $product['image_path'];
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadResult = self::handleImageUpload($_FILES['image']);
            if (!$uploadResult['ok']) {
                http_response_code(400);
                return $uploadResult;
            }
            $updateData['image_path'] = $uploadResult['path'];
        }

        // Update database
        try {
            $success = Product::update($productId, $updateData);
            
            if (!$success) {
                throw new \Exception('Failed to update product');
            }

            // Delete old image if new uploaded
            if (isset($updateData['image_path']) && $oldImagePath) {
                $oldFilePath = __DIR__ . '/../../../public' . $oldImagePath;
                if (file_exists($oldFilePath)) {
                    @unlink($oldFilePath);
                }
            }

            http_response_code(200);
            
            return [
                'ok' => true,
                'product_id' => $productId
            ];
            
        } catch (\Exception $e) {
            error_log("Product update error: " . $e->getMessage());
            
            // Cleanup new file if DB fails
            if (isset($updateData['image_path'])) {
                $newFilePath = __DIR__ . '/../../../public' . $updateData['image_path'];
                if (file_exists($newFilePath)) {
                    @unlink($newFilePath);
                }
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

        // Cascade Validation: Check for active or scheduled auctions
        $activeAuctions = Product::hasActiveAuctions($productId);

        if ($activeAuctions > 0) {
            http_response_code(400);
            return [
                'ok' => false,
                'error' => "Tidak dapat menghapus produk: Masih ada {$activeAuctions} lelang yang sedang berlangsung atau dijadwalkan"
            ];
        }

        // Soft delete
        try {
            $success = Product::softDelete($productId);

            if (!$success) {
                throw new \Exception('Failed to delete product');
            }

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

    // Show auction creation form for a specific product
    public static function showAuctionForm($productId): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        // Get product details
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

        // Return product data for the view (will be used by AuctionForm.js)
        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'product' => [
                    'product_id' => $product['product_id'],
                    'name' => $product['name'],
                    'image_path' => $product['image_path'],
                    'price' => $product['price'],
                    'stock' => $product['stock'],
                    'description' => $product['description'] ?? ''
                ],
                'store' => [
                    'store_id' => $store['store_id'],
                    'store_name' => $store['store_name']
                ]
            ]
        ];
    }
}
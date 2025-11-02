<?php

namespace App\Controllers\Seller;

use App\Models\Store;

class DashboardController
{
    // Renders the seller dashboard page with overview stats
    public static function showDashboard(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized: Not a seller'];
        }

        // Get seller's store information
        $store = Store::findByOwnerIdWithDetails($user['user_id']);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found. Please create a store first.'];
        }

        $storeId = $store['store_id'];

        // Get statistics
        $totalProducts = Store::getTotalProductCount($storeId);
        $pendingOrders = Store::getPendingOrdersCount($storeId);
        $lowStockProducts = Store::getLowStockProductsCount($storeId);
        $totalRevenue = Store::getTotalRevenue($storeId);

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'store' => [
                    'store_id' => $store['store_id'],
                    'store_name' => $store['store_name'],
                    'description' => $store['description'],
                    'logo_path' => $store['logo_path'],
                    'created_at' => $store['created_at'],
                    'updated_at' => $store['updated_at'],
                ],
                'stats' => [
                    'total_products' => $totalProducts,
                    'pending_orders' => $pendingOrders,
                    'low_stock_products' => $lowStockProducts,
                    'total_revenue' => $totalRevenue,
                ],
            ]
        ];
    }

    // Get seller balance
    public static function getBalance(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;

        if (!$user || $user['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        try {
            $balance = Store::getBalanceByOwnerId($user['user_id']);

            if ($balance === null) {
                http_response_code(404);
                return ['ok' => false, 'error' => 'Store not found'];
            }

            http_response_code(200);
            return [
                'ok' => true,
                'data' => [
                    'balance' => $balance
                ]
            ];

        } catch (\Exception $e) {
            error_log("Get balance error: " . $e->getMessage());
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to fetch balance'];
        }
    }

    // Update store information
    public static function updateStoreInfo(array $req): array
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
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Get request data
        $body = $req['body'] ?? $_POST ?? [];
        $storeName = $body['store_name'] ?? null;
        $description = $body['description'] ?? '';

        // Validations
        if (!$storeName || strlen($storeName) > 100) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Store name required (max 100 chars)'];
        }

        if (strlen($description) > 500) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Description max 500 chars'];
        }

        // Prepare update data
        $updateData = [
            'store_name' => $storeName,
            'description' => $description,
        ];

        $oldLogoPath = null;

        // Handle logo upload
        if (isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $uploadResult = self::handleLogoUpload($_FILES['logo']);
            
            if (!$uploadResult['ok']) {
                http_response_code(400);
                return $uploadResult;
            }
            
            $updateData['logo_path'] = $uploadResult['path'];
            $oldLogoPath = $store['logo_path'];
        }

        // Update store
        try {
            $success = Store::updateInfo($store['store_id'], $updateData);

            if (!$success) {
                throw new \Exception('Database update failed');
            }

            // Delete old logo if new one uploaded
            if ($oldLogoPath) {
                $oldLogoFullPath = __DIR__ . '/../../../public' . $oldLogoPath;
                if (file_exists($oldLogoFullPath)) {
                    unlink($oldLogoFullPath);
                }
            }

            http_response_code(200);
            return [
                'ok' => true,
                'message' => 'Store information updated successfully',
                'data' => [
                    'logo_path' => $updateData['logo_path'] ?? $store['logo_path']
                ]
            ];

        } catch (\Exception $e) {
            // Clean up new logo if DB update fails
            if (isset($updateData['logo_path'])) {
                $newLogoPath = __DIR__ . '/../../../public' . $updateData['logo_path'];
                if (file_exists($newLogoPath)) {
                    unlink($newLogoPath);
                }
            }

            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to update store information: ' . $e->getMessage()];
        }
    }

    // Handle logo upload
    private static function handleLogoUpload(array $file): array
    {
        // Validate file type
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, $allowedMimes)) {
            return ['ok' => false, 'error' => 'Invalid file type. Only JPG, PNG, WEBP allowed'];
        }

        // Validate file size (max 2MB)
        $maxSize = 2 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            return ['ok' => false, 'error' => 'File size must be less than 2MB'];
        }

        // Create upload directory
        $uploadDir = __DIR__ . '/../../../public/uploads/stores/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (!$extension) {
            // Fallback to mime type
            $mimeToExt = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp'
            ];
            $extension = $mimeToExt[$mimeType] ?? 'jpg';
        }
        
        $filename = uniqid('store_logo_', true) . '.' . $extension;
        $filepath = $uploadDir . $filename;

        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            return ['ok' => false, 'error' => 'Failed to upload file'];
        }

        return [
            'ok' => true,
            'path' => '/uploads/stores/' . $filename
        ];
    }
}
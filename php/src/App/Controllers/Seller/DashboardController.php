<?php

namespace App\Controllers\Seller;

use App\Core\Database;
use PDO;

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

        $db = Database::getInstance();

        // Get seller's store information
        $stmt = $db->prepare("
            SELECT 
                store_id, 
                store_name, 
                description, 
                logo_path,
                created_at,
                updated_at
            FROM stores 
            WHERE owner_id = :owner_id 
            LIMIT 1
        ");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found. Please create a store first.'];
        }

        $storeId = $store['store_id'];

        // Quick Stats

        // Total Unique Products (not quantity)
        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM products
            WHERE store_id = :store_id
            AND deleted_at IS NULL
        ");
        $stmt->execute(['store_id' => $storeId]);
        $totalProducts = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Pending Orders
        $stmt = $db->prepare("
            SELECT COUNT(DISTINCT o.order_id) as total
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE p.store_id = :store_id
            AND o.status IN ('waiting_approval', 'approved', 'on_delivery')
        ");
        $stmt->execute(['store_id' => $storeId]);
        $pendingOrders = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Low Stock Products (< 10)
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

        // Total Revenue (completed orders only)
        $stmt = $db->prepare("
            SELECT COALESCE(SUM(oi.qty * oi.price_at), 0) as total_revenue
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE p.store_id = :store_id
            AND o.status = 'received'
        ");
        $stmt->execute(['store_id' => $storeId]);
        $totalRevenue = (float)$stmt->fetch(PDO::FETCH_ASSOC)['total_revenue'];

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

    // Update store information (edit in place)
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

        $db = Database::getInstance();

        // Get seller's store
        $stmt = $db->prepare("
            SELECT store_id 
            FROM stores 
            WHERE owner_id = :owner_id 
            LIMIT 1
        ");
        $stmt->execute(['owner_id' => $user['user_id']]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        // Get request data
        $storeName = $req['body']['store_name'] ?? null;
        $description = $req['body']['description'] ?? '';

        // Validation
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
            'store_id' => $store['store_id'],
        ];

        // Handle logo upload
        if (isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $uploadResult = self::handleLogoUpload($_FILES['logo']);
            
            if (!$uploadResult['ok']) {
                http_response_code(400);
                return $uploadResult;
            }
            
            $updateData['logo_path'] = $uploadResult['path'];

            // Get old logo for deletion
            $stmt = $db->prepare("SELECT logo_path FROM stores WHERE store_id = :store_id");
            $stmt->execute(['store_id' => $store['store_id']]);
            $oldLogo = $stmt->fetch(PDO::FETCH_ASSOC)['logo_path'];
        }

        // Update store
        try {
            $sql = "
                UPDATE stores 
                SET 
                    store_name = :store_name,
                    description = :description,
                    updated_at = NOW()
            ";

            if (isset($updateData['logo_path'])) {
                $sql .= ", logo_path = :logo_path";
            }

            $sql .= " WHERE store_id = :store_id";

            $stmt = $db->prepare($sql);
            $stmt->execute($updateData);

            // Delete old logo if new one uploaded
            if (isset($oldLogo) && $oldLogo) {
                $oldLogoPath = __DIR__ . '/../../../public' . $oldLogo;
                if (file_exists($oldLogoPath)) {
                    unlink($oldLogoPath);
                }
            }

            http_response_code(200);
            return [
                'ok' => true,
                'message' => 'Store information updated successfully'
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
            return ['ok' => false, 'error' => 'Failed to update store information'];
        }
    }

    // Handle logo upload
    private static function handleLogoUpload(array $file): array
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
        $uploadDir = __DIR__ . '/../../../public/uploads/stores/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
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
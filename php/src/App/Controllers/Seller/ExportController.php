<?php

namespace App\Controllers\Seller;

use App\Services\ExportService;
use App\Core\Database;

class ExportController
{
    public static function exportData(): array
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
            // Get store
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT store_id, store_name FROM stores WHERE owner_id = :owner_id");
            $stmt->execute(['owner_id' => $user['user_id']]);
            $store = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$store) {
                http_response_code(404);
                return ['ok' => false, 'error' => 'Store not found'];
            }

            // Generate CSV data
            $exportService = new ExportService();
            $csvData = $exportService->exportComprehensiveReport($store['store_id'], $store['store_name']);

            if (empty($csvData)) {
                throw new \Exception('Failed to generate CSV data');
            }

            // Return CSV as base64 for frontend to download
            $filename = "store_report_" . date('Y-m-d_His') . '.csv';

            http_response_code(200);
            return [
                'ok' => true,
                'data' => [
                    'csv' => base64_encode("\xEF\xBB\xBF" . $csvData),
                    'filename' => $filename
                ]
            ];

        } catch (\Exception $e) {
            error_log("Export error: " . $e->getMessage());
            http_response_code(500);
            return [
                'ok' => false, 
                'error' => 'Export failed: ' . $e->getMessage()
            ];
        }
    }
}
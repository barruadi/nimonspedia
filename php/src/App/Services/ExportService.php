<?php
// filepath: php/src/App/Services/ExportService.php

namespace App\Services;

use App\Core\Database;
use PDO;

class ExportService
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Export Comprehensive Store Report
     */
    public function exportComprehensiveReport(int $storeId, string $storeName): string
    {
        $lines = [];

        // STore Overview
        $lines[] = "=== STORE OVERVIEW ===";
        $lines[] = "Store Name," . $this->csvEscape($storeName);
        $lines[] = "Export Date," . date('Y-m-d H:i:s');
        $lines[] = "Report Period,Last 30 Days";
        $lines[] = "";

        // Sales Summary
        $lines[] = "=== SALES SUMMARY (LAST 30 DAYS) ===";
        $lines[] = "Metric,Value";
        
        $salesSummary = $this->getSalesSummary($storeId);
        foreach ($salesSummary as $metric => $value) {
            $lines[] = $this->csvEscape($metric) . "," . $this->csvEscape($value);
        }
        $lines[] = "";

        // Product Inventory
        $lines[] = "=== PRODUCT INVENTORY ===";
        $inventory = $this->getInventory($storeId);
        
        if (!empty($inventory)) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_keys($inventory[0])));
            foreach ($inventory as $row) {
                $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
            }
        } else {
            $lines[] = "No products found";
        }
        $lines[] = "";

        // Recent Orders
        $lines[] = "=== RECENT ORDERS (LAST 30 DAYS) ===";
        $orders = $this->getRecentOrders($storeId);
        
        if (!empty($orders)) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_keys($orders[0])));
            foreach ($orders as $row) {
                $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
            }
        } else {
            $lines[] = "No orders found";
        }
        $lines[] = "";

        // Top Products
        $lines[] = "=== TOP 10 BEST SELLING PRODUCTS ===";
        $topProducts = $this->getTopProducts($storeId);
        
        if (!empty($topProducts)) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_keys($topProducts[0])));
            foreach ($topProducts as $row) {
                $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
            }
        } else {
            $lines[] = "No sales data available";
        }
        $lines[] = "";

        // Top Customers
        $lines[] = "=== TOP 10 CUSTOMERS ===";
        $topCustomers = $this->getTopCustomers($storeId);
        
        if (!empty($topCustomers)) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_keys($topCustomers[0])));
            foreach ($topCustomers as $row) {
                $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
            }
        } else {
            $lines[] = "No customer data available";
        }

        $lines[] = "";
        $lines[] = "=== END OF REPORT ===";

        return implode("\n", $lines);
    }

    /**
     * Escape CSV values
     */
    private function csvEscape($value): string
    {
        if ($value === null) {
            return '';
        }
        
        $value = (string) $value;
        
        // If contains comma, quote, or newline, wrap in quotes
        if (strpos($value, ',') !== false || strpos($value, '"') !== false || strpos($value, "\n") !== false) {
            return '"' . str_replace('"', '""', $value) . '"';
        }
        
        return $value;
    }

    private function getSalesSummary(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    COUNT(DISTINCT o.order_id) AS total_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'received' THEN o.order_id END) AS completed_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.order_id END) AS pending_orders,
                    COALESCE(SUM(CASE WHEN o.status = 'received' THEN oi.subtotal ELSE 0 END), 0) AS total_revenue,
                    COALESCE(AVG(CASE WHEN o.status = 'received' THEN oi.subtotal END), 0) AS avg_order_value
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                WHERE p.store_id = :store_id
                AND o.created_at >= NOW() - INTERVAL '30 days'
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            return [
                'Total Orders' => $result['total_orders'] ?? 0,
                'Completed Orders' => $result['completed_orders'] ?? 0,
                'Pending Orders' => $result['pending_orders'] ?? 0,
                'Total Revenue (IDR)' => 'Rp ' . number_format($result['total_revenue'] ?? 0, 0, ',', '.'),
                'Average Order Value (IDR)' => 'Rp ' . number_format($result['avg_order_value'] ?? 0, 0, ',', '.')
            ];
        } catch (\Exception $e) {
            error_log("getSalesSummary error: " . $e->getMessage());
            return [];
        }
    }

    private function getInventory(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    p.product_id,
                    p.name,
                    COALESCE(c.name, 'Uncategorized') AS category,
                    p.stock,
                    p.price,
                    (p.stock * p.price) AS total_value,
                    CASE 
                        WHEN p.stock = 0 THEN 'Out of Stock'
                        WHEN p.stock < 10 THEN 'Low Stock'
                        WHEN p.stock < 50 THEN 'Medium Stock'
                        ELSE 'High Stock'
                    END AS stock_status
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.category_id
                WHERE p.store_id = :store_id
                AND p.is_deleted = FALSE
                ORDER BY p.stock ASC
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Exception $e) {
            error_log("getInventory error: " . $e->getMessage());
            return [];
        }
    }

    private function getRecentOrders(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    o.order_id,
                    TO_CHAR(o.created_at, 'YYYY-MM-DD HH24:MI') AS order_date,
                    p.name AS product_name,
                    oi.qty,
                    oi.price_at,
                    oi.subtotal,
                    o.status,
                    u.full_name AS customer_name
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                JOIN users u ON o.buyer_id = u.user_id
                WHERE p.store_id = :store_id
                AND o.created_at >= NOW() - INTERVAL '30 days'
                ORDER BY o.created_at DESC
                LIMIT 50
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Exception $e) {
            error_log("getRecentOrders error: " . $e->getMessage());
            return [];
        }
    }

    private function getTopProducts(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    p.name,
                    COALESCE(c.name, 'Uncategorized') AS category,
                    SUM(oi.qty) AS total_sold,
                    SUM(oi.subtotal) AS total_revenue
                FROM order_items oi
                JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN categories c ON p.category_id = c.category_id
                JOIN orders o ON oi.order_id = o.order_id
                WHERE p.store_id = :store_id
                AND o.status = 'received'
                AND o.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY p.product_id, p.name, c.name
                ORDER BY SUM(oi.qty) DESC
                LIMIT 10
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Exception $e) {
            error_log("getTopProducts error: " . $e->getMessage());
            return [];
        }
    }

    private function getTopCustomers(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    u.full_name,
                    u.email,
                    COUNT(DISTINCT o.order_id) AS total_orders,
                    COALESCE(SUM(CASE WHEN o.status = 'received' THEN o.total_amount ELSE 0 END), 0) AS total_spent
                FROM users u
                JOIN orders o ON u.user_id = o.buyer_id
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                WHERE p.store_id = :store_id
                GROUP BY u.user_id, u.full_name, u.email
                HAVING COUNT(DISTINCT o.order_id) > 0
                ORDER BY total_spent DESC
                LIMIT 10
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Exception $e) {
            error_log("getTopCustomers error: " . $e->getMessage());
            return [];
        }
    }
}
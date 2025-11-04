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

    // Export Comprehensive Store Report
    public function exportComprehensiveReport(int $storeId, string $storeName): string
    {
        $lines = [];
        
        // HEADER SECTION
        $lines[] = "COMPREHENSIVE STORE PERFORMANCE REPORT";
        $lines[] = str_repeat("=", 80);
        $lines[] = "";
        $lines[] = "Store Name," . $this->csvEscape($storeName);
        $lines[] = "Report Generated," . date('l, d F Y - H:i:s');
        $lines[] = "Report Period,Last 30 Days";
        $lines[] = "Currency,Indonesian Rupiah (IDR)";
        $lines[] = "";
        $lines[] = str_repeat("=", 80);
        $lines[] = "";

        // SECTION 1: EXECUTIVE SUMMARY
        $lines[] = "SECTION 1: EXECUTIVE SUMMARY";
        $lines[] = str_repeat("-", 80);
        $lines[] = "";
        
        $salesSummary = $this->getSalesSummary($storeId);
        $lines[] = "Metric,Value,Performance";
        
        foreach ($salesSummary as $metric => $value) {
            $performance = $this->getPerformanceIndicator($metric, $value);
            $lines[] = $this->csvEscape($metric) . "," . $this->csvEscape($value) . "," . $performance;
        }
        $lines[] = "";
        $lines[] = "";

        // SECTION 2: REVENUE ANALYTICS
        $lines[] = "SECTION 2: REVENUE ANALYTICS";
        $lines[] = str_repeat("-", 80);
        $lines[] = "";
        
        $revenueAnalytics = $this->getRevenueAnalytics($storeId);
        $lines[] = "Metric,Amount (IDR),Percentage";
        
        foreach ($revenueAnalytics as $row) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
        }
        $lines[] = "";
        $lines[] = "";

        // SECTION 3: PRODUCT PERFORMANCE
        $lines[] = "SECTION 3: PRODUCT PERFORMANCE ANALYSIS";
        $lines[] = str_repeat("-", 80);
        $lines[] = "";
        
        // 3.1 Top Selling Products
        $lines[] = "3.1 TOP 10 BEST SELLING PRODUCTS";
        $lines[] = "";
        $topProducts = $this->getTopProducts($storeId);
        
        if (!empty($topProducts)) {
            $lines[] = "Rank,Product Name,Category,Units Sold,Revenue (IDR),Avg Price (IDR),Market Share (%)";
            $rank = 1;
            foreach ($topProducts as $product) {
                $lines[] = $rank . "," . 
                          $this->csvEscape($product['name']) . "," . 
                          $this->csvEscape($product['category']) . "," . 
                          $product['total_sold'] . "," . 
                          $this->formatNumber($product['total_revenue']) . "," .
                          $this->formatNumber($product['avg_price']) . "," .
                          $product['market_share'];
                $rank++;
            }
        } else {
            $lines[] = "No sales data available for this period";
        }
        $lines[] = "";
        
        // 3.2 Category Performance
        $lines[] = "3.2 CATEGORY PERFORMANCE";
        $lines[] = "";
        $categoryPerf = $this->getCategoryPerformance($storeId);
        
        if (!empty($categoryPerf)) {
            $lines[] = "Category,Products Count,Total Sales,Revenue (IDR),Avg Price (IDR),Stock Level";
            foreach ($categoryPerf as $row) {
                $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
            }
        } else {
            $lines[] = "No category data available";
        }
        $lines[] = "";
        
        // 3.3 Low Performing Products
        $lines[] = "3.3 LOW PERFORMING PRODUCTS (Action Required)";
        $lines[] = "";
        $lowPerforming = $this->getLowPerformingProducts($storeId);
        
        if (!empty($lowPerforming)) {
            $lines[] = "Product Name,Category,Current Stock,Units Sold (30d),Days Since Last Sale,Recommendation";
            foreach ($lowPerforming as $row) {
                $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
            }
        } else {
            $lines[] = "All products performing well";
        }
        $lines[] = "";
        $lines[] = "";

        // SECTION 4: INVENTORY MANAGEMENT
        $lines[] = "SECTION 4: INVENTORY MANAGEMENT";
        $lines[] = str_repeat("-", 80);
        $lines[] = "";
        
        // 4.1 Stock Status Summary
        $lines[] = "4.1 STOCK STATUS SUMMARY";
        $lines[] = "";
        $stockSummary = $this->getStockStatusSummary($storeId);
        $lines[] = "Status,Product Count,Total Value (IDR),Percentage";
        foreach ($stockSummary as $row) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
        }
        $lines[] = "";
        
        // 4.2 Current Inventory
        $lines[] = "4.2 COMPLETE PRODUCT INVENTORY";
        $lines[] = "";
        $inventory = $this->getInventory($storeId);
        
        if (!empty($inventory)) {
            $lines[] = "ID,Product Name,Category,Stock Qty,Unit Price (IDR),Total Value (IDR),Status,Turnover Rate,Reorder Recommendation";
            foreach ($inventory as $row) {
                $turnover = $this->calculateTurnoverRate($storeId, $row['product_id']);
                $reorder = $this->getReorderRecommendation($row['stock'], $turnover);
                $lines[] = $row['product_id'] . "," .
                          $this->csvEscape($row['name']) . "," .
                          $this->csvEscape($row['category']) . "," .
                          $row['stock'] . "," .
                          $this->formatNumber($row['price']) . "," .
                          $this->formatNumber($row['total_value']) . "," .
                          $row['stock_status'] . "," .
                          $turnover . "," .
                          $reorder;
            }
        } else {
            $lines[] = "No products in inventory";
        }
        $lines[] = "";
        $lines[] = "";

        // SECTION 5: ORDER ANALYTICS
        $lines[] = "SECTION 5: ORDER ANALYTICS";
        $lines[] = str_repeat("-", 80);
        $lines[] = "";
        
        // 5.1 Order Status Breakdown
        $lines[] = "5.1 ORDER STATUS BREAKDOWN";
        $lines[] = "";
        $orderStatus = $this->getOrderStatusBreakdown($storeId);
        $lines[] = "Status,Order Count,Total Value (IDR),Percentage,Avg Processing Time (hours)";
        foreach ($orderStatus as $row) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
        }
        $lines[] = "";
        
        // 5.2 Recent Orders
        $lines[] = "5.2 RECENT ORDERS (Last 50 Transactions)";
        $lines[] = "";
        $orders = $this->getRecentOrders($storeId);
        
        if (!empty($orders)) {
            $lines[] = "Order ID,Date & Time,Product,Quantity,Unit Price (IDR),Subtotal (IDR),Status,Customer,Days Since Order";
            foreach ($orders as $order) {
                $daysSince = $this->calculateDaysSince($order['order_date']);
                $lines[] = $order['order_id'] . "," .
                          $order['order_date'] . "," .
                          $this->csvEscape($order['product_name']) . "," .
                          $order['qty'] . "," .
                          $this->formatNumber($order['price_at']) . "," .
                          $this->formatNumber($order['subtotal']) . "," .
                          $order['status'] . "," .
                          $this->csvEscape($order['customer_name']) . "," .
                          $daysSince . " days";
            }
        } else {
            $lines[] = "No orders in this period";
        }
        $lines[] = "";
        $lines[] = "";

        // SECTION 6: CUSTOMER INSIGHTS
        $lines[] = "SECTION 6: CUSTOMER INSIGHTS";
        $lines[] = str_repeat("-", 80);
        $lines[] = "";
        
        // 6.1 Customer Segmentation
        $lines[] = "6.1 CUSTOMER SEGMENTATION";
        $lines[] = "";
        $customerSegments = $this->getCustomerSegmentation($storeId);
        $lines[] = "Segment,Customer Count,Avg Order Value (IDR),Total Revenue (IDR)";
        foreach ($customerSegments as $row) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($row)));
        }
        $lines[] = "";
        
        // 6.2 Top Customers
        $lines[] = "6.2 TOP 10 CUSTOMERS BY LIFETIME VALUE";
        $lines[] = "";
        $topCustomers = $this->getTopCustomers($storeId);
        
        if (!empty($topCustomers)) {
            $lines[] = "Rank,Customer Name,Email,Total Orders,Total Spent (IDR),Avg Order Value (IDR),Last Purchase Date,Customer Segment";
            $rank = 1;
            foreach ($topCustomers as $customer) {
                $segment = $this->determineCustomerSegment($customer['total_spent']);
                $lines[] = $rank . "," .
                          $this->csvEscape($customer['full_name']) . "," .
                          $this->csvEscape($customer['email']) . "," .
                          $customer['total_orders'] . "," .
                          $this->formatNumber($customer['total_spent']) . "," .
                          $this->formatNumber($customer['avg_order_value']) . "," .
                          $customer['last_purchase'] . "," .
                          $segment;
                $rank++;
            }
        } else {
            $lines[] = "No customer data available";
        }
        $lines[] = "";
        $lines[] = "";

        // SECTION 7: BUSINESS RECOMMENDATIONS
        $lines[] = "SECTION 7: BUSINESS RECOMMENDATIONS";
        $lines[] = str_repeat("-", 80);
        $lines[] = "";
        
        $recommendations = $this->generateRecommendations($storeId, $salesSummary, $topProducts, $inventory);
        $lines[] = "Priority,Category,Recommendation,Expected Impact,Action Items";
        foreach ($recommendations as $rec) {
            $lines[] = implode(',', array_map([$this, 'csvEscape'], array_values($rec)));
        }

        return implode("\n", $lines);
    }

    // Helper Methods
    
    private function formatNumber($value): string
    {
        if ($value === null || $value === '') {
            return '0';
        }
        
        $numValue = is_numeric($value) ? (float)$value : 0;
        return number_format($numValue, 0, ',', '.');
    }
    
    private function csvEscape($value): string
    {
        if ($value === null) return '';
        $value = (string) $value;
        if (strpos($value, ',') !== false || strpos($value, '"') !== false || strpos($value, "\n") !== false) {
            return '"' . str_replace('"', '""', $value) . '"';
        }
        return $value;
    }

    private function getPerformanceIndicator(string $metric, $value): string
    {
        if (str_contains($metric, 'Revenue')) {
            $numValue = (int) filter_var($value, FILTER_SANITIZE_NUMBER_INT);
            if ($numValue > 10000000) return "Excellent";
            if ($numValue > 5000000) return "Good";
            if ($numValue > 1000000) return "Fair";
            return "Needs Improvement";
        }
        
        if (str_contains($metric, 'Orders')) {
            if ($value > 50) return "Excellent";
            if ($value > 20) return "Good";
            if ($value > 5) return "Fair";
            return "Needs Improvement";
        }
        
        return "Neutral";
    }

    private function calculateTurnoverRate(int $storeId, int $productId): string
    {
        try {
            $sql = "
                SELECT 
                    COALESCE(SUM(oi.qty), 0) as total_sold,
                    p.stock
                FROM products p
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id
                WHERE p.product_id = :product_id
                AND (o.created_at >= NOW() - INTERVAL '30 days' OR o.created_at IS NULL)
                GROUP BY p.stock
            ";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute(['product_id' => $productId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result || $result['stock'] == 0) return "N/A";
            
            $turnover = ($result['total_sold'] / ($result['stock'] + $result['total_sold'])) * 100;
            return number_format($turnover, 1) . "%";
            
        } catch (\Exception $e) {
            return "N/A";
        }
    }

    private function getReorderRecommendation(int $stock, string $turnover): string
    {
        $turnoverRate = (float) str_replace('%', '', $turnover);
        
        if ($stock == 0) return "URGENT: Out of Stock";
        if ($stock < 10 && $turnoverRate > 50) return "HIGH: Reorder Immediately";
        if ($stock < 20 && $turnoverRate > 30) return "MEDIUM: Reorder Soon";
        if ($stock < 50 && $turnoverRate > 20) return "LOW: Monitor Stock";
        return "OK: Stock Sufficient";
    }

    private function calculateDaysSince(string $date): int
    {
        $orderDate = new \DateTime($date);
        $now = new \DateTime();
        return $now->diff($orderDate)->days;
    }

    private function determineCustomerSegment(float $totalSpent): string
    {
        if ($totalSpent >= 10000000) return "VIP";
        if ($totalSpent >= 5000000) return "Premium";
        if ($totalSpent >= 1000000) return "Regular";
        return "New";
    }

    // Methods to get business analytics data and insights

    private function getSalesSummary(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    COUNT(DISTINCT o.order_id) AS total_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'received' THEN o.order_id END) AS completed_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.order_id END) AS pending_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'rejected' THEN o.order_id END) AS rejected_orders,
                    COALESCE(SUM(CASE WHEN o.status = 'received' THEN oi.subtotal ELSE 0 END), 0) AS total_revenue,
                    COALESCE(AVG(CASE WHEN o.status = 'received' THEN oi.subtotal END), 0) AS avg_order_value,
                    COUNT(DISTINCT o.buyer_id) AS unique_customers
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                WHERE p.store_id = :store_id
                AND o.created_at >= NOW() - INTERVAL '30 days'
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            $totalOrders = (int)($result['total_orders'] ?? 0);
            $completedOrders = (int)($result['completed_orders'] ?? 0);
            $conversionRate = $totalOrders > 0 ? ($completedOrders / $totalOrders) * 100 : 0;

            return [
                'Total Orders' => $totalOrders,
                'Completed Orders' => $completedOrders,
                'Pending Orders' => $result['pending_orders'] ?? 0,
                'Rejected Orders' => $result['rejected_orders'] ?? 0,
                'Conversion Rate' => number_format($conversionRate, 1) . '%',
                'Unique Customers' => $result['unique_customers'] ?? 0,
                'Total Revenue (IDR)' => 'Rp ' . $this->formatNumber($result['total_revenue']),
                'Average Order Value (IDR)' => 'Rp ' . $this->formatNumber($result['avg_order_value'])
            ];
        } catch (\Exception $e) {
            error_log("getSalesSummary error: " . $e->getMessage());
            return [];
        }
    }

    private function getRevenueAnalytics(int $storeId): array
    {
        try {
            $sql = "
                WITH revenue_data AS (
                    SELECT 
                        SUM(CASE WHEN o.status = 'received' THEN oi.subtotal ELSE 0 END) as completed_revenue,
                        SUM(CASE WHEN o.status = 'pending' THEN oi.subtotal ELSE 0 END) as pending_revenue,
                        SUM(CASE WHEN o.status IN ('approved', 'on_delivery') THEN oi.subtotal ELSE 0 END) as in_progress_revenue,
                        SUM(oi.subtotal) as total_potential_revenue
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE p.store_id = :store_id
                    AND o.created_at >= NOW() - INTERVAL '30 days'
                )
                SELECT 
                    'Realized Revenue' as metric,
                    COALESCE(completed_revenue, 0) as amount,
                    CASE WHEN total_potential_revenue > 0 
                        THEN ROUND((completed_revenue / total_potential_revenue * 100)::numeric, 1)
                        ELSE 0 
                    END || '%' as percentage
                FROM revenue_data
                UNION ALL
                SELECT 
                    'Revenue in Progress' as metric,
                    COALESCE(in_progress_revenue, 0) as amount,
                    CASE WHEN total_potential_revenue > 0 
                        THEN ROUND((in_progress_revenue / total_potential_revenue * 100)::numeric, 1)
                        ELSE 0 
                    END || '%' as percentage
                FROM revenue_data
                UNION ALL
                SELECT 
                    'Pending Revenue' as metric,
                    COALESCE(pending_revenue, 0) as amount,
                    CASE WHEN total_potential_revenue > 0 
                        THEN ROUND((pending_revenue / total_potential_revenue * 100)::numeric, 1)
                        ELSE 0 
                    END || '%' as percentage
                FROM revenue_data
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($results as &$row) {
                $row['amount'] = $this->formatNumber($row['amount']);
            }

            return $results;
        } catch (\Exception $e) {
            error_log("getRevenueAnalytics error: " . $e->getMessage());
            return [];
        }
    }

    private function getCategoryPerformance(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    COALESCE(c.name, 'Uncategorized') as category,
                    COUNT(DISTINCT p.product_id) as products_count,
                    COALESCE(SUM(oi.qty), 0) as total_sales,
                    COALESCE(SUM(oi.subtotal), 0) as revenue,
                    COALESCE(AVG(oi.price_at), 0) as avg_price,
                    SUM(p.stock) as stock_level
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.category_id
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status = 'received'
                WHERE p.store_id = :store_id
                AND p.is_deleted = FALSE
                AND (o.created_at >= NOW() - INTERVAL '30 days' OR o.created_at IS NULL)
                GROUP BY c.name
                ORDER BY revenue DESC
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($results as &$row) {
                $row['revenue'] = $this->formatNumber($row['revenue']);
                $row['avg_price'] = $this->formatNumber($row['avg_price']);
            }

            return $results;
        } catch (\Exception $e) {
            error_log("getCategoryPerformance error: " . $e->getMessage());
            return [];
        }
    }

    private function getLowPerformingProducts(int $storeId): array
    {
        try {
            $sql = "
                SELECT 
                    p.name as product_name,
                    COALESCE(c.name, 'Uncategorized') as category,
                    p.stock as current_stock,
                    COALESCE(SUM(oi.qty), 0) as units_sold,
                    COALESCE(
                        EXTRACT(DAY FROM (NOW() - MAX(o.created_at))),
                        999
                    ) as days_since_last_sale,
                    CASE 
                        WHEN COALESCE(SUM(oi.qty), 0) = 0 AND p.stock > 20 THEN 'Consider Discount or Promotion'
                        WHEN COALESCE(SUM(oi.qty), 0) < 3 AND p.stock > 50 THEN 'Review Pricing'
                        WHEN EXTRACT(DAY FROM (NOW() - MAX(o.created_at))) > 14 THEN 'Marketing Campaign Needed'
                        ELSE 'Monitor Closely'
                    END as recommendation
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.category_id
                LEFT JOIN order_items oi ON p.product_id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.order_id 
                    AND o.status = 'received'
                    AND o.created_at >= NOW() - INTERVAL '30 days'
                WHERE p.store_id = :store_id
                AND p.is_deleted = FALSE
                GROUP BY p.product_id, p.name, c.name, p.stock
                HAVING COALESCE(SUM(oi.qty), 0) < 5 OR MAX(o.created_at) < NOW() - INTERVAL '14 days' OR MAX(o.created_at) IS NULL
                ORDER BY units_sold ASC, days_since_last_sale DESC
                LIMIT 10
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Exception $e) {
            error_log("getLowPerformingProducts error: " . $e->getMessage());
            return [];
        }
    }

    private function getStockStatusSummary(int $storeId): array
    {
        try {
            $sql = "
                WITH stock_data AS (
                    SELECT 
                        CASE 
                            WHEN stock = 0 THEN 'Out of Stock'
                            WHEN stock < 10 THEN 'Low Stock'
                            WHEN stock < 50 THEN 'Medium Stock'
                            ELSE 'High Stock'
                        END as status,
                        COUNT(*) as product_count,
                        SUM(stock * price) as total_value
                    FROM products
                    WHERE store_id = :store_id
                    AND is_deleted = FALSE
                    GROUP BY status
                ),
                totals AS (
                    SELECT SUM(product_count) as total_products FROM stock_data
                )
                SELECT 
                    sd.status,
                    sd.product_count,
                    sd.total_value,
                    ROUND((sd.product_count::numeric / t.total_products * 100), 1) || '%' as percentage
                FROM stock_data sd
                CROSS JOIN totals t
                ORDER BY 
                    CASE sd.status
                        WHEN 'Out of Stock' THEN 1
                        WHEN 'Low Stock' THEN 2
                        WHEN 'Medium Stock' THEN 3
                        WHEN 'High Stock' THEN 4
                    END
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($results as &$row) {
                $row['total_value'] = $this->formatNumber($row['total_value']);
            }

            return $results;
        } catch (\Exception $e) {
            error_log("getStockStatusSummary error: " . $e->getMessage());
            return [];
        }
    }

    private function getOrderStatusBreakdown(int $storeId): array
    {
        try {
            $sql = "
                WITH order_stats AS (
                    SELECT 
                        o.status,
                        COUNT(DISTINCT o.order_id) as order_count,
                        SUM(o.total_amount) as total_value,
                        AVG(
                            CASE 
                                WHEN o.confirmed_at IS NOT NULL 
                                THEN EXTRACT(EPOCH FROM (o.confirmed_at - o.created_at)) / 3600
                                ELSE NULL
                            END
                        ) as avg_processing_hours
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE p.store_id = :store_id
                    AND o.created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY o.status
                ),
                totals AS (
                    SELECT SUM(order_count) as total_orders FROM order_stats
                )
                SELECT 
                    os.status,
                    os.order_count,
                    os.total_value,
                    ROUND((os.order_count::numeric / t.total_orders * 100), 1) || '%' as percentage,
                    COALESCE(ROUND(os.avg_processing_hours::numeric, 1), 0) as avg_processing_time
                FROM order_stats os
                CROSS JOIN totals t
                ORDER BY os.order_count DESC
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($results as &$row) {
                $row['total_value'] = $this->formatNumber($row['total_value']);
            }

            return $results;
        } catch (\Exception $e) {
            error_log("getOrderStatusBreakdown error: " . $e->getMessage());
            return [];
        }
    }

    private function getCustomerSegmentation(int $storeId): array
    {
        try {
            $sql = "
                WITH customer_spending AS (
                    SELECT 
                        o.buyer_id,
                        SUM(CASE WHEN o.status = 'received' THEN o.total_amount ELSE 0 END) as total_spent,
                        AVG(CASE WHEN o.status = 'received' THEN o.total_amount END) as avg_order_value
                    FROM orders o
                    JOIN order_items oi ON o.order_id = oi.order_id
                    JOIN products p ON oi.product_id = p.product_id
                    WHERE p.store_id = :store_id
                    GROUP BY o.buyer_id
                )
                SELECT 
                    CASE 
                        WHEN total_spent >= 10000000 THEN 'VIP (10M+)'
                        WHEN total_spent >= 5000000 THEN 'Premium (5M-10M)'
                        WHEN total_spent >= 1000000 THEN 'Regular (1M-5M)'
                        ELSE 'New (<1M)'
                    END as segment,
                    COUNT(*) as customer_count,
                    ROUND(AVG(avg_order_value)) as avg_order_value,
                    SUM(total_spent) as total_revenue
                FROM customer_spending
                GROUP BY segment
                ORDER BY total_revenue DESC
            ";

            $stmt = $this->db->prepare($sql);
            $stmt->execute(['store_id' => $storeId]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($results as &$row) {
                $row['avg_order_value'] = $this->formatNumber($row['avg_order_value']);
                $row['total_revenue'] = $this->formatNumber($row['total_revenue']);
            }

            return $results;
        } catch (\Exception $e) {
            error_log("getCustomerSegmentation error: " . $e->getMessage());
            return [];
        }
    }

    private function generateRecommendations(int $storeId, array $salesSummary, array $topProducts, array $inventory): array
    {
        $recommendations = [];
        
        // Check revenue
        $revenue = (int) filter_var($salesSummary['Total Revenue (IDR)'] ?? '0', FILTER_SANITIZE_NUMBER_INT);
        if ($revenue < 1000000) {
            $recommendations[] = [
                'priority' => 'HIGH',
                'category' => 'Revenue Growth',
                'recommendation' => 'Revenue below target. Consider running promotional campaigns or bundle offers',
                'expected_impact' => '+20-30% sales',
                'action_items' => '1) Create flash sales 2) Offer bundle discounts 3) Email marketing campaign'
            ];
        }

        // Check conversion rate
        $conversionRate = (float) str_replace('%', '', $salesSummary['Conversion Rate'] ?? '0');
        if ($conversionRate < 50) {
            $recommendations[] = [
                'priority' => 'MEDIUM',
                'category' => 'Order Fulfillment',
                'recommendation' => 'Low conversion rate detected. Improve order approval speed and customer communication',
                'expected_impact' => '+15% conversion',
                'action_items' => '1) Respond to orders within 2 hours 2) Add order tracking 3) Send status updates'
            ];
        }

        // Check inventory
        $lowStock = array_filter($inventory, fn($item) => $item['stock_status'] === 'Low Stock' || $item['stock_status'] === 'Out of Stock');
        if (count($lowStock) > 0) {
            $recommendations[] = [
                'priority' => 'MEDIUM-HIGH',
                'category' => 'Inventory Management',
                'recommendation' => count($lowStock) . ' products have low/no stock. Restock high-demand items immediately',
                'expected_impact' => 'Prevent lost sales',
                'action_items' => '1) Review reorder points 2) Contact suppliers 3) Setup automatic restock alerts'
            ];
        }

        // Check product diversity
        if (count($topProducts) < 5) {
            $recommendations[] = [
                'priority' => 'LOW',
                'category' => 'Product Portfolio',
                'recommendation' => 'Limited product variety. Expand catalog to attract more customers',
                'expected_impact' => '+25% customer base',
                'action_items' => '1) Market research 2) Add complementary products 3) Test new categories'
            ];
        }

        // Default positive recommendation
        if (empty($recommendations)) {
            $recommendations[] = [
                'priority' => 'INFO',
                'category' => 'Performance',
                'recommendation' => 'Store performance is healthy. Focus on customer retention and upselling',
                'expected_impact' => 'Sustained growth',
                'action_items' => '1) Loyalty program 2) Cross-selling strategies 3) Customer feedback collection'
            ];
        }

        return $recommendations;
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
                WITH product_sales AS (
                    SELECT 
                        p.name,
                        COALESCE(c.name, 'Uncategorized') AS category,
                        SUM(oi.qty) AS total_sold,
                        SUM(oi.subtotal) AS total_revenue,
                        AVG(oi.price_at) AS avg_price
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.product_id
                    LEFT JOIN categories c ON p.category_id = c.category_id
                    JOIN orders o ON oi.order_id = o.order_id
                    WHERE p.store_id = :store_id
                    AND o.status = 'received'
                    AND o.created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY p.product_id, p.name, c.name
                ),
                total_revenue AS (
                    SELECT SUM(total_revenue) as total FROM product_sales
                )
                SELECT 
                    ps.name,
                    ps.category,
                    ps.total_sold,
                    ps.total_revenue,
                    ps.avg_price,
                    ROUND((ps.total_revenue / tr.total * 100)::numeric, 1) || '%' as market_share
                FROM product_sales ps
                CROSS JOIN total_revenue tr
                ORDER BY ps.total_sold DESC
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
                    COALESCE(SUM(CASE WHEN o.status = 'received' THEN o.total_amount ELSE 0 END), 0) AS total_spent,
                    COALESCE(AVG(CASE WHEN o.status = 'received' THEN o.total_amount END), 0) AS avg_order_value,
                    TO_CHAR(MAX(o.created_at), 'YYYY-MM-DD') AS last_purchase
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
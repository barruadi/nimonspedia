<?php

namespace App\Controllers\Buyer;

use App\Models\Product;
use App\Models\Store;
use App\Models\Review;
use App\Services\SearchService;
use App\Core\View;
use App\Core\Database;
use PDO;

class ProductController
{
    public function getProductDetail($productId)
    {
        $product = Product::findDetailById((int) $productId);
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Produk tidak ditemukan'];
        }

        $store = Store::findById($product['store_id']);

        $db = Database::getInstance();
        $auctionStmt = $db->prepare("
            SELECT auction_id, status, start_time, end_time
            FROM auctions
            WHERE product_id = :product_id
            AND status IN ('scheduled', 'active')
            ORDER BY start_time DESC
            LIMIT 1
        ");
        $auctionStmt->execute(['product_id' => $productId]);
        $auction = $auctionStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        // Get review statistics
        $reviewStats = Review::getProductStats((int) $productId);

        // Get latest reviews (first 5)
        $latestReviews = Review::getByProductId((int) $productId, 5, 0);

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'product' => $product,
                'store' => $store ?? null,
                'auction' => $auction,
                'reviews' => [
                    'stats' => $reviewStats,
                    'latest' => $latestReviews
                ]
            ]
        ];
    }
      
    public function showAllProducts(): void 
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if ($user) {   
            if ($user['role'] === 'seller') {
                header('location: /seller/dashboard');
                exit;
            }
        }
        
        $q = isset($_GET['q']) ? trim($_GET['q']) : null;
    
        // always-array categories
        $categories = [];
        if (isset($_GET['categories'])) {
            $raw = $_GET['categories'];
            if (is_array($raw)) {
                $categories = $raw;
            } else {
                $categories = explode(',', (string)$raw);
            }
            $categories = array_values(array_filter(array_map(fn($v) => trim((string)$v), $categories), fn($v) => $v !== ''));
        }
    
        $minPrice  = isset($_GET['min_price']) && $_GET['min_price'] !== ''
            ? (float) $_GET['min_price'] : null;
        $maxPrice  = isset($_GET['max_price']) && $_GET['max_price'] !== ''
            ? (float) $_GET['max_price'] : null;

        $page      = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $perPage   = isset($_GET['per_page']) ? (int) $_GET['per_page'] : 12;

        if ($page < 1) $page = 1;
        if ($perPage < 1)  $perPage = 12;
        if ($perPage > 60) $perPage = 60;

        $offset = ($page - 1) * $perPage;

        // Use advanced search if query exists, otherwise regular search
        if (!empty($q)) {
            $result = SearchService::search($q, $categories, $minPrice, $maxPrice, $perPage, $offset);
            $products = $result['products'];
            $totalItems = $result['total'];
            
            error_log("Advanced Search: '{$q}' expanded to [" . implode(', ', $result['expanded_terms']) . "], found {$totalItems} products");
        } else {
            $totalItems = Product::countFiltered($q, $categories, $minPrice, $maxPrice);
            $products   = Product::findFiltered($q, $categories, $minPrice, $maxPrice, $perPage, $offset);
        }

        // Pagination
        $totalPages = max(1, (int) ceil($totalItems / $perPage));
        if ($page > $totalPages) {
            $page = $totalPages;
        }

        $pagination = [
            'page'        => $page,
            'perPage'     => $perPage,
            'totalPages'  => $totalPages,
            'totalItems'  => $totalItems,
            'hasPrev'     => $page > 1,
            'hasNext'     => $page < $totalPages,
            'prevPage'    => ($page > 1) ? $page - 1 : null,
            'nextPage'    => ($page < $totalPages) ? $page + 1 : null,
        ];

        $title = !empty($q) ? "Search: {$q}" : "Browse Products";
        $wantsJson =
            isset($_GET['ajax']) && $_GET['ajax'] === '1' ||
            (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'fetch');

        if ($wantsJson) {
            header('Content-Type: application/json');
            echo json_encode([
                'products'   => $products,
                'pagination' => $pagination,
            ]);
            return;
        }
        
        View::render('ProductDiscover.php', [
            'title'       => $title,
            'products'    => $products,
            'pagination'  => $pagination,
            'filters'     => [
                'q'         => $q,
                // keep key name 'category' but value is now the array
                'category'  => $categories,
                'min_price' => $minPrice,
                'max_price' => $maxPrice,
            ],
            'sessionUser' => $_SESSION['user'] ?? null,
        ]);
        
        return;
    }

    
    public function getAllCategories(): array
    {
        $db = Database::getInstance();
        
        $stmt = $db->query("
            SELECT category_id, name
            FROM categories
        ");
        
        $cat = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (!$cat) {
            http_response_code(404);
            echo "Terjadi keasalahan";
            return [];
        }

        return [
            'ok' => true,
            'categories' => $cat
        ];
    }
}
<?php

namespace App\Controllers\Buyer;

use App\Models\Product;
use App\Models\Store;
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

        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'product' => $product,
                'store' => $store ?? null
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
        
        $q         = isset($_GET['q']) ? trim($_GET['q']) : null;
        $category  = isset($_GET['category']) ? trim($_GET['category']) : null;
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
            // Advanced search with fuzzy matching and synonyms
            $result = SearchService::search($q, $category, $minPrice, $maxPrice, $perPage, $offset);
            $products = $result['products'];
            $totalItems = $result['total'];
            
            error_log("Advanced Search: '{$q}' expanded to [" . implode(', ', $result['expanded_terms']) . "], found {$totalItems} products");
        } else {
            // Regular search
            $totalItems = Product::countFiltered($q, $category, $minPrice, $maxPrice);
            $products   = Product::findFiltered($q, $category, $minPrice, $maxPrice, $perPage, $offset);
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

        // AJAX response
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
                'category'  => $category,
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
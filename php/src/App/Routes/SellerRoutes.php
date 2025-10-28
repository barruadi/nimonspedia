<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Seller\{DashboardController, ProductManagementController};

$auth = AuthMiddleware::requireAuth();
// TODO: Add role check for 'seller' here, may be something like below
// $auth = AuthMiddleware::requireRole('seller');


$router->group([
  'prefix'      => '/api/seller',
  'middleware'  => [$auth],
  /* TODO: If sellerOnly middleware is already defined
    'middleware'  => [$auth, $sellerOnly],  */
    ], function($r) {
        $r->get('/dashboard', fn($req) => (new DashboardController())->showDashboard());
        $r->get('/products/add',  fn($req) => (new ProductManagementController())->showAddProductForm());
        $r->post('/products/add', fn($req) => (new ProductManagementController())->handleAddProduct($req));
        $r->get('/products/edit/{id}',  fn($req, $id) => (new ProductManagementController())->showEditProductForm($id));
        $r->post('/products/edit/{id}', fn($req, $id) => (new ProductManagementController())->handleEditProduct($req, $id));
    }); 

// PUBLIC ENDPOINTS
// GET /api/categories - to populate categories dropdown
$router->get('/api/categories', function() {
    $db = \App\Core\Database::getInstance();
    $stmt = $db->query("SELECT category_id, name FROM categories ORDER BY name");
    $categories = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    
    echo json_encode([
        'ok' => true,
        'data' => $categories
    ], JSON_UNESCAPED_SLASHES);
    
    exit; 
});

// SANITY CHECKS
$router->get('/api/me', function ($req) {
    $u = $_SESSION['user'] ?? null;
    return [
        'authenticated' => (bool)$u,
        'user' => $u ? [
            'id'    => $u['id'],
            'name'  => $u['name'],
            'email' => $u['email'],
            'role'  => $u['role'],
        ] : null
    ];
});

$router->post('/api/_echo', fn($req) => [
  'content_type' => $_SERVER['CONTENT_TYPE'] ?? null,
  'body' => $req['body'],
]);
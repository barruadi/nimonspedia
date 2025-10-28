<?php

use App\Core;

use App\Core\Application;
use App\Models\Categories;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Seller\{DashboardController, ProductManagementController};

$auth = AuthMiddleware::requireAuth();

$router->group([
  'prefix'      => '/api/seller',
  'middleware'  => [$auth],
    ], function($r) {
        $r->get('/dashboard',           fn($req) => (new DashboardController())->showDashboard());
        $r->get('/products',            fn($req) => (new ProductManagementController())->getStoreProducts());
        $r->get('/products/add',        fn($req) => (new ProductManagementController())->showAddProductForm());
        $r->post('/products/add',       fn($req) => (new ProductManagementController())->handleAddProduct($req));
        $r->get('/products/edit/{id}',  fn($req, $id) => (new ProductManagementController())->showEditProductForm($id));
        $r->post('/products/edit/{id}', fn($req, $id) => (new ProductManagementController())->handleEditProduct($req, $id));
    }); 

// Public Endpoints (can be called from non-sellers)
// GET /api/categories return categories list
$router->get('/api/categories', function() {
    $categories = Categories::getAll();
    
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    
    echo json_encode([
        'ok' => true,
        'data' => $categories
    ], JSON_UNESCAPED_SLASHES);
    
    exit; 
});

// Sanity Checks (get and post)
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
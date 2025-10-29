<?php

use App\Core;
use App\Core\Application;
use App\Models\Category;
use App\Middlewares\{AuthMiddleware, RoleMiddleware};
use App\Controllers\Seller\{DashboardController, ProductManagementController, OrderManagementController};

$auth = AuthMiddleware::requireAuth();
$roleSeller = RoleMiddleware::allow(['seller']);

$router->group([
    'prefix'      => '/api/seller',
    'middleware'  => [$auth, $roleSeller],
], function($r) {
    $r->get('/dashboard',                   fn($req) => DashboardController::showDashboard());
    $r->put('/store',                       fn($req) => DashboardController::updateStoreInfo($req));
    $r->get('/products',                    fn($req) => ProductManagementController::getStoreProducts());
    $r->get('/products/add',                fn($req) => ProductManagementController::showAddProductForm());
    $r->post('/products/add',               fn($req) => ProductManagementController::handleAddProduct($req));
    $r->get('/products/edit/{id}',          fn($req, $id) => ProductManagementController::showEditProductForm($id)); 
    $r->put('/products/edit/{id}',          fn($req, $id) => ProductManagementController::handleEditProduct($req, $id));
    $r->delete('/products/{id}',            fn($req, $id) => ProductManagementController::deleteProduct($id)); 
    $r->get('/orders',                      fn($req) => OrderManagementController::getStoreOrders());
    $r->put('/orders/approve/{id}',         fn($req, $id) => OrderManagementController::approveOrder($id));
    $r->put('/orders/delivery-time{id}/',   fn($req, $id) => OrderManagementController::setDeliveryTime($id, $req['body']['delivery_time'] ?? ''));
}); 

// Public Endpoints (can be called from non-sellers)
// GET /api/Category return Category list
$router->get('/api/Category', function() {
    $Category = Category::getAll();
    
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    
    echo json_encode([
        'ok' => true,
        'data' => $Category
    ], JSON_UNESCAPED_SLASHES);
    
    exit; 
});



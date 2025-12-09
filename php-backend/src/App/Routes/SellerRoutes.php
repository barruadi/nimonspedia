<?php

use App\Models\Category;
use App\Middlewares\{AuthMiddleware, RoleMiddleware};
use App\Controllers\Seller\{DashboardController, ProductManagementController, OrderManagementController, ExportController, ReviewManagementController};

$auth = AuthMiddleware::requireAuth();
$roleSeller = RoleMiddleware::allow(['seller']);

$router->group([
    'prefix'      => '/api/seller',
    'middleware'  => [$auth, $roleSeller],
], function($r) {
    $r->get('/dashboard',                   fn($req) => DashboardController::showDashboard());
    $r->post('/store/update',               fn($req) => DashboardController::updateStoreInfo($req));
    $r->get('/export',                      fn($req) => ExportController::exportData());
    $r->get('/products',                    fn($req) => ProductManagementController::getStoreProducts());
    $r->get('/products/add',                fn($req) => ProductManagementController::showAddProductForm());
    $r->post('/products/add',               fn($req) => ProductManagementController::handleAddProduct($req));
    $r->get('/products/edit/{id}',          fn($req, $id) => ProductManagementController::showEditProductForm($id)); 
    $r->post('/products/edit/{id}',         fn($req, $id) => ProductManagementController::handleEditProduct($req, $id));
    $r->get('/products/auction/{id}',       fn($req, $id) => ProductManagementController::showAuctionForm($id));
    $r->delete('/products/{id}',            fn($req, $id) => ProductManagementController::deleteProduct($id)); 
    $r->get('/orders',                      fn($req) => OrderManagementController::getStoreOrders());
    $r->get('/orders/detail/{id}',          fn($req, $id) => OrderManagementController::getOrderDetail($id));
    $r->put('/orders/approve/{id}',         fn($req, $id) => OrderManagementController::approveOrder($id));
    $r->put('/orders/reject/{id}', function($req, $id) {
        $body = $req['body'] ?? [];
        $rejectReason = $body['reject_reason'] ?? '';
        return OrderManagementController::rejectOrder($id, $rejectReason);
    });
    $r->put('/orders/delivery/{id}', function($req, $id) {
        $body = $req['body'] ?? [];
        $deliveryDays = isset($body['delivery_days']) ? (int)$body['delivery_days'] : 0;
        return OrderManagementController::setDeliveryTime($id, $deliveryDays);
    });

    // Review management routes
    $r->post('/reviews/{id}/reply',         fn($req, $id) => ReviewManagementController::replyToReview($req, (int)$id));
    $r->put('/reviews/{id}/toggle',         fn($req, $id) => ReviewManagementController::toggleVisibility($req, (int)$id));
});

// Public Endpoint: GET /api/categories returns Category list
$router->get('/api/categories', function() {
    $Category = Category::findAll();
    
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    
    echo json_encode([
        'ok' => true,
        'data' => $Category
    ], JSON_UNESCAPED_SLASHES);
    
    exit; 
});



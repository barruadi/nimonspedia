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
    $r->get('/dashboard',                       fn($req) => (new DashboardController())->showDashboard());
    $r->get('/product-management/add',          fn($req) => (new ProductManagementController())->showAddProductForm());
    $r->post('/product-management/add',         fn($req) => (new ProductManagementController())->handleAddProductForm());
    $r->get('/product-management/edit/{id}',    fn($req, $id) => (new ProductManagementController())->showEditProductForm($id));
    $r->post('/product-management/edit/{id}',   fn($req, $id) => (new ProductManagementController())->handleEditProductForm($id));
}); 

// Sanity checks ------------------------
$router->get('/api/me', function ($req) {
    $u = $_SESSION['user'] ?? null;
    /* TODO: implement role check
    if (!$u || $u['role'] !== 'seller') {
        return ['authenticated' => false, 'message' => 'Not a seller'];
    }
    */
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
<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\{AuthMiddleware, RoleMiddleware}; 
use App\Controllers\Buyer\{ProductController, CartController, CheckoutController, StoreController, OrderController};

$auth = AuthMiddleware::requireAuth();
$roleBuyer = RoleMiddleware::allow(['buyer']); 

$router->get('/products', fn($req) => (new ProductController())->showAllProducts());

$router->get('/store/{id}', fn($req, $id) => (new StoreController())->showStoreDetail($req, (int)$id));

$router->group([
    'prefix' => '/api',
    'middlewares' => [$auth, $roleBuyer]
], function ($r) {
    $r->post('/cart/add', fn($req) => (new CartController())->addItemToCart($req));
    $r->patch('/cart',    fn($req) => (new CartController())->setQuantity($req));
    $r->get('/cart',    fn($req) => (new CartController())->showCart());
    $r->get('/orders',  fn($req) => (new OrderController())->showHistory($req));
    $r->post('/orders/received', fn($req) => (new OrderController())->markAsReceived($req));
});
<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\{AuthMiddleware, RoleMiddleware};
use App\Controllers\Buyer\{ProductController, CartController, CheckoutController, StoreController, OrderController};

$auth = AuthMiddleware::requireAuth();
$role = RoleMiddleware::allow(['seller']);

$router->get('/products', fn($req) => (new ProductController())->showAllProducts(), []);

$router->get('/checkout', fn($req) => (new CheckoutController())->showCheckout());
$router->post('/checkout/submit', fn($req) => (new CheckoutController())->confirmOrder());
$router->get('/checkout/success', fn($req) => (new CheckoutController())->successPage());
$router->post('/checkout/confirm', fn($req) => (new CheckoutController())->confirmOrder());
$router->get('/api/store/{id}', fn($req, $id) => StoreController::getStoreDetail($req, (int)$id));
$router->get('/store/{id}', fn($req, $id) => (new StoreController())->showStoreDetail($req, (int)$id));


$router->group([
    'prefix' => '/api',
    'middlewares' => [$auth]
], function ($r) {
    $r->post('/cart/add', fn($req) => (new CartController())->addProduct($req));
    $r->patch('/cart',    fn($req) => (new CartController())->setQuantity($req));
    $r->get('/cart',    fn($req) => (new CartController())->getCart());
    $r->get('/orders',  fn($req) => (new OrderController())->showHistory($req));
    // delete cart
    // delete product
    $r->post('/checkout/selection', fn($req) => (new CheckoutController())->saveSelection($req));
});
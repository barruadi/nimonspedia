<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Buyer\{ProductController, CartController, CheckoutController, StoreController, OrderController};

$auth = AuthMiddleware::requireAuth();

$router->get('/products', fn($req) => (new ProductController())->showAllProducts());

$router->get('/checkout', fn($req) => (new CheckoutController())->showCheckout());
$router->get('/checkout/success', fn($req) => (new CheckoutController())->successPage());
$router->post('/checkout/confirm', fn($req) => (new CheckoutController())->confirmOrder());
$router->get('/api/store/{id}', fn($req, $id) => StoreController::getStoreDetail($req, (int)$id));
$router->get('/store/{id}', fn($req, $id) => (new StoreController())->showStoreDetail($req, (int)$id));

$router->group([
    'prefix' => '/api',
    'middlewares' => [$auth]
], function ($r) {
    $r->post('/cart/add', fn($req) => (new CartController())->addItemToCart($req));
    $r->patch('/cart',    fn($req) => (new CartController())->setQuantity($req));
    $r->get('/cart',    fn($req) => (new CartController())->showCart());
    $r->get('/orders',  fn($req) => (new OrderController())->showHistory($req));
    // delete cart
    // delete product
});
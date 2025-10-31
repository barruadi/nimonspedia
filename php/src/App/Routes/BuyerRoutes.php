<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Buyer\{ProductController, CartController, CheckoutController};

$auth = AuthMiddleware::requireAuth();

$router->get('/products', fn($req) => (new ProductController())->showAllProducts());

$router->get('/checkout', fn($req) => (new CheckoutController())->showCheckout());
$router->get('/checkout/success', fn($req) => (new CheckoutController())->successPage());
$router->post('/checkout/confirm', fn($req) => (new CheckoutController())->confirmOrder());

$router->group([
    'prefix' => '/api',
    'middlewares' => [$auth]
], function ($r) {
    $r->post('/cart/add', fn($req) => (new CartController())->addProduct($req));
    $r->patch('/cart',    fn($req) => (new CartController())->setQuantity($req));
    // delete cart
    // delete product
});
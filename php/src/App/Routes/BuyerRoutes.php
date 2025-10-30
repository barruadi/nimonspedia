<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Buyer\{ProductController, CartController, CheckoutController};

$auth = AuthMiddleware::requireAuth();

$router->get('/products', fn($req) => (new ProductController())->showAllProducts());

$router->get('/checkout', fn($req) => (new CheckoutController())->showCheckout());


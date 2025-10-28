<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Buyer\ProductController;

$auth = AuthMiddleware::requireAuth();

$router->get('/products', fn($req) => (new ProductController())->showAllProducts());
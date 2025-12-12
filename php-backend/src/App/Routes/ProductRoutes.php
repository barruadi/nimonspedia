<?php

use App\Controllers\Buyer\ProductController;
use App\Controllers\Buyer\CartController;
use App\Middlewares\AuthMiddleware;

$router->get('/api/product/{id}', function($req, $id) {
    return (new ProductController())->getProductDetail($id);
});

$router->post('/api/cart/add', function($req) {
    return (new CartController())->addItemToCart($req);
}, [AuthMiddleware::requireAuth()]);
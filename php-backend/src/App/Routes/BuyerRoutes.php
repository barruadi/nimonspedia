<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\{AuthMiddleware, RoleMiddleware};
use App\Controllers\Buyer\{ProductController, CartController, CheckoutController, StoreController, OrderController, ReviewController};

$auth = AuthMiddleware::requireAuth();
$prohibitRole = RoleMiddleware::prohibit(['seller']);
$roleBuyer = RoleMiddleware::allow(['buyer']); 

$router->get('/products', fn($req) => (new ProductController())->showAllProducts(), []);

$router->get('/checkout', fn($req) => (new CheckoutController())->showCheckout());
$router->post('/checkout/submit', fn($req) => (new CheckoutController())->confirmOrder($req));
$router->get('/checkout/success', fn($req) => (new CheckoutController())->successPage());
$router->post('/checkout/confirm', fn($req) => (new CheckoutController())->confirmOrder($req));
$router->get('/api/store/{id}', fn($req, $id) => StoreController::getStoreDetail($req, (int)$id));

$router->get('/store/{id}', fn($req, $id) => (new StoreController())->showStoreDetail($req, (int)$id));


$router->group([
    'prefix' => '/api',
    'middlewares' => [$auth, $roleBuyer]
], function ($r) {
    $r->post('/cart/add', fn($req) => (new CartController())->addItemToCart($req));
    $r->patch('/cart',    fn($req) => (new CartController())->setQuantity($req));
    $r->get('/cart',    fn($req) => (new CartController())->getCart());
    $r->get('/orders',  fn($req) => (new OrderController())->showHistory($req));
    $r->post('/cart/set', fn($req) => (new CartController())->setQuantity($req));
    $r->post('/cart/remove', fn($req) => (new CartController())->removeProduct($req));
    $r->post('/checkout/selection', fn($req) => (new CheckoutController())->saveSelection($req));
    $r->post('/orders/received', fn($req) => (new OrderController())->markAsReceived($req));

    // Review routes
    $r->post('/reviews', fn($req) => (new ReviewController())->submitReview($req));
    $r->get('/product/{id}/reviews', fn($req, $id) => (new ReviewController())->getProductReviews($req, (int)$id));
});

// Review pages (authenticated buyers)
$router->get('/reviews', fn($req) => (new ReviewController())->showReviewablePage(), [$auth, $roleBuyer]);
$router->get('/review/product/{id}', fn($req, $id) => (new ReviewController())->showReviewForm($req, (int)$id), [$auth, $roleBuyer]);
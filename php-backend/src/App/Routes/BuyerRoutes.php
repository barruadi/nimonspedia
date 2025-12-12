<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\{AuthMiddleware, RoleMiddleware, FeatureFlagMiddleware};
use App\Controllers\Buyer\{ProductController, CartController, CheckoutController, StoreController, OrderController, ReviewController};

$auth = AuthMiddleware::requireAuth();
$prohibitRole = RoleMiddleware::prohibit(['seller']);
$roleBuyer = RoleMiddleware::allow(['buyer']);
$checkoutEnabled = FeatureFlagMiddleware::requireCheckout(); 

// Redirect root to /products
$router->get('/', fn($req) => header('Location: /products') && exit(), []);

$router->get('/products', fn($req) => (new ProductController())->showAllProducts(), []);

$router->get('/checkout', fn($req) => (new CheckoutController())->showCheckout(), [$checkoutEnabled]);
$router->post('/checkout/submit', fn($req) => (new CheckoutController())->confirmOrder($req), [$checkoutEnabled]);
$router->get('/checkout/payment', fn($req) => (new CheckoutController())->paymentPage(), [$checkoutEnabled]);
$router->get('/checkout/success', fn($req) => (new CheckoutController())->successPage(), [$checkoutEnabled]);
$router->post('/checkout/confirm', fn($req) => (new CheckoutController())->confirmOrder($req), [$checkoutEnabled]);
$router->get('/api/store/{id}', fn($req, $id) => StoreController::getStoreDetail($req, (int)$id));

$router->get('/store/{id}', fn($req, $id) => (new StoreController())->showStoreDetail($req, (int)$id));


$router->group([
    'prefix' => '/api',
    'middlewares' => [$auth, $roleBuyer]
], function ($r) use ($checkoutEnabled) {
    $r->post('/cart/add', fn($req) => (new CartController())->addItemToCart($req), [$checkoutEnabled]);
    $r->patch('/cart',    fn($req) => (new CartController())->setQuantity($req), [$checkoutEnabled]);
    $r->get('/cart',    fn($req) => (new CartController())->getCart(), [$checkoutEnabled]);
    $r->get('/orders',  fn($req) => (new OrderController())->showHistory($req));
    $r->post('/cart/set', fn($req) => (new CartController())->setQuantity($req), [$checkoutEnabled]);
    $r->post('/cart/remove', fn($req) => (new CartController())->removeProduct($req), [$checkoutEnabled]);
    $r->post('/checkout/selection', fn($req) => (new CheckoutController())->saveSelection($req), [$checkoutEnabled]);
    $r->post('/orders/received', fn($req) => (new OrderController())->markAsReceived($req));

    // Review routes
    $r->post('/reviews', fn($req) => (new ReviewController())->submitReview($req));
    $r->get('/product/{id}/reviews', fn($req, $id) => (new ReviewController())->getProductReviews($req, (int)$id));
});

// Review pages (authenticated buyers)
$router->get('/reviews', fn($req) => (new ReviewController())->showReviewablePage(), [$auth, $roleBuyer]);
$router->get('/review/product/{id}', fn($req, $id) => (new ReviewController())->showReviewForm($req, (int)$id), [$auth, $roleBuyer]);
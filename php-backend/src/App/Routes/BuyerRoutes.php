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

$router->get('/cart', function($req) {
    $cartPagePath = __DIR__ . '/../../public/pages/CartPage.html';
    if (file_exists($cartPagePath)) {
        return file_get_contents($cartPagePath);
    }
    http_response_code(404);
    return 'Cart page not found';
}, [$auth, $prohibitRole, $checkoutEnabled]);

$router->get('/checkout', fn($req) => (new CheckoutController())->showCheckout(), [$checkoutEnabled]);
$router->post('/checkout/submit', fn($req) => (new CheckoutController())->confirmOrder($req), [$checkoutEnabled]);
$router->get('/checkout/payment', fn($req) => (new CheckoutController())->paymentPage(), [$checkoutEnabled]);
$router->get('/checkout/success', fn($req) => (new CheckoutController())->successPage(), [$checkoutEnabled]);
$router->post('/checkout/confirm', fn($req) => (new CheckoutController())->confirmOrder($req), [$checkoutEnabled]);

// Payment callback pages (for Midtrans redirects)
$router->get('/payment/success', function($req) {
    $pagePath = __DIR__ . '/../../public/pages/PaymentSuccess.html';
    if (file_exists($pagePath)) {
        return file_get_contents($pagePath);
    }
    http_response_code(404);
    return 'Payment success page not found';
});

$router->get('/payment/error', function($req) {
    $pagePath = __DIR__ . '/../../public/pages/PaymentError.html';
    if (file_exists($pagePath)) {
        return file_get_contents($pagePath);
    }
    http_response_code(404);
    return 'Payment error page not found';
});

$router->get('/payment/pending', function($req) {
    $pagePath = __DIR__ . '/../../public/pages/PaymentPending.html';
    if (file_exists($pagePath)) {
        return file_get_contents($pagePath);
    }
    http_response_code(404);
    return 'Payment pending page not found';
});
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
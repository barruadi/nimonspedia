<?php

$cookieLifetime = 7 * 24 * 60 * 60;
session_set_cookie_params([
    'lifetime' => $cookieLifetime,
    'path' => '/',
    'domain' => '',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax'
]);

ini_set('session.gc_maxlifetime', $cookieLifetime);

session_start();

require __DIR__ . '/bootstrap/bootstrap.php';

use App\Core\Application;

$app = new Application();
$router = $app->router;

// Load routes
require __DIR__ . '/App/Routes/AuthRoutes.php';
require __DIR__ . '/App/Routes/BuyerRoutes.php';
require __DIR__ . '/App/Routes/ProductRoutes.php';
require __DIR__ . '/App/Routes/ProfileRoutes.php';
require __DIR__ . '/App/Routes/SellerRoutes.php';
require __DIR__ . '/App/Routes/FeatureFlagRoutes.php';

$app->run();

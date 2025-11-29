<?php

session_start();

require __DIR__ . '/bootstrap/bootstrap.php';

use App\Core\Application;

$app = new Application();

// Load routes
require __DIR__ . '/App/Routes/AuthRoutes.php';
require __DIR__ . '/App/Routes/BuyerRoutes.php';
require __DIR__ . '/App/Routes/ProductRoutes.php';
require __DIR__ . '/App/Routes/ProfileRoutes.php';
require __DIR__ . '/App/Routes/SellerRoutes.php';

$app->run();

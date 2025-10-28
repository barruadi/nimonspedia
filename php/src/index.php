<?php
declare(strict_types=1);

require __DIR__ . "/bootstrap/bootstrap.php";

use App\Core\Application;

session_name('Nimonspedia-K01-08');
session_start([
  'cookie_httponly' => 1,
  'cookie_samesite' => 'Lax',
]);

$app = new Application();

$router = $app->router;
foreach (glob(__DIR__ . '/App/Routes/*.php') as $file) {
    require $file;
}

$app->run();

// SPA routes
$index = __DIR__ . '/public/index.html';
<?php
declare(strict_types=1);

session_name('Nimonspedia-K01-08');
session_start([
  'cookie_httponly' => 1,
  'cookie_samesite' => 'Lax',
]);

// API Routes
// 

// SPA routes
$index = __DIR__ . '/public/index.html';
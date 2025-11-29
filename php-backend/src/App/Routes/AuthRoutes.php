<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Auth\{LoginController, RegisterController, LogoutController};

$auth = AuthMiddleware::requireAuth();

$router->group([
  'prefix'      => '/api'
], function($r) {
  $r->get('/login',     fn($req) => (new LoginController())->show());
  $r->post('/login',    fn($req) => (new LoginController())->login($req));
  $r->get('/register',  fn($req) => (new RegisterController())->show());
  $r->post('/register', fn($req) => (new RegisterController())->register($req));
});

$router->post('/api/logout', fn($req) => (new LogoutController())->logout(), [$auth]);
$router->get('/api/logout', fn($req) => (new LogoutController())->logout(), [$auth]);

// Sanity checks ------------------------
$router->get('/api/me', function ($req) {
    $u = $_SESSION['user'] ?? null;
    if (!$u) {
        return [
            'authenticated' => false,
            'user' => null
        ];
    }

    $userData = [
        'id'      => $u['user_id'],
        'name'    => $u['full_name'],
        'email'   => $u['email'],
        'role'    => $u['role'],
        'balance' => $u['balance'],
    ];

    // Add unique cart items count for buyers (distinct products, not total quantity)
    if ($u['role'] === 'buyer') {
        $userData['cartCount'] = \App\Models\Cart::countItems((int)$u['user_id']);
    }

    return [
        'authenticated' => true,
        'user' => $userData
    ];
});

$router->post('/api/_echo', fn($req) => [
  'content_type' => $_SERVER['CONTENT_TYPE'] ?? null,
  'body' => $req['body'],
]);

$router->get('/api/session', function ($req) {
    return [
        'session' => $_SESSION,
        'session_id' => session_id(),
    ];
});
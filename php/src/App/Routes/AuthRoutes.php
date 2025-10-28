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

$router->get('/api/logout', fn($req) => (new LogoutController())->logout(), [$auth]);

// Sanity checks ------------------------
$router->get('/api/me', function ($req) {
    $u = $_SESSION['user'] ?? null;
    return [
        'authenticated' => (bool)$u,
        'user' => $u ? [
            'id'    => $u['user_id'],
            'name'  => $u['full_name'],
            'email' => $u['email'],
            'role'  => $u['role'],
        ] : null
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
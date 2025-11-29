<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Auth\ProfileController;

$auth = AuthMiddleware::requireAuth();

$router->group([
    'prefix'     => '/api/profile',
    'middleware' => [$auth],
], function($r) {
    $r->post('/change-password',   fn($req) => (new ProfileController())->updatePassword($req));
    $r->post('/change-username',   fn($req) => (new ProfileController())->updateUsername($req));
    $r->post('/top-up',             fn($req) => (new ProfileController())->topUpBalance($req));
});

// Cheat api
$router->group([
    'prefix' => '/secret/api/profile',
    'middleware' => [$auth],
], function ($r) {
    $r->patch('/set-balance', fn($req) => (new ProfileController())->setBalance($req));
});
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
    $r->patch('/change-password',   fn($req) => (new ProfileController())->updatePassword($req));
    $r->patch('/change-username',   fn($req) => (new ProfileController())->updateUsername($req));
});

// Cheat api
$router->group([
    'prefix' => '/secret/api/profile',
    'middleware' => [$auth],
], function ($r) {
    $r->patch('/set-balance', fn($req) => (new ProfileController())->setBalance($req));
});
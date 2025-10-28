<?php

use App\Core;

use App\Core\Application;
use App\Middlewares\AuthMiddleware;
use App\Controllers\Auth\ProfileController;

$auth = AuthMiddleware::requireAuth();

$router->group([
    'prefix'     => '/api/profile',
    'middleware' => [$auth]
], function($r) {
    $r->patch('/change-password',   fn($req) => (new ProfileController())->updatePassword());
    $r->patch('/change-username',   fn($req) => (new ProfileController())->updateUsername());
});
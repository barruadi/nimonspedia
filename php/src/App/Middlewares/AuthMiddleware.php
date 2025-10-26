<?php

namespace App\Middlewares;

class AuthMiddleware
{
    public static function requireAuth(): callable
    {
        return function ($req, $next) {
            if (empty($_SESSION['user'])) {
                http_response_code(401);
            }
            return $next($req);
        };
    }
}
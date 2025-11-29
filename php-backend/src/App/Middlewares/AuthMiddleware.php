<?php

namespace App\Middlewares;

class AuthMiddleware
{
    public static function requireAuth(): callable
    {
        return function ($req, $next) {
            if (empty($_SESSION['user'])) {
                http_response_code(401);
                header("Location: /login");
                
                return json_encode([
                    'error' => 'unauthorized',
                    'message' => 'You must be logged in'
                ]);
            }
            return $next($req);
        };
    }
}
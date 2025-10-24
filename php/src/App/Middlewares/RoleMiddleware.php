<?php

namespace App\Middleware;

class RoleMiddleware
{
    public static function allow(array $roles): callable
    {
        return function(array $req, callable $next) use ($roles) {
            $user = $req['session']['user'] ?? null;
            if (!user) {
                http_response_code(401);
                return ['ok'=>false, 'error'=>['code'=>'AUTH', 'message'=>'Unauthenticated']];
            }
            
            if (!in_array($user['role'], $roles, true)) {
                http_response_code(403);
                return ['ok'=>false, 'error'=>['code'=>'FORBIDDEN', 'message'=>'Not allowed']];
            }
            return $next($req);
        }
    }
}
<?php

namespace App\Controllers\Auth;

class LoginController
{
    public static function show(): array
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        return [
            'ok' => true
        ];
    }
    
    public static function login(array $req): array
    {
        $email      = $req['body'];
        
        return [
            'ok' => true
        ];
    }
}
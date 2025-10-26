<?php

namespace App\Controllers\Auth;

class LoginController
{
    public static function show(): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_SLASHES);
        return 
    }
    
    public static function login(array $req): void
    {
        $email      = $req['body'];
        
        return [
            'ok' => true
        ]
    }
}
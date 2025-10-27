<?php

namespace App\Controllers\Auth;

class RegisterController
{
    public static function show(): array
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        // echo json_encode($data, JSON_UNESCAPED_SLASHES);
        return [
            'ok' => true
        ];
    }
    
    public static function register(array $req): array
    {   
        return [
            'ok' => true
        ];
    }
}
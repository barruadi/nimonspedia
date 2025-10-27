<?php

namespace App\Controllers\Auth;

use App\Models\User;

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
        $name       = $req['body']['full_name'] ?? '';
        $email      = $req['body']['email'] ?? '';
        $password   = $req['body']['password'] ?? '';
        $role       = $req['body']['role'] ?? 'buyer';
        
        // Verifications
        
        
        
        $user = User::create($name, $email, $password, $role);
        if ($user === null) {
            return [
                'ok' => false,
                'user' => [
                    'name' => $name,
                    'email'     => $email,
                    'pass'     => $password,
                    'role'     => $role
                ]
            ];
        }
        
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        return [
            'ok' => true,
            'user' => $user
        ];
    }
}
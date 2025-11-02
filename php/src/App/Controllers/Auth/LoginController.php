<?php

namespace App\Controllers\Auth;

use App\Models\User;

class LoginController
{
    public static function show(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;
        
        if ($user) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Already login in'];
        }
        
        return [
            'ok' => true
        ];
    }
    
    public static function login(array $req): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $email      = $req['body']['email'] ?? '';
        $password   = $req['body']['password'] ?? '';
        
        if ($email === '' || $password === '') {
            return [];
        }
        
        $user = User::authenticate($email, $password);
        
        if (!$user) {
            return [
                'ok' => false,
                'error' => 'gagal login '
            ];
        }
        
        // setup session
        $_SESSION['user']      = $user;
        
        return [
            'ok' => true,
            'data' => $user
        ];
    }
}
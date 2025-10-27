<?php

namespace App\Controllers\Auth;

use App\Models\User;

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
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $email      = $req['body']['email'] ?? '';
        $password   = $req['body']['password'] ?? '';
        
        if ($email === '' || $password === '') {
            return [];
        }
        
        $user = User::authenticate($email, $password);
        
        // setup session
        $_SESSION['user_id']   = $user['user_id'];
        $_SESSION['role']      = $user['role'];
        $_SESSION['full_name'] = $user['full_name'];
        
        return [
            'ok' => true,
            'data' => $user
        ];
    }
}
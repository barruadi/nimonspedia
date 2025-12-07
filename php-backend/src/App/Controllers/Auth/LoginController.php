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

        $email      = trim($req['body']['email'] ?? '');
        $password   = $req['body']['password'] ?? '';

        if (empty($email)) {
            http_response_code(400);
            return [
                'ok' => false,
                'error' => 'Email wajib diisi'
            ];
        }

        if (empty($password)) {
            http_response_code(400);
            return [
                'ok' => false,
                'error' => 'Password wajib diisi'
            ];
        }

        $existingUser = User::findByEmail($email);
        if (empty($existingUser)) {
            http_response_code(401);
            return [
                'ok' => false,
                'error' => 'Email tidak terdaftar'
            ];
        }

        if (!password_verify($password, $existingUser['password_hash'])) {
            http_response_code(401);
            return [
                'ok' => false,
                'error' => 'Password salah'
            ];
        }

        unset($existingUser['password_hash']);
        $_SESSION['user'] = $existingUser;

        return [
            'ok' => true,
            'data' => $existingUser
        ];
    }
}
<?php

namespace App\Controllers\Auth;

use App\Models\User;
use App\Models\Store;

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
        // [ TODO ]
        
        
        $user = User::create($name, $email, $password, $role);
        
        if ($user === null) {
            return [
                'ok' => false
            ];
        }
        
        if ($role === 'seller') {
            $store_name  = $req['body']['store_name'] ?? '' ;
            $description = $req['body']['description'] ?? '' ;
            $logo_path   = $req['body']['logo_path'] ?? '' ;
            
            $store = Store::create($user['user_id'], $store_name, $description, $logo_path);
            
            return [
                'ok' => true,
                'user' => $user,
                'store' => $store
            ];
        }
        
        return [
            'ok' => true,
            'user' => $user
        ];
    }
}
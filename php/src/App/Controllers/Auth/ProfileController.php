<?php

namespace App\Controllers\Auth;

use App\Models\User;

class ProfileController
{
    public function profile($req): array
    {
        $user_id = $_SESSION['user_id'] ?? '';
        
        $user = User::findById($user_id);
        if (!$user) {
            return [];
        }
        
        unset($user['password_hash']);
        
        return [
            'ok' => true,
            'user' => $user
        ];
    }
}
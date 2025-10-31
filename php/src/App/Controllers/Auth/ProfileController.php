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
    
    public function updatePassword($req): array
    {
        $user_id      = (int) $_SESSION['user']['user_id'] ?? null;
        $email        = $_SESSION['user']['email'] ?? '';
        $old_password = $req['body']['old_password'] ?? '';
        $new_password = $req['body']['new_password'] ?? '';
        
        $user = User::authenticate($email, $old_password);
        
        if (!$user) {
            return [
                'ok' => false,
                'error' => [
                    'code' => 'PROFILE',
                    'message' => 'Not authenticated'
                ]
            ];
        }
        
        $update = User::updatePassword($new_password, $user_id);
        
        if (!$update) {
            return [
                'ok' => false,
                'error' => [
                    'code' => 'PROFILE',
                    'message' => 'Failed to update'
                ]
            ];
        }
        
        return [
            'ok' => true
        ];
    }
    
    // [TODO]
    public function updateUsername($req): array
    {
        return [];
    }
    
    public function setBalance($req): array
    {
        $new_balance = $req['body']['balance'];
        
        User::setBalance($new_balance);

        return [
            'ok' => true,
            'new_balance' => $new_balance
        ];
    }
}
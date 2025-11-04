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
    
    public function topUpBalance($req): array
    {
        $user_id = (int) $_SESSION['user']['user_id'] ?? null;
        $amount  = (float) ($req['body']['amount'] ?? 0);

        if (!$user_id) {
            http_response_code(401);
            return ['ok' => false, 'error' => 'User not authenticated'];
        }

        if ($amount <= 0) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Invalid top-up amount'];
        }

        $newBalance = User::addBalance($user_id, $amount);

        if ($newBalance === null) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to update balance'];
        }
        
        $_SESSION['user']['balance'] = $newBalance;

        return [
            'ok' => true,
            'data' => [
                'new_balance' => $newBalance
            ]
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
        if (!$_SESSION['user']) {
            return [
                'ok' => false
            ];
        }
        
        $userId = $_SESSION['user']['user_id'];
        $newName = $req['body']['full_name'];

        $update = User::updateUsername($newName, $userId);
        
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
    
    public function setBalance($req): array
    {
        $userId = $_SESSION['user']['user_id'];
        $new_balance = $req['body']['balance'];
        
        User::updateBalance($userId, $new_balance);

        return [
            'ok' => true,
            'new_balance' => $new_balance
        ];
    }
}
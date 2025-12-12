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

    public function getNotificationPreferences($req): array
    {
        $userId = (int) $_SESSION['user']['user_id'] ?? null;

        if (!$userId) {
            http_response_code(401);
            return ['ok' => false, 'error' => 'User not authenticated'];
        }

        $db = \App\Core\Database::getInstance();
        $stmt = $db->prepare("
            SELECT chat_enabled, auction_enabled, order_enabled, updated_at
            FROM push_preferences
            WHERE user_id = :user_id
        ");
        $stmt->execute(['user_id' => $userId]);
        $prefs = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$prefs) {
            $stmt = $db->prepare("
                INSERT INTO push_preferences (user_id, chat_enabled, auction_enabled, order_enabled)
                VALUES (:user_id, TRUE, TRUE, TRUE)
                RETURNING chat_enabled, auction_enabled, order_enabled, updated_at
            ");
            $stmt->execute(['user_id' => $userId]);
            $prefs = $stmt->fetch(\PDO::FETCH_ASSOC);
        }

        return [
            'ok' => true,
            'preferences' => $prefs
        ];
    }

    public function updateNotificationPreferences($req): array
    {
        $userId = (int) $_SESSION['user']['user_id'] ?? null;

        if (!$userId) {
            http_response_code(401);
            return ['ok' => false, 'error' => 'User not authenticated'];
        }

        $body = $req['body'] ?? [];
        $fields = [];
        $params = ['user_id' => $userId];

        if (isset($body['chat_enabled'])) {
            $fields[] = "chat_enabled = :chat_enabled";
            $params['chat_enabled'] = $body['chat_enabled'] ? 'TRUE' : 'FALSE';
        }

        if (isset($body['auction_enabled'])) {
            $fields[] = "auction_enabled = :auction_enabled";
            $params['auction_enabled'] = $body['auction_enabled'] ? 'TRUE' : 'FALSE';
        }

        if (isset($body['order_enabled'])) {
            $fields[] = "order_enabled = :order_enabled";
            $params['order_enabled'] = $body['order_enabled'] ? 'TRUE' : 'FALSE';
        }

        if (empty($fields)) {
            return [
                'ok' => false,
                'error' => 'No fields to update'
            ];
        }

        $db = \App\Core\Database::getInstance();

        $checkStmt = $db->prepare("SELECT user_id FROM push_preferences WHERE user_id = :user_id");
        $checkStmt->execute(['user_id' => $userId]);
        $exists = $checkStmt->fetch(\PDO::FETCH_ASSOC);

        if (!$exists) {
            $insertStmt = $db->prepare("
                INSERT INTO push_preferences (user_id, chat_enabled, auction_enabled, order_enabled)
                VALUES (:user_id, TRUE, TRUE, TRUE)
            ");
            $insertStmt->execute(['user_id' => $userId]);
        }

        $fields[] = "updated_at = NOW()";
        $sql = "UPDATE push_preferences SET " . implode(', ', $fields) . " WHERE user_id = :user_id";

        $stmt = $db->prepare($sql);
        $success = $stmt->execute($params);

        if (!$success) {
            http_response_code(500);
            return [
                'ok' => false,
                'error' => 'Failed to update preferences'
            ];
        }

        return [
            'ok' => true,
            'message' => 'Preferences updated successfully'
        ];
    }
}
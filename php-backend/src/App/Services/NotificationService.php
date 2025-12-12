<?php

namespace App\Services;

use App\Core\Database;
use PDO;

class NotificationService
{
    public static function getPreferences(int $userId): array
    {
        $db = Database::getInstance();

        $stmt = $db->prepare("
            SELECT chat_enabled, auction_enabled, order_enabled
            FROM push_preferences
            WHERE user_id = :user_id
        ");
        $stmt->execute([':user_id' => $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$result) {
            return [
                'chat' => true,
                'auction' => true,
                'order' => true
            ];
        }

        return [
            'chat' => (bool)$result['chat_enabled'],
            'auction' => (bool)$result['auction_enabled'],
            'order' => (bool)$result['order_enabled']
        ];
    }

    public static function updatePreference(int $userId, string $notificationType, bool $isEnabled): bool
    {
        try {
            $db = Database::getInstance();

            $validTypes = ['chat', 'auction', 'order'];
            if (!in_array($notificationType, $validTypes)) {
                throw new \InvalidArgumentException('Invalid notification type');
            }

            $columnMap = [
                'chat' => 'chat_enabled',
                'auction' => 'auction_enabled',
                'order' => 'order_enabled'
            ];
            $column = $columnMap[$notificationType];
            $enabledValue = $isEnabled ? 'true' : 'false';

            $stmt = $db->prepare("
                INSERT INTO push_preferences (user_id, chat_enabled, auction_enabled, order_enabled, created_at, updated_at)
                VALUES (:user_id, 
                    CASE WHEN '{$notificationType}' = 'chat' THEN {$enabledValue} ELSE true END,
                    CASE WHEN '{$notificationType}' = 'auction' THEN {$enabledValue} ELSE true END,
                    CASE WHEN '{$notificationType}' = 'order' THEN {$enabledValue} ELSE true END,
                    NOW(), NOW()
                )
                ON CONFLICT (user_id)
                DO UPDATE SET 
                    {$column} = {$enabledValue},
                    updated_at = NOW()
            ");

            return $stmt->execute([':user_id' => $userId]);

        } catch (\Exception $e) {
            error_log("[NotificationService] Error updating preference: " . $e->getMessage());
            return false;
        }
    }

    public static function savePushSubscription(int $userId, array $subscription): bool
    {
        try {
            $db = Database::getInstance();

            $endpoint = $subscription['endpoint'] ?? null;
            $p256dh = $subscription['keys']['p256dh'] ?? null;
            $auth = $subscription['keys']['auth'] ?? null;

            if (!$endpoint || !$p256dh || !$auth) {
                error_log("[NotificationService] Missing subscription data");
                return false;
            }

            $checkStmt = $db->prepare("
                SELECT subscription_id FROM push_subscriptions 
                WHERE user_id = :user_id AND endpoint = :endpoint
            ");
            $checkStmt->execute([
                ':user_id' => $userId,
                ':endpoint' => $endpoint
            ]);

            if ($checkStmt->fetch()) {
                return true;
            }

            $stmt = $db->prepare("
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, created_at)
                VALUES (:user_id, :endpoint, :p256dh_key, :auth_key, NOW())
            ");

            return $stmt->execute([
                ':user_id' => $userId,
                ':endpoint' => $endpoint,
                ':p256dh_key' => $p256dh,
                ':auth_key' => $auth
            ]);

        } catch (\Exception $e) {
            error_log("[NotificationService] Error saving subscription: " . $e->getMessage());
            return false;
        }
    }

    public static function removePushSubscription(int $userId, string $endpoint): bool
    {
        try {
            $db = Database::getInstance();

            $stmt = $db->prepare("
                DELETE FROM push_subscriptions
                WHERE user_id = :user_id AND endpoint = :endpoint
            ");

            return $stmt->execute([
                ':user_id' => $userId,
                ':endpoint' => $endpoint
            ]);

        } catch (\Exception $e) {
            error_log("[NotificationService] Error removing subscription: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send order notification via Node.js backend
     * @param int $userId - User ID to receive notification
     * @param string $title - Notification title
     * @param string $message - Notification message
     * @param int|null $orderId - Order ID (optional)
     * @return bool - Success status
     */
    public static function sendOrderNotification(int $userId, string $title, string $message, ?int $orderId = null): bool
    {
        try {
            $nodeBackendUrl = getenv('NODE_BACKEND_URL') ?: 'http://node-backend:3000';
            $url = "{$nodeBackendUrl}/api/node/notifications/send-order";

            $data = [
                'userId' => $userId,
                'title' => $title,
                'message' => $message,
                'orderId' => $orderId
            ];

            error_log("[NotificationService] Attempting to send order notification to user {$userId}");
            error_log("[NotificationService] URL: {$url}");
            error_log("[NotificationService] Data: " . json_encode($data));

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Accept: application/json'
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 5 second timeout
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3); // 3 second connection timeout

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            error_log("[NotificationService] HTTP Response Code: {$httpCode}");
            error_log("[NotificationService] Response Body: {$response}");
            
            if ($curlError) {
                error_log("[NotificationService] CURL Error: {$curlError}");
                return false;
            }

            if ($httpCode >= 200 && $httpCode < 300) {
                error_log("[NotificationService] Order notification sent successfully to user {$userId}");
                return true;
            } else {
                error_log("[NotificationService] Failed to send order notification. HTTP {$httpCode}: {$response}");
                return false;
            }

        } catch (\Exception $e) {
            error_log("[NotificationService] Exception sending order notification: " . $e->getMessage());
            error_log("[NotificationService] Stack trace: " . $e->getTraceAsString());
            return false;
        }
    }
}

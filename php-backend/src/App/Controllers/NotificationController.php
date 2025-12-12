<?php

namespace App\Controllers;

use App\Services\NotificationService;

class NotificationController
{
    /**
     * Get user's notification preferences
     */
    public function getPreferences($req)
    {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }

            $user = $_SESSION['user'] ?? null;
            error_log("[NotificationController] getPreferences called, user: " . ($user ? $user['user_id'] : 'none'));

            if (!$user) {
                error_log("[NotificationController] Unauthorized - no user in session");
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
                return;
            }

            $preferences = NotificationService::getPreferences($user['user_id']);
            error_log("[NotificationController] Preferences: " . json_encode($preferences));

            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode([
                'ok' => true,
                'preferences' => $preferences
            ]);
        } catch (\Exception $e) {
            error_log("[NotificationController] Error: " . $e->getMessage());
            error_log("[NotificationController] Trace: " . $e->getTraceAsString());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'ok' => false,
                'error' => 'Failed to get preferences: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update notification preference
     */
    public function updatePreference($req)
    {
        ob_start();

        
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }

            $user = $_SESSION['user'] ?? null;

            if (!$user) {
                ob_end_clean();
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
                exit;
            }

            $body = $req['body'] ?? [];
            $notificationType = $body['notification_type'] ?? null;
            $isEnabled = $body['is_enabled'] ?? null;

            error_log("[NotificationController] Received - type: " . var_export($notificationType, true) . ", enabled: " . var_export($isEnabled, true));

            if ($notificationType === null || $isEnabled === null) {
                ob_end_clean();
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Missing notification_type or is_enabled']);
                exit;
            }

            $success = NotificationService::updatePreference(
                (int)$user['user_id'],
                (string)$notificationType,
                (bool)$isEnabled
            );

            ob_end_clean();
            
            if ($success) {
                http_response_code(200);
                header('Content-Type: application/json');
                echo json_encode([
                    'ok' => true,
                    'message' => 'Preference updated successfully'
                ]);
            } else {
                http_response_code(500);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Failed to update preference in database']);
            }
            exit;
            
        } catch (\InvalidArgumentException $e) {
            ob_end_clean();
            error_log("[NotificationController] Invalid argument: " . $e->getMessage());
            http_response_code(400);
            header('Content-Type: application/json');
            echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            exit;
        } catch (\PDOException $e) {
            ob_end_clean();
            error_log("[NotificationController] PDO error: " . $e->getMessage());
            error_log("[NotificationController] SQL State: " . $e->getCode());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'ok' => false,
                'error' => 'Database error',
                'details' => $e->getMessage()
            ]);
            exit;
        } catch (\Exception $e) {
            ob_end_clean();
            error_log("[NotificationController] Unexpected error: " . $e->getMessage());
            error_log("[NotificationController] Trace: " . $e->getTraceAsString());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'ok' => false,
                'error' => 'Server error',
                'message' => $e->getMessage()
            ]);
            exit;
        }
    }

    /**
     * Subscribe to push notifications
     */
    public function subscribe($req)
    {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }

            $user = $_SESSION['user'] ?? null;

            if (!$user) {
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
                return;
            }

            $subscription = $req['body']['subscription'] ?? null;

            if (!$subscription || !isset($subscription['endpoint']) || !isset($subscription['keys'])) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Invalid subscription data']);
                return;
            }

            $success = NotificationService::savePushSubscription(
                $user['user_id'],
                $subscription
            );

            if ($success) {
                http_response_code(200);
                header('Content-Type: application/json');
                echo json_encode([
                    'ok' => true,
                    'message' => 'Subscription saved successfully'
                ]);
            } else {
                http_response_code(500);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Failed to save subscription']);
            }
        } catch (\Exception $e) {
            error_log("[NotificationController] Subscribe error: " . $e->getMessage());
            error_log("[NotificationController] Trace: " . $e->getTraceAsString());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'ok' => false,
                'error' => 'Failed to subscribe: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Unsubscribe from push notifications
     */
    public function unsubscribe($req)
    {
        session_start();
        $user = $_SESSION['user'] ?? null;

        if (!$user) {
            http_response_code(401);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $endpoint = $req['body']['endpoint'] ?? null;

        if (!$endpoint) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Missing endpoint'];
        }

        try {
            $success = NotificationService::removePushSubscription(
                $user['user_id'],
                $endpoint
            );

            if ($success) {
                http_response_code(200);
                return [
                    'ok' => true,
                    'message' => 'Unsubscribed successfully'
                ];
            } else {
                http_response_code(500);
                return ['ok' => false, 'error' => 'Failed to unsubscribe'];
            }
        } catch (\Exception $e) {
            http_response_code(500);
            return [
                'ok' => false,
                'error' => 'Failed to unsubscribe: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Get VAPID public key for frontend
     */
    public function getVapidPublicKey($req)
    {
        $vapidPublicKey = $_ENV['VAPID_PUBLIC_KEY'] ?? getenv('VAPID_PUBLIC_KEY');

        if (!$vapidPublicKey) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'VAPID public key not configured'];
        }

        http_response_code(200);
        return [
            'ok' => true,
            'publicKey' => $vapidPublicKey
        ];
    }
}

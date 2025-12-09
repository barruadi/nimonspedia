<?php

namespace App\Middlewares;

use App\Services\FeatureFlagService;

class FeatureFlagMiddleware
{
    /**
     * Middleware to check if a feature is enabled for the current user
     *
     * @param string $featureName Feature name to check (checkout_enabled, chat_enabled, auction_enabled)
     * @return callable
     */
    public static function requireFeature(string $featureName): callable
    {
        return function (array $req, callable $next) use ($featureName) {
            // Get user ID from session if authenticated
            $userId = $_SESSION['user']['user_id'] ?? null;

            // Check if feature is enabled
            $featureStatus = FeatureFlagService::isFeatureEnabled($featureName, $userId);

            if (!$featureStatus['enabled']) {
                // Feature is disabled, check if API or web request
                $isApiRequest = strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') !== false;

                if ($isApiRequest) {
                    // Return JSON for API requests
                    http_response_code(403);
                    header('Content-Type: application/json');
                    echo json_encode([
                        'ok' => false,
                        'error' => [
                            'code' => 'FEATURE_DISABLED',
                            'message' => 'This feature is currently disabled',
                            'reason' => $featureStatus['reason'],
                            'isGlobal' => $featureStatus['isGlobal']
                        ]
                    ]);
                    exit;
                } else {
                    // Redirect to disabled page for web requests
                    $reason = urlencode($featureStatus['reason'] ?? 'Feature disabled');
                    $isGlobal = $featureStatus['isGlobal'] ? 'true' : 'false';
                    header("Location: /feature-disabled?feature=$featureName&reason=$reason&isGlobal=$isGlobal");
                    exit;
                }
            }

            // Feature is enabled, continue to next middleware/handler
            return $next($req);
        };
    }

    /**
     * Middleware to check checkout feature
     */
    public static function requireCheckout(): callable
    {
        return self::requireFeature('checkout_enabled');
    }

    /**
     * Middleware to check chat feature
     */
    public static function requireChat(): callable
    {
        return self::requireFeature('chat_enabled');
    }

    /**
     * Middleware to check auction feature
     */
    public static function requireAuction(): callable
    {
        return self::requireFeature('auction_enabled');
    }
}

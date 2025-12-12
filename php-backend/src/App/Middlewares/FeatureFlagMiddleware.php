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
                    // Redirect to React disabled page (not PHP)
                    // Use inline script to set sessionStorage before redirect
                    http_response_code(403);
                    header('Content-Type: text/html; charset=utf-8');
                    $featureDisplayName = str_replace('_enabled', '', $featureName);
                    $featureDisplayName = ucfirst($featureDisplayName);
                    $reason = htmlspecialchars($featureStatus['reason'] ?? 'Feature disabled', ENT_QUOTES, 'UTF-8');
                    $isGlobal = $featureStatus['isGlobal'] ? 'true' : 'false';
                    
                    echo "<!DOCTYPE html>
                    <html>
                    <head><meta charset='utf-8'><title>Redirecting...</title></head>
                    <body>
                    <script>
                    sessionStorage.setItem('disabledFeatureInfo', JSON.stringify({
                        featureName: '$featureDisplayName',
                        reason: '$reason',
                        isGlobal: $isGlobal
                    }));
                    window.location.replace('/feature-disabled');
                    </script>
                    <p>Redirecting...</p>
                    </body>
                    </html>";
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

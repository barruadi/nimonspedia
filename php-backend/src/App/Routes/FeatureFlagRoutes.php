<?php

use App\Services\FeatureFlagService;

// Feature Disabled Page
$router->get('/feature-disabled', function($req) {
    $feature = $_GET['feature'] ?? 'unknown';
    $reason = $_GET['reason'] ?? 'This feature is currently disabled';
    $isGlobal = ($_GET['isGlobal'] ?? 'false') === 'true';

    // Map feature names to display names
    $featureDisplayNames = [
        'checkout_enabled' => 'Checkout',
        'chat_enabled' => 'Chat',
        'auction_enabled' => 'Auction'
    ];

    $featureName = $featureDisplayNames[$feature] ?? ucfirst(str_replace('_', ' ', $feature));

    // Load the view directly
    ob_start();
    extract([
        'featureName' => $featureName,
        'reason' => urldecode($reason),
        'isGlobal' => $isGlobal
    ]);
    require VIEW_PATH . 'FeatureDisabled.php';
    return ob_get_clean();
});

// API endpoint to get feature flags for current user
$router->get('/api/feature-flags', function($req) {
    $userId = $_SESSION['user']['user_id'] ?? null;

    $flags = FeatureFlagService::getAllFeatureFlags($userId);

    return [
        'ok' => true,
        'flags' => $flags
    ];
});

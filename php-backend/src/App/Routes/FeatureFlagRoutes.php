<?php

use App\Services\FeatureFlagService;

// API endpoint to get feature flags for current user
$router->get('/api/feature-flags', function($req) {
    $userId = $_SESSION['user']['user_id'] ?? null;

    $flags = FeatureFlagService::getAllFeatureFlags($userId);

    return [
        'ok' => true,
        'flags' => $flags
    ];
});

<?php

use App\Services\FeatureFlagService;

// Feature Disabled Page - Serve React SPA
$router->get('/feature-disabled', function($req) {
    // Serve the React SPA index.html
    $spa_index = __DIR__ . '/../../public/index.html';
    
    if (file_exists($spa_index)) {
        http_response_code(200);
        return file_get_contents($spa_index);
    }
    
    // Fallback if index.html not found
    return 'Feature Disabled - Please enable this feature to continue.';
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

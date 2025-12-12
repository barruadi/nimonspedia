<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require __DIR__ . '/bootstrap/bootstrap.php';

echo "Testing Notification Service...\n\n";

// Test 1: Database connection
try {
    $db = App\Core\Database::getInstance();
    echo "✓ Database connection OK\n";
} catch (Exception $e) {
    echo "✗ Database error: " . $e->getMessage() . "\n";
    exit(1);
}

// Test 2: Check if notification tables exist
try {
    $stmt = $db->query("SELECT COUNT(*) FROM notification_preferences");
    echo "✓ notification_preferences table exists\n";
} catch (Exception $e) {
    echo "✗ notification_preferences table error: " . $e->getMessage() . "\n";
    echo "  Run database migration first!\n";
    exit(1);
}

try {
    $stmt = $db->query("SELECT COUNT(*) FROM push_subscriptions");
    echo "✓ push_subscriptions table exists\n";
} catch (Exception $e) {
    echo "✗ push_subscriptions table error: " . $e->getMessage() . "\n";
    exit(1);
}

try {
    $stmt = $db->query("SELECT COUNT(*) FROM notification_queue");
    echo "✓ notification_queue table exists\n";
} catch (Exception $e) {
    echo "✗ notification_queue table error: " . $e->getMessage() . "\n";
    exit(1);
}

// Test 3: NotificationService class
try {
    $prefs = App\Services\NotificationService::getPreferences(1);
    echo "✓ NotificationService::getPreferences() works\n";
    echo "  Preferences: " . json_encode($prefs) . "\n";
} catch (Exception $e) {
    echo "✗ NotificationService error: " . $e->getMessage() . "\n";
    echo "  Stack trace: " . $e->getTraceAsString() . "\n";
    exit(1);
}

// Test 4: Update preference
try {
    $result = App\Services\NotificationService::updatePreference(1, 'chat', true);
    echo "✓ NotificationService::updatePreference() works\n";
    echo "  Result: " . ($result ? 'success' : 'failed') . "\n";
} catch (Exception $e) {
    echo "✗ Update preference error: " . $e->getMessage() . "\n";
    exit(1);
}

// Test 5: Get preferences again
try {
    $prefs = App\Services\NotificationService::getPreferences(1);
    echo "✓ Preferences after update: " . json_encode($prefs) . "\n";
} catch (Exception $e) {
    echo "✗ Get preferences error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n✓ All tests passed!\n";

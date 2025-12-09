<?php

namespace App\Services;

use App\Core\Database;
use PDO;

class FeatureFlagService
{
    /**
     * Check if a feature is enabled for a specific user
     *
     * Logic:
     * 1. First check for user-specific override (user_id is set)
     * 2. If no user-specific setting, check for global setting (user_id is NULL)
     * 3. If no records found, default to enabled (true)
     *
     * @param string $featureName Feature name (checkout_enabled, chat_enabled, auction_enabled)
     * @param int|null $userId User ID to check for, null to check only global
     * @return array ['enabled' => bool, 'reason' => string|null, 'isGlobal' => bool]
     */
    public static function isFeatureEnabled(string $featureName, ?int $userId = null): array
    {
        $db = Database::getInstance();

        // If user is specified, check user-specific setting first
        if ($userId !== null) {
            $sql = "SELECT is_enabled, reason
                    FROM user_feature_access
                    WHERE feature_name = :feature_name
                    AND user_id = :user_id
                    ORDER BY updated_at DESC
                    LIMIT 1";

            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':feature_name' => $featureName,
                ':user_id' => $userId
            ]);
            $userSetting = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($userSetting) {
                return [
                    'enabled' => (bool)$userSetting['is_enabled'],
                    'reason' => $userSetting['reason'],
                    'isGlobal' => false
                ];
            }
        }

        // Check global setting (user_id IS NULL)
        $sql = "SELECT is_enabled, reason
                FROM user_feature_access
                WHERE feature_name = :feature_name
                AND user_id IS NULL
                ORDER BY updated_at DESC
                LIMIT 1";

        $stmt = $db->prepare($sql);
        $stmt->execute([':feature_name' => $featureName]);
        $globalSetting = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($globalSetting) {
            return [
                'enabled' => (bool)$globalSetting['is_enabled'],
                'reason' => $globalSetting['reason'] ?? 'Maintenance',
                'isGlobal' => true
            ];
        }

        // Default: feature is enabled if no records found
        return [
            'enabled' => true,
            'reason' => null,
            'isGlobal' => false
        ];
    }

    /**
     * Check if checkout is enabled for a user
     */
    public static function isCheckoutEnabled(?int $userId = null): array
    {
        return self::isFeatureEnabled('checkout_enabled', $userId);
    }

    /**
     * Check if chat is enabled for a user
     */
    public static function isChatEnabled(?int $userId = null): array
    {
        return self::isFeatureEnabled('chat_enabled', $userId);
    }

    /**
     * Check if auction is enabled for a user
     */
    public static function isAuctionEnabled(?int $userId = null): array
    {
        return self::isFeatureEnabled('auction_enabled', $userId);
    }

    /**
     * Get all feature flags for a user (for frontend)
     */
    public static function getAllFeatureFlags(?int $userId = null): array
    {
        return [
            'checkout_enabled' => self::isCheckoutEnabled($userId),
            'chat_enabled' => self::isChatEnabled($userId),
            'auction_enabled' => self::isAuctionEnabled($userId)
        ];
    }

    /**
     * Set feature flag for a user (Admin function)
     */
    public static function setUserFeatureFlag(int $userId, string $featureName, bool $isEnabled, ?string $reason = null): bool
    {
        $db = Database::getInstance();

        // Check if entry exists
        $sql = "SELECT access_id FROM user_feature_access
                WHERE user_id = :user_id AND feature_name = :feature_name";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':user_id' => $userId,
            ':feature_name' => $featureName
        ]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            // Update existing
            $sql = "UPDATE user_feature_access
                    SET is_enabled = :is_enabled, reason = :reason, updated_at = NOW()
                    WHERE access_id = :access_id";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':is_enabled' => $isEnabled,
                ':reason' => $reason,
                ':access_id' => $existing['access_id']
            ]);
        } else {
            // Insert new
            $sql = "INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
                    VALUES (:user_id, :feature_name, :is_enabled, :reason, NOW())";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':user_id' => $userId,
                ':feature_name' => $featureName,
                ':is_enabled' => $isEnabled,
                ':reason' => $reason
            ]);
        }

        return true;
    }

    /**
     * Set global feature flag (Admin function)
     */
    public static function setGlobalFeatureFlag(string $featureName, bool $isEnabled, ?string $reason = null): bool
    {
        $db = Database::getInstance();

        // Check if global entry exists
        $sql = "SELECT access_id FROM user_feature_access
                WHERE user_id IS NULL AND feature_name = :feature_name";
        $stmt = $db->prepare($sql);
        $stmt->execute([':feature_name' => $featureName]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            // Update existing
            $sql = "UPDATE user_feature_access
                    SET is_enabled = :is_enabled, reason = :reason, updated_at = NOW()
                    WHERE access_id = :access_id";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':is_enabled' => $isEnabled,
                ':reason' => $reason,
                ':access_id' => $existing['access_id']
            ]);
        } else {
            // Insert new
            $sql = "INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
                    VALUES (NULL, :feature_name, :is_enabled, :reason, NOW())";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':feature_name' => $featureName,
                ':is_enabled' => $isEnabled,
                ':reason' => $reason
            ]);
        }

        return true;
    }

    /**
     * Delete user-specific feature flag (reverts to global/default)
     */
    public static function deleteUserFeatureFlag(int $userId, string $featureName): bool
    {
        $db = Database::getInstance();

        $sql = "DELETE FROM user_feature_access
                WHERE user_id = :user_id AND feature_name = :feature_name";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':user_id' => $userId,
            ':feature_name' => $featureName
        ]);

        return true;
    }
}

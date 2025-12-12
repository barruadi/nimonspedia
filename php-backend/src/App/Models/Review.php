<?php

namespace App\Models;

use App\Core\Database;
use PDO;

class Review
{
    private static function db(): PDO
    {
        return Database::getInstance();
    }

    /**
     * Get reviewable products for a buyer (products from received orders)
     */
    public static function getReviewableProducts(int $buyerId): array
    {
        $sql = "
            SELECT DISTINCT
                oi.product_id,
                oi.order_id,
                p.name,
                p.image_path,
                p.price,
                o.received_at,
                o.created_at,
                o.store_id,
                s.store_name,
                EXISTS(
                    SELECT 1 FROM reviews r
                    WHERE r.order_id = o.order_id
                    AND r.product_id = oi.product_id
                ) as has_review,
                (
                    SELECT rating FROM reviews r
                    WHERE r.order_id = o.order_id
                    AND r.product_id = oi.product_id
                    LIMIT 1
                ) as your_rating
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN products p ON oi.product_id = p.product_id
            JOIN stores s ON o.store_id = s.store_id
            WHERE o.buyer_id = :buyer_id
            AND o.status = 'received'
            ORDER BY o.received_at DESC, oi.product_id
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->execute(['buyer_id' => $buyerId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Create a new review
     */
    public static function create(array $data): ?int
    {
        $sql = "
            INSERT INTO reviews (
                order_id, product_id, buyer_id, rating, review_text
            ) VALUES (
                :order_id, :product_id, :buyer_id, :rating, :review_text
            )
            RETURNING review_id
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->execute([
            'order_id' => $data['order_id'],
            'product_id' => $data['product_id'],
            'buyer_id' => $data['buyer_id'],
            'rating' => $data['rating'],
            'review_text' => $data['review_text'] ?? null
        ]);

        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? (int)$result['review_id'] : null;
    }

    /**
     * Add images to a review
     */
    public static function addImages(int $reviewId, array $imagePaths): bool
    {
        if (empty($imagePaths) || count($imagePaths) > 3) {
            return false;
        }

        $sql = "
            INSERT INTO review_images (review_id, image_path, display_order)
            VALUES (:review_id, :image_path, :display_order)
        ";

        $stmt = self::db()->prepare($sql);

        foreach ($imagePaths as $index => $path) {
            $stmt->execute([
                'review_id' => $reviewId,
                'image_path' => $path,
                'display_order' => $index
            ]);
        }

        return true;
    }

    /**
     * Get reviews for a product
     */
    public static function getByProductId(int $productId, int $limit = 10, int $offset = 0): array
    {
        $sql = "
            SELECT
                r.review_id,
                r.rating,
                r.review_text,
                r.seller_reply,
                r.created_at,
                r.replied_at,
                r.is_hidden,
                u.full_name as buyer_name,
                COALESCE(
                    json_agg(
                        json_build_object('image_path', ri.image_path, 'display_order', ri.display_order)
                        ORDER BY ri.display_order
                    ) FILTER (WHERE ri.review_image_id IS NOT NULL),
                    '[]'
                ) as images
            FROM reviews r
            JOIN users u ON r.buyer_id = u.user_id
            LEFT JOIN review_images ri ON r.review_id = ri.review_id
            WHERE r.product_id = :product_id
            AND r.is_hidden = FALSE
            GROUP BY r.review_id, u.full_name
            ORDER BY r.created_at DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->bindValue(':product_id', $productId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Decode JSON images
        foreach ($reviews as &$review) {
            $review['images'] = json_decode($review['images'], true);
        }

        return $reviews;
    }

    /**
     * Get product rating statistics
     */
    public static function getProductStats(int $productId): array
    {
        $sql = "
            SELECT
                COALESCE(AVG(rating), 0) as average_rating,
                COUNT(*) as review_count,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1
            FROM reviews
            WHERE product_id = :product_id
            AND is_hidden = FALSE
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->execute(['product_id' => $productId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result) {
            $result['average_rating'] = round((float)$result['average_rating'], 1);
            $result['review_count'] = (int)$result['review_count'];
            $result['rating_5'] = (int)$result['rating_5'];
            $result['rating_4'] = (int)$result['rating_4'];
            $result['rating_3'] = (int)$result['rating_3'];
            $result['rating_2'] = (int)$result['rating_2'];
            $result['rating_1'] = (int)$result['rating_1'];
        }

        return $result ?: [
            'average_rating' => 0,
            'review_count' => 0,
            'rating_5' => 0,
            'rating_4' => 0,
            'rating_3' => 0,
            'rating_2' => 0,
            'rating_1' => 0
        ];
    }

    /**
     * Add seller reply to a review
     */
    public static function addReply(int $reviewId, int $sellerId, string $reply): bool
    {
        // Verify seller owns the product
        $checkSql = "
            SELECT r.review_id
            FROM reviews r
            JOIN products p ON r.product_id = p.product_id
            JOIN stores s ON p.store_id = s.store_id
            WHERE r.review_id = :review_id
            AND s.owner_id = :seller_id
            AND r.seller_reply IS NULL
        ";

        $checkStmt = self::db()->prepare($checkSql);
        $checkStmt->execute([
            'review_id' => $reviewId,
            'seller_id' => $sellerId
        ]);

        if (!$checkStmt->fetch()) {
            return false; // Not authorized or already replied
        }

        $sql = "
            UPDATE reviews
            SET seller_reply = :reply,
                replied_at = NOW(),
                updated_at = NOW()
            WHERE review_id = :review_id
        ";

        $stmt = self::db()->prepare($sql);
        return $stmt->execute([
            'review_id' => $reviewId,
            'reply' => $reply
        ]);
    }

    /**
     * Toggle review visibility (hide/unhide)
     */
    public static function toggleVisibility(int $reviewId, int $sellerId): bool
    {
        // Verify seller owns the product
        $checkSql = "
            SELECT r.review_id, r.is_hidden
            FROM reviews r
            JOIN products p ON r.product_id = p.product_id
            JOIN stores s ON p.store_id = s.store_id
            WHERE r.review_id = :review_id
            AND s.owner_id = :seller_id
        ";

        $checkStmt = self::db()->prepare($checkSql);
        $checkStmt->execute([
            'review_id' => $reviewId,
            'seller_id' => $sellerId
        ]);

        $review = $checkStmt->fetch(PDO::FETCH_ASSOC);
        if (!$review) {
            return false; // Not authorized
        }

        $newStatus = !$review['is_hidden'];

        $sql = "
            UPDATE reviews
            SET is_hidden = :is_hidden,
                updated_at = NOW()
            WHERE review_id = :review_id
        ";

        $stmt = self::db()->prepare($sql);
        return $stmt->execute([
            'review_id' => $reviewId,
            'is_hidden' => $newStatus
        ]);
    }

    /**
     * Check if buyer can review a product from an order
     */
    public static function canReview(int $orderId, int $productId, int $buyerId): bool
    {
        $sql = "
            SELECT 1
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.order_id = :order_id
            AND oi.product_id = :product_id
            AND o.buyer_id = :buyer_id
            AND o.status = 'received'
            AND NOT EXISTS (
                SELECT 1 FROM reviews r
                WHERE r.order_id = :order_id
                AND r.product_id = :product_id
            )
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->execute([
            'order_id' => $orderId,
            'product_id' => $productId,
            'buyer_id' => $buyerId
        ]);

        return (bool)$stmt->fetch();
    }

    /**
     * Get review by ID
     */
    public static function findById(int $reviewId): ?array
    {
        $sql = "
            SELECT
                r.*,
                u.full_name as buyer_name,
                p.name as product_name,
                COALESCE(
                    json_agg(
                        json_build_object('image_path', ri.image_path, 'display_order', ri.display_order)
                        ORDER BY ri.display_order
                    ) FILTER (WHERE ri.review_image_id IS NOT NULL),
                    '[]'
                ) as images
            FROM reviews r
            JOIN users u ON r.buyer_id = u.user_id
            JOIN products p ON r.product_id = p.product_id
            LEFT JOIN review_images ri ON r.review_id = ri.review_id
            WHERE r.review_id = :review_id
            GROUP BY r.review_id, u.full_name, p.name
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->execute(['review_id' => $reviewId]);
        $review = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($review) {
            $review['images'] = json_decode($review['images'], true);
        }

        return $review ?: null;
    }

    /**
     * Get all reviews for seller's products with pagination
     */
    public static function getByStoreId(int $storeId, int $limit = 20, int $offset = 0): array
    {
        $sql = "
            SELECT
                r.review_id,
                r.rating,
                r.review_text,
                r.seller_reply,
                r.created_at,
                r.replied_at,
                r.is_hidden,
                r.product_id,
                p.name as product_name,
                p.image_path as product_image,
                u.full_name as buyer_name,
                COALESCE(
                    json_agg(
                        json_build_object('image_path', ri.image_path, 'display_order', ri.display_order)
                        ORDER BY ri.display_order
                    ) FILTER (WHERE ri.review_image_id IS NOT NULL),
                    '[]'
                ) as images
            FROM reviews r
            JOIN products p ON r.product_id = p.product_id
            JOIN users u ON r.buyer_id = u.user_id
            LEFT JOIN review_images ri ON r.review_id = ri.review_id
            WHERE p.store_id = :store_id
            GROUP BY r.review_id, p.name, p.image_path, u.full_name
            ORDER BY r.created_at DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->bindValue(':store_id', $storeId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Decode JSON images
        foreach ($reviews as &$review) {
            $review['images'] = json_decode($review['images'], true);
        }

        return $reviews;
    }

    /**
     * Count total reviews for a store
     */
    public static function countByStoreId(int $storeId): int
    {
        $sql = "
            SELECT COUNT(*)
            FROM reviews r
            JOIN products p ON r.product_id = p.product_id
            WHERE p.store_id = :store_id
        ";

        $stmt = self::db()->prepare($sql);
        $stmt->execute(['store_id' => $storeId]);
        return (int)$stmt->fetchColumn();
    }
}

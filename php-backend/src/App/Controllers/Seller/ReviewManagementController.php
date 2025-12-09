<?php

namespace App\Controllers\Seller;

use App\Models\Review;

class ReviewManagementController
{
    /**
     * Reply to a review
     */
    public static function replyToReview(array $req, int $reviewId): array
    {
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $sellerId = (int)$_SESSION['user']['user_id'];
        $reply = trim($req['body']['reply'] ?? '');

        if (empty($reply)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Reply cannot be empty'];
        }

        if (strlen($reply) > 500) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Reply cannot exceed 500 characters'];
        }

        $success = Review::addReply($reviewId, $sellerId, $reply);

        if (!$success) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Cannot reply to this review or already replied'];
        }

        return [
            'ok' => true,
            'message' => 'Reply added successfully'
        ];
    }

    /**
     * Toggle review visibility (hide/unhide)
     */
    public static function toggleVisibility(array $req, int $reviewId): array
    {
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $sellerId = (int)$_SESSION['user']['user_id'];
        $success = Review::toggleVisibility($reviewId, $sellerId);

        if (!$success) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Cannot modify this review'];
        }

        return [
            'ok' => true,
            'message' => 'Review visibility updated'
        ];
    }
}

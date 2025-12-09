<?php

namespace App\Controllers\Seller;

use App\Models\Review;
use App\Models\Store;
use App\Core\View;

class ReviewManagementController
{
    /**
     * Show reviews page
     */
    public function showReviewsPage(): void
    {
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'seller') {
            header('Location: /login');
            exit;
        }

        $sellerId = (int)$_SESSION['user']['user_id'];

        // Get seller's store
        $store = Store::findByOwnerId($sellerId);
        if (!$store) {
            header('Location: /seller/dashboard');
            exit;
        }

        View::render('SellerReviewsPage.php', [
            'title' => 'Manage Reviews',
            'sessionUser' => $_SESSION['user'],
            'store' => $store
        ]);
    }

    /**
     * Get reviews for seller's store (API endpoint)
     */
    public function getStoreReviews(array $req): array
    {
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'seller') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $sellerId = (int)$_SESSION['user']['user_id'];

        // Get seller's store
        $store = Store::findByOwnerId($sellerId);
        if (!$store) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Store not found'];
        }

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $perPage = 20;
        $offset = ($page - 1) * $perPage;

        $reviews = Review::getByStoreId($store['store_id'], $perPage, $offset);
        $total = Review::countByStoreId($store['store_id']);

        return [
            'ok' => true,
            'data' => [
                'reviews' => $reviews,
                'pagination' => [
                    'page' => $page,
                    'perPage' => $perPage,
                    'total' => $total,
                    'totalPages' => ceil($total / $perPage)
                ]
            ]
        ];
    }

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

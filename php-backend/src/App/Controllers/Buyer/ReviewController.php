<?php

namespace App\Controllers\Buyer;

use App\Models\Review;
use App\Core\View;

class ReviewController
{
    /**
     * Show reviewable products page
     */
    public function showReviewablePage(): void
    {
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'buyer') {
            header('Location: /login');
            exit;
        }

        $buyerId = (int)$_SESSION['user']['user_id'];
        $products = Review::getReviewableProducts($buyerId);

        View::render('ReviewablePage.php', [
            'title' => 'Review Products',
            'products' => $products,
            'sessionUser' => $_SESSION['user']
        ]);
    }

    /**
     * Show review form for a specific product
     */
    public function showReviewForm(array $req, int $productId): void
    {
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'buyer') {
            header('Location: /login');
            exit;
        }

        $buyerId = (int)$_SESSION['user']['user_id'];
        $orderId = (int)($_GET['order_id'] ?? 0);

        if (!$orderId) {
            header('Location: /orders');
            exit;
        }

        // Check if buyer can review this product
        if (!Review::canReview($orderId, $productId, $buyerId)) {
            $_SESSION['flash'] = 'You cannot review this product';
            header('Location: /orders');
            exit;
        }

        // Get product details
        $product = \App\Models\Product::findById($productId);
        if (!$product) {
            header('Location: /orders');
            exit;
        }

        View::render('ReviewForm.php', [
            'title' => 'Write Review',
            'product' => $product,
            'order_id' => $orderId,
            'sessionUser' => $_SESSION['user']
        ]);
    }

    /**
     * Submit a review
     */
    public function submitReview(array $req): array
    {
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'buyer') {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Unauthorized'];
        }

        $buyerId = (int)$_SESSION['user']['user_id'];
        $orderId = (int)($req['body']['order_id'] ?? 0);
        $productId = (int)($req['body']['product_id'] ?? 0);
        $rating = (int)($req['body']['rating'] ?? 0);
        $reviewText = trim($req['body']['review_text'] ?? '');

        // Validate
        if (!$orderId || !$productId) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Missing order or product ID'];
        }

        if ($rating < 1 || $rating > 5) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Rating must be between 1 and 5'];
        }

        if (strlen($reviewText) > 500) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Review text cannot exceed 500 characters'];
        }

        // Check if buyer can review
        if (!Review::canReview($orderId, $productId, $buyerId)) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'You cannot review this product'];
        }

        // Create review
        $reviewId = Review::create([
            'order_id' => $orderId,
            'product_id' => $productId,
            'buyer_id' => $buyerId,
            'rating' => $rating,
            'review_text' => $reviewText ?: null
        ]);

        if (!$reviewId) {
            http_response_code(500);
            return ['ok' => false, 'error' => 'Failed to create review'];
        }

        // Handle image uploads if present
        if (!empty($_FILES['images']['name'][0])) {
            $uploadedPaths = $this->handleImageUploads($reviewId);
            if (!empty($uploadedPaths)) {
                Review::addImages($reviewId, $uploadedPaths);
            }
        }

        http_response_code(200);
        return [
            'ok' => true,
            'review_id' => $reviewId,
            'message' => 'Review submitted successfully'
        ];
    }

    /**
     * Handle review image uploads
     */
    private function handleImageUploads(int $reviewId): array
    {
        $uploadedPaths = [];
        $maxImages = 3;

        if (empty($_FILES['images']['name'])) {
            return $uploadedPaths;
        }

        $uploadDir = __DIR__ . '/../../../public/uploads/reviews/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $files = $_FILES['images'];
        $fileCount = is_array($files['name']) ? count($files['name']) : 1;

        for ($i = 0; $i < min($fileCount, $maxImages); $i++) {
            if (is_array($files['name'])) {
                $name = $files['name'][$i];
                $tmpName = $files['tmp_name'][$i];
                $error = $files['error'][$i];
                $size = $files['size'][$i];
            } else {
                $name = $files['name'];
                $tmpName = $files['tmp_name'];
                $error = $files['error'];
                $size = $files['size'];
            }

            if ($error !== UPLOAD_ERR_OK) {
                continue;
            }

            // Validate file type
            $allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $tmpName);
            finfo_close($finfo);

            if (!in_array($mimeType, $allowedTypes)) {
                continue;
            }

            // Validate file size (max 5MB)
            if ($size > 5 * 1024 * 1024) {
                continue;
            }

            // Generate unique filename
            $extension = pathinfo($name, PATHINFO_EXTENSION);
            $filename = 'review_' . $reviewId . '_' . $i . '_' . uniqid() . '.' . $extension;
            $destination = $uploadDir . $filename;

            if (move_uploaded_file($tmpName, $destination)) {
                $uploadedPaths[] = '/uploads/reviews/' . $filename;
            }
        }

        return $uploadedPaths;
    }

    /**
     * Get reviews for a product (API endpoint)
     */
    public function getProductReviews(array $req, int $productId): array
    {
        $page = (int)($_GET['page'] ?? 1);
        $limit = 10;
        $offset = ($page - 1) * $limit;

        $reviews = Review::getByProductId($productId, $limit, $offset);
        $stats = Review::getProductStats($productId);

        return [
            'ok' => true,
            'data' => [
                'reviews' => $reviews,
                'stats' => $stats,
                'page' => $page
            ]
        ];
    }
}

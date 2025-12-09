<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title ?? 'Review Products') ?> - Nimonspedia</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
        }

        .header {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 30px;
            margin-bottom: 30px;
        }

        .header h1 {
            color: #333;
            margin-bottom: 10px;
        }

        .header p {
            color: #666;
            font-size: 14px;
        }

        .products-list {
            display: grid;
            gap: 20px;
        }

        .product-card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 20px;
            display: flex;
            gap: 20px;
            align-items: center;
            transition: box-shadow 0.3s;
        }

        .product-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .product-image {
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 8px;
            flex-shrink: 0;
        }

        .product-info {
            flex: 1;
        }

        .product-name {
            color: #333;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .product-meta {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .product-meta strong {
            color: #333;
        }

        .review-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-top: 8px;
        }

        .status-reviewed {
            background-color: #d4edda;
            color: #155724;
        }

        .status-pending {
            background-color: #fff3cd;
            color: #856404;
        }

        .product-actions {
            flex-shrink: 0;
        }

        .btn {
            padding: 10px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.3s;
        }

        .btn-primary {
            background-color: #28a745;
            color: white;
        }

        .btn-primary:hover {
            background-color: #218838;
        }

        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }

        .btn-secondary:hover {
            background-color: #5a6268;
        }

        .btn:disabled {
            background-color: #e9ecef;
            color: #6c757d;
            cursor: not-allowed;
        }

        .empty-state {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 60px 30px;
            text-align: center;
        }

        .empty-state h3 {
            color: #333;
            margin-bottom: 10px;
        }

        .empty-state p {
            color: #666;
            margin-bottom: 20px;
        }

        .back-link {
            display: inline-block;
            color: #28a745;
            text-decoration: none;
            font-weight: 500;
            margin-bottom: 20px;
        }

        .back-link:hover {
            text-decoration: underline;
        }

        .rating-display {
            color: #ffc107;
            font-size: 16px;
            margin-top: 5px;
        }

        .rating-display .stars {
            letter-spacing: 2px;
        }

        .rating-display .rating-value {
            color: #666;
            font-size: 14px;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="/orders" class="back-link">← Back to Orders</a>

        <div class="header">
            <h1>Review Your Products</h1>
            <p>Share your experience with products you've received</p>
        </div>

        <?php if (empty($products)): ?>
            <div class="empty-state">
                <h3>No Products to Review</h3>
                <p>You don't have any received orders yet. Products will appear here once your orders are delivered.</p>
                <a href="/products" class="btn btn-primary">Browse Products</a>
            </div>
        <?php else: ?>
            <div class="products-list">
                <?php foreach ($products as $product): ?>
                    <div class="product-card">
                        <img src="<?= htmlspecialchars($product['image_path'] ?? '/placeholder.png') ?>"
                             alt="<?= htmlspecialchars($product['name']) ?>"
                             class="product-image">

                        <div class="product-info">
                            <div class="product-name"><?= htmlspecialchars($product['name']) ?></div>
                            <div class="product-meta">
                                <strong>Order ID:</strong> #<?= htmlspecialchars($product['order_id']) ?>
                            </div>
                            <div class="product-meta">
                                <strong>Received:</strong> <?= date('M d, Y', strtotime($product['received_at'] ?? $product['created_at'])) ?>
                            </div>

                            <?php if (!empty($product['has_review'])): ?>
                                <span class="review-status status-reviewed">✓ Reviewed</span>
                                <?php if (isset($product['your_rating'])): ?>
                                    <div class="rating-display">
                                        <span class="stars">
                                            <?php for ($i = 1; $i <= 5; $i++): ?>
                                                <?= $i <= $product['your_rating'] ? '★' : '☆' ?>
                                            <?php endfor; ?>
                                        </span>
                                        <span class="rating-value"><?= $product['your_rating'] ?>/5</span>
                                    </div>
                                <?php endif; ?>
                            <?php else: ?>
                                <span class="review-status status-pending">Pending Review</span>
                            <?php endif; ?>
                        </div>

                        <div class="product-actions">
                            <?php if (empty($product['has_review'])): ?>
                                <a href="/review/product/<?= $product['product_id'] ?>?order_id=<?= $product['order_id'] ?>"
                                   class="btn btn-primary">
                                    Write Review
                                </a>
                            <?php else: ?>
                                <button class="btn" disabled>Already Reviewed</button>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>

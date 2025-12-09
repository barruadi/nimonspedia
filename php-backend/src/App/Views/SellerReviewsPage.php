<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title ?? 'Manage Reviews') ?> - Nimonspedia</title>
    <link rel="stylesheet" href="/styles/SellerReviews.css">
</head>
<body>

    <div class="container">
        <div class="header">
            <h1>Manage Reviews</h1>
            <p>View and respond to customer reviews for your products</p>
        </div>

        <div id="loadingState" class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading reviews...</p>
        </div>

        <div id="contentWrapper" class="content-wrapper" style="display: none;">
            <div id="reviewsList" class="reviews-list"></div>

            <div id="pagination" class="pagination"></div>

            <div id="emptyState" class="empty-state" style="display: none;">
                <h3>No Reviews Yet</h3>
                <p>Your products haven't received any reviews yet. Reviews will appear here once customers review your products.</p>
            </div>
        </div>
    </div>

    <!-- Reply Modal -->
    <div id="replyModal" class="modal">
        <div class="modal-content"> 
            <div class="modal-header">
                <h3>Reply to Review</h3>
                <button class="modal-close" onclick="closeReplyModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div id="modalReviewInfo"></div>
                <textarea id="replyText" class="reply-textarea" placeholder="Write your reply..." maxlength="500"></textarea>
                <div class="char-count"><span id="charCount">0</span>/500</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeReplyModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitReply()">Send Reply</button>
            </div>
        </div>
    </div>

    <script type="module" src="/script/SellerReviews.js"></script>
</body>
</html>

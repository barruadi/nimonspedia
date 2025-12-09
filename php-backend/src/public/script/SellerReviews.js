import { api } from '../utils/api.js';

let currentPage = 1;
let currentReviewId = null;

async function loadReviews(page = 1) {
    const loadingState = document.getElementById('loadingState');
    const contentWrapper = document.getElementById('contentWrapper');
    const reviewsList = document.getElementById('reviewsList');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');

    try {
        loadingState.style.display = 'block';
        contentWrapper.style.display = 'none';

        const result = await api.get(`/seller/reviews?page=${page}`);

        if (result && result.ok) {
            const { reviews, pagination: paginationData } = result.data;

            if (reviews.length === 0 && page === 1) {
                emptyState.style.display = 'block';
                reviewsList.innerHTML = '';
                pagination.innerHTML = '';
            } else {
                emptyState.style.display = 'none';
                renderReviews(reviews);
                renderPagination(paginationData);
            }

            currentPage = page;
        } else {
            showError('Failed to load reviews');
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        showError('An error occurred while loading reviews');
    } finally {
        loadingState.style.display = 'none';
        contentWrapper.style.display = 'block';
    }
}

function renderReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');

    reviewsList.innerHTML = reviews.map(review => {
        const hasReply = review.seller_reply && review.seller_reply.trim() !== '';
        const stars = renderStars(review.rating);
        const images = review.images && review.images.length > 0 ? renderReviewImages(review.images) : '';
        const hiddenBadge = review.is_hidden ? '<span class="hidden-badge">Hidden</span>' : '';

        return `
            <div class="review-card" data-review-id="${review.review_id}">
                <div class="review-header">
                    <div class="review-product-info">
                        <div class="product-name">${escapeHtml(review.product_name)}${hiddenBadge}</div>
                        <div class="review-meta">
                            By: <strong>${escapeHtml(review.buyer_name)}</strong> •
                            ${formatDate(review.created_at)}
                        </div>
                    </div>
                    <div class="review-rating">${stars}</div>
                </div>

                <div class="review-body">
                    ${review.review_text ? `
                        <div class="review-text">${escapeHtml(review.review_text)}</div>
                    ` : ''}
                    ${images}
                </div>

                ${hasReply ? `
                    <div class="seller-reply-section">
                        <div class="reply-header">
                            <span class="reply-label">Your Reply</span>
                            ${review.replied_at ? `<span class="reply-date">${formatDate(review.replied_at)}</span>` : ''}
                        </div>
                        <div class="reply-text">${escapeHtml(review.seller_reply)}</div>
                    </div>
                ` : ''}

                <div class="review-actions">
                    ${!hasReply ? `
                        <button class="btn btn-primary" onclick="openReplyModal(${review.review_id}, '${escapeHtml(review.product_name)}', '${escapeHtml(review.buyer_name)}')">
                            Reply
                        </button>
                    ` : ''}
                    <button class="btn btn-${review.is_hidden ? 'secondary' : 'danger'}"
                            onclick="toggleVisibility(${review.review_id})">
                        ${review.is_hidden ? 'Unhide' : 'Hide'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    let html = '';
    for (let i = 0; i < 5; i++) {
        html += i < fullStars ? '★' : '☆';
    }
    return html;
}

function renderReviewImages(images) {
    if (!images || images.length === 0) return '';

    return `
        <div class="review-images">
            ${images.map(img => `
                <img src="${escapeHtml(img.image_path)}"
                     alt="Review image"
                     class="review-image"
                     onclick="window.open('${escapeHtml(img.image_path)}', '_blank')">
            `).join('')}
        </div>
    `;
}

function renderPagination(paginationData) {
    const pagination = document.getElementById('pagination');

    if (paginationData.totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    pagination.innerHTML = `
        <button ${paginationData.page <= 1 ? 'disabled' : ''}
                onclick="loadReviews(${paginationData.page - 1})">
            Previous
        </button>
        <span class="page-info">
            Page ${paginationData.page} of ${paginationData.totalPages}
        </span>
        <button ${paginationData.page >= paginationData.totalPages ? 'disabled' : ''}
                onclick="loadReviews(${paginationData.page + 1})">
            Next
        </button>
    `;
}

window.openReplyModal = function(reviewId, productName, buyerName) {
    currentReviewId = reviewId;
    const modal = document.getElementById('replyModal');
    const modalReviewInfo = document.getElementById('modalReviewInfo');
    const replyText = document.getElementById('replyText');
    const charCount = document.getElementById('charCount');

    modalReviewInfo.innerHTML = `
        <div style="margin-bottom: 8px;"><strong>Product:</strong> ${escapeHtml(productName)}</div>
        <div><strong>Customer:</strong> ${escapeHtml(buyerName)}</div>
    `;

    replyText.value = '';
    charCount.textContent = '0';
    modal.classList.add('active');

    // Add character counter
    replyText.addEventListener('input', function() {
        charCount.textContent = this.value.length;
    });
};

window.closeReplyModal = function() {
    const modal = document.getElementById('replyModal');
    modal.classList.remove('active');
    currentReviewId = null;
};

window.submitReply = async function() {
    if (!currentReviewId) return;

    const replyText = document.getElementById('replyText');
    const reply = replyText.value.trim();

    if (!reply) {
        alert('Please enter a reply');
        return;
    }

    if (reply.length > 500) {
        alert('Reply cannot exceed 500 characters');
        return;
    }

    try {
        const result = await api.post(`/seller/reviews/${currentReviewId}/reply`, {
            reply: reply
        });

        if (result && result.ok) {
            showToast('Reply sent successfully', 'Your reply has been posted', 'success');
            closeReplyModal();
            loadReviews(currentPage); // Reload current page
        } else {
            throw new Error(result?.error || 'Failed to send reply');
        }
    } catch (error) {
        console.error('Error sending reply:', error);
        alert(error.message || 'Failed to send reply. Please try again.');
    }
};

window.toggleVisibility = async function(reviewId) {
    if (!confirm('Are you sure you want to change the visibility of this review?')) {
        return;
    }

    try {
        const result = await api.post(`/seller/reviews/${reviewId}/toggle-visibility`, {});

        if (result && result.ok) {
            showToast('Review visibility updated', '', 'success');
            loadReviews(currentPage); // Reload current page
        } else {
            throw new Error(result?.error || 'Failed to update visibility');
        }
    } catch (error) {
        console.error('Error toggling visibility:', error);
        alert(error.message || 'Failed to update visibility. Please try again.');
    }
};

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const contentWrapper = document.getElementById('contentWrapper');
    contentWrapper.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 60px 30px; text-align: center;">
            <h3 style="color: #dc3545; margin-bottom: 10px;">Error</h3>
            <p style="color: #666;">${escapeHtml(message)}</p>
            <button class="btn btn-primary" style="margin-top: 20px;" onclick="location.reload()">
                Reload Page
            </button>
        </div>
    `;
}

function showToast(primaryMessage, secondaryMessage = '', type = 'success') {
    window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
            primary: primaryMessage,
            secondary: secondaryMessage,
            type: type
        }
    }));
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadReviews(1);
});

// Export for use in HTML onclick
window.loadReviews = loadReviews;

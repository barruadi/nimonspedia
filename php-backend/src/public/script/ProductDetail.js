import { api } from '../utils/api.js';
import { featureGuard } from '../utils/featureGuard.js';

function initProductDetailPage() {
    const loadingState = document.getElementById('loadingState');
    const contentWrapper = document.getElementById('contentWrapper');
    
    const productImage = document.getElementById('productImage');
    const productCategory = document.getElementById('productCategory');
    const productName = document.getElementById('productName');
    const productPrice = document.getElementById('productPrice');
    const productDescription = document.getElementById('productDescription');
    const productStock = document.getElementById('productStock');
    
    const storeLogo = document.getElementById('storeLogo');
    const storeName = document.getElementById('storeName');
    const storeDescription = document.getElementById('storeDescription');
    const chatStoreBtn = document.getElementById('chatStoreBtn');
    const goToAuctionBtn = document.getElementById('goToAuctionBtn');

    const qtyDecrement = document.getElementById('qtyDecrement');
    const qtyIncrement = document.getElementById('qtyIncrement');
    const qtyInput = document.getElementById('qtyInput');
    const subtotalPrice = document.getElementById('subtotalPrice');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const cartMessage = document.getElementById('cartMessage');

    let currentProduct = null;
    let isUserLoggedIn = false;
    let isCheckoutEnabled = true;

    async function checkAuthStatus() {
        try {
            const result = await api.get('/me');
            isUserLoggedIn = result && result.authenticated === true;
            
            // Check if checkout feature is enabled
            if (isUserLoggedIn) {
                isCheckoutEnabled = await featureGuard.isFeatureEnabled('checkout_enabled');
                console.log('[ProductDetail] Checkout enabled:', isCheckoutEnabled);
            } else {
                isCheckoutEnabled = true; // Default for non-logged-in users
            }
        } catch (error) {
            isUserLoggedIn = false;
            isCheckoutEnabled = true;
        }
    }

    async function loadProductData() {
        const productId = window.routeParams?.id;

        if (!productId) {
            showError('Halaman produk tidak ditemukan.');
            return;
        }

        try {
            showLoading();

            // Check auth status first
            await checkAuthStatus();

            const result = await api.get(`/product/${productId}`);

            if (result && result.ok) {
                currentProduct = result.data.product;
                const store = result.data.store;
                const auction = result.data.auction;
                const reviews = result.data.reviews;

                renderProduct(currentProduct, store);
                setupPurchaseBox(currentProduct);
                setupStoreActions(store, auction);
                renderReviews(reviews);

                hideLoading();
            } else {
                showError(result?.error || 'Gagal memuat data produk.');
            }
        } catch (error) {
            showError('Terjadi kesalahan. Coba muat ulang halaman.');
        }
    }
    
    function renderProduct(product, store) {
        productImage.src = product.image_path || '/images/placeholder.png';
        productImage.alt = product.name;
        productCategory.textContent = product.category_name || 'Kategori';
        productName.textContent = product.name;
        productPrice.textContent = formatCurrency(product.price);
        productDescription.innerHTML = product.description;

        if (store) {
            storeName.textContent = store.store_name;
            if (storeDescription) {
                storeDescription.innerHTML = store.description;
            }
            if (storeLogo && store.logo_path) {
                storeLogo.src = store.logo_path;
            }
        }
    }

function setupPurchaseBox(product) {
        const stock = parseInt(product.stock, 10);
        productStock.textContent = stock;
        qtyInput.max = stock;

        // If user is not logged in or checkout is disabled, disable all purchase controls
        if (!isUserLoggedIn || !isCheckoutEnabled) {
            qtyInput.value = 0;
            qtyInput.disabled = true;
            qtyDecrement.disabled = true;
            qtyIncrement.disabled = true;
            updateSubtotal();
            return; // Don't add event listeners for guests or disabled users
        }

        if (stock === 0) {
            qtyInput.value = 0;
            qtyInput.disabled = true;
        } else {
            qtyInput.value = 1;
            qtyInput.disabled = false;
        }

        updateSubtotal();

        qtyDecrement.addEventListener('click', () => {
            let qty = parseInt(qtyInput.value, 10);
            if (qty > 0) {
                qtyInput.value = qty - 1;
                updateSubtotal();
            }
        });

        qtyIncrement.addEventListener('click', () => {
            let qty = parseInt(qtyInput.value, 10);
            const stock = parseInt(currentProduct.stock, 10);
            if (qty < stock) {
                qtyInput.value = qty + 1;
                updateSubtotal();
            }
        });

        qtyInput.addEventListener('input', () => {
            let qty = parseInt(qtyInput.value, 10);
            const stock = parseInt(currentProduct.stock, 10);

            if (isNaN(qty) || qty < 0) {
                qtyInput.value = 0;
            } else if (qty > stock) {
                qtyInput.value = stock;
            }
            updateSubtotal();
        });
    }
    
    function updateSubtotal() {
        const qty = parseInt(qtyInput.value, 10);
        const stock = parseInt(currentProduct.stock, 10);

        if (isNaN(qty)) return;

        if (currentProduct && qty > 0) {
            const subtotal = currentProduct.price * qty;
            subtotalPrice.textContent = formatCurrency(subtotal);
        } else {
            subtotalPrice.textContent = formatCurrency(0);
        }

        qtyDecrement.disabled = (qty <= 0);
        qtyIncrement.disabled = (qty >= stock);

        // If user is not logged in, show "Login to buy" button
        if (!isUserLoggedIn) {
            addToCartBtn.textContent = 'Login to buy';
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('btn-disabled-guest');
        } else if (!isCheckoutEnabled) {
            // Checkout feature is disabled for this user
            addToCartBtn.textContent = 'Checkout Disabled';
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('btn-disabled-guest');
        } else if (stock === 0) {
            addToCartBtn.textContent = 'Stok Habis';
            addToCartBtn.disabled = true;
            addToCartBtn.classList.remove('btn-disabled-guest');
        } else if (qty <= 0) {
            addToCartBtn.textContent = 'Tambahkan ke Keranjang';
            addToCartBtn.disabled = true;
            addToCartBtn.classList.remove('btn-disabled-guest');
        } else {
            addToCartBtn.textContent = 'Tambahkan ke Keranjang';
            addToCartBtn.disabled = false;
            addToCartBtn.classList.remove('btn-disabled-guest');
        }
    }

async function handleAddToCart() {
        if (!currentProduct) return;
        
        if (cartMessage) {
            cartMessage.style.display = 'none';
        }

        const qty = parseInt(qtyInput.value, 10);
        if (qty <= 0) return;
        
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = 'Menambahkan...';
        
        try {
            const result = await api.post('/cart/add', {
                product_id: currentProduct.product_id,
                qty: qty
            });
            
            if (result && result.ok) {
                showToast(
                    'Produk berhasil ditambahkan ke keranjang!',
                    'Yuk, lanjut belanja atau langsung ke checkout~',
                    'success'
                );

                addToCartBtn.textContent = 'Berhasil!';

                // Refresh navbar to update cart badge count
                if (window.notifyAuthChanged) {
                    window.notifyAuthChanged();
                }

                setTimeout(() => {
                    addToCartBtn.textContent = 'Tambahkan ke Keranjang';
                    updateSubtotal();
                }, 2000);
            } else {
                let errorMsg = 'Melewati batas stok, silahkan periksa keranjang Anda';
                if (result && result.error) {
                    if (typeof result.error === 'string') {
                        errorMsg = result.error;
                    } else if (result.error.message) {
                        errorMsg = result.error.message;
                    }
                }
                throw new Error(errorMsg);
            }

        } catch (error) {
            showToast('Gagal menambahkan ke keranjang', 'Silakan cek pesan error di kartu', 'error');
            
            if (cartMessage) {
                cartMessage.textContent = error.message;
                cartMessage.className = 'cart-message error'; 
                cartMessage.style.display = 'block';
            }
            
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = 'Tambahkan ke Keranjang';
        }
    }
    
    addToCartBtn.addEventListener('click', handleAddToCart);

    function setupStoreActions(store, auction) {
        if (!store) return;

        if (chatStoreBtn) {
            chatStoreBtn.addEventListener('click', () => {
                if (!isUserLoggedIn) {
                    showToast('Silakan login terlebih dahulu', 'Anda harus login untuk memulai chat', 'error');
                    return;
                }
                // Redirect to chat with store_id and product_id for automatic product preview
                window.location.href = `/chat?store_id=${store.store_id}&product_id=${currentProduct.product_id}`;
            });

            if (!isUserLoggedIn) {
                chatStoreBtn.disabled = true;
            }
        }

        if (goToAuctionBtn) {
            if (auction && (auction.status === 'scheduled' || auction.status === 'active')) {
                goToAuctionBtn.disabled = false;
                goToAuctionBtn.addEventListener('click', () => {
                    window.location.href = `/auction/${auction.auction_id}`;
                });
            } else {
                goToAuctionBtn.disabled = true;
            }
        }
    }

    function showLoading() {
        loadingState.style.display = 'block';
        contentWrapper.style.display = 'none';
    }
    function hideLoading() {
        loadingState.style.display = 'none';
        contentWrapper.style.display = 'flex';
    }
    function showError(message) {
        loadingState.innerHTML = `<p style="color: #BE2124;">${message}</p>`;
        loadingState.style.display = 'block';
        contentWrapper.style.display = 'none';
    }
    function formatCurrency(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number);
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

    function renderReviews(reviewsData) {
        const reviewsSection = document.getElementById('reviewsSection');
        const reviewsList = document.getElementById('reviewsList');
        const reviewsLoading = document.getElementById('reviewsLoading');
        const noReviews = document.getElementById('noReviews');
        const averageRating = document.getElementById('averageRating');
        const averageStars = document.getElementById('averageStars');
        const totalReviews = document.getElementById('totalReviews');
        const ratingBreakdown = document.getElementById('ratingBreakdown');
        const productRatingHeader = document.getElementById('productRatingHeader');
        const headerStars = document.getElementById('headerStars');
        const headerRatingText = document.getElementById('headerRatingText');

        if (!reviewsData || !reviewsData.stats) {
            return;
        }

        const stats = reviewsData.stats;
        const latestReviews = reviewsData.latest || [];

        // Show reviews section
        reviewsSection.style.display = 'block';

        // Update header rating display
        if (stats.review_count > 0) {
            productRatingHeader.style.display = 'flex';
            headerStars.innerHTML = renderStars(stats.average_rating);
            headerRatingText.textContent = `${stats.average_rating.toFixed(1)} (${stats.review_count} ${stats.review_count === 1 ? 'review' : 'reviews'})`;
        }

        // Display average rating
        averageRating.textContent = stats.average_rating.toFixed(1);
        averageStars.innerHTML = renderStars(stats.average_rating);
        totalReviews.textContent = `${stats.review_count} ${stats.review_count === 1 ? 'review' : 'reviews'}`;

        // Display rating breakdown
        if (stats.review_count > 0) {
            ratingBreakdown.innerHTML = `
                ${renderRatingBar(5, stats.rating_5, stats.review_count)}
                ${renderRatingBar(4, stats.rating_4, stats.review_count)}
                ${renderRatingBar(3, stats.rating_3, stats.review_count)}
                ${renderRatingBar(2, stats.rating_2, stats.review_count)}
                ${renderRatingBar(1, stats.rating_1, stats.review_count)}
            `;
        }

        // Display reviews
        if (latestReviews.length === 0) {
            reviewsList.style.display = 'none';
            noReviews.style.display = 'block';
        } else {
            noReviews.style.display = 'none';
            reviewsList.style.display = 'block';
            reviewsList.innerHTML = latestReviews.map(review => renderReviewCard(review)).join('');
        }
    }

    function renderStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let starsHtml = '';
        for (let i = 0; i < fullStars; i++) {
            starsHtml += '<span class="star filled">★</span>';
        }
        if (hasHalfStar) {
            starsHtml += '<span class="star half">★</span>';
        }
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '<span class="star empty">☆</span>';
        }
        return starsHtml;
    }

    function renderRatingBar(stars, count, total) {
        const percentage = total > 0 ? (count / total) * 100 : 0;
        return `
            <div class="rating-bar-item">
                <span class="rating-label">${stars} ★</span>
                <div class="rating-bar">
                    <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <span class="rating-count">${count}</span>
            </div>
        `;
    }

    function renderReviewCard(review) {
        const reviewDate = formatReviewDate(review.created_at);
        const hasImages = review.images && review.images.length > 0;
        const hasReply = review.seller_reply && review.seller_reply.trim() !== '';

        return `
            <div class="review-card">
                <div class="review-header">
                    <div class="reviewer-info">
                        <span class="reviewer-name">${escapeHtml(review.buyer_name)}</span>
                        <span class="review-date">${reviewDate}</span>
                    </div>
                    <div class="review-rating">
                        ${renderStars(review.rating)}
                    </div>
                </div>

                ${review.review_text ? `
                    <div class="review-text">
                        <p>${escapeHtml(review.review_text)}</p>
                    </div>
                ` : ''}

                ${hasImages ? `
                    <div class="review-images">
                        ${review.images.map(img => `
                            <img src="${escapeHtml(img.image_path)}"
                                 alt="Review image"
                                 class="review-image"
                                 onclick="window.open('${escapeHtml(img.image_path)}', '_blank')">
                        `).join('')}
                    </div>
                ` : ''}

                ${hasReply ? `
                    <div class="seller-reply">
                        <div class="reply-header">
                            <span class="reply-label">Seller's Reply</span>
                            ${review.replied_at ? `<span class="reply-date">${formatReviewDate(review.replied_at)}</span>` : ''}
                        </div>
                        <p class="reply-text">${escapeHtml(review.seller_reply)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function formatReviewDate(dateString) {
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
            return date.toLocaleDateString('id-ID', {
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

    loadProductData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductDetailPage);
} else {
    setTimeout(initProductDetailPage, 50); 
}
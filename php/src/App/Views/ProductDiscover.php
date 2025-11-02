<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title><?= htmlspecialchars($title ?? 'Browse Products') ?></title>
<meta name="viewport" content="width=device-width,initial-scale=1">

<style>
/* --- Page Layout --- */
.store-detail-page {
    max-width: 1200px;
    margin: 1.5rem auto;
    padding: 0 1rem 4rem;
    color: #222;
    font-family: system-ui, -apple-system, sans-serif;
}

.store-banner {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1rem;
    padding-top: 1rem;
}

.filters {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}

@media(min-width: 768px) {
    .filters {
        grid-template-columns: 2fr 1fr 1fr 1fr;
        align-items: end;
    }
}

.filters label {
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
    font-weight: 500;
    color: #444;
    gap: 0.25rem;
}

.filters input,
.filters select {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #ddd;
    font-size: 0.9rem;
    background: #fff;
    font-family: inherit;
    transition: border-color 0.2s;
}

.filters input:focus,
.filters select:focus {
    outline: none;
    border-color: #03ac0e; /* Green focus from new style */
}

/* NEW: Search with icon */
.filter-search {
    position: relative;
}

.filter-search input {
    padding-left: 2.5rem;
    width: 100%;
    box-sizing: border-box;
}

.filter-search svg {
    position: absolute;
    left: 0.75rem;
    /* Adjusted to center with 0.75rem padding */
    bottom: calc(0.75rem - 1px); 
    color: #888;
    pointer-events: none;
}

/* --- Results Header --- */
.results-header {
    margin-bottom: 1.5rem;
}

.product-grid-title {
    font-size: 0.9rem;
    font-weight: 400;
    margin: 0;
    color: #666;
}

/* --- Product Grid --- */
.grid {
    display: grid;
    /* Updated minmax to match new card size */
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    min-height: 200px;
    margin-bottom: 2rem;
    position: relative; /* Kept for loading skeleton */
}

/* Loading skeleton overlay (Kept from original) */
.grid.loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
        -45deg,
        #eee,
        #eee 10px,
        #f5f5f5 10px,
        #f5f5f5 20px
    );
    opacity: 0.6;
    pointer-events: none;
    border-radius: .5rem;
}

/* --- Product Card (From new style) --- */
.card {
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    min-height: 320px; /* New height */
    transition: all 0.2s ease;
    position: relative;
    text-decoration: none; /* Added for link wrapper */
    color: inherit; /* Added for link wrapper */
}

.card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    transform: translateY(-2px);
}

.card.out-of-stock {
    background: #f9f9f9;
    opacity: 0.7;
    border-color: #e5e5e5; /* Harmonized */
    color: #999; /* Harmonized */
}

.card.out-of-stock:hover {
    transform: none;
    box-shadow: none;
}

/* NEW: disabled state (Merged from original) */
.card.disabled {
    background: #f9f9f9;
    border-color: #e5e5e5;
    color: #999;
    opacity: .7;
    filter: grayscale(1);
    pointer-events: none;
}
.card.disabled:hover {
    transform: none;
    box-shadow: none;
}
.card.disabled .btn-addcart { display: none; }
.card.disabled .btn-disabled { pointer-events: none; }


.card img {
    width: 100%;
    height: 180px; /* New height */
    object-fit: cover;
    border-radius: 0.5rem;
    background: #f5f5f5;
    margin-bottom: 0.75rem;
}

.card .name {
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.4;
    color: #111;
    margin-bottom: 0.5rem;
    flex-grow: 1;
    /* NEW: text truncation */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.store {
    font-size: .75rem;
    margin-bottom: .5rem;
    color: #555;
}
.store a {
    color: inherit;
    text-decoration: underline;
}

.card .price {
    font-size: 1rem; /* New size */
    font-weight: 600; /* New weight */
    color: #111;
    margin-bottom: 0.5rem;
}

.card .stock-line {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.75rem;
}

.badge-out {
    display: inline-block;
    font-size: 0.7rem;
    background: #e5e5e5; /* New color */
    color: #999; /* New color */
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
}

/* --- Action Buttons (From new style) --- */
.actions {
    margin-top: auto;
}

.btn-addcart,
.btn-disabled {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    font-weight: 500;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
}

.btn-addcart {
    background: #03ac0e;
    color: #fff;
}

.btn-addcart:hover:not(:disabled) {
    background: #028a0b;
    box-shadow: 0 2px 8px rgba(3, 172, 14, 0.3);
}

.btn-addcart:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    position: relative; /* For loading spinner */
}

.btn-addcart svg {
    flex-shrink: 0;
}

.btn-disabled {
    background: #f5f5f5;
    color: #999;
    border: 1px solid #e5e5e5;
    cursor: not-allowed;
    pointer-events: none;
}

/* --- Empty State (From new style) --- */
.empty-state {
    display: flex; /* Changed from none to flex */
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4rem 1rem;
    color: #666;
    min-height: 400px;
    grid-column: 1 / -1; /* Kept from original */
}

.empty-state-icon {
    width: 160px;
    height: 160px;
    margin-bottom: 1.5rem;
    opacity: 0.5;
}

.empty-state-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #333;
    margin: 0 0 0.5rem;
}

.empty-state-subtitle {
    font-size: 0.95rem;
    color: #666;
    margin: 0;
}

/* --- Pagination Container (From new style) --- */
.pagination-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-top: 2rem;
    padding: 1.5rem 0;
    border-top: 1px solid #e5e5e5;
}

@media(min-width: 768px) {
    .pagination-container {
        flex-direction: row;
        justify-content: space-between;
    }
    .results-header {
        margin-bottom: 0; /* No margin on desktop */
    }
}

/* --- Pagination Controls (From new style) --- */
.pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.pagination-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid #e5e5e5;
    border-radius: 0.5rem;
    background: #fff;
    color: #333;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
}

.pagination-btn:hover {
    background: #f5f5f5;
    border-color: #03ac0e;
}

.pagination-btn[aria-disabled="true"],
.pagination-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
    color: #999; /* Harmonized */
    background: #f5f5f5; /* Harmonized */
}

/* --- Pagination Numbers (From new style) --- */
.pagination-numbers {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.pagination-number {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 0.5rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.5rem;
    background: #fff;
    color: #333;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
}

.pagination-number:hover {
    background: #f5f5f5;
    border-color: #03ac0e;
}

/* Active/Disabled state for JS rendering */
.pagination-number[aria-disabled="true"],
.pagination-number.active { 
    background: #03ac0e;
    color: #fff;
    border-color: #03ac0e;
    cursor: default;
    pointer-events: none;
}

.pagination-ellipsis {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    color: #999;
    font-weight: 500;
}

/* --- Items Per Page Selector (From new style) --- */
.per-page-selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
.per-page-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #444;
}

.per-page-select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.5rem;
    background: #fff;
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
    cursor: pointer;
    transition: border-color 0.2s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
}

.per-page-select:hover {
    border-color: #03ac0e;
}

.per-page-select:focus {
    outline: none;
    border-color: #03ac0e;
}

/* --- Responsive Adjustments (From new style) --- */
@media(max-width: 767px) {
    .pagination-controls {
        flex-wrap: wrap;
        justify-content: center;
    }
    
    .pagination-numbers {
        order: -1;
        width: 100%;
        justify-content: center;
        margin-bottom: 0.5rem;
    }
}

/* --- Loading State (From new style) --- */
@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Spinner element for loading button */
.btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
</style>
</head>
<body>

<div class="store-detail-page">

    <form class="filters" id="filters-form" method="GET">
        <label class="filter-search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
                type="text"
                name="q"
                id="filter-q"
                value="<?= htmlspecialchars($filters['q'] ?? '') ?>"
                placeholder="Search products..."
            >
        </label>

        <label>
            Kategori
            <select name="category" id="filter-category">
                <option value="">All</option>
                <option value="phone" <?= ($filters['category'] ?? '') === 'phone' ? 'selected' : '' ?>>Phone</option>
                <option value="laptop" <?= ($filters['category'] ?? '') === 'laptop' ? 'selected' : '' ?>>Laptop</option>
            </select>
        </label>

        <label>
            Min Price
            <input
                type="number"
                min="0"
                name="min_price"
                id="filter-min"
                value="<?= htmlspecialchars($filters['min_price'] ?? '') ?>"
                placeholder="0"
            >
        </label>

        <label>
            Max Price
            <input
                type="number"
                min="0"
                name="max_price"
                id="filter-max"
                value="<?= htmlspecialchars($filters['max_price'] ?? '') ?>"
                placeholder="5000000"
            >
        </label>
    </form>

    <section
        class="grid"
        id="product-grid"
        data-page="<?= $pagination['page'] ?>"
        data-total-pages="<?= $pagination['totalPages'] ?>"
        data-per-page="<?= $pagination['perPage'] ?>"
    >

        <?php if (empty($products)): ?>
            <section class="empty-state">
                <img src="/uploads/seller/dashboard-logo.svg" alt="Empty State" class="empty-state-icon">
                <h2 class="empty-state-title">Produk tidak ditemukan</h2>
                <p class="empty-state-subtitle">Coba ubah kata kunci pencarian atau filter Anda. 😔</p>
            </section>
        <?php else: ?>
            <?php foreach ($products as $p): ?>
                <?php
                $id         = (int) $p['product_id'];
                $name       = $p['name'] ?? 'Untitled';
                $price      = $p['price'] ?? 0;
                $stock      = (int) $p['stock'];
                $img        = $p['image_path'] ?? '';
                $storeName  = $p['store_name'] ?? 'Unknown Store';
                $storeId    = $p['store_id'] ?? null;

                $isOut = ($stock <= 0);
                $isDisabled = !$sessionUser;
                $cardClass = 'card'
                    . ($isOut ? ' out-of-stock' : '')
                    . ($isDisabled ? ' disabled' : ''); // 'disabled' class dims the card for logged-out users

                $detailUrl = "/product/$id";
                $storeUrl  = $storeId ? "/store/$storeId" : "#";
                $pointer   = ($isOut || $isDisabled) ? 'none' : 'auto';
                ?>
                <article class="<?= $cardClass ?>">
                    <a href="<?= htmlspecialchars($detailUrl) ?>" style="text-decoration:none;color:inherit;pointer-events:<?= $pointer ?>;">
                        <img src="<?= $img ?: '/placeholder.png' ?>" alt="<?= htmlspecialchars($name) ?>">
                        <div class="name"><?= htmlspecialchars($name) ?></div>
                    </a>

                    <div class="store">
                        <a href="<?= htmlspecialchars($storeUrl) ?>" style="pointer-events:<?= $pointer ?>;">
                            <?= htmlspecialchars($storeName) ?>
                        </a>
                    </div>

                    <div class="price">Rp <?= number_format($price, 0, ',', '.') ?></div>

                    <div class="stock-line">
                        <?php if ($isOut): ?>
                            <span class="badge-out">Habis</span>
                        <?php else: ?>
                            Stok: <?= $stock ?>
                        <?php endif; ?>
                    </div>
                    
                    <div class="actions">
                        <?php if ($isOut): ?>
                            <span class="btn-disabled">Habis</span>
                        <?php elseif (!$sessionUser): ?>
                            <span class="btn-disabled">Login to buy</span>
                        <?php else: ?>
                            <button class="btn-addcart" data-product-id="<?= $id ?>">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="9" cy="21" r="1"></circle>
                                    <circle cx="20" cy="21" r="1"></circle>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                </svg>
                                Add to cart
                            </button>
                        <?php endif; ?>
                    </div>
                </article>
            <?php endforeach; ?>
        <?php endif; ?>

    </section>

    <nav class="pagination-container" id="pagination-container">
        
        <div class="results-header">
            <h2 class="product-grid-title" id="results-meta">
                Showing page <?= $pagination['page'] ?> of <?= $pagination['totalPages'] ?> —
                <?= $pagination['totalItems'] ?> total products
            </h2>
        </div>

        <div class="pagination-controls">
            <?php
            // --- Re-implemented PHP pagination logic to build NEW HTML structure ---
            $baseQuery = [
                'q'         => $filters['q'] ?? '',
                'category'  => $filters['category'] ?? '',
                'min_price' => $filters['min_price'] ?? '',
                'max_price' => $filters['max_price'] ?? '',
                'per_page'  => $pagination['perPage'],
            ];

            // Function to build URL (kept from original)
            function buildUrl($pageNum, $baseQuery) {
                $merged = array_merge($baseQuery, ['page' => $pageNum]);
                $q = http_build_query(array_filter($merged, fn($v) => $v !== '' && $v !== null));
                return '/products?' . $q;
            }

            $current = (int)$pagination['page'];
            $total   = (int)$pagination['totalPages'];
            $window  = 2;

            // --- Button/Link builder for NEW structure ---
            $makeBtn = function($page, $content, $disabled = false) use ($baseQuery) {
                $href = buildUrl($page, $baseQuery);
                $disabledAttr = $disabled ? 'aria-disabled="true"' : '';
                return '<a href="'.htmlspecialchars($href).'" class="pagination-btn" '.$disabledAttr.'>'.$content.'</a>';
            };

            $makeNum = function($page, $isActive = false) use ($baseQuery) {
                $href = buildUrl($page, $baseQuery);
                $activeAttr = $isActive ? 'aria-disabled="true"' : '';
                $activeClass = $isActive ? 'active' : '';
                return '<a href="'.htmlspecialchars($href).'" class="pagination-number '.$activeClass.'" '.$activeAttr.'>'.$page.'</a>';
            };
            
            $prevIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            $nextIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';

            // Prev Button
            echo $makeBtn(
                $pagination['prevPage'] ?? 1, 
                $prevIcon, 
                !$pagination['hasPrev']
            );
            ?>

            <div class="pagination-numbers">
                <?php
                if ($start = max(1, $current - $window) > 1) {
                    echo $makeNum(1);
                    if ($start > 2) {
                        echo '<span class="pagination-ellipsis">...</span>';
                    }
                }

                for ($p = max(1, $current - $window); $p <= min($total, $current + $window); $p++) {
                    echo $makeNum($p, $current === $p);
                }

                if ($end = min($total, $current + $window) < $total) {
                    if ($end < $total - 1) {
                        echo '<span class="pagination-ellipsis">...</span>';
                    }
                    echo $makeNum($total);
                }
                ?>
            </div>

            <?php
            // Next Button
            echo $makeBtn(
                $pagination['nextPage'] ?? $total, 
                $nextIcon, 
                !$pagination['hasNext']
            );
            
            // --- Per Page Selector ---
            $perPageCurrent = (int)$pagination['perPage'];
            $perOptions = [4, 8, 12, 16, 20, 24, 28, 32, 48];
            if (!in_array($perPageCurrent, $perOptions, true)) { 
                $perOptions[] = $perPageCurrent; 
                sort($perOptions); 
            }
            ?>
        </div>
        
        <div class="per-page-selector">
            <span class="per-page-label">Items</span>
            <select id="per-page-select" class="per-page-select">
                <?php foreach ($perOptions as $opt): ?>
                    <option value="<?= $opt ?>" <?= $opt === $perPageCurrent ? 'selected' : '' ?>><?= $opt ?></option>
                <?php endforeach; ?>
            </select>
        </div>
    </nav>

</div> <script>window.isLoggedIn = <?= $sessionUser ? 'true' : 'false' ?>;</script>

<script type="module">
import { api } from '/utils/api.js';

// ------- helper: debounce (Kept from original) -------
function debounce(fn, delay = 500) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    }
}

// ------- build query string (Kept from original) -------
function getCurrentQueryParams(pageOverride = null) {
    const q        = document.getElementById('filter-q').value.trim();
    const category = document.getElementById('filter-category').value;
    const minP     = document.getElementById('filter-min').value;
    const maxP     = document.getElementById('filter-max').value;

    const grid     = document.getElementById('product-grid');
    // Updated to find the new select ID
    const perPage  = document.getElementById('per-page-select')?.value || grid.dataset.perPage; 

    const params = new URLSearchParams();
    if (q)        params.set('q', q);
    if (category) params.set('category', category);
    if (minP)     params.set('min_price', minP);
    if (maxP)     params.set('max_price', maxP);
    if (perPage)  params.set('per_page', perPage);

    if (pageOverride !== null) {
        params.set('page', pageOverride);
    } else {
        params.set('page', grid.dataset.page || '1');
    }

    params.set('ajax', '1');
    return params.toString();
}

// ------- render products from JSON (UPDATED) -------
function renderProducts(json) {
    const grid = document.getElementById('product-grid');
    const meta = document.getElementById('results-meta');
    // UPDATED: Changed pagination ID
    const pag  = document.getElementById('pagination-container'); 

    grid.dataset.page       = json.pagination.page;
    grid.dataset.perPage    = json.pagination.perPage;
    grid.dataset.totalPages = json.pagination.totalPages;

    const loggedOut = !window.isLoggedIn;

    if (!json.products.length) {
        // UPDATED: New empty state HTML
        grid.innerHTML = `
            <section class="empty-state">
                <img src="/uploads/seller/dashboard-logo.svg" alt="Empty State" class="empty-state-icon">
                <h2 class="empty-state-title">Produk tidak ditemukan</h2>
                <p class="empty-state-subtitle">Coba ubah kata kunci pencarian atau filter Anda. 😔</p>
            </section>
        `;
    } else {
        // UPDATED: New card HTML
        grid.innerHTML = json.products.map(p => {
            const id        = p.product_id;
            const name      = p.name ?? 'Untitled';
            const price     = p.price ?? 0;
            const stock     = Number(p.stock ?? 0);
            const img       = p.image_path ?? '';
            const storeName = p.store_name ?? 'Unknown Store';
            const storeId   = p.store_id ?? null;

            const isOut = stock <= 0;
            const disabled = loggedOut; // For .card.disabled state
            const cardClass = `card${isOut ? ' out-of-stock' : ''}${disabled ? ' disabled' : ''}`;
            const detailUrl = `/product/${id}`;
            const storeUrl  = storeId ? `/store/${storeId}` : '#';
            const pointer   = (isOut || disabled) ? 'none' : 'auto';

            let actionHtml;
            if (isOut) {
                actionHtml = `<span class="btn-disabled">Habis</span>`;
            } else if (disabled) {
                actionHtml = `<span class="btn-disabled">Login to buy</span>`;
            } else {
                actionHtml = `<button class="btn-addcart" data-product-id="${id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    Add to cart
                </button>`;
            }

            return `
                <article class="${cardClass}">
                    <a href="${detailUrl}" style="text-decoration:none;color:inherit;pointer-events:${pointer};">
                        <img src="${img ? img : '/placeholder.png'}" alt="${name}">
                        <div class="name">${name}</div>
                    </a>
                    <div class="store">
                        <a href="${storeUrl}" style="pointer-events:${pointer};">${storeName}</a>
                    </div>
                    <div class="price">Rp ${Number(price).toLocaleString('id-ID')}</div>
                    <div class="stock-line">
                        ${isOut
                            ? '<span class="badge-out">Out of stock</span>'
                            : `Stok: ${stock}`
                        }
                    </div>
                    <div class="actions">${actionHtml}</div>
                </article>
            `;
        }).join('');
    }

    // Update results meta text
    meta.textContent =
        `Showing page ${json.pagination.page} of ${json.pagination.totalPages} — `
        + `${json.pagination.totalItems} total products`;

    // UPDATED: Rebuild pagination with new HTML structure
    function buildNumberedPagination(p) {
        const curParams = new URLSearchParams(window.location.search);
        
        const link = (page, content, active = false, disabled = false, isBtn = false) => {
            const nonAjax = new URLSearchParams(curParams);
            nonAjax.set('page', page);
            nonAjax.delete('ajax');
            const url = `/products?` + nonAjax.toString();

            if (disabled) {
                return `<a class="${isBtn ? 'pagination-btn' : 'pagination-number'}" aria-disabled="true">${content}</a>`;
            }
            if (active) {
                return `<a class="${isBtn ? 'pagination-btn' : 'pagination-number'} active" aria-disabled="true">${content}</a>`;
            }
            return `<a href="${url}" class="${isBtn ? 'pagination-btn' : 'pagination-number'}">${content}</a>`;
        };

        const { page: current, totalPages: total, hasPrev, prevPage, hasNext, nextPage, perPage } = p;
        
        const prevIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
        const nextIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        
        const controls = [];
        controls.push(link(prevPage ?? 1, prevIcon, false, !hasPrev, true));
        
        const numbers = [];
        const windowSize = 2;
        const start = Math.max(1, current - windowSize);
        const end   = Math.min(total, current + windowSize);

        if (start > 1) {
            numbers.push(link(1, '1'));
            if (start > 2) {
                numbers.push('<span class="pagination-ellipsis">...</span>');
            }
        }

        for (let i = start; i <= end; i++) {
            numbers.push(link(i, String(i), current === i));
        }

        if (end < total) {
            if (end < total - 1) {
                numbers.push('<span class="pagination-ellipsis">...</span>');
            }
            numbers.push(link(total, String(total)));
        }
        
        controls.push(`<div class="pagination-numbers">${numbers.join('')}</div>`);
        controls.push(link(nextPage ?? total, nextIcon, false, !hasNext, true));

        // Per Page Selector
        const perOptions = [4, 8, 12, 16, 20, 24, 28, 32, 48];
        const currentPer = Number(perPage);
        if (!perOptions.includes(currentPer)) {
             perOptions.push(currentPer);
             perOptions.sort((a,b) => a - b);
        }
        
        const perHtml = `
            <div class="per-page-selector">
                <span class="per-page-label">Items</span>
                <select id="per-page-select" class="per-page-select">
                    ${perOptions.map(n => `<option value="${n}" ${currentPer === n ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
            </div>
        `;

        // Combine all parts
        return `
            <div class="results-header">
                <h2 class="product-grid-title" id="results-meta">${meta.textContent}</h2>
            </div>
            <div class="pagination-controls">${controls.join('')}</div>
            ${perHtml}
        `;
    }

    pag.innerHTML = buildNumberedPagination(json.pagination);

    // Re-attach listener to the newly rendered per-page select
    pag.querySelector('#per-page-select')?.addEventListener('change', () => {
        const params = getCurrentQueryParams(1); // Go to page 1 on per-page change
        refetchAndRender(params);
    });
}

// ------- NEW: Add to Cart function from StoreDetail.php -------
// Adapted to use window.isLoggedIn from original file
async function addToCart(productId, qty = 1, btn) {
    if (!window.isLoggedIn) {
        window.location.href = '/login';
        return;
    }
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    // NEW: Loading spinner
    btn.innerHTML = '<span class="btn-spinner"></span> Loading...';
    
    try {
        const res = await api.post('/cart/add', {
            product_id: Number(productId),
            qty: qty
        });
        
        if (!res || res.ok === false) {
            throw new Error(res?.error?.message || 'Gagal menambahkan ke keranjang');
        }
        
        // NEW: Success state
        btn.innerHTML = '✓ Added';
        // TODO: Update cart count in navbar here
        
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }, 1500);

    } catch (e) {
        console.error(e);
        alert(e.message || 'Network error. Please try again.');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ------- fetch new data with skeleton (Kept from original) -------
async function refetchAndRender(paramsString) {
    const grid = document.getElementById('product-grid');
    grid.classList.add('loading');

    try {
        const res = await fetch('/products?' + paramsString, {
            headers: { 'X-Requested-With': 'fetch' }
        });
        const json = await res.json();
        renderProducts(json); // This will render the new card/pagination UI

        // Update URL bar (Kept from original)
        const withoutAjax = paramsString.replace(/(&)?ajax=1(&)?/, '$1').replace(/ajax=1&?/, '');
        const newUrl = '/products?' + withoutAjax;
        history.replaceState(null, '', newUrl);

    } catch (err) {
        console.error(err);
        // TODO: Show a user-friendly error message on the UI
    } finally {
        grid.classList.remove('loading');
    }
}

// ------- wire filter inputs (Kept from original) -------
const debouncedFilter = debounce(() => {
    const params = getCurrentQueryParams(1); // always go back to page 1 on filter
    refetchAndRender(params);
}, 500);

document.getElementById('filter-q').addEventListener('input', debouncedFilter);
document.getElementById('filter-category').addEventListener('change', debouncedFilter);
document.getElementById('filter-min').addEventListener('input', debouncedFilter);
document.getElementById('filter-max').addEventListener('input', debouncedFilter);

document.getElementById('product-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-addcart');
    if (!btn) return;
    e.preventDefault();
    
    const pid = btn.getAttribute('data-product-id');
    if (!pid) return;

    addToCart(pid, 1, btn);
});

document.getElementById('pagination-container').addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (a.getAttribute('aria-disabled') === 'true') return;
    
    e.preventDefault(); // Prevent full page reload

    const url = new URL(a.href, window.location.origin);
    const newPage = url.searchParams.get('page') || '1';

    const params = getCurrentQueryParams(newPage);
    refetchAndRender(params);
});

document.getElementById('per-page-select')?.addEventListener('change', () => {
    const params = getCurrentQueryParams(1); 
    refetchAndRender(params);
});
</script>

</body>
</html>
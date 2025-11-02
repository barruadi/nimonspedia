<?php
$title = htmlspecialchars($store['store_name'] ?? 'Detail Toko');

// Ekstrak kategori unik dari produk untuk dropdown filter
$categories = [];
foreach ($products as $product) {
    if (!empty($product['category_id']) && !isset($categories[$product['category_id']])) {
        $categories[$product['category_id']] = $product['category_name'];
    }
}
asort($categories);

$current_page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$items_per_page = isset($_GET['per_page']) ? max(1, (int)$_GET['per_page']) : 12;
$search_query = $_GET['q'] ?? '';
$category_filter = $_GET['category'] ?? '';
$min_price = isset($_GET['min_price']) && $_GET['min_price'] !== '' ? (int)$_GET['min_price'] : null;
$max_price = isset($_GET['max_price']) && $_GET['max_price'] !== '' ? (int)$_GET['max_price'] : null;

// Filter products based on criteria
$filtered_products = array_filter($products, function($p) use ($search_query, $category_filter, $min_price, $max_price) {
    // Search filter
    if ($search_query && stripos($p['name'], $search_query) === false) return false;
    // Category filter
    if ($category_filter && $p['category_id'] != $category_filter) return false;
    // Price filters
    if ($min_price !== null && $p['price'] < $min_price) return false;
    if ($max_price !== null && $p['price'] > $max_price) return false;
    return true;
});

// Calculate pagination
$total_products = count($filtered_products);
$total_pages = max(1, ceil($total_products / $items_per_page));
$current_page = min($current_page, $total_pages); // Ensure current page is valid
$offset = ($current_page - 1) * $items_per_page;

// Get products for current page
$paginated_products = array_slice($filtered_products, $offset, $items_per_page);

// Build query string for pagination links
function buildQueryString($params) {
    $filtered = array_filter($params, function($val) {
        return $val !== '' && $val !== null;
    });
    return http_build_query($filtered);
}

$base_params = [
    'q' => $search_query,
    'category' => $category_filter,
    'min_price' => $min_price,
    'max_price' => $max_price,
    'per_page' => $items_per_page
];
?>

<link rel="stylesheet" href="/styles/StoreDetail.css">

<div class="store-detail-page">

    <div id="mainContent">
        
        <!-- Store Banner -->
        <section id="storeBanner" class="store-banner">
            <div class="banner-logo-container">
                <img id="storeLogo" 
                     src="<?= htmlspecialchars($store['logo_path'] ?? '/images/placeholder.png') ?>" 
                     alt="Store Logo" 
                     class="banner-logo">
            </div>
            <div class="banner-info">
                <h1 id="storeName" class="banner-name">
                    <?= htmlspecialchars($store['store_name'] ?? 'Nama Toko') ?>
                </h1>
                <p id="storeDescription" class="banner-description">
                    <?= htmlspecialchars($store['description'] ?? 'Deskripsi toko...') ?>
                </p>
            </div>
        </section>

        <!-- Filter Section -->
        <form class="filters" id="filters-form" method="GET">
            <label class="filter-search">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input type="text" name="q" id="filter-q" 
                       placeholder="Cari di <?= htmlspecialchars($store['store_name'] ?? '') ?>"
                       value="<?= htmlspecialchars($search_query) ?>">
            </label>
            
            <label>
                Kategori
                <select name="category" id="filter-category">
                    <option value="">Semua Produk</option>
                    <?php foreach ($categories as $id => $name): ?>
                        <option value="<?= $id ?>" <?= $category_filter == $id ? 'selected' : '' ?>>
                            <?= htmlspecialchars($name) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </label>
            
            <label>
                Harga Minimal
                <input type="number" min="0" name="min_price" id="filter-min" 
                       placeholder="Harga Minimal"
                       value="<?= $min_price !== null ? $min_price : '' ?>">
            </label>
            
            <label>
                Harga Maksimal
                <input type="number" min="0" name="max_price" id="filter-max" 
                       placeholder="Harga Maksimal"
                       value="<?= $max_price !== null ? $max_price : '' ?>">
            </label>

            <input type="hidden" name="per_page" value="<?= $items_per_page ?>">
        </form>

        <!-- Product Grid -->
        <?php if (empty($paginated_products)): ?>
            <section class="empty-state" style="display: flex;">
                <img src="/uploads/seller/dashboard-logo.svg" alt="Empty State" class="empty-state-icon">
                <h2 class="empty-state-title">
                    <?= $total_products === 0 && count($products) > 0 ? 'Produk tidak ditemukan' : 'Belum ada produk' ?>
                </h2>
                <p class="empty-state-subtitle">
                    <?= $total_products === 0 && count($products) > 0 
                        ? 'Coba ubah kata kunci pencarian atau filter Anda.' 
                        : 'Toko ini belum memiliki produk untuk dijual.' ?>
                </p>
            </section>
        <?php else: ?>
            <section id="productGrid" class="grid">
                <?php foreach ($paginated_products as $p): 
                    $id = $p['product_id'];
                    $name = $p['name'] ?? 'Untitled';
                    $price = $p['price'] ?? 0;
                    $stock = (int)($p['stock'] ?? 0);
                    $img = $p['image_path'] ?? '';
                    $isOut = $stock <= 0;
                    $cardClass = $isOut ? 'card out-of-stock' : 'card';
                    $detailUrl = "/product/{$id}";
                    $priceFormatted = 'Rp ' . number_format($price, 0, ',', '.');
                ?>
                    <article class="<?= $cardClass ?>">
                        <a href="<?= $detailUrl ?>" style="text-decoration:none;color:inherit;<?= $isOut ? 'pointer-events:none;' : '' ?>">
                            <img src="<?= $img ?: '/images/placeholder.png' ?>" alt="<?= htmlspecialchars($name) ?>">
                            <div class="name"><?= htmlspecialchars($name) ?></div>
                        </a>
                        <div class="price"><?= $priceFormatted ?></div>
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
                            <?php elseif (!isset($_SESSION['user'])): ?>
                                <a href="/login" class="btn-disabled" style="text-decoration:none;">Login to buy</a>
                            <?php else: ?>
                                <button class="btn-addcart" data-product-id="<?= $id ?>">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="9" cy="21" r="1"></circle>
                                        <circle cx="20" cy="21" r="1"></circle>
                                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                    </svg>
                                    Tambah ke Keranjang
                                </button>
                            <?php endif; ?>
                        </div>
                    </article>
                <?php endforeach; ?>
            </section>

            <!-- Pagination Section -->

            <div class="pagination-container">
                <?php if ($total_products > 0): ?>
                    <div class="results-header">
                        <h2 class="product-grid-title">
                            Menampilkan <?= $offset + 1 ?> sampai <?= min($offset + $items_per_page, $total_products) ?> 
                            dari <?= $total_products ?> Produk
                        </h2>
                    </div>
                <?php endif; ?>

                <div class="pagination-controls">
                    <!-- Previous Button -->
                    <?php if ($current_page > 1): ?>
                        <a href="?<?= buildQueryString(array_merge($base_params, ['page' => 1])) ?>" 
                           class="pagination-btn" title="First Page">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="11 17 6 12 11 7"></polyline>
                                <polyline points="18 17 13 12 18 7"></polyline>
                            </svg>
                        </a>
                        <a href="?<?= buildQueryString(array_merge($base_params, ['page' => $current_page - 1])) ?>" 
                           class="pagination-btn" title="Previous">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </a>
                    <?php else: ?>
                        <span class="pagination-btn disabled">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="11 17 6 12 11 7"></polyline>
                                <polyline points="18 17 13 12 18 7"></polyline>
                            </svg>
                        </span>
                        <span class="pagination-btn disabled">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </span>
                    <?php endif; ?>


                    <!-- Page Numbers -->
                    <div class="pagination-numbers">
                        <?php
                        $range = 2; // Show 2 pages before and after current
                        $start = max(1, $current_page - $range);
                        $end = min($total_pages, $current_page + $range);

                        if ($start > 1): ?>
                            <a href="?<?= buildQueryString(array_merge($base_params, ['page' => 1])) ?>" 
                               class="pagination-number">1</a>
                            <?php if ($start > 2): ?>
                                <span class="pagination-ellipsis">...</span>
                            <?php endif;
                        endif;

                        for ($i = $start; $i <= $end; $i++): ?>
                            <?php if ($i == $current_page): ?>
                                <span class="pagination-number active"><?= $i ?></span>
                            <?php else: ?>
                                <a href="?<?= buildQueryString(array_merge($base_params, ['page' => $i])) ?>" 
                                   class="pagination-number"><?= $i ?></a>
                            <?php endif;
                        endfor;

                        if ($end < $total_pages): ?>
                            <?php if ($end < $total_pages - 1): ?>
                                <span class="pagination-ellipsis">...</span>
                            <?php endif; ?>
                            <a href="?<?= buildQueryString(array_merge($base_params, ['page' => $total_pages])) ?>" 
                               class="pagination-number"><?= $total_pages ?></a>
                        <?php endif; ?>
                    </div>

                    <!-- Next Button -->
                    <?php if ($current_page < $total_pages): ?>
                        <a href="?<?= buildQueryString(array_merge($base_params, ['page' => $current_page + 1])) ?>" 
                           class="pagination-btn" title="Next">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </a>
                        <a href="?<?= buildQueryString(array_merge($base_params, ['page' => $total_pages])) ?>" 
                           class="pagination-btn" title="Last Page">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="13 17 18 12 13 7"></polyline>
                                <polyline points="6 17 11 12 6 7"></polyline>
                            </svg>
                        </a>
                    <?php else: ?>
                        <span class="pagination-btn disabled">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </span>
                        <span class="pagination-btn disabled">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="13 17 18 12 13 7"></polyline>
                                <polyline points="6 17 11 12 6 7"></polyline>
                            </svg>
                        </span>
                    <?php endif; ?>
                </div>

                <!-- Items Per Page Selector -->
                <div class="per-page-selector">
                    <form method="GET" id="per-page-form">
                        <?php foreach ($base_params as $key => $value): ?>
                            <?php if ($key !== 'per_page' && $value !== '' && $value !== null): ?>
                                <input type="hidden" name="<?= htmlspecialchars($key) ?>" value="<?= htmlspecialchars($value) ?>">
                            <?php endif; ?>
                        <?php endforeach; ?>
                        <input type="hidden" name="page" value="1">
                        
                        <select name="per_page" onchange="this.form.submit()" class="per-page-select">
                            <option value="4" <?= $items_per_page == 4 ? 'selected' : '' ?>>4</option>
                            <option value="8" <?= $items_per_page == 8 ? 'selected' : '' ?>>8</option>
                            <option value="12" <?= $items_per_page == 12 ? 'selected' : '' ?>>12</option>
                            <option value="16" <?= $items_per_page == 16 ? 'selected' : '' ?>>16</option>
                            <option value="20" <?= $items_per_page == 20 ? 'selected' : '' ?>>20</option>
                            <option value="24" <?= $items_per_page == 24 ? 'selected' : '' ?>>24</option>
                            <option value="28" <?= $items_per_page == 28 ? 'selected' : '' ?>>28</option>
                            <option value="32" <?= $items_per_page == 32 ? 'selected' : '' ?>>32</option>
                            <option value="48" <?= $items_per_page == 48 ? 'selected' : '' ?>>48</option>
                        </select>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>
</div>

<script type="module">
    import { api } from '/utils/api.js';

    (function() {
        const lastFocusId = sessionStorage.getItem('lastActiveFilterId');
        if (lastFocusId) {
            const el = document.getElementById(lastFocusId);
            if (el) {
                el.focus(); // Kembalikan fokus
                
                if (typeof el.setSelectionRange === 'function') {
                    const len = el.value.length;
                    el.setSelectionRange(len, len);
                }
                
                sessionStorage.removeItem('lastActiveFilterId');
            }
        }
    })();

    const navbarRoot = document.getElementById('navbar-root');

    // Add to Cart Function
    async function addToCart(productId, qty = 1, btn) {
        const session = navbarRoot.querySelector('app-navbar')?._session;
        if (!session?.authenticated) {
            window.location.href = '/login';
            return;
        }
        
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span style="display:flex;align-items:center;gap:0.5rem;justify-content:center;">Loading...</span>';
        
        try {
            const res = await api.post('/cart/add', {
                product_id: Number(productId),
                qty: qty
            });
            
            if (!res || res.ok === false) {
                throw new Error(res?.error?.message || 'Gagal menambahkan ke keranjang');
            }
            
            btn.innerHTML = '<span style="display:flex;align-items:center;gap:0.5rem;justify-content:center;">✓ Ditambahkan</span>';
            
            if (window.notifyAuthChanged) {
                window.notifyAuthChanged(session);
            }
            
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }, 1500);
        } catch (e) {
            console.error(e);
            alert(e.message);
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }

    document.getElementById('productGrid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-addcart');
        if (!btn) return;
        e.preventDefault();
        const pid = btn.getAttribute('data-product-id');
        if (!pid) return;
        addToCart(pid, 1, btn);
    });

    const filterForm = document.getElementById('filters-form');
    const filterInputs = filterForm.querySelectorAll('input, select');
    
    let debounceTimer;
    filterInputs.forEach(input => {
        if (input.name === 'per_page') return; 
        
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                
                sessionStorage.setItem('lastActiveFilterId', input.id);

                let pageHiddenInput = filterForm.querySelector('input[name="page"]');
                if (!pageHiddenInput) {
                     pageHiddenInput = document.createElement('input');
                     pageHiddenInput.type = 'hidden';
                     pageHiddenInput.name = 'page';
                     filterForm.appendChild(pageHiddenInput);
                }
                pageHiddenInput.value = '1';

                filterForm.submit();
            }, 500); // 500ms debounce
        });
    });
</script>
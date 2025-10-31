<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title><?= htmlspecialchars($title) ?></title>
<meta name="viewport" content="width=device-width,initial-scale=1">

<style>
  body {
    font-family: system-ui, sans-serif;
    margin: 0;
    background: #fafafa;
    color: #222;
  }

  nav.topnav {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid #ddd;
    background: #fff;
  }

  main.page {
    max-width: 1200px;
    margin: 1.5rem auto;
    padding: 0 1rem 4rem;
  }

  h1.page-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem;
  }

  /* Filter bar */
  .filters {
    display: grid;
    grid-template-columns: 1fr;
    gap: .75rem;
    margin-bottom: 1rem;
  }
  @media(min-width:600px){
    .filters {
      grid-template-columns: 1fr 150px 150px 150px;
      align-items: end;
    }
  }

  .filters label {
    display: flex;
    flex-direction: column;
    font-size: .8rem;
    color: #444;
  }
  .filters input, .filters select {
    padding: .5rem .6rem;
    border-radius: .4rem;
    border: 1px solid #bbb;
    font-size: .9rem;
    background: #fff;
  }

  .results-meta {
    font-size: .8rem;
    color: #666;
    margin-bottom: 1rem;
  }

  /* grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill,minmax(180px,1fr));
    gap: 1rem;
    min-height: 200px;
    position: relative;
  }

  /* Loading skeleton overlay */
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

  .card {
    background: #fff;
    border: 1px solid #ddd;
    border-radius: .5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    min-height: 260px;
    position: relative;
    text-decoration: none;
    color: inherit;
    transition: box-shadow .12s ease;
  }
  .card:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,.06);
  }

  .card.out-of-stock {
    background: #f5f5f5;
    border-color: #ccc;
    color: #999;
  }

  .card img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    border-radius: .5rem;
    background: #eee;
    margin-bottom: .75rem;
  }

  .name {
    font-size: .9rem;
    font-weight: 600;
    line-height: 1.4;
    flex-grow: 1;
    margin-bottom: .5rem;
    color: #111;
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

  .price {
    font-size: .9rem;
    font-weight: 500;
    color: #111;
    margin-bottom: .25rem;
  }

  .stock-line {
    font-size: .75rem;
    margin-bottom: .5rem;
    color: #666;
  }

  .badge-out {
    display: inline-block;
    font-size: .7rem;
    background: #bbb;
    color: #fff;
    padding: .25rem .5rem;
    border-radius: .4rem;
    font-weight: 500;
  }

  .actions {
    margin-top: auto;
  }

  .btn-disabled,
  .btn-addcart {
    display: inline-block;
    padding: .5rem .75rem;
    font-size: .8rem;
    line-height: 1.2;
    border-radius: .4rem;
    border: 1px solid #aaa;
    text-decoration: none;
  }

  .btn-addcart {
    background: #111;
    color: #fff;
    border-color: #111;
    cursor: pointer;
  }

  .btn-disabled {
    background: #e5e5e5;
    color: #999;
    border-color: #ccc;
    cursor: not-allowed;
    pointer-events: none;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #666;
    grid-column: 1 / -1;
    font-size: .9rem;
  }

  .pagination {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: .5rem 1rem;
    margin-top: 2rem;
    font-size: .9rem;
  }

  .pagination a {
    background: #fff;
    border: 1px solid #ccc;
    border-radius: .4rem;
    padding: .4rem .7rem;
    text-decoration: none;
    color: #333;
    font-weight: 500;
  }

  .pagination a[aria-disabled="true"] {
    color: #999;
    background: #eee;
    border-color: #ddd;
    pointer-events: none;
    cursor: not-allowed;
  }

  .pagination .page-label {
    padding: .4rem .7rem;
    color: #444;
  }
</style>
</head>
<body>

<nav class="topnav">
  <a href="/products">Browse</a>
  <a href="/cart">Cart</a>
  <?php if (!$sessionUser): ?>
    <a href="/login">Login</a>
  <?php else: ?>
    <a href="/home">Dashboard</a>
  <?php endif; ?>
</nav>

<main class="page">

  <h1 class="page-title">Browse Products</h1>

  <!-- Filters / search UI -->
  <section class="filters" id="filters-form">
    <label>
      Search
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
        <!-- TODO: render real categories from DB -->
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
  </section>

  <div class="results-meta" id="results-meta">
    Showing page <?= $pagination['page'] ?> of <?= $pagination['totalPages'] ?> —
    <?= $pagination['totalItems'] ?> total products
  </div>

  <!-- Product Grid -->
  <section
    class="grid"
    id="product-grid"
    data-page="<?= $pagination['page'] ?>"
    data-total-pages="<?= $pagination['totalPages'] ?>"
    data-per-page="<?= $pagination['perPage'] ?>"
  >

    <?php if (empty($products)): ?>
      <div class="empty-state">
        Tidak ada produk 😔
      </div>
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
          $cardClass = 'card' . ($isOut ? ' out-of-stock' : '');
          $detailUrl = "/product/$id";
          $storeUrl  = $storeId ? "/store/$storeId" : "#";
        ?>
        <article class="<?= $cardClass ?>">
          <a href="<?= htmlspecialchars($detailUrl) ?>" style="text-decoration:none;color:inherit;pointer-events:<?= $isOut ? 'none' : 'auto' ?>;">
            <?php if ($img): ?>
              <img src="<?= htmlspecialchars($img) ?>" alt="">
            <?php else: ?>
              <img src="/placeholder.png" alt="">
            <?php endif; ?>

            <div class="name"><?= htmlspecialchars($name) ?></div>
          </a>

          <div class="store">
            <a href="<?= htmlspecialchars($storeUrl) ?>">
              <?= htmlspecialchars($storeName) ?>
            </a>
          </div>

          <div class="price">Rp <?= number_format($price, 0, ',', '.') ?></div>

          <div class="stock-line">
            <?php if ($isOut): ?>
              <span class="badge-out">Out of stock</span>
            <?php else: ?>
              Stok: <?= $stock ?>
            <?php endif; ?>
          </div>

          <div class="actions">
            <?php if ($isOut): ?>
              <span class="btn-disabled">Habis</span>
            <?php elseif (!$sessionUser): ?>
              <a class="btn-disabled">Login to buy</a>
            <?php else: ?>
              <button class="btn-addcart" data-product-id="<?= $id ?>">Add to cart</button>
            <?php endif; ?>
          </div>
        </article>
      <?php endforeach; ?>
    <?php endif; ?>

  </section>

  <!-- Pagination -->
  <nav class="pagination" id="pagination-bar">
    <?php
      // keep filters in pagination links
      $baseQuery = [
        'q'         => $filters['q']         ?? '',
        'category'  => $filters['category']  ?? '',
        'min_price' => $filters['min_price'] ?? '',
        'max_price' => $filters['max_price'] ?? '',
        'per_page'  => $pagination['perPage'],
      ];
      function buildUrl($pageNum, $baseQuery) {
        $merged = array_merge($baseQuery, ['page' => $pageNum]);
        $q = http_build_query(array_filter($merged, fn($v) => $v !== '' && $v !== null));
        return '/products?' . $q;
      }
    ?>

    <?php if ($pagination['hasPrev']): ?>
      <a href="<?= buildUrl($pagination['prevPage'], $baseQuery) ?>">Prev</a>
    <?php else: ?>
      <a aria-disabled="true">Prev</a>
    <?php endif; ?>

    <span class="page-label">
      Page <?= $pagination['page'] ?> of <?= $pagination['totalPages'] ?>
    </span>

    <?php if ($pagination['hasNext']): ?>
      <a href="<?= buildUrl($pagination['nextPage'], $baseQuery) ?>">Next</a>
    <?php else: ?>
      <a aria-disabled="true">Next</a>
    <?php endif; ?>
  </nav>

</main>

<script>window.isLoggedIn = <?= $sessionUser ? 'true' : 'false' ?>;</script>

<script type="module">

import { api } from '/utils/api.js'; 
// ------- helper: debounce -------
function debounce(fn, delay = 500) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  }
}

// ------- build query string from current filters -------
function getCurrentQueryParams(pageOverride = null) {
  const q        = document.getElementById('filter-q').value.trim();
  const category = document.getElementById('filter-category').value;
  const minP     = document.getElementById('filter-min').value;
  const maxP     = document.getElementById('filter-max').value;

  const grid     = document.getElementById('product-grid');
  const perPage  = grid.dataset.perPage;

  const params = new URLSearchParams();
  if (q)        params.set('q', q);
  if (category) params.set('category', category);
  if (minP)     params.set('min_price', minP);
  if (maxP)     params.set('max_price', maxP);
  if (perPage)  params.set('per_page', perPage);

  // if pagination changes (Prev/Next), we pass pageOverride
  if (pageOverride !== null) {
    params.set('page', pageOverride);
  } else {
    // otherwise keep current page (default 1)
    params.set('page', grid.dataset.page || '1');
  }

  // mark ajax mode so controller returns JSON
  params.set('ajax', '1');

  return params.toString();
}

// ------- render products from JSON -------
function renderProducts(json) {
  const grid = document.getElementById('product-grid');
  const meta = document.getElementById('results-meta');
  const pag  = document.getElementById('pagination-bar');

  // update pagination data attributes
  grid.dataset.page = json.pagination.page;
  grid.dataset.perPage = json.pagination.perPage;
  grid.dataset.totalPages = json.pagination.totalPages;

  // build product cards
  if (!json.products.length) {
    grid.innerHTML = `
      <div class="empty-state">
        Tidak ada produk 
      </div>
    `;
  } else {
    grid.innerHTML = json.products.map(p => {
      const id        = p.product_id;
      const name      = p.name ?? 'Untitled';
      const price     = p.price ?? 0;
      const stock     = Number(p.stock ?? 0);
      const img       = p.image_path ?? '';
      const storeName = p.store_name ?? 'Unknown Store';
      const storeId   = p.store_id ?? null;

      const isOut = stock <= 0;
      const cardClass = `card${isOut ? ' out-of-stock' : ''}`;
      const detailUrl = `/product/${id}`;
      const storeUrl  = storeId ? `/store/${storeId}` : '#';

      // sessionUser is not available in JSON, so we can't know if user is logged in here
      // We could embed a data-flag in window at initial render if needed.
      // For now: just hide add-to-cart in JS render:
      let actionHtml;
      if (isOut) {
        actionHtml = `<span class="btn-disabled">Habis</span>`;
      } else {
        actionHtml = `<span class="btn-disabled">Add to cart (login req)</span>`;
      }

      return `
        <article class="${cardClass}">
          <a href="${detailUrl}" style="text-decoration:none;color:inherit;pointer-events:${isOut?'none':'auto'};">
            <img src="${img ? img : '/placeholder.png'}" alt="">
            <div class="name">${name}</div>
          </a>

          <div class="store">
            <a href="${storeUrl}">${storeName}</a>
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

  // update meta text
  meta.textContent =
    `Showing page ${json.pagination.page} of ${json.pagination.totalPages} — `
    + `${json.pagination.totalItems} total products`;

  // rebuild pagination bar HTML using current filters
  const curParams = new URLSearchParams(window.location.search);

  function makePageLink(pageNum, disabledText) {
    if (!pageNum) {
      return `<a aria-disabled="true">${disabledText}</a>`;
    }
    // rebuild URL for normal navigation (without ajax=1)
    const nonAjaxParams = new URLSearchParams(curParams);
    nonAjaxParams.set('page', pageNum);
    nonAjaxParams.delete('ajax');
    const url = `/products?` + nonAjaxParams.toString();
    return `<a href="${url}">${disabledText}</a>`;
  }

  pag.innerHTML = `
    ${json.pagination.hasPrev
      ? makePageLink(json.pagination.prevPage, 'Prev')
      : `<a aria-disabled="true">Prev</a>`
    }
    <span class="page-label">
      Page ${json.pagination.page} of ${json.pagination.totalPages}
    </span>
    ${json.pagination.hasNext
      ? makePageLink(json.pagination.nextPage, 'Next')
      : `<a aria-disabled="true">Next</a>`
    }
  `;
}

async function addToCart(productId, qty = 1) {
  try {
    const res = await api.post('/cart/add', {
      product_id: Number(productId),
      qty: 1
    });

    // if (!res || res.ok === false) {
    //   // not logged in
    //   // window.location.href = '/login';
    //   return;
    // }

    console.log(res);
    if (!res || res.ok === false) {
      console.log(res);
      alert("djsiaodjsia");
      return;
    }

    // success
    alert('Added to cart');

    // optional: update a cart badge if you have one
    // const count = json.items?.length ?? 0;
    // document.getElementById('cart-count')?.replaceChildren(document.createTextNode(count));

  } catch (e) {
    console.error(e);
    alert('Network error. Please try again.');
  }
}

// ------- fetch new data with skeleton -------
async function refetchAndRender(paramsString) {
  const grid = document.getElementById('product-grid');
  grid.classList.add('loading');

  try {
    const res = await fetch('/products?' + paramsString, {
      headers: { 'X-Requested-With': 'fetch' }
    });
    const json = await res.json();
    renderProducts(json);

    // Update URL (pushState) so filters are sharable
    const withoutAjax = paramsString.replace(/(&)?ajax=1(&)?/, '$1').replace(/ajax=1&?/, '');
    const newUrl = '/products?' + withoutAjax;
    history.replaceState(null, '', newUrl);
  } catch (err) {
    console.error(err);
  } finally {
    grid.classList.remove('loading');
  }
}

// ------- wire filter inputs (debounced search) -------
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

  if (!window.isLoggedIn) {
    window.location.href = '/login';
    return;
  }

  // Optimistic UI (optional): disable briefly to prevent spam clicks
  btn.disabled = true;
  console.log(pid);
  addToCart(pid, 1).finally(() => { btn.disabled = false; });
});

// OPTIONAL: intercept pagination clicks for SPA-like page changes
document.getElementById('pagination-bar').addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;

  // If it's disabled, let it fall through
  if (a.getAttribute('aria-disabled') === 'true') return;

  // Use AJAX instead of hard navigation
  e.preventDefault();

  const url = new URL(a.href, window.location.origin);
  const newPage = url.searchParams.get('page') || '1';

  const params = getCurrentQueryParams(newPage);
  refetchAndRender(params);
});
</script>

</body>
</html>

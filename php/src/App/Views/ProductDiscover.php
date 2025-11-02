<?php
/** @var array $filters */
/** @var array $pagination */
/** @var array $products */
/** @var array|null $sessionUser */
/** @var string $title */

// Fallbacks in case controller didn't provide them (safe to remove if you always set them)
$title       = $title       ?? 'Products';
$filters     = $filters     ?? [];
$pagination  = $pagination  ?? ['page'=>1,'perPage'=>12,'totalPages'=>1,'totalItems'=>0,'hasPrev'=>false,'hasNext'=>false,'prevPage'=>null,'nextPage'=>null];
$products    = $products    ?? [];
$sessionUser = $sessionUser ?? null;
?>
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
      grid-template-columns: 1fr 300px 150px 150px;
      align-items: end;
    }
  }

  .filters label {
    display: flex;
    flex-direction: column;
    font-size: .8rem;
    color: #444;
  }
  .filters input, .filters select, .multi__button {
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
    transition: box-shadow .12s ease, filter .12s ease, opacity .12s ease;
  }
  .card:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,.06);
  }

  .card.out-of-stock {
    background: #f5f5f5;
    border-color: #ccc;
    color: #999;
  }

  /* NEW: disabled state when user not logged in */
  .card.disabled {
    background: #f5f5f5;
    border-color: #ddd;
    color: #999;
    opacity: .75;
    filter: grayscale(1);
    pointer-events: none; /* block all interactions inside card */
  }
  .card.disabled .btn-addcart { display: none; }
  .card.disabled .btn-disabled { pointer-events: none; }

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
    align-items: center;
  }
  .pagination__spacer { flex: 1 1 auto; } /* for right-aligning the per-page select on wide screens */

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

  .per-page {
    display: inline-flex;
    gap: .4rem;
    align-items: center;
  }
  .per-page select {
    padding: .35rem .6rem;
    border-radius: .4rem;
    border: 1px solid #bbb;
    background: #fff;
    font-size: .85rem;
  }

  /* === MULTI SELECT DROPDOWN === */
  .multi { position: relative; }
  .multi__button {
    width: 100%; text-align: left;
    display: flex; align-items: center; justify-content: space-between; gap: .5rem; cursor: pointer;
  }
  .multi__label { font-size: .9rem; color:#222; }
  .multi__count { font-size:.75rem; background:#111; color:#fff; border-radius:.4rem; padding:.15rem .4rem; }
  .multi__chev { flex: 0 0 auto; }
  .multi[data-open="true"] .multi__button { border-color:#888; box-shadow:0 2px 8px rgba(0,0,0,.06); }
  .multi__panel {
    position: absolute; z-index: 50; inset-inline: 0; top: calc(100% + .35rem);
    background:#fff; border:1px solid #ccc; border-radius:.5rem; box-shadow:0 10px 30px rgba(0,0,0,.08);
    padding:.5rem; display:none;
  }
  .multi[data-open="true"] .multi__panel { display:block; }
  .multi__options { max-height: 220px; overflow:auto; display:grid; gap:.25rem; padding:.25rem; }
  .multi__option {
    display:flex; align-items:center; gap:.5rem; padding:.35rem; border-radius:.35rem; cursor:pointer;
  }
  .multi__option:hover { background:#f7f7f7; }
  .multi__option input { accent-color:#111; }
  .multi__empty { color:#666; font-size:.85rem; padding:.5rem; }
  .multi__actions {
    display:flex; justify-content: space-between; gap:.5rem; padding:.35rem .25rem .15rem;
  }
  .multi__actions button {
    border:1px solid #bbb; background:#fff; border-radius:.4rem; padding:.4rem .6rem; font-size:.85rem; cursor:pointer;
  }
  .multi__actions .multi__apply { background:#111; color:#fff; border-color:#111; }
</style>
</head>
<body>

<main class="page">

  <h1 class="page-title">Cari produk</h1>

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
      <!-- Hidden CSV stores selected category IDs -->
      <input
        type="hidden"
        name="categories"
        id="filter-category"
        value="<?= htmlspecialchars($filters['categories'] ?? ($filters['category'] ?? '')) ?>">

      <!-- Dropdown with checkboxes -->
      <div class="multi" id="category-menu"
           data-selected-csv="<?= htmlspecialchars($filters['categories'] ?? ($filters['category'] ?? '')) ?>">
        <button type="button" class="multi__button" aria-haspopup="listbox" aria-expanded="false">
          <span class="multi__label">Pilih kategori</span>
          <span class="multi__count" hidden>0</span>
          <svg class="multi__chev" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7l5 6 5-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
        </button>
        <div class="multi__panel" role="listbox" aria-multiselectable="true">
          <div class="multi__options" id="category-options">
            <div class="multi__empty">Loading…</div>
          </div>
          <div class="multi__actions">
            <button type="button" class="multi__clear">Clear</button>
            <button type="button" class="multi__apply">Apply</button>
          </div>
        </div>
      </div>
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
    Showing page <?= (int)$pagination['page'] ?> of <?= (int)$pagination['totalPages'] ?> —
    <?= (int)$pagination['totalItems'] ?> total products
  </div>

  <!-- Product Grid -->
  <section
    class="grid"
    id="product-grid"
    data-page="<?= (int)$pagination['page'] ?>"
    data-total-pages="<?= (int)$pagination['totalPages'] ?>"
    data-per-page="<?= (int)$pagination['perPage'] ?>"
  >

    <?php if (empty($products)): ?>
      <div class="empty-state">
        Tidak ada produk 😔
      </div>
    <?php else: ?>
      <?php foreach ($products as $p): ?>
        <?php
          $id         = (int)($p['product_id'] ?? 0);
          $name       = $p['name'] ?? 'Untitled';
          $price      = (float)($p['price'] ?? 0);
          $stock      = (int)($p['stock'] ?? 0);
          $img        = $p['image_path'] ?? '';
          $storeName  = $p['store_name'] ?? 'Unknown Store';
          $storeId    = $p['store_id'] ?? null;

          $isOut = ($stock <= 0);
          $isDisabled = !$sessionUser;
          $cardClass = 'card'
            . ($isOut ? ' out-of-stock' : '')
            . ($isDisabled ? ' disabled' : '');

          $detailUrl = "/product/$id";
          $storeUrl  = $storeId ? "/store/$storeId" : "#";
          $pointer   = ($isOut || $isDisabled) ? 'none' : 'auto';
        ?>
        <article class="<?= $cardClass ?>">
          <a href="<?= htmlspecialchars($detailUrl) ?>" style="text-decoration:none;color:inherit;pointer-events:<?= $pointer ?>;">
            <?php if ($img): ?>
              <img src="<?= htmlspecialchars($img) ?>" alt="">
            <?php else: ?>
              <img src="/placeholder.png" alt="">
            <?php endif; ?>

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
              <span class="badge-out">Out of stock</span>
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
      // NOTE: we persist 'categories' CSV in the URL, not 'category'
      $baseQuery = [
        'q'           => $filters['q']           ?? '',
        'categories'  => $filters['categories']  ?? ($filters['category'] ?? ''),
        'min_price'   => $filters['min_price']   ?? '',
        'max_price'   => $filters['max_price']   ?? '',
        'per_page'    => $pagination['perPage'],
      ];
      function buildUrl($pageNum, $baseQuery) {
        $merged = array_merge($baseQuery, ['page' => $pageNum]);
        $q = http_build_query(array_filter($merged, fn($v) => $v !== '' && $v !== null));
        return '/products?' . $q;
      }

      $current = (int)$pagination['page'];
      $total   = (int)$pagination['totalPages'];
      $window  = 2;

      $makeLink = function($page, $label = null, $isActive = false, $disabled = false) use ($baseQuery) {
        if ($disabled) return '<a aria-disabled="true">'.htmlspecialchars($label ?? $page).'</a>';
        $label = $label ?? (string)$page;
        $href  = buildUrl($page, $baseQuery);
        return $isActive
          ? '<a aria-disabled="true" style="font-weight:700;background:#111;color:#fff;border-color:#111;">'.htmlspecialchars($label).'</a>'
          : '<a href="'.htmlspecialchars($href).'">'.htmlspecialchars($label).'</a>';
      };

      echo !empty($pagination['hasPrev']) ? $makeLink($pagination['prevPage'], 'Prev') : $makeLink(1, 'Prev', false, true);
      echo $makeLink(1, '1', $current === 1);

      if ($current - $window > 2) {
        echo '<span class="page-label">…</span>';
      }

      $start = max(2, $current - $window);
      $end   = min($total - 1, $current + $window);
      for ($p = $start; $p <= $end; $p++) {
        echo $makeLink($p, (string)$p, $current === $p);
      }

      if ($current + $window < $total - 1) {
        echo '<span class="page-label">…</span>';
      }

      if ($total > 1) {
        echo $makeLink($total, (string)$total, $current === $total);
      }

      echo !empty($pagination['hasNext']) ? $makeLink($pagination['nextPage'], 'Next') : $makeLink($total, 'Next', false, true);

      $perPageCurrent = (int)$pagination['perPage'];
      $perOptions = [4, 8, 12, 16, 20, 24, 28, 32, 48];
      if (!in_array($perPageCurrent, $perOptions, true)) { $perOptions[] = $perPageCurrent; sort($perOptions); }
    ?>

    <span class="pagination__spacer"></span>
    <span class="per-page">
      <label for="per-page-select" style="font-size:.85rem;color:#444;">Items</label>
      <select id="per-page-select">
        <?php foreach ($perOptions as $opt): ?>
          <option value="<?= (int)$opt ?>" <?= ((int)$opt === $perPageCurrent) ? 'selected' : '' ?>><?= (int)$opt ?></option>
        <?php endforeach; ?>
      </select>
    </span>
  </nav>


</main>

<script>window.isLoggedIn = <?= $sessionUser ? 'true' : 'false' ?>;</script>

<script type="module">
import { api } from '/utils/api.js';

/* --------------------- helpers ---------------------- */
function parseCsv(str) {
  return (str ?? '').split(',').map(s => s.trim()).filter(Boolean);
}
function toCsv(arr) {
  return (arr ?? []).map(String).filter(Boolean).join(',');
}

function getSelectedCategoryIdsFromMenu() {
  return Array.from(document.querySelectorAll('#category-menu input[type="checkbox"]:checked'))
    .map(cb => cb.value);
}
function setSelectedCategoryIdsInMenu(ids) {
  const want = new Set((ids ?? []).map(String));
  document.querySelectorAll('#category-menu input[type="checkbox"]').forEach(cb => {
    cb.checked = want.has(String(cb.value));
  });
  updateCategoryBadge();
}
function updateCategoryHiddenInput() {
  const hidden = document.getElementById('filter-category');
  hidden.value = toCsv(getSelectedCategoryIdsFromMenu());
}
function updateCategoryBadge() {
  const lbl = document.querySelector('#category-menu .multi__label');
  const countEl = document.querySelector('#category-menu .multi__count');
  const chosen = Array.from(document.querySelectorAll('#category-menu input[type="checkbox"]:checked'));
  if (!chosen.length) {
    lbl.textContent = 'Pilih kategori';
    countEl.hidden = true;
  } else if (chosen.length <= 2) {
    lbl.textContent = chosen.map(c => c.dataset.name || c.value).join(', ');
    countEl.hidden = true;
  } else {
    lbl.textContent = 'Kategori';
    countEl.textContent = chosen.length;
    countEl.hidden = false;
  }
}

// ------- helper: debounce -------
function debounce(fn, delay = 500) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  }
}

/* ------------------ categories loader ------------------ */
async function loadCategories() {
  const menu = document.getElementById('category-menu');
  const optionsBox = document.getElementById('category-options');
  if (!menu || !optionsBox) return;

  const url = new URLSearchParams(window.location.search);
  const urlCsv   = url.get('categories');
  const urlSingle= url.get('category'); // legacy
  const selectedCsv = urlCsv ?? urlSingle ?? menu.dataset.selectedCsv ?? '';
  const desired = parseCsv(selectedCsv);

  try {
    // Expect typical shapes: array | {data: array} | {categories: array} | map
    const payload = await api.get('/categories');
    let categories = [];
    if (Array.isArray(payload)) categories = payload;
    else if (Array.isArray(payload?.data)) categories = payload.data;
    else if (Array.isArray(payload?.categories)) categories = payload.categories;
    else if (payload && typeof payload === 'object') {
      const entries = Object.entries(payload).filter(([k]) => !['ok','error','message'].includes(k));
      const looksLikeMap = entries.every(([,v]) => typeof v === 'string');
      if (looksLikeMap) categories = entries.map(([category_id, name]) => ({ category_id, name }));
    }

    if (!Array.isArray(categories)) throw new Error('Categories must be an array');

    if (!categories.length) {
      optionsBox.innerHTML = `<div class="multi__empty">No categories</div>`;
    } else {
      optionsBox.innerHTML = categories.map(c => {
        const id = String(c.category_id);
        const name = c.name ?? `Category ${id}`;
        return `
          <label class="multi__option">
            <input type="checkbox" value="${id}" data-name="${name}">
            <span>${name}</span>
          </label>
        `;
      }).join('');
    }

    // include stale ids from URL if API no longer has them
    const have = new Set(categories.map(c => String(c.category_id)));
    desired.filter(v => !have.has(String(v))).forEach(v => {
      const el = document.createElement('label');
      el.className = 'multi__option';
      el.innerHTML = `<input type="checkbox" value="${String(v)}" data-name="(Unknown) ${String(v)}">
                      <span>(Unknown) ${String(v)}</span>`;
      optionsBox.appendChild(el);
    });

    setSelectedCategoryIdsInMenu(desired);
    updateCategoryHiddenInput();

  } catch (err) {
    console.error('Failed to load /categories', err);
    // Fallback static options
    optionsBox.innerHTML = `
      <label class="multi__option">
        <input type="checkbox" value="phone" data-name="Phone"><span>Phone</span>
      </label>
      <label class="multi__option">
        <input type="checkbox" value="laptop" data-name="Laptop"><span>Laptop</span>
      </label>
    `;
    setSelectedCategoryIdsInMenu(desired);
    updateCategoryHiddenInput();
  }
}
loadCategories();

/* -------------- dropdown open/close + actions -------------- */
(function initCategoryMenu(){
  const menu = document.getElementById('category-menu');
  if (!menu) return;
  const btn = menu.querySelector('.multi__button');
  const panel = menu.querySelector('.multi__panel');
  const clearBtn = menu.querySelector('.multi__clear');
  const applyBtn = menu.querySelector('.multi__apply');

  function open()  { menu.dataset.open = "true";  btn.setAttribute('aria-expanded','true'); }
  function close() { menu.dataset.open = "false"; btn.setAttribute('aria-expanded','false'); }

  btn.addEventListener('click', () => {
    const isOpen = menu.dataset.open === "true";
    isOpen ? close() : open();
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) close();
  });

  // live update label/count on check
  menu.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      updateCategoryBadge();
    }
  });

  clearBtn.addEventListener('click', () => {
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateCategoryBadge();
  });

  // apply writes hidden CSV and triggers filtering
  const debouncedFilter = debounce(() => {
    const params = getCurrentQueryParams(1);
    refetchAndRender(params);
  }, 500);

  applyBtn.addEventListener('click', () => {
    updateCategoryHiddenInput();
    close();
    debouncedFilter();
  });

  // keyboard support
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); btn.focus(); }
  });
})();

/* --------------------- list interactions --------------------- */
function getCurrentQueryParams(pageOverride = null) {
  const q        = document.getElementById('filter-q').value.trim();
  const categoriesCsv = document.getElementById('filter-category').value; // CSV from hidden
  const minP     = document.getElementById('filter-min').value;
  const maxP     = document.getElementById('filter-max').value;

  const grid     = document.getElementById('product-grid');
  const perPage  = document.getElementById('per-page-select')?.value || grid.dataset.perPage;

  const params = new URLSearchParams();
  if (q)        params.set('q', q);
  if (categoriesCsv) params.set('categories', categoriesCsv);
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

function renderProducts(json) {
  const grid = document.getElementById('product-grid');
  const meta = document.getElementById('results-meta');
  const pag  = document.getElementById('pagination-bar');

  grid.dataset.page       = json.pagination.page;
  grid.dataset.perPage    = json.pagination.perPage;
  grid.dataset.totalPages = json.pagination.totalPages;

  const loggedOut = !window.isLoggedIn;

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
      const disabled = loggedOut;
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
        actionHtml = `<button class="btn-addcart" data-product-id="${id}">Add to cart</button>`;
      }

      return `
        <article class="${cardClass}">
          <a href="${detailUrl}" style="text-decoration:none;color:inherit;pointer-events:${pointer};">
            <img src="${img ? img : '/placeholder.png'}" alt="">
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

  meta.textContent =
    `Showing page ${json.pagination.page} of ${json.pagination.totalPages} — `
    + `${json.pagination.totalItems} total products`;

  const curParams = new URLSearchParams(window.location.search);

  function link(page, label = null, active = false, disabled = false) {
    if (disabled) return `<a aria-disabled="true">${label ?? page}</a>`;
    if (active)   return `<a aria-disabled="true" style="font-weight:700;background:#111;color:#fff;border-color:#111;">${label ?? page}</a>`;
    const nonAjax = new URLSearchParams(curParams);
    nonAjax.set('page', page);
    nonAjax.delete('ajax');
    const url = `/products?` + nonAjax.toString();
    return `<a href="${url}">${label ?? page}</a>`;
  }

  function buildNumberedPagination(p) {
    const { page: current, totalPages: total, hasPrev, prevPage, hasNext, nextPage, perPage } = p;
    const windowSize = 2;
    const first = 1, last = Math.max(1, total);

    const parts = [];
    parts.push(hasPrev ? link(prevPage, 'Prev') : link(first, 'Prev', false, true));
    parts.push(link(first, '1', current === first));

    if (current - windowSize > 2) parts.push('<span class="page-label">…</span>');

    const start = Math.max(2, current - windowSize);
    const end   = Math.min(last - 1, current + windowSize);
    for (let i = start; i <= end; i++) {
      parts.push(link(i, String(i), current === i));
    }

    if (current + windowSize < last - 1) parts.push('<span class="page-label">…</span>');

    if (last > 1) parts.push(link(last, String(last), current === last));

    parts.push(hasNext ? link(nextPage, 'Next') : link(last, 'Next', false, true));

    const perOptions = [4, 8,12,16,20,24,28,32,48];
    const perHtml = `
      <span class="pagination__spacer"></span>
      <span class="per-page">
        <label for="per-page-select" style="font-size:.85rem;color:#444;">Items</label>
        <select id="per-page-select">
          ${perOptions.map(n => `<option value="${n}" ${Number(perPage)===n?'selected':''}>${n}</option>`).join('')}
        </select>
      </span>
    `;
    return parts.join('') + perHtml;
  }

  pag.innerHTML = buildNumberedPagination(json.pagination);

  document.getElementById('per-page-select')?.addEventListener('change', () => {
    const params = getCurrentQueryParams(1);
    refetchAndRender(params);
  });

  // sync category badge with current hidden CSV (e.g., when URL changes)
  const currentCsv = document.getElementById('filter-category')?.value || '';
  setSelectedCategoryIdsInMenu(parseCsv(currentCsv));
}

async function addToCart(productId, qty = 1) {
  try {
    const res = await api.post('/cart/add', {
      product_id: Number(productId),
      qty: 1
    });

    if (!res || res.ok === false) {
      alert(res?.message || 'Failed to add to cart.');
      return;
    }

    alert('Added to cart');
  } catch (e) {
    console.error(e);
    alert('Network error. Please try again.');
  }
}

async function refetchAndRender(paramsString) {
  const grid = document.getElementById('product-grid');
  grid.classList.add('loading');

  try {
    const res = await fetch('/products?' + paramsString, {
      headers: { 'X-Requested-With': 'fetch' }
    });
    const json = await res.json();
    renderProducts(json);

    const withoutAjax = paramsString.replace(/(&)?ajax=1(&)?/, '$1').replace(/ajax=1&?/, '');
    const newUrl = '/products?' + withoutAjax;
    history.replaceState(null, '', newUrl);
  } catch (err) {
    console.error(err);
  } finally {
    grid.classList.remove('loading');
  }
}

/* ------- wire filter inputs (debounced search) ------- */
const debouncedFilter = debounce(() => {
  const params = getCurrentQueryParams(1); // always go back to page 1 on filter
  refetchAndRender(params);
}, 500);

document.getElementById('filter-q').addEventListener('input', debouncedFilter);

// Category menu uses Apply button; if you want instant apply, do it here instead:
// document.getElementById('category-menu')?.addEventListener('change', () => {
//   updateCategoryHiddenInput();
//   debouncedFilter();
// });

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

  btn.disabled = true;
  addToCart(pid, 1).finally(() => { btn.disabled = false; });
});

// Intercept pagination clicks for SPA-like page changes
document.getElementById('pagination-bar').addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  if (a.getAttribute('aria-disabled') === 'true') return;
  e.preventDefault();

  const url = new URL(a.href, window.location.origin);
  const newPage = url.searchParams.get('page') || '1';

  const params = getCurrentQueryParams(newPage);
  refetchAndRender(params);
});

// Keep per-page select in sync (SSR initial render)
document.getElementById('per-page-select')?.addEventListener('change', () => {
  const params = getCurrentQueryParams(1);
  refetchAndRender(params);
});
</script>

</body>
</html>

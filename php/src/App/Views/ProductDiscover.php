<?php

// Fallbacks
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
<title><?= htmlspecialchars($title ?? 'Browse Products') ?></title>
<meta name="viewport" content="width=device-width,initial-scale=1">

<style>
/* --- Reset --- */
* {
  box-sizing: border-box;
}

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

/* --- Filters --- */
.filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
@media(min-width: 768px) {
  .filters {
    grid-template-columns: 1fr 300px 150px 150px;
    align-items: end;
  }
}

.filters label {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  font-weight: 500;
  color: #444;
}

.filters input, .filters select, .multi__button {
  padding: .5rem .6rem;
  border-radius: .4rem;
  border: 1px solid #bbb;
  font-size: .9rem;
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
  border-color: #03ac0e;
}

/* Search with icon */
.filter-search { position: relative; }
.filter-search input {
  padding-left: 2.5rem;
  width: 100%;
  box-sizing: border-box;
}
.filter-search svg {
  position: absolute;
  left: 0.75rem;
  bottom: calc(0.75rem - 1px);
  color: #888;
  pointer-events: none;
}

/* --- Results header --- */
.results-header { margin-bottom: 1.5rem; }
.product-grid-title {
  font-size: 0.9rem;
  font-weight: 400;
  margin: 0;
  color: #666;
}

/* --- Product Grid --- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  min-height: 200px;
  margin-bottom: 2rem;
  position: relative;
}
/* Loading skeleton */
.grid.loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -45deg,
    #eee, #eee 10px,
    #f5f5f5 10px, #f5f5f5 20px
  );
  opacity: 0.6;
  pointer-events: none;
  border-radius: .5rem;
}

/* --- Product Card --- */
.card {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 320px;
  transition: all 0.2s ease;
  position: relative;
  text-decoration: none;
  color: inherit;
}
.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}
.card.out-of-stock {
  background: #f9f9f9;
  opacity: 0.7;
  border-color: #e5e5e5;
  color: #999;
}
.card.out-of-stock:hover { transform: none; box-shadow: none; }

.card img {
  width: 100%;
  height: 180px;
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
.store a { color: inherit; text-decoration: underline; }

.card .price {
  font-size: 1rem;
  font-weight: 600;
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
  background: #e5e5e5;
  color: #999;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

/* --- Action Buttons --- */
.actions { margin-top: auto; }
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-addcart { background: #03ac0e; color: #fff; }
.btn-addcart:hover:not(:disabled) {
  background: #028a0b;
  box-shadow: 0 2px 8px rgba(3, 172, 14, 0.3);
}
.btn-addcart:disabled { opacity: 0.7; cursor: not-allowed; position: relative; }
.btn-addcart svg { flex-shrink: 0; }
.btn-disabled {
  background: #f5f5f5;
  color: #999;
  border: 1px solid #e5e5e5;
  cursor: not-allowed;
  pointer-events: none;
}

/* --- Empty State --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 1rem;
  color: #666;
  min-height: 400px;
  grid-column: 1 / -1;
}
.empty-state-icon {
  width: 160px; height: 160px; margin-bottom: 1.5rem; opacity: 0.5;
}
.empty-state-title {
  font-size: 1.25rem; font-weight: 600; color: #333; margin: 0 0 0.5rem;
}
.empty-state-subtitle { font-size: 0.95rem; color: #666; margin: 0; }

/* --- Pagination (dev style) --- */
.pagination-container {
  display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
  margin-top: 2rem; padding: 1.5rem 0; border-top: 1px solid #e5e5e5;
}
@media(min-width: 768px) {
  .pagination-container { flex-direction: row; justify-content: space-between; }
  .results-header { margin-bottom: 0; }
}
.pagination-controls { display: flex; align-items: center; gap: 0.5rem; }
.pagination-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: 1px solid #e5e5e5; border-radius: 0.5rem;
  background: #fff; color: #333; cursor: pointer; transition: all 0.2s ease; text-decoration: none;
}
.pagination-btn:hover { background: #f5f5f5; border-color: #03ac0e; }
.pagination-btn[aria-disabled="true"], .pagination-btn.disabled {
  opacity: 0.4; cursor: not-allowed; pointer-events: none; color: #999; background: #f5f5f5;
}
.pagination-numbers { display: flex; align-items: center; gap: 0.5rem; }
.pagination-number {
  display: flex; align-items: center; justify-content: center;
  min-width: 36px; height: 36px; padding: 0 0.5rem; border: 1px solid #e5e5e5; border-radius: 0.5rem;
  background: #fff; color: #333; font-size: 0.9rem; font-weight: 500;
  cursor: pointer; transition: all 0.2s ease; text-decoration: none;
}
.pagination-number:hover { background: #f5f5f5; border-color: #03ac0e; }
.pagination-number[aria-disabled="true"], .pagination-number.active {
  background: #03ac0e; color: #fff; border-color: #03ac0e; cursor: default; pointer-events: none;
}
.pagination-ellipsis {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; color: #999; font-weight: 500;
}

/* Items per page selector */
.per-page-selector { display: flex; align-items: center; gap: 0.75rem; }
.per-page-label { font-size: 0.9rem; font-weight: 500; color: #444; }
.per-page-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem; border: 1px solid #e5e5e5; border-radius: 0.5rem; background: #fff;
  font-size: 0.9rem; font-weight: 500; color: #333; cursor: pointer; transition: border-color 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.75rem center;
}
.per-page-select:hover { border-color: #03ac0e; }
.per-page-select:focus { outline: none; border-color: #03ac0e; }

/* Responsive pagination adjustments */
@media(max-width: 767px) {
  .pagination-controls { flex-wrap: wrap; justify-content: center; }
  .pagination-numbers { order: -1; width: 100%; justify-content: center; margin-bottom: 0.5rem; }
}

/* Loading spinner for Add to cart */
@keyframes spin { to { transform: rotate(360deg); } }
.btn-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}

/* === MULTI SELECT DROPDOWN (from fix/bug-check) === */
.multi { position: relative; }
.multi__button {
  width: 100%; text-align: left; display: flex; align-items: center; justify-content: space-between;
  gap: .5rem; cursor: pointer; padding:.75rem; border-radius:.5rem; border:1px solid #ddd; background:#fff;
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
.multi__option { display:flex; align-items:center; gap:.5rem; padding:.35rem; border-radius:.35rem; cursor:pointer; }
.multi__option:hover { background:#f7f7f7; }
.multi__option input { accent-color:#111; }
.multi__empty { color:#666; font-size:.85rem; padding:.5rem; }
.multi__actions { display:flex; justify-content: space-between; gap:.5rem; padding:.35rem .25rem .15rem; }
.multi__actions button {
  border:1px solid #bbb; background:#fff; border-radius:.4rem; padding:.4rem .6rem; font-size:.85rem; cursor:pointer;
}
.multi__actions .multi__apply { background:#111; color:#fff; border-color:#111; }
</style>
</head>
<body>

<div class="store-detail-page">

  <!-- Filters / search UI -->
  <section class="filters" id="filters-form">
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
          <svg class="multi__chev" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 7l5 6 5-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
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
        type="number" min="0" step="1000" name="min_price" id="filter-min"
        value="<?= htmlspecialchars($filters['min_price'] ?? '') ?>" placeholder="0">
    </label>

    <label>
      Max Price
      <input
        type="number" min="0" step="1000" name="max_price" id="filter-max"
        value="<?= htmlspecialchars($filters['max_price'] ?? '') ?>" placeholder="5000000">
    </label>
  </section>

  <section
    class="grid"
    id="product-grid"
    data-page="<?= (int)$pagination['page'] ?>"
    data-total-pages="<?= (int)$pagination['totalPages'] ?>"
    data-per-page="<?= (int)$pagination['perPage'] ?>"
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
          $id         = (int)($p['product_id'] ?? 0);
          $name       = $p['name'] ?? 'Untitled';
          $price      = (float)($p['price'] ?? 0);
          $stock      = (int)($p['stock'] ?? 0);
          $img        = $p['image_path'] ?? '';
          $storeName  = $p['store_name'] ?? 'Unknown Store';
          $storeId    = $p['store_id'] ?? null;
          $isOut      = ($stock <= 0);
          $isGuest    = !$sessionUser;
          $cardClass  = 'card' . ($isOut ? ' out-of-stock' : '');
          $detailUrl  = "/product/$id";
          $storeUrl   = $storeId ? "/store/$storeId" : "#";
          // Guest users can still click products to view details
          $pointer    = 'auto';
        ?>
        <article class="<?= $cardClass ?>">
          <a href="<?= htmlspecialchars($detailUrl) ?>"
             style="text-decoration:none;color:inherit;pointer-events:<?= $pointer ?>;">
            <img src="<?= htmlspecialchars($img ?: '/placeholder.png') ?>" alt="<?= htmlspecialchars($name) ?>">
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
              Stok: <?= (int)$stock ?>
            <?php endif; ?>
          </div>

          <div class="actions">
            <?php if ($isOut): ?>
              <span class="btn-disabled">Habis</span>
            <?php elseif ($isGuest): ?>
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

  <!-- Pagination (dev layout) -->
  <nav class="pagination-container" id="pagination-container">
    <div class="results-header">
      <h2 class="product-grid-title" id="results-meta">
        Showing page <?= (int)$pagination['page'] ?> of <?= (int)$pagination['totalPages'] ?> —
        <?= (int)$pagination['totalItems'] ?> total products
      </h2>
    </div>

    <?php
      // Build initial SSR pagination controls
      $baseQuery = [
        'q'           => $filters['q'] ?? '',
        // Note: use CSV categories (merged behavior)
        'categories'  => $filters['categories'] ?? ($filters['category'] ?? ''),
        'min_price'   => $filters['min_price'] ?? '',
        'max_price'   => $filters['max_price'] ?? '',
        'per_page'    => $pagination['perPage'],
      ];
      $current = (int)$pagination['page'];
      $total   = (int)$pagination['totalPages'];
      $window  = 2;
      $buildUrl = function($pageNum, $baseQuery) {
        $merged = array_merge($baseQuery, ['page' => $pageNum]);
        $q = http_build_query(array_filter($merged, fn($v) => $v !== '' && $v !== null));
        return '/products?' . $q;
      };
      $makeBtn = function($page, $content, $disabled = false) use ($baseQuery, $buildUrl) {
        $href = htmlspecialchars($buildUrl($page, $baseQuery));
        $dis  = $disabled ? 'aria-disabled="true"' : '';
        return "<a href=\"$href\" class=\"pagination-btn\" $dis>$content</a>";
      };
      $makeNum = function($page, $active = false) use ($baseQuery, $buildUrl) {
        $href  = htmlspecialchars($buildUrl($page, $baseQuery));
        $dis   = $active ? 'aria-disabled="true"' : '';
        $class = $active ? 'pagination-number active' : 'pagination-number';
        return "<a href=\"$href\" class=\"$class\" $dis>$page</a>";
      };
      $prevIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
      $nextIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    ?>

    <div class="pagination-controls">
      <?= $makeBtn($pagination['prevPage'] ?? 1, $prevIcon, !$pagination['hasPrev']) ?>

      <div class="pagination-numbers">
        <?php
          $start = max(1, $current - $window);
          $end   = min($total, $current + $window);
          if ($start > 1) {
            echo $makeNum(1);
            if ($start > 2) echo '<span class="pagination-ellipsis">...</span>';
          }
          for ($p = $start; $p <= $end; $p++) {
            echo $makeNum($p, $p === $current);
          }
          if ($end < $total) {
            if ($end < $total - 1) echo '<span class="pagination-ellipsis">...</span>';
            echo $makeNum($total);
          }
        ?>
      </div>

      <?= $makeBtn($pagination['nextPage'] ?? $total, $nextIcon, !$pagination['hasNext']) ?>
    </div>

    <?php
      $perPageCurrent = (int)$pagination['perPage'];
      $perOptions = [4, 8, 12, 16, 20, 24, 28, 32, 48];
      if (!in_array($perPageCurrent, $perOptions, true)) { $perOptions[] = $perPageCurrent; sort($perOptions); }
    ?>
    <div class="per-page-selector">
      <span class="per-page-label">Items</span>
      <select id="per-page-select" class="per-page-select">
        <?php foreach ($perOptions as $opt): ?>
          <option value="<?= (int)$opt ?>" <?= ((int)$opt === $perPageCurrent) ? 'selected' : '' ?>><?= (int)$opt ?></option>
        <?php endforeach; ?>
      </select>
    </div>
  </nav>

</div>

<script>window.isLoggedIn = <?= $sessionUser ? 'true' : 'false' ?>;</script>
<script type="module">

import { api } from '/utils/api.js';
import { redirectSellerToDashboard } from '/utils/sellerRedirect.js';

redirectSellerToDashboard();

/* --------------------- helpers ---------------------- */
function parseCsv(str) {
  return (str ?? '').split(',').map(s => s.trim()).filter(Boolean);
}
function toCsv(arr) {
  return (arr ?? []).map(String).filter(Boolean).join(',');
}
function debounce(fn, delay = 500) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/* -------- multi-category menu helpers (fix/bug-check) -------- */
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

/* ------------------ categories loader ------------------ */
async function loadCategories() {
  const menu = document.getElementById('category-menu');
  const optionsBox = document.getElementById('category-options');
  if (!menu || !optionsBox) return;

  const url = new URLSearchParams(window.location.search);
  const urlCsv   = url.get('categories');
  const urlSingle= url.get('category'); // legacy single
  const selectedCsv = urlCsv ?? urlSingle ?? menu.dataset.selectedCsv ?? '';
  const desired = parseCsv(selectedCsv);

  try {
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
    // Fallback options
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
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) close(); });
  menu.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) updateCategoryBadge();
  });
  clearBtn.addEventListener('click', () => {
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateCategoryBadge();
    updateCategoryHiddenInput();
    close();
    // Apply filter immediately after clearing
    const params = getCurrentQueryParams(1);
    refetchAndRender(params);
  });

  applyBtn.addEventListener('click', () => {
    updateCategoryHiddenInput();
    close();
    // Apply filter immediately (no debounce needed for explicit button click)
    const params = getCurrentQueryParams(1);
    refetchAndRender(params);
  });

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); btn.focus(); }
  });
})();

/* --------------------- list interactions --------------------- */
function getCurrentQueryParams(pageOverride = null) {
  const q             = document.getElementById('filter-q').value.trim();
  const categoriesCsv = document.getElementById('filter-category').value; // CSV from hidden
  const minP          = document.getElementById('filter-min').value;
  const maxP          = document.getElementById('filter-max').value;

  const grid   = document.getElementById('product-grid');
  const perSel = document.getElementById('per-page-select');
  const perPage = perSel?.value || grid.dataset.perPage;

  const params = new URLSearchParams();
  if (q)             params.set('q', q);
  if (categoriesCsv) params.set('categories', categoriesCsv);
  if (minP)          params.set('min_price', minP);
  if (maxP)          params.set('max_price', maxP);
  if (perPage)       params.set('per_page', perPage);

  if (pageOverride !== null) {
    params.set('page', pageOverride);
  } else {
    params.set('page', grid.dataset.page || '1');
  }

  params.set('ajax', '1');
  return params.toString();
}

/* ------- render products from JSON (merged) ------- */
function renderProducts(json) {
  const grid = document.getElementById('product-grid');
  const meta = document.getElementById('results-meta');
  const pag  = document.getElementById('pagination-container');

  grid.dataset.page       = json.pagination.page;
  grid.dataset.perPage    = json.pagination.perPage;
  grid.dataset.totalPages = json.pagination.totalPages;

  const loggedOut = !window.isLoggedIn;

  if (!json.products.length) {
    grid.innerHTML = `
      <section class="empty-state">
        <img src="/uploads/seller/dashboard-logo.svg" alt="Empty State" class="empty-state-icon">
        <h2 class="empty-state-title">Produk tidak ditemukan</h2>
        <p class="empty-state-subtitle">Coba ubah kata kunci pencarian atau filter Anda. 😔</p>
      </section>
    `;
  } else {
    grid.innerHTML = json.products.map(p => {
      const id        = p.product_id;
      const name      = p.name ?? 'Untitled';
      const price     = Number(p.price ?? 0);
      const stock     = Number(p.stock ?? 0);
      const img       = p.image_path ?? '';
      const storeName = p.store_name ?? 'Unknown Store';
      const storeId   = p.store_id ?? null;

      const isOut     = stock <= 0;
      const isGuest   = loggedOut;
      const cardClass = `card${isOut ? ' out-of-stock' : ''}`;
      const detailUrl = `/product/${id}`;
      const storeUrl  = storeId ? `/store/${storeId}` : '#';
      // Guest users can still click products to view details
      const pointer   = 'auto';

      let actionHtml;
      if (isOut) {
        actionHtml = `<span class="btn-disabled">Habis</span>`;
      } else if (isGuest) {
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
          <div class="price">Rp ${price.toLocaleString('id-ID')}</div>
          <div class="stock-line">
            ${isOut ? '<span class="badge-out">Out of stock</span>' : `Stok: ${stock}`}
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

  // Build pagination (dev layout)
  function buildNumberedPagination(p) {
    const curParams = new URLSearchParams(window.location.search);

    const link = (page, content, active = false, disabled = false, isBtn = false) => {
      const nonAjax = new URLSearchParams(curParams);
      nonAjax.set('page', page);
      nonAjax.delete('ajax');
      const url = `/products?` + nonAjax.toString();

      if (disabled)  return `<a class="${isBtn ? 'pagination-btn' : 'pagination-number'}" aria-disabled="true">${content}</a>`;
      if (active)    return `<a class="${isBtn ? 'pagination-btn' : 'pagination-number'} active" aria-disabled="true">${content}</a>`;
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
      if (start > 2) numbers.push('<span class="pagination-ellipsis">...</span>');
    }
    for (let i = start; i <= end; i++) {
      numbers.push(link(i, String(i), current === i));
    }
    if (end < total) {
      if (end < total - 1) numbers.push('<span class="pagination-ellipsis">...</span>');
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

    return `
      <div class="results-header">
        <h2 class="product-grid-title" id="results-meta">${meta.textContent}</h2>
      </div>
      <div class="pagination-controls">${controls.join('')}</div>
      ${perHtml}
    `;
  }

  pag.innerHTML = buildNumberedPagination(json.pagination);

  // Re-bind per-page change (newly rendered)
  pag.querySelector('#per-page-select')?.addEventListener('change', () => {
    const params = getCurrentQueryParams(1);
    refetchAndRender(params);
  });
}

/* ------- Add to Cart (dev spinner + merged) ------- */
async function addToCart(productId, qty = 1, btn) {
  if (!window.isLoggedIn) {
    window.location.href = '/login';
    return;
  }
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> Loading...';

  try {
    const res = await api.post('/cart/add', { product_id: Number(productId), qty });
    if (!res || res.ok === false) throw new Error(res?.error || 'Gagal menambahkan ke keranjang');

    btn.innerHTML = '✓ Added';

    // Refresh navbar to update cart badge count
    if (window.notifyAuthChanged) {
      window.notifyAuthChanged();
    }

    setTimeout(() => { btn.disabled = false; btn.innerHTML = originalHTML; }, 1200);
  } catch (e) {
    console.error(e);
    alert(e.message || 'Network error. Please try again.');
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

/* ------- fetch & render with skeleton ------- */
async function refetchAndRender(paramsString) {
  const grid = document.getElementById('product-grid');
  grid.classList.add('loading');
  try {
    const res = await fetch('/products?' + paramsString, { headers: { 'X-Requested-With': 'fetch' } });
    const json = await res.json();
    renderProducts(json);

    // Update URL (strip ajax=1)
    const withoutAjax = paramsString.replace(/(&)?ajax=1(&)?/, '$1').replace(/(^|&)ajax=1$/, '');
    const newUrl = '/products?' + withoutAjax.replace(/^&/, '');
    history.replaceState(null, '', newUrl);
  } catch (err) {
    console.error(err);
  } finally {
    grid.classList.remove('loading');
  }
}

/* ------- wire filters (debounced) ------- */
const debouncedFilter = debounce(() => {
  const params = getCurrentQueryParams(1);
  refetchAndRender(params);
}, 500);

document.getElementById('filter-q')?.addEventListener('input', debouncedFilter);
document.getElementById('filter-min')?.addEventListener('input', debouncedFilter);
document.getElementById('filter-max')?.addEventListener('input', debouncedFilter);

// Sync category badge with current hidden CSV (SSR)
const currentCsv = document.getElementById('filter-category')?.value || '';
setSelectedCategoryIdsInMenu(parseCsv(currentCsv));

/* ------- Add to cart click ------- */
document.getElementById('product-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-addcart');
  if (!btn) return;
  e.preventDefault();
  const pid = btn.getAttribute('data-product-id');
  if (!pid) return;
  addToCart(pid, 1, btn);
});

/* ------- SPA-like pagination ------- */
document.getElementById('pagination-container').addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  if (a.getAttribute('aria-disabled') === 'true') return;
  e.preventDefault();

  const url = new URL(a.href, window.location.origin);
  const newPage = url.searchParams.get('page') || '1';

  const params = getCurrentQueryParams(newPage);
  refetchAndRender(params);
});

/* Keep SSR per-page select active on first render */
document.getElementById('per-page-select')?.addEventListener('change', () => {
  const params = getCurrentQueryParams(1);
  refetchAndRender(params);
});


</script>
</body>
</html>

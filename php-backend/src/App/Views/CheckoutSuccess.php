<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Order Confirmed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
    margin: 0;
    background: #f9fafb;
    color: #111827;
    min-height: 100vh;
  }
  main.success-page {
    max-width: 650px;
    width: 100%;
    margin: 0 auto;
    padding: 4rem 1rem;
    min-height: calc(100vh - 64px);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  main.success-page > * {
    width: 100%;
  }
  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 2.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    text-align: center;
  }
  .success-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 1.5rem;
    background: #dcfce7;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .success-icon svg {
    width: 48px;
    height: 48px;
    color: #16a34a;
  }
  h1 {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
    color: #111827;
  }
  .order-id {
    font-size: 1rem;
    color: #6b7280;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }
  .order-id strong {
    color: #16a34a;
    font-weight: 700;
  }
  .order-summary {
    background: #f9fafb;
    border-radius: 12px;
    padding: 1.25rem;
    margin: 1.5rem 0;
    text-align: left;
  }
  .order-summary-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
    color: #374151;
  }
  .order-summary-item:last-child {
    margin-bottom: 0;
  }
  .order-summary-item span:last-child {
    font-weight: 700;
    color: #111827;
  }
  .items-mini {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }
  .items-mini > div {
    padding: 0.5rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .actions {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .btn {
    display: inline-block;
    padding: 0.875rem 1.5rem;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    text-align: center;
  }
  .btn-primary {
    background: #16a34a;
    color: #fff;
  }
  .btn-primary:hover {
    background: #15803d;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
  }
  .btn-secondary {
    background: #fff;
    color: #374151;
    border: 2px solid #e5e7eb;
  }
  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }
  .stack { display: grid; gap: 1.5rem; }
  .grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: 1fr;
  }
  @media(min-width: 768px){
    .grid { grid-template-columns: 1fr 1fr; }
    .actions {
      flex-direction: row;
      justify-content: center;
    }
  }
  .muted {
    color: #6b7280;
    font-size: 0.95rem;
    line-height: 1.6;
  }
  @media(max-width: 480px) {
    .card {
      padding: 2rem 1.5rem;
    }
    h1 {
      font-size: 1.5rem;
    }
    .success-icon {
      width: 64px;
      height: 64px;
    }
    .success-icon svg {
      width: 36px;
      height: 36px;
    }
  }
  
  body { visibility: hidden; }
  body.feature-checked { visibility: visible; }
</style>
<script>
  // Block page render until feature check complete
  (async function() {
    try {
      const userId = await (async () => {
        const res = await fetch('/api/me', { credentials: 'include' });
        const data = await res.json();
        return data?.user?.user_id || data?.user?.id;
      })();
      
      const res = await fetch(`/api/node/feature-flags?user_id=${userId}`, { credentials: 'include' });
      const data = await res.json();

      if (!data.flags?.checkout_enabled?.enabled) {
        const info = {
          featureName: 'Checkout',
          reason: data.flags?.checkout_enabled?.reason,
          isGlobal: data.flags?.checkout_enabled?.isGlobal
        };
        sessionStorage.setItem('disabledFeatureInfo', JSON.stringify(info));
        window.location.replace('/feature-disabled');
        return;
      }
      
      document.body.classList.add('feature-checked');
    } catch (error) {
      console.error('Error checking feature flag:', error);
      document.body.classList.add('feature-checked');
    }
  })();
</script>
</head>
<body>
<?php
  // Helpers
  $fmt = fn($n) => 'Rp ' . number_format((float)$n, 0, ',', '.');
  $safe = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');

  // Normalize inputs from controller:
  // - $user: ['name','email']
  // - $order: single order OR null
  // - $orders: array of orders (optional)
  // - $total: grand total for multi-order (optional)
  $customerName = $safe($user['name'] ?? 'Customer');

  // Ensure variables exist to avoid notices
  $order  = $order  ?? null;
  $orders = $orders ?? [];
  $total  = $total  ?? 0.0;
?>

<main class="success-page">
  <?php if ($order): ?>
    <!-- Single order (your original layout) -->
    <div class="card">
      <div class="success-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1>Pesanan Berhasil!</h1>
      <div class="order-id">
        Terima kasih, <?= $customerName ?>.<br>
        ID Pesanan Anda:
        <strong>#<?= $safe($order['order_id'] ?? '—') ?></strong>
      </div>

      <p class="muted">
        Kami telah menerima pesanan Anda dan akan segera memprosesnya.
        Anda akan mendapat update ketika penjual mengirim barang Anda.
      </p>

      <div class="order-summary">
        <div class="order-summary-item">
          <span>Total Dibayar</span>
          <span><?= $fmt($order['total'] ?? $order['total_amount'] ?? 0) ?></span>
        </div>

        <div class="order-summary-item">
          <span>Jumlah Item</span>
          <span><?= isset($order['items']) ? count($order['items']) : 0 ?></span>
        </div>

        <?php if (!empty($order['items'])): ?>
          <div class="items-mini">
            <?php foreach ($order['items'] as $oi): ?>
              <div>
                <span><?= $safe($oi['name'] ?? $oi['product_name'] ?? 'Item') ?>
                × <?= (int)($oi['qty'] ?? 1) ?></span>
                <span><?= $fmt($oi['price'] ?? $oi['price_at'] ?? 0) ?></span>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <div class="actions">
        <a class="btn btn-primary" href="/orders">Lihat Pesanan</a>
        <a class="btn btn-secondary" href="/products">Lanjut Belanja</a>
      </div>
    </div>

  <?php elseif (!empty($orders)): ?>
    <!-- Multiple orders (e.g., split by store) -->
    <div class="stack">
      <div class="card">
        <div class="success-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1>Pesanan Berhasil!</h1>
        <div class="order-id">
          Terima kasih, <?= $customerName ?>.<br>
          Kami telah membuat <strong><?= count($orders) ?></strong> pesanan untuk pembelian Anda.
        </div>
        <div class="order-summary">
          <div class="order-summary-item">
            <span>Total Keseluruhan</span>
            <span><?= $fmt($total) ?></span>
          </div>
        </div>
      </div>

      <div class="grid">
        <?php foreach ($orders as $o): ?>
          <div class="card" style="text-align: left;">
            <div class="order-id" style="margin-bottom:.5rem; text-align: left;">
              ID Pesanan: <strong>#<?= $safe($o['order_id']) ?></strong>
            </div>
            <?php if (!empty($o['store_name'])): ?>
              <div class="muted" style="margin-bottom:.75rem;">
                Toko: <?= $safe($o['store_name']) ?>
              </div>
            <?php endif; ?>

            <div class="order-summary">
              <div class="order-summary-item">
                <span>Total</span>
                <span><?= $fmt($o['total'] ?? $o['total_amount'] ?? 0) ?></span>
              </div>
              <div class="order-summary-item">
                <span>Jumlah Item</span>
                <span><?= isset($o['items']) ? count($o['items']) : 0 ?></span>
              </div>

              <?php if (!empty($o['items'])): ?>
                <div class="items-mini">
                  <?php foreach ($o['items'] as $oi): ?>
                    <div>
                      <span><?= $safe($oi['name'] ?? $oi['product_name'] ?? 'Item') ?>
                      × <?= (int)($oi['qty'] ?? 1) ?></span>
                      <span><?= $fmt($oi['price'] ?? $oi['price_at'] ?? 0) ?></span>
                    </div>
                  <?php endforeach; ?>
                </div>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>

        <div class="actions">
          <a class="btn btn-primary" href="/orders">Lihat Pesanan</a>
          <a class="btn btn-secondary" href="/products">Lanjut Belanja</a>
      </div>
    </div>

  <?php else: ?>
    <!-- Fallback (no order info) -->
    <div class="card">
      <div class="success-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1>Pesanan Berhasil!</h1>
      <div class="actions">
        <a class="btn btn-primary" href="/orders">Lihat Pesanan</a>
        <a class="btn btn-secondary" href="/products">Lanjut Belanja</a>
      </div>
    </div>
  <?php endif; ?>
</main>

</body>
</html>

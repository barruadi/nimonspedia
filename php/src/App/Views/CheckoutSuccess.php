<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Order Confirmed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: system-ui, sans-serif; margin:0; background:#fafafa; color:#222; }
  main.success-page { max-width:900px; margin:2rem auto 4rem; padding:0 1rem; }
  .card { background:#fff; border:1px solid #ddd; border-radius:.5rem; padding:1.5rem; }
  h1 { font-size:1.25rem; font-weight:600; margin:0 0 .5rem; }
  .order-id { font-size:.9rem; color:#444; margin-bottom:1rem; }
  .order-summary { font-size:.9rem; color:#333; border-top:1px solid #eee; margin-top:1rem; padding-top:1rem; }
  .order-summary-item { display:flex; justify-content:space-between; margin-bottom:.4rem; }
  .items-mini { font-size:.8rem; color:#666; margin-top:.5rem; }
  .actions { margin-top:1.5rem; display:flex; flex-wrap:wrap; gap:.75rem; font-size:.85rem; }
  .btn { display:inline-block; padding:.6rem .75rem; border-radius:.4rem; border:1px solid #111; background:#111; color:#fff; text-decoration:none; font-weight:500; cursor:pointer; }
  .btn-secondary { background:#fff; color:#111; }
  .stack { display:grid; gap:1rem; }
  .grid { display:grid; gap:1rem; grid-template-columns:1fr; }
  @media(min-width:700px){ .grid { grid-template-columns:1fr 1fr; } }
  .muted { color:#666; font-size:.9rem; }
</style>
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
      <h1>Order Confirmed</h1>
      <div class="order-id">
        Thank you, <?= $customerName ?>.<br>
        Your order ID:
        <strong>#<?= $safe($order['order_id'] ?? '—') ?></strong>
      </div>

      <p class="muted">
        We've received your order and will start processing it.
        You'll get updates when the seller ships your items.
      </p>

      <div class="order-summary">
        <div class="order-summary-item">
          <span>Total paid</span>
          <span><?= $fmt($order['total'] ?? $order['total_amount'] ?? 0) ?></span>
        </div>

        <div class="order-summary-item">
          <span>Items</span>
          <span><?= isset($order['items']) ? count($order['items']) : 0 ?></span>
        </div>

        <?php if (!empty($order['items'])): ?>
          <div class="items-mini">
            <?php foreach ($order['items'] as $oi): ?>
              <div>
                <?= $safe($oi['name'] ?? $oi['product_name'] ?? 'Item') ?>
                × <?= (int)($oi['qty'] ?? 1) ?>
                — <?= $fmt($oi['price'] ?? $oi['price_at'] ?? 0) ?>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <div class="actions">
        <a class="btn" href="/orders">View Orders</a>
        <a class="btn btn-secondary" href="/products">Keep shopping</a>
      </div>
    </div>

  <?php elseif (!empty($orders)): ?>
    <!-- Multiple orders (e.g., split by store) -->
    <div class="stack">
      <div class="card">
        <h1>Order Confirmed</h1>
        <div class="order-id">
          Thank you, <?= $customerName ?>.<br>
          We created <strong><?= count($orders) ?></strong> orders for your purchase.
        </div>
        <div class="order-summary">
          <div class="order-summary-item">
            <span>Grand total paid</span>
            <span><?= $fmt($total) ?></span>
          </div>
        </div>
      </div>

      <div class="grid">
        <?php foreach ($orders as $o): ?>
          <div class="card">
            <div class="order-id" style="margin-bottom:.25rem;">
              Order ID: <strong>#<?= $safe($o['order_id']) ?></strong>
            </div>
            <?php if (!empty($o['store_name'])): ?>
              <div class="muted" style="margin-bottom:.75rem;">
                Store: <?= $safe($o['store_name']) ?>
              </div>
            <?php endif; ?>

            <div class="order-summary">
              <div class="order-summary-item">
                <span>Total</span>
                <span><?= $fmt($o['total'] ?? $o['total_amount'] ?? 0) ?></span>
              </div>
              <div class="order-summary-item">
                <span>Items</span>
                <span><?= isset($o['items']) ? count($o['items']) : 0 ?></span>
              </div>

              <?php if (!empty($o['items'])): ?>
                <div class="items-mini">
                  <?php foreach ($o['items'] as $oi): ?>
                    <div>
                      <?= $safe($oi['name'] ?? $oi['product_name'] ?? 'Item') ?>
                      × <?= (int)($oi['qty'] ?? 1) ?>
                      — <?= $fmt($oi['price'] ?? $oi['price_at'] ?? 0) ?>
                    </div>
                  <?php endforeach; ?>
                </div>
              <?php endif; ?>
            </div>

            <div class="actions">
              <a class="btn" href="/orders">View Orders</a>
              <a class="btn btn-secondary" href="/products">Keep shopping</a>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>

  <?php else: ?>
    <!-- Fallback (no order info) -->
    <div class="card">
      <h1>Order Confirmed</h1>
      <p class="muted">Your order was created, but we couldn't load the detail. You can review it from the Orders page.</p>
      <div class="actions">
        <a class="btn" href="/orders">View Orders</a>
        <a class="btn btn-secondary" href="/products">Keep shopping</a>
      </div>
    </div>
  <?php endif; ?>
</main>

</body>
</html>

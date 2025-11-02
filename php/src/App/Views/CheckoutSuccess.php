<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Order Confirmed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {
    font-family: system-ui, sans-serif;
    margin: 0;
    background: #fafafa;
    color: #222;
  }

  nav.topnav {
    display:flex;
    flex-wrap:wrap;
    gap:12px;
    padding:12px 16px;
    border-bottom:1px solid #ddd;
    background:#fff;
  }

  main.success-page {
    max-width:800px;
    margin:2rem auto 4rem;
    padding:0 1rem;
  }

  .card {
    background:#fff;
    border:1px solid #ddd;
    border-radius:.5rem;
    padding:1.5rem;
  }

  h1 {
    font-size:1.25rem;
    font-weight:600;
    margin:0 0 .5rem;
  }

  .order-id {
    font-size:.9rem;
    color:#444;
    margin-bottom:1rem;
  }

  .order-summary {
    font-size:.9rem;
    color:#333;
    border-top:1px solid #eee;
    margin-top:1rem;
    padding-top:1rem;
  }

  .order-summary-item {
    display:flex;
    justify-content:space-between;
    margin-bottom:.4rem;
  }

  .actions {
    margin-top:1.5rem;
    display:flex;
    flex-wrap:wrap;
    gap:.75rem;
    font-size:.85rem;
  }

  .btn {
    display:inline-block;
    padding:.6rem .75rem;
    border-radius:.4rem;
    border:1px solid #111;
    background:#111;
    color:#fff;
    text-decoration:none;
    font-weight:500;
    cursor:pointer;
  }

  .btn-secondary {
    background:#fff;
    color:#111;
  }
</style>
</head>
<body>

<nav class="topnav">
  <a href="/products">Browse</a>
  <a href="/home">Dashboard</a>
  <a href="/orders">My Orders</a>
</nav>

<main class="success-page">
  <div class="card">
    <h1>Order Confirmed 🎉</h1>
    <div class="order-id">
      Thank you, <?= htmlspecialchars($user['name'] ?? 'Customer') ?>.<br>
      Your order ID:
      <strong>#<?= htmlspecialchars($order['order_id'] ?? '—') ?></strong>
    </div>

    <p style="font-size:.9rem; color:#444; line-height:1.4;">
      We've received your order and will start processing it.
      You'll get updates when the seller ships your items.
    </p>

    <div class="order-summary">
      <div class="order-summary-item">
        <span>Total paid</span>
        <span>
          Rp <?= number_format(($order['total'] ?? 0), 0, ',', '.') ?>
        </span>
      </div>

      <div class="order-summary-item">
        <span>Items</span>
        <span><?= isset($order['items']) ? count($order['items']) : 0 ?></span>
      </div>

      <?php if (!empty($order['items'])): ?>
        <div style="font-size:.8rem;color:#666;margin-top:.5rem;">
          <?php foreach ($order['items'] as $oi): ?>
            <div>
              <?= htmlspecialchars($oi['name'] ?? 'Item') ?>
              × <?= (int)($oi['qty'] ?? 1) ?>
              — Rp <?= number_format(($oi['price'] ?? 0), 0, ',', '.') ?>
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
</main>

</body>
</html>

<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title><?= htmlspecialchars($title ?? 'Checkout') ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/styles/Navbar.css">
  <style>
    .wrap { max-width: 1100px; margin:24px auto; padding:0 16px; }
    h1 { font-size:24px; margin:0 0 16px; }
    .grid { display:grid; grid-template-columns: 1fr 360px; gap:20px; }
    @media(max-width:900px){ .grid { grid-template-columns: 1fr; } }
    .card { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:20px; box-shadow:0 8px 24px rgba(0,0,0,.06); }
    .item { display:grid; grid-template-columns: 64px 1fr 120px; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid #eee; }
    .item:last-child { border-bottom:none; }
    .thumb { width:64px; height:64px; object-fit:cover; border-radius:10px; border:1px solid #e5e7eb; }
    .title { font-weight:600; margin-bottom:4px; }
    .muted { color:#6b7280; font-size:12px; }
    .price { font-weight:600; text-align:right; }
    .sum-row { display:flex; justify-content:space-between; margin:8px 0; color:#6b7280; }
    .sum-row.total { color:#111; font-weight:800; font-size:20px; }
    .btn { display:inline-block; width:100%; padding:12px 22px; border-radius:12px; background:#22c55e; color:#fff; border:none; font-weight:700; cursor:pointer; }
    form .field { margin-bottom:12px; }
    input, textarea { width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Checkout</h1>
    <div class="grid">
      <section class="card">
        <?php foreach ($items as $it): ?>
          <div class="item">
            <img class="thumb" src="<?= htmlspecialchars($it['image_path'] ?? '/placeholder.png') ?>" alt="">
            <div>
              <div class="title"><?= htmlspecialchars($it['name']) ?></div>
              <div class="muted">Qty: <?= (int)$it['qty'] ?></div>
            </div>
            <div class="price">Rp <?= number_format($it['price'] * $it['qty'], 0, ',', '.') ?></div>
          </div>
        <?php endforeach; ?>
      </section>

      <aside class="card">
        <h3>Ringkasan</h3>
        <div class="sum-row"><span>Subtotal</span><span>Rp <?= number_format($summary['subtotal'],0,',','.') ?></span></div>
        <div class="sum-row total"><span>Total</span><span>Rp <?= number_format($summary['total'],0,',','.') ?></span></div>
        <hr style="margin:16px 0">
        <form method="post" action="/checkout/submit">
          <div class="field">
            <label>Alamat Pengiriman</label>
            <textarea name="address" rows="3" required></textarea>
          </div>
          <button class="btn" type="submit">Buat Pesanan</button>
        </form>
      </aside>
    </div>
  </div>
</body>
</html>

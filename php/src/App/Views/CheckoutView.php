<?php
function rupiah($n){ return 'Rp '.number_format((int)$n,0,',','.'); }
?>
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title><?= htmlspecialchars($title ?? 'Checkout') ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/styles/Navbar.css">
  <style>
    :root { --bd:#e5e7eb; --muted:#6b7280; --ok:#22c55e; }
    body { margin:0; background:var(--bg); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:#111; }
    .wrap { max-width:1100px; margin:24px auto; padding:0 16px; }
    h1 { font-size:28px; margin:0 0 16px; }
    .grid { display:grid; grid-template-columns:1fr 360px; gap:20px; }
    @media (max-width:900px){ .grid{ grid-template-columns:1fr; } }
    .card { background:#fff; border:1px solid var(--bd); border-radius:14px; padding:20px; box-shadow:0 8px 24px rgba(0,0,0,.06); }
    /* address */
    .addr { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .addr .title { font-weight:700; margin-bottom:6px; display:flex; align-items:center; gap:6px; }
    .addr .text { color:var(--muted); }
    .btn-ghost { padding:6px 12px; border:1px solid var(--bd); border-radius:999px; background:#fff; cursor:pointer; }
    /* store groups */
    .store { margin-top:16px; }
    .store h3 { font-size:14px; margin:0 0 8px; }
    .box { border:1px solid var(--bd); border-radius:14px; padding:8px 16px; background:#fff; }
    .item { display:grid; grid-template-columns:64px 1fr 120px; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid #eee; }
    .item:last-child { border-bottom:none; }
    .thumb { width:64px; height:64px; object-fit:cover; border-radius:10px; border:1px solid var(--bd); }
    .pname { font-weight:600; margin:0 0 4px; }
    .price { text-align:right; font-weight:700; }
    .qty { text-align:right; font-size:12px; color:var(--muted); }
    /* summary */
    aside h3 { margin:0 0 12px; }
    .sum-row { display:flex; justify-content:space-between; margin:8px 0; color:var(--muted); }
    .sum-row.total { color:#111; font-weight:800; font-size:20px; margin-top:10px; }
    .btn { width:100%; padding:12px 22px; border-radius:12px; background:var(--ok); color:#fff; border:none; font-weight:700; cursor:pointer; }
    .btn[disabled]{ opacity:.6; cursor:not-allowed; }
    hr { border:none; border-top:1px solid #eee; margin:16px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Checkout</h1>

    <div class="grid">
      <section>
        <!-- alamat -->
        <div class="card">
          <div class="addr">
            <div>
              <div class="title">Alamat Pengiriman</div>
              <div class="text"><?= nl2br(htmlspecialchars($address ?: 'Belum ada alamat')) ?></div>
            </div>
            <form method="get" action="/account/address">
              <button class="btn-ghost" type="submit">Ganti</button>
            </form>
          </div>
        </div>

        <!-- per toko -->
        <?php foreach ($groups as $g): ?>
          <div class="store">
            <h3><?= htmlspecialchars($g['store_name']) ?></h3>
            <div class="box">
              <?php foreach ($g['items'] as $it): ?>
                <div class="item">
                  <img class="thumb" src="<?= htmlspecialchars($it['image_path'] ?? '/placeholder.png') ?>" alt="">
                  <div>
                    <div class="pname"><?= htmlspecialchars($it['name']) ?></div>
                  </div>
                  <div>
                    <div class="price"><?= rupiah($it['price']) ?></div>
                    <div class="qty">×<?= (int)$it['qty'] ?></div>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </section>

      <aside class="card">
        <h3>Ringkasan Belanja</h3>

        <?php foreach ($groups as $g): ?>
          <div class="sum-row">
            <span><?= htmlspecialchars($g['store_name']) ?></span>
            <span>Harga (<?= (int)$g['count'] ?> Item)&nbsp;&nbsp; <?= rupiah($g['subtotal']) ?></span>
          </div>
        <?php endforeach; ?>

        <hr>
        <div class="sum-row"><span>Total Item</span><span><?= (int)$totalItems ?></span></div>
        <div class="sum-row total"><span>Total Harga</span><span><?= rupiah($summary['total'] ?? 0) ?></span></div>
        <hr>
        <div class="sum-row"><span>Saldo</span><span><?= rupiah($balance) ?></span></div>
        <div class="sum-row"><span>Saldo Setelah Checkout</span><span><?= rupiah($afterBalance) ?></span></div>

        <form method="post" action="/checkout/submit" style="margin-top:16px">
          <input type="hidden" name="address" value="<?= htmlspecialchars($address) ?>">
          <button class="btn" type="submit" <?= $canCheckout ? '' : 'disabled' ?>>Checkout</button>
        </form>
      </aside>
    </div>
  </div>
</body>
</html>

<?php
function rupiah($n){ return 'Rp '.number_format((int)$n,0,',','.'); }
$address     = $address     ?? '';
$canCheckout = $canCheckout ?? true; // server-side rule; JS will enable if temp address is set
?>
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title><?= htmlspecialchars($title ?? 'Checkout') ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/styles/Navbar.css">
  <style>
    :root { --bd:#e5e7eb; --muted:#6b7280; --ok:#22c55e; --bg:#fafafa; --overlay:rgba(0,0,0,.5); }
    body { margin:0; background:var(--bg); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:#111; }
    .wrap { max-width:1100px; margin:24px auto; padding:0 16px; }
    h1 { font-size:28px; margin:0 0 16px; }
    .grid { display:grid; grid-template-columns:1fr 360px; gap:20px; }
    @media (max-width:900px){ .grid{ grid-template-columns:1fr; } }
    .card { background:#fff; border:1px solid var(--bd); border-radius:14px; padding:20px; box-shadow:0 8px 24px rgba(0,0,0,.06); }
    /* address */
    .addr { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .addr .title { font-weight:700; margin-bottom:6px; display:flex; align-items:center; gap:6px; }
    .addr .text { color:var(--muted); white-space:pre-line; }
    .btn-ghost { padding:6px 12px; border:1px solid var(--bd); border-radius:999px; background:#fff; cursor:pointer; }
    /* store groups */
    .store { margin-top:16px; }
    .store h3 { font-size:14px; margin:0 0 8px; font-weight:600; }
    .box { border:1px solid var(--bd); border-radius:14px; padding:8px 16px; background:#fff; }
    .item { display:grid; grid-template-columns:64px 1fr 120px; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid #eee; }
    .item:last-child { border-bottom:none; }
    .thumb { width:64px; height:64px; object-fit:cover; border-radius:10px; border:1px solid var(--bd); }
    .pname { font-weight:600; margin:0 0 4px; font-size:14px; }
    .price { text-align:right; font-weight:700; font-size:14px; }
    .qty { text-align:right; font-size:12px; color:var(--muted); }
    /* summary */
    aside h3 { margin:0 0 12px; font-size:16px; }
    .sum-row { display:flex; justify-content:space-between; margin:8px 0; color:var(--muted); font-size:14px; }
    .sum-row.total { color:#111; font-weight:800; font-size:16px; margin-top:10px; }
    .btn { width:100%; padding:12px 22px; border-radius:12px; background:var(--ok); color:#fff; border:none; font-weight:700; cursor:pointer; }
    .btn[disabled]{ opacity:.6; cursor:not-allowed; }
    hr { border:none; border-top:1px solid #eee; margin:16px 0; }

    /* ===== Modal (Alamat Sementara – 1 field) ===== */
    .modal-backdrop {
      position: fixed; inset: 0; background: var(--overlay);
      display: none; align-items: center; justify-content: center;
      padding: 16px; z-index: 1000;
    }
    .modal-backdrop[aria-hidden="false"] { display: flex; }
    .modal {
      width: 100%; max-width: 560px; background:#fff; border-radius:14px; border:1px solid var(--bd);
      box-shadow: 0 20px 50px rgba(0,0,0,.25); overflow:hidden;
    }
    .modal header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--bd); }
    .modal h2 { font-size:18px; margin:0; }
    .modal .close { background:none; border:none; font-size:20px; cursor:pointer; padding:6px; }
    .modal .body { padding:16px; }
    .field label { font-size:12px; color:#555; display:block; margin-bottom:6px; }
    .field textarea {
      width:100%; min-height:140px; padding:10px 12px; border:1px solid #ddd; border-radius:10px; font:inherit; background:#fff; resize:vertical;
    }
    .modal footer { display:flex; gap:10px; justify-content:flex-end; padding:14px 16px; border-top:1px solid var(--bd); background:#fafafa; }
    .btn-secondary { background:#fff; border:1px solid var(--bd); color:#111; padding:10px 16px; border-radius:10px; cursor:pointer; }
    .btn-primary { background:var(--ok); border:1px solid var(--ok); color:#fff; padding:10px 16px; border-radius:10px; cursor:pointer; }
    .error { color:#b91c1c; font-size:12px; margin-top:8px; }
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
              <div id="address-text" class="text"><?= nl2br(htmlspecialchars($address ?: 'Belum ada alamat')) ?></div>
            </div>
            <button class="btn-ghost" type="button" id="btn-change-address">Ganti</button>
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
        <div class="sum-row"><span>Saldo</span><span id="current-balance"><?= rupiah($balance) ?></span></div>
        <div class="sum-row"><span>Saldo Setelah Checkout</span><span id="after-balance"><?= rupiah($afterBalance) ?></span></div>

        <?php if (!$canCheckout && $afterBalance < 0): ?>
          <div style="margin-top: 12px; color: var(--muted); font-size: 14px;">
            Saldo tidak cukup. <span id="topup-trigger" style="color: #16a34a; font-weight: 600; cursor: pointer; text-decoration: underline;">Isi Saldo</span>
          </div>
        <?php endif; ?>

        <form method="post" action="/checkout/submit" style="margin-top:16px">
          <input type="hidden" name="address" value="<?= htmlspecialchars($address) ?>">
          <button class="btn" type="submit" id="checkout-btn" <?= $canCheckout ? '' : 'disabled' ?>>Checkout</button>
        </form>
      </aside>
    </div>
  </div>

  <script type="module">
    import { api } from '/utils/api.js';

    // Trigger top-up modal when "Isi Saldo" button clicked
    const topupTrigger = document.getElementById('topup-trigger');
    if (topupTrigger) {
      topupTrigger.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('open-top-up-modal'));
      });
    }

    // Listen for balance update events
    window.addEventListener('balance:updated', async () => {
      console.log('Balance updated, refreshing checkout page data...');
      await refreshBalance();
    });

    // Function to refresh balance without page reload
    async function refreshBalance() {
      try {
        const res = await api.get('/me');
        if (!res || !res.authenticated || !res.user) {
          console.error('Failed to fetch user data');
          return;
        }

        const newBalance = res.user.balance || 0;
        const totalPrice = <?= (int)($summary['total'] ?? 0) ?>;
        const afterBalance = newBalance - totalPrice;

        // Format currency
        const rupiah = (n) => 'Rp ' + parseInt(n, 10).toLocaleString('id-ID');

        // Update balance displays
        const currentBalanceEl = document.getElementById('current-balance');
        const afterBalanceEl = document.getElementById('after-balance');
        const checkoutBtn = document.getElementById('checkout-btn');

        if (currentBalanceEl) {
          currentBalanceEl.textContent = rupiah(newBalance);
        }

        if (afterBalanceEl) {
          afterBalanceEl.textContent = rupiah(afterBalance);
        }

        // Enable/disable checkout button based on balance
        if (checkoutBtn) {
          if (afterBalance >= 0) {
            checkoutBtn.disabled = false;

            // Hide warning if exists
            const warningDiv = topupTrigger?.parentElement;
            if (warningDiv) {
              warningDiv.style.display = 'none';
            }
          } else {
            checkoutBtn.disabled = true;
          }
        }

        console.log('Balance updated:', { newBalance, afterBalance, canCheckout: afterBalance >= 0 });
      } catch (error) {
        console.error('Error refreshing balance:', error);
      }
    }
  </script>
</body>
</html>

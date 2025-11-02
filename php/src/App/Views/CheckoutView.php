<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Checkout</title>
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

  main.checkout-page {
    max-width:1100px;
    margin:1.5rem auto;
    padding:0 1rem 4rem;
    display:grid;
    grid-template-columns:1fr;
    gap:1.5rem;
  }

  @media(min-width:900px){
    main.checkout-page {
      grid-template-columns:2fr 1fr;
    }
  }

  .panel {
    background:#fff;
    border:1px solid #ddd;
    border-radius:.5rem;
    padding:1rem 1.25rem;
  }

  .panel h2 {
    font-size:1rem;
    font-weight:600;
    margin:0 0 .75rem;
  }

  .cart-item {
    display:grid;
    grid-template-columns:64px 1fr auto;
    gap:.75rem;
    align-items:flex-start;
    font-size:.85rem;
    border-bottom:1px solid #eee;
    padding:.75rem 0;
  }

  .cart-item:last-child {
    border-bottom:none;
  }

  .cart-item img {
    width:64px;
    height:64px;
    object-fit:cover;
    border-radius:.5rem;
    background:#eee;
    border:1px solid #ddd;
  }

  .item-name {
    font-weight:600;
    color:#111;
    margin-bottom:.25rem;
  }

  .item-store {
    font-size:.75rem;
    color:#555;
    margin-bottom:.25rem;
  }

  .item-stock-warning {
    font-size:.7rem;
    color:#c00;
    font-weight:500;
  }

  .item-qty-price {
    text-align:right;
    font-size:.8rem;
    color:#444;
  }

  .summary-line {
    display:flex;
    justify-content:space-between;
    font-size:.9rem;
    margin-bottom:.4rem;
    color:#333;
  }

  .summary-total {
    border-top:1px solid #ddd;
    padding-top:.5rem;
    font-weight:600;
  }

  .checkout-submit {
    margin-top:1rem;
    width:100%;
    background:#111;
    color:#fff;
    border:1px solid #111;
    border-radius:.4rem;
    padding:.75rem 1rem;
    font-size:.9rem;
    font-weight:500;
    cursor:pointer;
  }

  .notice {
    font-size:.75rem;
    color:#888;
    margin-top:.5rem;
    line-height:1.4;
  }

  .danger {
    color:#c00;
    font-weight:600;
  }

</style>
</head>
<body>

<main class="checkout-page">

  <!-- LEFT: Cart review -->
  <section style="display:flex;flex-direction:column;gap:1.5rem;">

    <!-- Cart Review -->
    <div class="panel">
      <h2>Order Summary</h2>

      <?php if (empty($cartItems)): ?>
        <p style="font-size:.9rem;color:#666;">Your cart is empty.</p>
        <p style="font-size:.9rem;">
          <a href="/products" style="color:#111;text-decoration:underline;">Continue shopping</a>
        </p>
      <?php else: ?>
        <?php foreach ($cartItems as $item): ?>
          <?php
            $img        = $item['image_path'] ?? '';
            $name       = $item['name'] ?? 'Unknown item';
            $storeName  = $item['store_name'] ?? 'Unknown Store';
            $qty        = (int)($item['qty'] ?? 1);
            $price      = $item['price'] ?? 0;
            $stockLeft  = isset($item['stock']) ? (int)$item['stock'] : null;
            $lineTotal  = $price * $qty;
            $outOfStock = $stockLeft !== null && $stockLeft < $qty;
          ?>
          <div class="cart-item">
            <div>
              <?php if ($img): ?>
                <img src="<?= htmlspecialchars($img) ?>" alt="">
              <?php else: ?>
                <img src="/placeholder.png" alt="">
              <?php endif; ?>
            </div>

            <div>
              <div class="item-name"><?= htmlspecialchars($name) ?></div>
              <div class="item-store"><?= htmlspecialchars($storeName) ?></div>
              <div class="item-qty" style="font-size:.8rem;color:#444;">
                Qty: <?= $qty ?>
              </div>

              <?php if ($outOfStock): ?>
                <div class="item-stock-warning">
                  ⚠ Stok tidak cukup (tersisa <?= $stockLeft ?>). Silakan ubah di cart.
                </div>
              <?php endif; ?>
            </div>

            <div class="item-qty-price">
              <div>Rp <?= number_format($price,0,',','.') ?> / pc</div>
              <div style="font-weight:600;">
                Rp <?= number_format($lineTotal,0,',','.') ?>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>

    
    <form class="panel" method="POST" action="/checkout/confirm">
      <?php if (!empty($cartItems)): ?>
        <button class="checkout-submit" type="submit">
          Place Order
        </button>
        <p class="notice">
          By placing this order you confirm product availability
        </p>

        <?php
          $hasStockProblem = false;
          foreach ($cartItems as $item) {
            $qty = (int)($item['qty'] ?? 1);
            $stockLeft = isset($item['stock']) ? (int)$item['stock'] : null;
            if ($stockLeft !== null && $stockLeft < $qty) {
              $hasStockProblem = true;
              break;
            }
          }
        ?>

        <?php if ($hasStockProblem): ?>
          <p class="notice danger">
            One or more items are low stock or unavailable. Please update your cart.
          </p>
        <?php endif; ?>

      <?php else: ?>
        <p class="notice danger">Your cart is empty. You can't checkout.</p>
      <?php endif; ?>
    </form>

  </section>

  <!-- RIGHT: Summary total -->
  <aside class="panel">
    <h2>Payment Summary</h2>

    <?php
      $subtotal = $summary['subtotal'] ?? 0;
      $shipping = $summary['shipping'] ?? 0;
      $total    = $summary['total']    ?? ($subtotal + $shipping);
    ?>

    <div class="summary-line">
      <span>Subtotal</span>
      <span>Rp <?= number_format($subtotal,0,',','.') ?></span>
    </div>
    <div class="summary-line">
      <span>Shipping</span>
      <span>Rp <?= number_format($shipping,0,',','.') ?></span>
    </div>
    <div class="summary-line summary-total">
      <span>Total</span>
      <span>Rp <?= number_format($total,0,',','.') ?></span>
    </div>

    <p class="notice" style="margin-top:1rem;">
      Prices and stock will be re-validated when you place the order.
    </p>
  </aside>

</main>

</body>
</html>

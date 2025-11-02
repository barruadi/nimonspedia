<?php

http_response_code(404);

$logoPath = __DIR__ . '/../../public/uploads/assets/not_found.png';
$homeUrl  = '/products';
$title    = '404 Not Found';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title><?= htmlspecialchars($title) ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="icon" href="<?= htmlspecialchars($logoPath) ?>" />
  <style>
    :root{
      --green:#2f9d4a;
      --bg:#f6f6f8;
      --text:#000;
      --muted:#6b7280;
      --card:#fff;
      --radius:16px;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family:system-ui,BlinkMacSystemFont,"Inter",Roboto,Arial,sans-serif;
      background:var(--bg);
      color:var(--text);
    }
    .nf-page{
      min-height:100dvh;
      display:grid;
      place-items:center;
      padding:2rem;
    }
    .nf-card{
      width:min(720px,92vw);
      background:var(--card);
      border:1px solid rgba(0,0,0,.06);
      box-shadow:0 20px 40px rgba(0,0,0,.08);
      border-radius:var(--radius);
      padding:2.25rem 1.75rem;
      text-align:center;
    }
    .nf-logo{
      width:min(220px,60vw);
      height:auto;
      display:block;
      margin:0 auto 1.25rem;
    }
    .nf-code{
      font-size:3.25rem;
      line-height:1;
      margin:.25rem 0 .25rem;
      letter-spacing:.02em;
    }
    .nf-text{
      margin:0 0 1.25rem;
      font-size:1rem;
      color:var(--muted);
    }
    .nf-actions{ margin-top:.5rem; }
    .nf-btn{
      display:inline-block;
      background:#d5edd8;
      color:var(--green);
      border:2px solid #d5edd8;
      font-weight:700;
      text-decoration:none;
      padding:.75rem 1.1rem;
      border-radius:12px;
    }
    .nf-btn:hover{ filter:brightness(0.98); }
  </style>
</head>
<body>
  <main class="nf-page">
    <div class="nf-card">
      <img class="nf-logo" src="<?= htmlspecialchars($logoPath) ?>" alt="Logo" />
      <h1 class="nf-code">404</h1>
      <p class="nf-text">Halaman tidak ditemukan.</p>
      <div class="nf-actions">
        <a class="nf-btn" href="<?= htmlspecialchars($homeUrl) ?>">Kembali ke Beranda</a>
      </div>
    </div>
  </main>
</body>
</html>

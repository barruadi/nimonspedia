<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title><?= htmlspecialchars($title ?? ''); ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/styles/Navbar.css">
  <script>
    window.__BOOT_SESSION__ = <?= json_encode([
      'authenticated' => (bool)$sessionUser,
      'user' => $sessionUser ? [
        'id'    => $sessionUser['user_id'],
        'name'  => $sessionUser['full_name'],
        'email' => $sessionUser['email'],
        'role'  => $sessionUser['role'],
      ] : null
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
  </script>
</head>
<body>

  <header id="navbar-root">
    <app-navbar></app-navbar>
  </header>

  <main id="app" class="container">
    <?= $content  ?>
  </main>

  <!-- load the web component once -->
  <script type="module" src="/components/Navbar.js"></script>
  <!--<script type="module" src="/index.js"></script>-->
</body>
</html>

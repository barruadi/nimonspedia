<!doctype html>
<html lang="en">
<head>
  <link rel="stylesheet" href="/styles/Navbar.css">
  <link rel="stylesheet" href="/styles/BalanceModal.css">
  
  <link rel="stylesheet" href="/styles/LoadingComponent.css">
  <link rel="preload" href="/uploads/loading/loading-icon.svg" as="image">
  
  <script>
    window.__BOOT_SESSION__ = <?= json_encode([
      'authenticated' => (bool)$sessionUser,
      'user' => $sessionUser ? [
        'id'    => $sessionUser['user_id'],
        'name'  => $sessionUser['full_name'],
        'email' => $sessionUser['email'],
        'role'  => $sessionUser['role'],
        'balance' => $sessionUser['balance'] ?? 0 
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
  
  <balance-modal></balance-modal>
  <app-toast></app-toast> 
  
  <script type="module" src="/components/Navbar.js"></script>
  <script type="module" src="/components/BalanceModal.js"></script>
  <script type="module" src="/components/ToastNotification.js"></script> 
  <script type="module" src="/components/LoadingComponent.js"></script> 
  </body>
</html>
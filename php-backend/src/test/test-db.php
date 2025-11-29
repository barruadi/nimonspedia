<?php

require __DIR__ . '/../bootstrap.php';
use App\Core\Database;

try {
    $pdo = Database::getInstance();
    $row = $pdo->query("SELECT version()")->fetch();
    echo "[OK]: " . htmlspecialchars($row['version']);
} catch (Throwable $e) {
    echo "[DB Error]: " . htmlspecialchars($e->getMessage());
}
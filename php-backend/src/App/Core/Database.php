<?php

namespace App\Core;
use PDO;

class Database {
    private static ?PDO $instance = null;

    public static function getInstance(): PDO {
        if (!self::$instance) {
            
            # Perubahan: Host HARUS 'postgres' (nama service Docker)
            $host = 'postgres'; 
            
            # Kita menggunakan getenv() untuk variabel lain
            $port = getenv('DB_PORT') ?: '5432';
            $name = getenv('DB_NAME') ?: 'ecommerce'; # Nama DB: 'ecommerce'
            $user = getenv('DB_USER') ?: 'user';      # User: 'user'
            $pass = getenv('DB_PASS') ?: 'password';  # Pass: 'password'

            # Pastikan DSN menggunakan driver 'pgsql'
            self::$instance = new PDO("pgsql:host=$host;dbname=$name", $user, $pass);
            self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        }
        return self::$instance;
    }
    
    // ... (fungsi fetchOne, executeQuery, pdo tetap sama)
    
    public static function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }
    
    public static function executeQuery(string $sql, array $params = []): int
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }
    
    public static function pdo(): PDO
    {
        return self::getInstance();
    }
}
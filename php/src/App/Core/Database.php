<?php

namespace App\Core;
use PDO;

class Database {
    private static ?PDO $instance = null;

    public static function getInstance(): PDO {
        # If PDO hasn't been built yet (access via .env variables)
        if (!self::$instance) {
            $host = getenv('DB_HOST') ?: 'db';
            $port = getenv('DB_PORT') ?: '5432';
            $name = getenv('DB_NAME') ?: 'ecommerce';
            $user = getenv('DB_USER') ?: 'user';
            $pass = getenv('DB_PASS') ?: 'password';

            self::$instance = new PDO("pgsql:host=$host;dbname=$name", $user, $pass);
            self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        }
        return self::$instance;
    }

}
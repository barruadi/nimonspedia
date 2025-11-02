<?php

namespace App\Models;

use App\Core\Database;
use PDO;

class Category
{
    // Get database connection
    private static function getDB(): PDO
    {
        return Database::getInstance();
    }

    // Get all categories ordered by name
    public static function findAll(): array
    {
        $db = Database::getInstance();
        $stmt = $db->query("SELECT category_id, name FROM categories ORDER BY name");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
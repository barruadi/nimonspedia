<?php

namespace App\Models;

use App\Core\Database;
use PDO;

class Category
{
    // Properties
    public ?int $category_id = null;
    public ?string $name = null;
    public ?string $description = null;
    public ?string $created_at = null;
    public ?string $updated_at = null;

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
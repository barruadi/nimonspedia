<?php

namespace App\Models;

use App\Core\Database;
use PDO;

class Categories
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

    // Get all categories in database
    public static function getAll(): array
    {
        $db = self::getDB();
        $stmt = $db ->prepare("
            SELECT * FROM categories
            ORDER BY name
        ");
        $stmt->execute();

        $categories = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        return $categories;
    }
}
<?php

namespace App\Models;

use App\Core\Database;
use PDO;
use PDOException;

class Store
{
    public int    $store_id;
    public int    $owner_id;
    public string $store_name;
    public string $description;
    public string $logo_path;
    public string $created_at;
    public string $updated_at;
    
    public static function create(
        int    $owner_id,
        string $store_name,
        string $description,
        string $logo_path
    ): ?array
    {
        $query = "
            INSERT INTO stores (owner_id, store_name, description, logo_path)
            VALUES (:owner_id, :store_name, :description, :logo_path)
            RETURNING store_id, owner_id, store_name, description, logo_path, created_at, updated_at
        ";
        
        try {
            $pdo = Database::pdo();
            $stmt = $pdo->prepare($query);
            $stmt->execute([
                ':owner_id'     => $owner_id,
                ':store_name'   => $store_name,
                ':description'  => $description,
                ':logo_path'    => $logo_path,
            ]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row === false ? null : $row;

        } catch (PDOException $e) {
            return null;
        }
    }
}
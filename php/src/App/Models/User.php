<?php

namespace App\Models;

use App\Core\Database;
use PDO;
use PDOException;

class User {
    public int    $user_id;
    public string $email;
    public string $password_hash;
    public string $full_name;
    public string $role;
    public int    $balance;
    public string $created_at;
    public string $update_at;

    public static function create(
        string $name,
        string $email,
        string $password,
        string $role,
    ): array
    {
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $query = "
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (:email, :password_hash, :full_name, :role)
            RETURNING user_id, email, full_name, role, balance, created_at, updated_at
        ";

        try {
            $pdo = Database::pdo();
            $stmt = $pdo->prepare($query);
            $stmt->execute([
                ':email'         => $email,
                ':password_hash' => $hash,
                ':full_name'     => $name,
                ':role'          => $role,
            ]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row === false ? null : $row;

        } catch (PDOException $e) {
            return null;
        }
    }

    public static function findByEmail(
        string $email
    ): array
    {
        $query = "
            SELECT user_id, email, password_hash, full_name, role, balance, created_at, updated_at
            FROM users
            WHERE email = :email
            LIMIT 1
        ";

        $row = Database::fetchOne($query, [':email' => $email]);
        return $row ?? [];
    }
    
    public static function findById(
        int $user_id
    ): array
    {
        $query = "
            SELECT user_id, email, password_hash, full_name, role, balance, created_at, updated_at
            FROM users
            WHERE user_id = :user_id
            LIMIT 1
        ";
        
        $row = Database::fetchOne($query, [':user_id' => $user_id]);
        return $row ?? [];
    }

    public static function authenticate(
        string $email,
        string $password
    ): ?array
    {
        $user = self::findByEmail($email);
        if (!$user) {
            return null;
        }

        if (!password_verify($password, $user['password_hash'])) {
            return null;
        }

        unset($user['password_hash']);
        return $user;
    }
}

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
    public string $updated_at;

    public static function create(
        string $name,
        string $email,
        string $password,
        string $address,
        string $role,
    ): array
    {
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $query = "
            INSERT INTO users (email, password_hash, full_name, role, address)
            VALUES (:email, :password_hash, :full_name, :role, :address)
            RETURNING user_id, email, full_name, role, address, balance, created_at, updated_at
        ";

        try {
            $pdo = Database::pdo();
            $stmt = $pdo->prepare($query);
            $stmt->execute([
                ':email'         => $email,
                ':password_hash' => $hash,
                ':full_name'     => $name,
                ':role'          => $role,
                ':address'       => $address,
            ]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row === false ? null : $row;

        } catch (PDOException $e) {
            return [];
        }
    }

    public static function findByEmail(
        string $email
    ): array
    {
        $query = "
            SELECT user_id, email, password_hash, full_name, role, address, balance, created_at, updated_at
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
            SELECT user_id, email, password_hash, full_name, role, address, balance, created_at, updated_at
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

    public static function addBalance(int $user_id, float $amount): ?float
    {
        if ($amount <= 0) {
            return null;
        }

        $query = "
            UPDATE users
            SET balance = balance + :amount,
                updated_at = NOW()
            WHERE user_id = :user_id
            RETURNING balance
        ";
        
        try {
            $pdo = Database::pdo();
            $stmt = $pdo->prepare($query);
            $stmt->execute([
                ':amount'   => $amount,
                ':user_id'  => $user_id,
            ]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ? (float)$row['balance'] : null;

        } catch (PDOException $e) {
            error_log("User::addBalance error: " . $e->getMessage());
            return null;
        }
    }
    
    public static function updatePassword(
        string $new_password,
        int    $user_id
    ): bool
    {
        $hash = password_hash($new_password, PASSWORD_DEFAULT);
        
        $query = "
            UPDATE users
            SET password_hash = :password_hash,
                updated_at    = NOW()
            WHERE user_id = :user_id
        ";
        
        $row_affected = Database::executeQuery($query, [
            ':password_hash' => $hash,
            ':user_id'       => $user_id,
        ]);
        
        return $row_affected === 1;
    }
    
    // Update balance
    public static function updateBalance(int $userId, int $amount): bool
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            UPDATE users 
            SET balance = :amount,
                updated_at = NOW()
            WHERE user_id = :user_id
            AND (balance + :amount) >= 0
        ");
        
        $stmt->execute([
            'user_id' => $userId,
            'amount' => $amount
        ]);
        
        $user = self::findById($userId);
        unset($user['password_hash']);
        $_SESSION['user']      = $user;

        return true;
    }

    // Get user balance as integer
    public static function getBalance(int $userId): ?int
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT balance FROM users WHERE user_id = :user_id");
        $stmt->execute(['user_id' => $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? (int)$result['balance'] : null;
    }
}

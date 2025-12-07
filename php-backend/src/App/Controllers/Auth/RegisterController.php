<?php

namespace App\Controllers\Auth;

use App\Models\User;
use App\Models\Store;

class RegisterController
{
    public static function show(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $user = $_SESSION['user'] ?? null;

        if ($user) {
            http_response_code(403);
            return ['ok' => false, 'error' => 'Already login in'];
        }

        return [
            'ok' => true
        ];
    }

    public static function checkEmail(array $req): array
    {
        $email = trim($req['body']['email'] ?? '');

        if (empty($email)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Email wajib diisi'];
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Format email tidak valid'];
        }

        $exists = User::findByEmail($email);
        if (!empty($exists)) {
            http_response_code(409);
            return ['ok' => false, 'error' => 'Email sudah terdaftar'];
        }

        return ['ok' => true];
    }
    
    public static function register(array $req): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $name       = trim($req['body']['full_name'] ?? '');
        $email      = trim($req['body']['email'] ?? '');
        $password   = $req['body']['password'] ?? '';
        $address    = trim($req['body']['address'] ?? '');
        $role       = $req['body']['role'] ?? 'buyer';

        if (empty($name)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Nama lengkap wajib diisi'];
        }

        if (strlen($name) > 200) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Nama terlalu panjang, maksimal 200 karakter'];
        }

        if (empty($email)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Email wajib diisi'];
        }

        if (!self::isValidEmail($email)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Format email tidak valid'];
        }

        $exists = User::findByEmail($email);
        if (!empty($exists)) {
            http_response_code(409);
            return ['ok' => false, 'error' => 'Email sudah terdaftar'];
        }

        if (empty($password)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Password wajib diisi'];
        }

        if (!self::isValidPassword($password)) {
            $errors = self::getPasswordErrors($password);
            http_response_code(400);
            return ['ok' => false, 'error' => 'Password tidak memenuhi kriteria: ' . implode(', ', $errors)];
        }

        if (empty($address)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Alamat wajib diisi'];
        }

        if (!in_array($role, ['buyer', 'seller'], true)) {
            http_response_code(400);
            return ['ok' => false, 'error' => 'Role tidak valid'];
        }
        
        $user = User::create($name, $email, $password, $address, $role);

        if (empty($user)) {
            http_response_code(500);
            return [
                'ok' => false,
                'error' => 'Terjadi kesalahan saat membuat akun'
            ];
        }
        
        if ($role === 'seller') {
            $store_name  = trim($req['body']['store_name'] ?? '');
            $description = trim($req['body']['store_description'] ?? '');

            if (empty($store_name)) {
                http_response_code(400);
                return ['ok' => false, 'error' => 'Nama toko wajib diisi'];
            }

            if (strlen($store_name) > 100) {
                http_response_code(400);
                return ['ok' => false, 'error' => 'Nama toko terlalu panjang, maksimal 100 karakter'];
            }

            if (empty($description)) {
                http_response_code(400);
                return ['ok' => false, 'error' => 'Deskripsi toko wajib diisi'];
            }

            $plainText = strip_tags($description);
            if (strlen($plainText) > 1000) {
                http_response_code(400);
                return ['ok' => false, 'error' => 'Deskripsi toko terlalu panjang, maksimal 1000 karakter'];
            }

            $imagePath = null;
            if (isset($_FILES['store_logo']) && $_FILES['store_logo']['error'] === UPLOAD_ERR_OK) {
                $uploadResult = self::handleImageUpload($_FILES['store_logo']);
                if (!$uploadResult['ok']) {
                    http_response_code(400);
                    return $uploadResult;
                }
                $imagePath = $uploadResult['path'];
            } else {
                http_response_code(400);
                return ['ok' => false, 'error' => 'Logo toko wajib diunggah'];
            }
            
            try {
                $store = Store::create($user['user_id'], $store_name, $description, $imagePath);
                $_SESSION['user'] = $user;
                return [
                    'ok' => true,
                    'user' => $user,
                    'store' => $store
                ];
            } catch (\Exception $e) {
                if ($imagePath && file_exists(__DIR__ . '/../../../public' . $imagePath)) {
                    unlink(__DIR__ . '/../../../public' . $imagePath);
                }

                error_log('Store creation failed: ' . $e->getMessage());
                http_response_code(500);
                return ['ok' => false, 'error' => 'Gagal membuat toko, silakan coba lagi'];
            }
        }
        
        $_SESSION['user'] = $user;
        
        return [
            'ok' => true,
            'user' => $user
        ];
    }
    
    private static function handleImageUpload(array $file): array
    {
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            error_log("Upload failed: No file uploaded or invalid upload");
            return ['ok' => false, 'error' => 'File tidak dapat diunggah'];
        }

        error_log("File uploaded: " . $file['name'] . " (" . $file['size'] . " bytes)");

        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        error_log("MIME type detected: $mimeType");

        if (!in_array($mimeType, $allowedTypes)) {
            error_log("Invalid MIME type: $mimeType");
            return ['ok' => false, 'error' => 'Format file tidak valid. Hanya JPG, PNG, dan WEBP yang diperbolehkan'];
        }

        $maxSize = 2 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            error_log("File too large: " . $file['size'] . " bytes (max: $maxSize bytes)");
            return ['ok' => false, 'error' => 'Ukuran file terlalu besar. Maksimal 2MB'];
        }

        $uploadDir = __DIR__ . '/../../../public/uploads/logo/';
        if (!is_dir($uploadDir)) {
            error_log("Creating upload directory: $uploadDir");
            if (!mkdir($uploadDir, 0755, true)) {
                error_log("Failed to create upload directory: $uploadDir");
                return ['ok' => false, 'error' => 'Gagal membuat direktori upload'];
            }
        }

        if (!is_writable($uploadDir)) {
            error_log("Upload directory not writable: $uploadDir");
            return ['ok' => false, 'error' => 'Direktori upload tidak dapat ditulis'];
        }

        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        if (!$extension) {
            // Fallback to MIME type
            $extension = match($mimeType) {
                'image/jpeg', 'image/jpg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => 'jpg'
            };
        }
        
        $filename = uniqid('logg', true) . '.' . $extension;
        $filepath = $uploadDir . $filename;

        error_log("Attempting to save to: $filepath");

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            error_log("Failed to move uploaded file from " . $file['tmp_name'] . " to $filepath");
            return ['ok' => false, 'error' => 'Gagal mengunggah file'];
        }

        error_log("File uploaded successfully: $filepath");

        $finalSize = filesize($filepath);
        error_log("Final file size: " . ($finalSize / 1024) . " KB");

        return [
            'ok' => true,
            'path' => '/uploads/logo/' . $filename
        ];
    }

    private static function isValidEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    private static function isValidPassword(string $password): bool
    {
        if (strlen($password) < 8) return false;
        if (!preg_match('/[A-Z]/', $password)) return false;
        if (!preg_match('/[a-z]/', $password)) return false;
        if (!preg_match('/[0-9]/', $password)) return false;
        if (!preg_match('/[^A-Za-z0-9]/', $password)) return false;
        return true;
    }

    private static function getPasswordErrors(string $password): array
    {
        $errors = [];
        if (strlen($password) < 8) {
            $errors[] = 'minimal 8 karakter';
        }
        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'harus ada huruf besar';
        }
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = 'harus ada huruf kecil';
        }
        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = 'harus ada angka';
        }
        if (!preg_match('/[^A-Za-z0-9]/', $password)) {
            $errors[] = 'harus ada simbol';
        }
        return $errors;
    }
}
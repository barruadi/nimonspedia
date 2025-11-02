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
    
    public static function register(array $req): array
    {   
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $name       = $req['body']['full_name'] ?? '';
        $email      = $req['body']['email'] ?? '';
        $password   = $req['body']['password'] ?? '';
        $role       = $req['body']['role'] ?? 'buyer';
        
        
        $user = User::create($name, $email, $password, $role);
        
        if ($user === null) {
            return [
                'ok' => false
            ];
        }
        
        if ($role === 'seller') {
            $store_name  = $req['body']['store_name'] ?? '' ;
            $description = $req['body']['store_description'] ?? '' ;
            $logo_path   = $req['body']['logo_path'] ?? '' ;
            
            // Handle file upload
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
                return ['ok' => false, 'error' => 'Logo image required'];
            }
            
            try {
                
                $store = Store::create($user['user_id'], $store_name, $description, $imagePath);
                return [
                    'ok' => true,
                    'user' => $user,
                    'store' => $store
                ];
            } catch ( \Exception $e) {
                // Clean up uploaded file if DB insert fails
                if ($imagePath && file_exists(__DIR__ . '/../../../public' . $imagePath)) {
                    unlink(__DIR__ . '/../../../public' . $imagePath);
                }
                
                http_response_code(500);
                return ['ok' => false, 'error' => 'Database error: ' . $e->getMessage()];
            }
        }
        
        // auto login
        $_SESSION['user']      = $user;
        
        return [
            'ok' => true,
            'user' => $user
        ];
    }
    
    private static function handleImageUpload(array $file): array
    {
        // Check if file was uploaded
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            error_log("❌ Upload failed: No file uploaded or invalid upload");
            return ['ok' => false, 'error' => 'No file uploaded'];
        }

        error_log("File uploaded: " . $file['name'] . " (" . $file['size'] . " bytes)");

        // Validate file type using MIME
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        error_log("MIME type detected: $mimeType");
        
        if (!in_array($mimeType, $allowedTypes)) {
            error_log("Invalid MIME type: $mimeType");
            return ['ok' => false, 'error' => 'Invalid file type. Only JPG, PNG, WEBP allowed'];
        }

        // Validate file size (max 2MB)
        $maxSize = 2 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            error_log("File too large: " . $file['size'] . " bytes (max: $maxSize bytes)");
            return ['ok' => false, 'error' => 'File size must be less than 2MB'];
        }

        // Create upload directory
        $uploadDir = __DIR__ . '/../../../public/uploads/logo/';
        if (!is_dir($uploadDir)) {
            error_log("Creating upload directory: $uploadDir");
            if (!mkdir($uploadDir, 0755, true)) {
                error_log("Failed to create upload directory: $uploadDir");
                return ['ok' => false, 'error' => 'Failed to create upload directory'];
            }
        }

        // Check if directory is writable
        if (!is_writable($uploadDir)) {
            error_log("Upload directory not writable: $uploadDir");
            return ['ok' => false, 'error' => 'Upload directory not writable'];
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

        // Move uploaded file (DIRECT UPLOAD - NO OPTIMIZATION)
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            error_log("Failed to move uploaded file from " . $file['tmp_name'] . " to $filepath");
            return ['ok' => false, 'error' => 'Failed to upload file'];
        }

        error_log("File uploaded successfully: $filepath");

        // OPTIMIZATION DISABLED FOR TESTING
        // Uncomment below to enable image optimization
        /*
        try {
            self::optimizeImage($filepath, $mimeType);
            error_log("Image optimized successfully");
        } catch (\Exception $e) {
            // Log warning but DON'T delete file - continue with original
            error_log("Image optimization failed (using original): " . $e->getMessage());
        }
        */

        $finalSize = filesize($filepath);
        error_log("Final file size: " . ($finalSize / 1024) . " KB");

        return [
            'ok' => true,
            'path' => '/uploads/logo/' . $filename
        ];
    }
}
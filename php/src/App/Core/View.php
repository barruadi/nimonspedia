<?php

namespace App\Core;

class View {
    public static function render(string $viewPath, array $data = []): void {
        $fullPath = VIEW_PATH . $viewPath;
        if (!is_file($fullPath)) {
            throw new \RuntimeException("View not found: $fullPath");
        }
        extract($data);
        include $fullPath;
    }
}

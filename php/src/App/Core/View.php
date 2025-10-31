<?php

namespace App\Core;

class View {
    public static function render(string $viewPath, array $data = []): void {
        $fullPath = VIEW_PATH . $viewPath;
        $layoutPath = VIEW_PATH . "layout.php";
        
        if (!is_file($fullPath)) {
            throw new \RuntimeException("View not found: $fullPath");
        }
        extract($data);
        
        ob_start();
        include $fullPath;
        
        $content = ob_get_clean();
        include $layoutPath;
    }
}

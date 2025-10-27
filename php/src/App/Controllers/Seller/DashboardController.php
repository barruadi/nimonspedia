<?php

namespace App\Controllers\Seller;

class DashboardController
{
    // Renders the seller dashboard page
    public static function showDashboard(): array
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        return [
            'ok' => true
        ];
    }
}
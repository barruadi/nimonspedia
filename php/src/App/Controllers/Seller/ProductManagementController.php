<?php

namespace App\Controllers\Seller;

class ProductManagementController
{
    // Renders the add product form for sellers
    public static function showAddProductForm(): array
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        return [
            'ok' => true
        ];
    }
    
    // Handles the submission of the add product form
    public static function handleAddProductForm(): array
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        return [
            'ok' => true
        ];
    }
    
    // Renders the edit product form for sellers
    public static function showEditProductForm(): array
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        return [
            'ok' => true
        ];
    }

    // Handles the submission of the edit product form
    public static function handleEditProductForm(): array
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        return [
            'ok' => true
        ];
    }
}
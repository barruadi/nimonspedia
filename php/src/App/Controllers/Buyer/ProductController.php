<?php

namespace App\Controllers\Buyer;

use App\Models\Product;
use App\Models\Store;

class ProductController
{
    public function getProductDetail($productId)
    {
        $product = Product::findDetailById((int)$productId);
        if (!$product) {
            http_response_code(404);
            return ['ok' => false, 'error' => 'Produk tidak ditemukan'];
        }

        $store = Store::findById($product['store_id']);
        
        http_response_code(200);
        return [
            'ok' => true,
            'data' => [
                'product' => $product,
                'store'   => $store ?? null
            ]
        ];
    }
}
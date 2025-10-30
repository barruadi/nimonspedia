<?php

namespace App\Controllers\Buyer;

use App\Core\View;

class CheckoutController
{
    public function showCheckout(): void
    {


        View::render('CheckoutView.php', [
            'test' => 1
        ]);

        return;
    }
}
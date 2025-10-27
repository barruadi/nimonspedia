<?php

namespace App\Controllers\Auth;

class LogoutController
{
    public static function logout(array $req): array
    {
        return [
            'ok' => true
        ];
    }
}
<?php

namespace App\Controllers\Auth;

class LogoutController
{
    public static function logout(): array
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // wipe session
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 3600,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();

        return [
            'ok' => true,
            'message' => 'Logged out'
        ];
    }
}
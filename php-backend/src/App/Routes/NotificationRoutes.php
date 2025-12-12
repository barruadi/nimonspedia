<?php

use App\Controllers\NotificationController;
use App\Middlewares\AuthMiddleware;

$router->get('/api/notifications/preferences', fn($req) => (new NotificationController())->getPreferences($req), [AuthMiddleware::requireAuth()]);
$router->post('/api/notifications/preferences', fn($req) => (new NotificationController())->updatePreference($req), [AuthMiddleware::requireAuth()]);

$router->post('/api/notifications/subscribe', fn($req) => (new NotificationController())->subscribe($req), [AuthMiddleware::requireAuth()]);
$router->post('/api/notifications/unsubscribe', fn($req) => (new NotificationController())->unsubscribe($req), [AuthMiddleware::requireAuth()]);

$router->get('/api/notifications/vapid-public-key', fn($req) => (new NotificationController())->getVapidPublicKey($req));

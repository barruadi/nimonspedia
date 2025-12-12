<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('log_errors', '1');
ini_set('error_log', '/tmp/php_errors.log');

define('VIEW_PATH', dirname(__DIR__) . '/App/Views/');

spl_autoload_register(function ($class) {
    $prefix  = 'App\\';
    $baseDir = dirname(__DIR__) . '/app/';
    
    if (strncmp($prefix, $class, strlen($prefix)) !== 0) return;
    
    $relative = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\','/',$relative) . '.php';
    
    if (is_file($file)) {
        require $file;
    } else {
        throw new RuntimeException("[ AUTOLOADER ]: Failed for {$class} at {$file}");
    }
});
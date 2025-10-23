<?php

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
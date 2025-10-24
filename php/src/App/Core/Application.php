<?php

namespace App\Core;
use App\Core\Router;

class Application
{
    public Router $router;
    
    public function __construct()
    {
        $this->router = new Router();
    }
    
    public function request(): array {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        
        if ($method === 'POST' && isset($_POST['_method'])) {
            $method = strtoupper($_POST['_method']);
        }
        
        return [
            'method'    => $method,
            'path'      => $path,
            'query'     => $_GET,
            'post'      => $_POST,
            'files'     => $_FILES,
            'cookies'   => $_COOKIE,
            'session'   =>&$_SESSION
        ];
    }
    
    public function run(): void
    {
        // Build request (works for GET/POST/etc.)
        $method  = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path    = strtok($_SERVER['REQUEST_URI'] ?? '/', '?') ?: '/';
        $headers = function_exists('getallheaders') ? getallheaders() : [];

        $rawBody = file_get_contents('php://input') ?: '';
        $ctype   = $_SERVER['CONTENT_TYPE'] ?? '';
        $isJson  = stripos($ctype, 'application/json') !== false;  // catches "; charset=UTF-8"

        $body = $isJson
            ? (json_decode($rawBody, true) ?? [])
            : ($_POST ?: []);   // also covers multipart/form-data

        $request = [
            'method'  => $method,
            'path'    => $path,
            'query'   => $_GET,
            'body'    => $body,
            'headers' => $headers,
            'session' => &$_SESSION,
        ];
        
        $response = $this->router->dispatch($this->request());
        // $this->emit($response);
    
        if ($response === null) return;

        if (is_array($response) || is_object($response)) {
            if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
            echo json_encode($response, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
            return;
        }

        if (is_string($response)) {
            if (!headers_sent()) header('Content-Type: text/html; charset=utf-8');
            echo $response;
            return;
        }

        if (!headers_sent()) header('Content-Type: text/plain; charset=utf-8');
        echo (string)$response;
    }
    
    private function emit($response): void 
    {
        if (is_callable($response)) $response = $response();
        if (is_array($response)) 
        {
            if (isset($response['redirect'])) { header('Location: '.$response['redirect']); return; }
            header('Content-Type: application/json; charset=utf-8'); echo json_encode($response); return;
        }
        if (is_string($response)) { echo $response; return; }
    }
}
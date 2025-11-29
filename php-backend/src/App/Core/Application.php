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
        $method  = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path    = strtok($_SERVER['REQUEST_URI'] ?? '/', '?') ?: '/';
        $headers = function_exists('getallheaders') ? getallheaders() : [];

        $rawBody = file_get_contents('php://input') ?: '';
        $ctype   = $_SERVER['CONTENT_TYPE'] ?? '';
        $isJson  = stripos($ctype, 'application/json') !== false;

        $body = $isJson
            ? (json_decode($rawBody, true) ?? [])
            : ($_POST ?: []);

        return [
            'method'  => $method,
            'path'    => $path,
            'query'   => $_GET,
            'body'    => $body,
            'headers' => $headers,
            'session' => &$_SESSION,
        ];
    }
    
public function run(): void
    {   
        $request = $this->request();
        $response = $this->router->dispatch($request);
        
        if ($response === 'Not Found') {
            $path = $request['path'] ?? '/';
            
            $isApiRequest = str_starts_with($path, '/api/') || 
                            str_starts_with($path, '/secret/api/');
            
            if (!$isApiRequest) {
                $extension = pathinfo($path, PATHINFO_EXTENSION);
                
                if (empty($extension)) {
                    $spa_index = __DIR__ . '/../../public/index.html';
                    
                    if (file_exists($spa_index)) {
                        http_response_code(200); 
                        $this->emit(file_get_contents($spa_index));
                        return; 
                    }
                }
            }
        }
    
        $this->emit($response);
    }

    private function emit($response): void 
    {
        if ($response === null) return;
        
        if (is_callable($response)) $response = $response();

        if (is_array($response) || is_object($response)) {
            if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
            if (isset($response['redirect'])) {
                header('Location: '.$response['redirect']); 
                return;
            }
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
}
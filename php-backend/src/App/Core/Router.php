<?php

namespace App\Core;

class Router
{
    private array $routes = [];
    private $notFoundHandler = null;
    private $errorHandler = null;

    public function get(string $path, callable $callback, array $mw = []): self
    {
        return $this->map('GET', $path, $callback, $mw);
    }
    
    public function post(string $path, callable $callback, array $mw = []): self
    {
        return $this->map('POST', $path, $callback, $mw);
    }
    
    public function patch(string $path, callable $callback, array $mw = []): self
    {
        return $this->map('PATCH', $path, $callback, $mw);
    }
    
    public function put(string $path, callable $callback, array $mw = []): self
    {
        return $this->map('PUT', $path, $callback, $mw);
    }
    
    public function delete(string $path, callable $callback, array $mw = []): self
    {
        return $this->map('DELETE', $path, $callback, $mw);
    }
    
    public function group(array $opts, callable $callback): void 
    {
        $prefix = rtrim($opts['prefix'] ?? '', '/');
        $baseMW = $opts['middlewares'] ?? [];

        $proxy = new class($this, $prefix, $baseMW) {
            public function __construct(private Router $r, private string $p, private array $m) {}
            public function get(string $path, callable $h, array $mw = []): void 
            {
                $this->r->get($this->p . ($path ?: ''), $h, array_merge($this->m, $mw));
            }
            
            public function post(string $path, callable $h, array $mw = []): void 
            {
                $this->r->post($this->p . ($path ?: ''), $h, array_merge($this->m, $mw));
            }
            
            public function patch(string $path, callable $h, array $mw = []): void 
            {
                $this->r->patch($this->p . ($path ?: ''), $h, array_merge($this->m, $mw));
            }
            
            public function put(string $path, callable $h, array $mw = []): void 
            {
                $this->r->put($this->p . ($path ?: ''), $h, array_merge($this->m, $mw));
            }
            
            public function delete(string $path, callable $h, array $mw = []): void 
            {
                $this->r->delete($this->p . ($path ?: ''), $h, array_merge($this->m, $mw));
            }
            
            public function map(string $method, string $path, callable $h, array $mw = []): void 
            {
                $this->r->map($method, $this->p . ($path ?: ''), $h, array_merge($this->m, $mw));
            }
        };

        $callback($proxy);
    }
    
    public function map(string $method, string $path, callable $handler, array $middlewares): self 
    {
        [$regex, $paramNames] = $this->compile($path);
        $this->routes[strtoupper($method)][] = [
            'pattern'     => $regex,
            'params'      => $paramNames,
            'handler'     => $handler,
            'middlewares' => $middlewares,
        ];
        return $this;
    }
    
    private function compile(string $path): array 
    {
        $paramNames = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', function ($m) use (&$paramNames) 
        {
            $paramNames[] = $m[1]; return '([^/]+)';
        }, $path);
        $regex = '#^' . ($regex === '' ? '/' : $regex) . '/?$#';
        return [$regex, $paramNames];
    }
    
    // Helper function to parse multipart/form-data for PUT/PATCH
    private function parseFormData(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        
        // Only parse if it's multipart/form-data
        if (strpos($contentType, 'multipart/form-data') === false) {
            return ['body' => [], 'files' => []];
        }
        
        // Get boundary
        preg_match('/boundary=(.*)$/', $contentType, $matches);
        if (!isset($matches[1])) {
            return ['body' => [], 'files' => []];
        }
        
        $boundary = $matches[1];
        $rawData = file_get_contents('php://input');
        
        // Split by boundary
        $parts = array_slice(explode("--$boundary", $rawData), 1, -1);
        
        $body = [];
        $files = [];
        
        foreach ($parts as $part) {
            // Skip empty parts
            if (trim($part) === '') continue;
            
            // Split headers and content
            list($rawHeaders, $content) = explode("\r\n\r\n", $part, 2);
            
            // Remove trailing \r\n
            $content = substr($content, 0, -2);
            
            // Parse headers
            $headers = [];
            foreach (explode("\r\n", $rawHeaders) as $header) {
                if (strpos($header, ':') !== false) {
                    list($key, $value) = explode(':', $header, 2);
                    $headers[strtolower(trim($key))] = trim($value);
                }
            }
            
            // Get Content-Disposition
            $disposition = $headers['content-disposition'] ?? '';
            
            // Extract name
            if (preg_match('/name="([^"]+)"/', $disposition, $nameMatch)) {
                $name = $nameMatch[1];
                
                // Check if it's a file
                if (preg_match('/filename="([^"]*)"/', $disposition, $fileMatch)) {
                    $filename = $fileMatch[1];
                    
                    // Save file to tmp
                    $tmpName = tempnam(sys_get_temp_dir(), 'php_upload_');
                    file_put_contents($tmpName, $content);
                    
                    $files[$name] = [
                        'name' => $filename,
                        'type' => $headers['content-type'] ?? 'application/octet-stream',
                        'tmp_name' => $tmpName,
                        'error' => UPLOAD_ERR_OK,
                        'size' => strlen($content)
                    ];
                } else {
                    // Regular field
                    $body[$name] = $content;
                }
            }
        }
        
        return ['body' => $body, 'files' => $files];
    }
    
    public function dispatch(array $request) {
        $method = strtoupper($request['method'] ?? 'GET');
        $path   = $request['path'] ?? '/';

        // ADDED: Parse FormData for PUT/PATCH requests
        if (($method === 'PUT' || $method === 'PATCH') && 
            strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false) {
            
            $parsed = $this->parseFormData();
            
            // Merge parsed data into request
            $request['body'] = array_merge($request['body'] ?? [], $parsed['body']);
            
            // Populate global $_FILES for compatibility
            foreach ($parsed['files'] as $name => $file) {
                $_FILES[$name] = $file;
            }
        }

        foreach ($this->routes[$method] ?? [] as $route) {
            if (preg_match($route['pattern'], $path, $m)) {
                array_shift($m);
                $named = [];
                foreach ($route['params'] as $i => $name) $named[$name] = $m[$i] ?? null;

                $next = function ($req) use ($route, $named) {
                    return ($route['handler'])($req, ...array_values($named));
                };
                
                // middlewares checks
                foreach (array_reverse($route['middlewares'] ?? []) as $mw) {
                    $prev = $next;
                    $next = function ($req) use ($mw, $prev) { return $mw($req, $prev); };
                }

                try { 
                    $result = $next($request);
                    return $result;
                }
                catch (\Throwable $e) {
                    error_log("[Router] Exception caught: " . $e->getMessage());
                    error_log("[Router] Trace: " . $e->getTraceAsString());
                    if ($this->errorHandler) return ($this->errorHandler)($e, $request);
                    http_response_code(500); 
                    header('Content-Type: application/json');
                    return json_encode(['ok' => false, 'error' => 'Internal Server Error', 'message' => $e->getMessage()]);
                }
            }
        }
        
        if ($this->notFoundHandler) return ($this->notFoundHandler)($request);
        http_response_code(404); return 'Not Found';
    }
    
    public function setNotFoundHandler(callable $handler): self
    {
        $this->notFoundHandler = $handler;
        return $this;
    }

    public function setErrorHandler(callable $handler): self
    {
        $this->errorHandler = $handler;
        return $this;
    }
}
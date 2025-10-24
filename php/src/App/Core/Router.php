<?php

namespace App\Core;

class Router
{
    private array $routes = [];

    public function get(string $path, callable $callback, array $mw = []): self
    {
        return $this->map('GET', $path, $callback, $mw);
    }
    
    public function post(string $path, callable $callback, array $mw = []): self
    {
        return $this->map('POST', $path, $callback, $mw);
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
    
    public function dispatch(array $request) {
        $method = strtoupper($request['method'] ?? 'GET');
        $path   = $request['path'] ?? '/';

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

                try { return $next($request); }
                catch (\Throwable $e) {
                    // if ($this->errorHandler) return ($this->errorHandler)($e, $request);
                    http_response_code(500); return 'Internal Server Error';
                }
            }
        }
        // if ($this->notFoundHandler) return ($this->notFoundHandler)($request);
        http_response_code(404); return 'Not Found';
    }
}
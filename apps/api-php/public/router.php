<?php
// Router for PHP's development server. Production serves public/ through Apache.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if ($path !== '/' && is_file(__DIR__.$path)) return false;
if (!str_starts_with($path,'/api') && $path !== '/health') {
    $index=__DIR__.'/index.html';
    if(is_file($index)) { header('Content-Type: text/html; charset=utf-8'); readfile($index); return true; }
}
require __DIR__.'/index.php';

<?php
namespace App\Filters;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Services;
class CorsFilter implements FilterInterface {
    private function allowed(RequestInterface $request): bool {
        $origin=$request->getHeaderLine('Origin');
        if ($origin === '') return true;
        $allowed=array_filter(array_map('trim',explode(',',(string)env('CORS_ORIGIN',''))));
        $base=parse_url(config('App')->baseURL);
        $same=($base['scheme']??'http').'://'.($base['host']??'localhost').(isset($base['port']) ? ':'.$base['port'] : '');
        return in_array($origin,[$same,...$allowed],true);
    }
    public function before(RequestInterface $request,$arguments=null) {
        if (!$this->allowed($request)) return Services::response()->setStatusCode(403)->setJSON(['error'=>'FORBIDDEN_ORIGIN']);
        if (strtoupper($request->getMethod()) === 'OPTIONS') return Services::response()->setStatusCode(204);
        if (!in_array(strtoupper($request->getMethod()),['GET','HEAD'],true) && str_contains($request->getHeaderLine('Content-Type'),'application/x-www-form-urlencoded')) return Services::response()->setStatusCode(415)->setJSON(['error'=>'JSON_REQUIRED']);
        return null;
    }
    public function after(RequestInterface $request,ResponseInterface $response,$arguments=null) {
        if ($this->allowed($request) && $request->getHeaderLine('Origin') !== '') $response->setHeader('Access-Control-Allow-Origin',$request->getHeaderLine('Origin'))->setHeader('Vary','Origin')->setHeader('Access-Control-Allow-Credentials','true')->setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS')->setHeader('Access-Control-Allow-Headers','Content-Type');
        $response->setHeader('Cache-Control','no-store')->setHeader('X-Content-Type-Options','nosniff');
    }
}

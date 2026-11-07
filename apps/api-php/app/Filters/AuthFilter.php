<?php
namespace App\Filters;
use App\Libraries\AuthContext;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Services;
class AuthFilter implements FilterInterface
{
    public function before(RequestInterface $request,$arguments=null) {
        AuthContext::$user=null;
        AuthContext::$user=(new \App\Models\AuthRepository())->sessionUser($request->getCookie('pulso_session'));
        if (!AuthContext::$user) return Services::response()->setStatusCode(401)->setJSON(['error'=>'UNAUTHENTICATED']);
        return null;
    }
    public function after(RequestInterface $request,ResponseInterface $response,$arguments=null) {}
}

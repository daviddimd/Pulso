<?php
namespace App\Filters;
use App\Libraries\AuthContext;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Services;
class AdminFilter implements FilterInterface {
    public function before(RequestInterface $request,$arguments=null) {
        if ((AuthContext::$user['role'] ?? '') !== 'ADMIN') return Services::response()->setStatusCode(403)->setJSON(['error'=>'FORBIDDEN']);
        return null;
    }
    public function after(RequestInterface $request,ResponseInterface $response,$arguments=null) {}
}

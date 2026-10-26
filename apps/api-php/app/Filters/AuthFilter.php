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
        $cookie=$request->getCookie('pulso_session');
        if (!$cookie) return Services::response()->setStatusCode(401)->setJSON(['error'=>'UNAUTHENTICATED']);
        $db=\Config\Database::connect();
        $row=$db->table('sessions s')->select('u.*, e.name as establishment_name, e.timezone as establishment_timezone')->join('users u','u.id=s.user_id')->join('establishments e','e.id=u.establishment_id')
            ->where('s.token_hash',hash('sha256',(string)$cookie))->where('s.expires_at >',gmdate('Y-m-d H:i:s'))->where('s.revoked_at',null)->where('u.active',1)->where('e.active',1)->get()->getRowArray();
        if (!$row) return Services::response()->setStatusCode(401)->setJSON(['error'=>'UNAUTHENTICATED']);
        AuthContext::$user=['id'=>$row['id'],'username'=>$row['username'],'fullName'=>$row['full_name'],'role'=>$row['role'],'establishmentId'=>$row['establishment_id'],'establishmentName'=>$row['establishment_name'],'establishmentTimezone'=>$row['establishment_timezone']];
        return null;
    }
    public function after(RequestInterface $request,ResponseInterface $response,$arguments=null) {}
}

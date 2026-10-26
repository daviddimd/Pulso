<?php
namespace App\Controllers;
use App\Libraries\AuthContext;
use CodeIgniter\HTTP\ResponseInterface;
abstract class BaseApiController extends BaseController
{
    protected function jsonResponse(array $data,int $status=200): ResponseInterface { return $this->response->setStatusCode($status)->setJSON($data); }
    protected function errorResponse(string $error,int $status,?string $message=null): ResponseInterface { return $this->jsonResponse(['error'=>$error]+($message ? ['message'=>$message] : []),$status); }
    protected function getAuthUser(): array { return AuthContext::$user ?? []; }
    protected function getEstablishmentId(): string { return $this->getAuthUser()['establishmentId']; }
    protected function getClientIp(): string { return $this->request->getIPAddress(); }
    protected function getRequestBody(): array {
        $data=json_decode((string)$this->request->getBody(),true);
        if (!is_array($data)) throw new \DomainException('INVALID_SERVICE_DATA',400);
        return $data;
    }
    protected function attempt(callable $work): ResponseInterface {
        try { return $work(); }
        catch (\DomainException $e) { return $this->errorResponse($e->getMessage(),$e->getCode() ?: 400); }
        catch (\Throwable $e) {
            log_message('error','{exception}',['exception'=>$e]);
            if (str_contains($e->getMessage(),'Duplicate entry') || str_contains($e->getMessage(),'Deadlock')) return $this->errorResponse('SERVICE_CONFLICT',409);
            return $this->errorResponse('INTERNAL_ERROR',500);
        }
    }
}

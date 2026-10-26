<?php
namespace App\Controllers;
use App\Libraries\{ClaveUnicaClient, SecurityLib};
use App\Models\AuthRepository;
use Config\Services;

class AuthController extends BaseApiController
{
    private function setSessionCookie(array $session): void {
        $this->response->setCookie('pulso_session',$session['token'],$session['ttl'],'','/','',ENVIRONMENT==='production',true,'Strict');
    }
    public function options() { return $this->jsonResponse(['claveUnicaEnabled'=>ClaveUnicaClient::configured()]); }
    public function login() {
        return $this->attempt(function () {
            $b=$this->getRequestBody();
            if (!is_string($b['username']??null) || !is_string($b['password']??null) || trim($b['username'])==='' || strlen($b['username'])>50 || $b['password']==='' || strlen($b['password'])>1024) return $this->errorResponse('INVALID_CREDENTIALS',400);
            $session=(new AuthRepository())->login(trim($b['username']),$b['password'],$this->getClientIp());
            if (isset($session['error'])) return $this->errorResponse($session['error'],$session['status']);
            $this->setSessionCookie($session);
            return $this->jsonResponse(['user'=>$session['user']]);
        });
    }
    public function me() {
        $user=(new AuthRepository())->current($this->getAuthUser()['id']);
        return $user ? $this->jsonResponse(['user'=>$user]) : $this->errorResponse('ACCOUNT_DISABLED',403);
    }
    public function logout() {
        return $this->attempt(function () {
            $cookie=$this->request->getCookie('pulso_session');
            if (is_string($cookie)) (new AuthRepository())->logout($cookie,$this->getAuthUser()['id']??null,$this->getClientIp());
            $this->response->deleteCookie('pulso_session','','/','');
            Services::session()->remove(['clave_unica_state','clave_unica_expires']);
            return $this->jsonResponse(['ok'=>true]);
        });
    }
    public function claveUnicaRedirect() {
        if (!ClaveUnicaClient::configured()) return $this->errorResponse('CLAVE_UNICA_UNAVAILABLE',503);
        return $this->attempt(function () {
            $state=SecurityLib::generateSessionToken();
            Services::session()->regenerate(true);
            Services::session()->set(['clave_unica_state'=>$state,'clave_unica_expires'=>time()+600]);
            return $this->jsonResponse(['url'=>(new ClaveUnicaClient())->getAuthorizationUrl($state)]);
        });
    }
    public function claveUnicaCallback() {
        $code=$this->request->getGet('code'); $state=$this->request->getGet('state');
        $session=Services::session();
        $saved=$session->get('clave_unica_state'); $expires=$session->get('clave_unica_expires');
        $session->remove(['clave_unica_state','clave_unica_expires']);
        if (!is_string($code) || $code==='' || !is_string($state) || !is_string($saved) || !hash_equals($saved,$state) || (int)$expires<time()) return $this->errorResponse('INVALID_OAUTH_STATE',400);
        return $this->attempt(function () use ($code,$state) {
            $client=new ClaveUnicaClient();
            $tokens=$client->exchangeCode($code,$state);
            $login=(new AuthRepository())->claveUnica($client->getUserInfo($tokens['access_token']),$this->getClientIp());
            $this->setSessionCookie($login);
            Services::session()->regenerate(true);
            // Keep the cookie on the same response that carries the redirect.
            return $this->response->setStatusCode(303)->setHeader('Location',getenv('FRONTEND_URL') ?: base_url());
        });
    }
}

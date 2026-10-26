<?php
namespace App\Libraries;
use Config\Services;
use DomainException;

final class ClaveUnicaClient
{
    private const BASE='https://accounts.claveunica.gob.cl/openid/';
    private array $credentials;
    public static function configured(): bool {
        return (bool)(getenv('CLAVE_UNICA_CLIENT_ID') && getenv('CLAVE_UNICA_CLIENT_SECRET') && getenv('CLAVE_UNICA_REDIRECT_URI'));
    }
    public function __construct(?array $credentials=null, private ?\Closure $transport=null) {
        $this->credentials=$credentials ?? ['client_id'=>getenv('CLAVE_UNICA_CLIENT_ID'),'client_secret'=>getenv('CLAVE_UNICA_CLIENT_SECRET'),'redirect_uri'=>getenv('CLAVE_UNICA_REDIRECT_URI')];
        foreach (['client_id','client_secret','redirect_uri'] as $key) if (empty($this->credentials[$key])) throw new DomainException('CLAVE_UNICA_UNAVAILABLE',503);
        if (!filter_var($this->credentials['redirect_uri'],FILTER_VALIDATE_URL) || parse_url($this->credentials['redirect_uri'],PHP_URL_SCHEME)!=='https') throw new DomainException('CLAVE_UNICA_CONFIGURATION',503);
    }
    public function getAuthorizationUrl(string $state): string {
        return self::BASE.'authorize/?'.http_build_query(['client_id'=>$this->credentials['client_id'],'response_type'=>'code','scope'=>'openid run name','redirect_uri'=>$this->credentials['redirect_uri'],'state'=>$state],'','&',PHP_QUERY_RFC3986);
    }
    public function exchangeCode(string $code,string $state): array {
        $data=$this->post('token/',['form_params'=>$this->credentials+['grant_type'=>'authorization_code','code'=>$code,'state'=>$state]]);
        if (!is_string($data['access_token']??null) || $data['access_token']==='') throw new DomainException('OAUTH_TOKEN_ERROR',502);
        return $data;
    }
    public function getUserInfo(string $token): array {
        return $this->post('userinfo/',['headers'=>['Authorization'=>'Bearer '.$token]]);
    }
    private function post(string $endpoint,array $options): array {
        $options+=['http_errors'=>false,'timeout'=>15,'connect_timeout'=>5,'allow_redirects'=>false];
        try {
            $response=$this->transport ? ($this->transport)(self::BASE.$endpoint,$options) : Services::curlrequest()->post(self::BASE.$endpoint,$options);
            if ($response->getStatusCode()!==200) throw new \RuntimeException('Provider error');
            $data=json_decode($response->getBody(),true,512,JSON_THROW_ON_ERROR);
            if (!is_array($data)) throw new \RuntimeException('Invalid provider response');
            return $data;
        } catch (\Throwable $e) {
            // Never expose provider bodies, tokens or credentials.
            throw new DomainException('CLAVE_UNICA_UNAVAILABLE',502);
        }
    }
}

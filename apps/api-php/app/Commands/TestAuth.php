<?php
namespace App\Commands;
use CodeIgniter\CLI\BaseCommand;
use App\Libraries\ClaveUnicaClient;
use App\Models\{AuthRepository,EstablishmentRepository};
use Config\Database;

final class TestAuth extends BaseCommand
{
    protected $group='Tests'; protected $name='pulso:test-auth'; protected $description='Comprueba autenticación y alta de instituciones en pulso_test.';
    public function run(array $params) {
        $db=Database::connect();
        if (ENVIRONMENT==='production' || env('PULSO_INTEGRATION')!=='1' || $db->database!=='pulso_test') throw new \RuntimeException('Base de pruebas no autorizada');
        $checks=0;
        $check=function(bool $ok,string $label) use (&$checks) { if (!$ok) throw new \RuntimeException($label); $checks++; };
        $denied=function(callable $work,string $error) use ($check) { try {$work();} catch (\DomainException $e) {$check($e->getMessage()===$error,$error); return;} throw new \RuntimeException('No rechazado: '.$error); };
        $credentials=['client_id'=>'test-client','client_secret'=>'test-secret','redirect_uri'=>'https://pulso.example/api/auth/clave-unica/callback'];
        $calls=[];
        $transport=function($url,$options) use (&$calls) {
            $calls[]=[$url,$options];
            $body=str_ends_with($url,'token/') ? ['access_token'=>'test-token'] : ['sub'=>'subject-1','RolUnico'=>['numero'=>11111111,'DV'=>'1']];
            return new class($body) {
                public function __construct(private array $body) {}
                public function getStatusCode() { return 200; }
                public function getBody() { return json_encode($this->body); }
            };
        };
        $client=new ClaveUnicaClient($credentials,$transport);
        parse_str(parse_url($client->getAuthorizationUrl('state-123'),PHP_URL_QUERY),$query);
        $check($query['scope']==='openid run name' && $query['state']==='state-123','Scope y estado');
        $client->exchangeCode('code-123','state-123');
        $check($calls[0][0]==='https://accounts.claveunica.gob.cl/openid/token/' && $calls[0][1]['form_params']['state']==='state-123','Estado en token');
        $check($calls[0][1]['timeout']===15 && $calls[0][1]['allow_redirects']===false,'Timeout y redirecciones');
        $identity=$client->getUserInfo('test-token');
        $check($calls[1][1]['headers']['Authorization']==='Bearer test-token','Token en backend');
        $bad=new ClaveUnicaClient($credentials,fn()=>new class {function getStatusCode(){return 500;} function getBody(){return 'test-secret';}});
        $denied(fn()=>$bad->exchangeCode('code','state'),'CLAVE_UNICA_UNAVAILABLE');
        $invalid=new ClaveUnicaClient($credentials,fn()=>new class {function getStatusCode(){return 200;} function getBody(){return 'not-json';}});
        $denied(fn()=>$invalid->exchangeCode('code','state'),'CLAVE_UNICA_UNAVAILABLE');
        $missing=new ClaveUnicaClient($credentials,fn()=>new class {function getStatusCode(){return 200;} function getBody(){return '{}';}});
        $denied(fn()=>$missing->exchangeCode('code','state'),'OAUTH_TOKEN_ERROR');
        $denied(fn()=>new ClaveUnicaClient(array_replace($credentials,['redirect_uri'=>'http://pulso.example/callback'])),'CLAVE_UNICA_CONFIGURATION');
        $auth=new AuthRepository();
        $denied(fn()=>$auth->claveUnica($identity,'127.0.0.1'),'USER_NOT_REGISTERED');
        $db->table('users')->where('id','a-driver3')->update(['rut'=>'11111111-1']);
        $login=$auth->claveUnica($identity,'127.0.0.1');
        $check($login['user']['id']==='a-driver3' && !empty($login['token']),'Identidad registrada');
        $check($db->table('users')->where('id','a-driver3')->get()->getRowArray()['clave_unica_sub']==='subject-1','Vinculación persistente');
        $denied(fn()=>$auth->claveUnica(array_replace($identity,['sub'=>'other']),'127.0.0.1'),'USER_NOT_REGISTERED');
        $db->table('establishments')->where('id','a')->update(['active'=>0]);
        $before=$db->table('sessions')->countAllResults();
        $denied(fn()=>$auth->claveUnica($identity,'127.0.0.1'),'ACCOUNT_DISABLED');
        $check($db->table('sessions')->countAllResults()===$before,'No sesión para institución desactivada');
        $db->table('establishments')->where('id','a')->update(['active'=>1]);
        $provision=new EstablishmentRepository();
        $count=$db->table('establishments')->countAllResults();
        $denied(fn()=>$provision->provision('test-c','Centro C','Invalid/Zone','c-admin','test-password-long'),'INVALID_ESTABLISHMENT');
        $check($db->table('establishments')->countAllResults()===$count,'Alta inválida no deja registros');
        $created=$provision->provision('test-c','Centro C','Pacific/Easter','c-admin','test-password-long');
        $new=$auth->login('c-admin','test-password-long','127.0.0.1');
        $check($new['user']['establishmentId']===$created['establishmentId'] && $new['user']['establishmentTimezone']==='Pacific/Easter','Institución nueva y zona horaria');
        $denied(fn()=>$provision->provision('test-c','Duplicado','UTC','other-admin','test-password-long'),'ESTABLISHMENT_OR_USERNAME_EXISTS');
        $check($db->table('establishments')->countAllResults()===$count+1,'Alta duplicada atómica');
        echo "Autenticación y multiestablecimiento: {$checks} verificaciones correctas.\n";
    }
}

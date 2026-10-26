<?php
namespace App\Models;
use App\Libraries\{SecurityLib, AuditService, UnitOfWork};
use Config\Database;
use DomainException;

final class AuthRepository
{
    private function transaction(callable $work): mixed {
        $db=Database::connect(); $db->transException(true)->transBegin();
        try {
            $result=$work($db);
            if (!$db->transStatus()) throw new \RuntimeException('Authentication transaction failed');
            $db->transCommit(); return $result;
        } catch (\Throwable $e) { $db->transRollback(); throw $e; }
    }
    public function login(string $username,string $password,string $ip): array {
        // Failed attempts must commit before the controller returns an error.
        return $this->transaction(function ($db) use ($username,$password,$ip) {
            $u=$db->query('SELECT * FROM users WHERE username = ? FOR UPDATE',[$username])->getRowArray();
            if (!$u) return ['error'=>'INVALID_CREDENTIALS','status'=>401];
            $e=$this->establishment($u['establishment_id']);
            if (!$u['active'] || !$e) return ['error'=>'ACCOUNT_DISABLED','status'=>403];
            if ($u['locked_until'] && $u['locked_until']>gmdate('Y-m-d H:i:s')) return ['error'=>'ACCOUNT_LOCKED','status'=>423];
            if (!SecurityLib::verifyPassword($password,$u['password_hash'])) {
                $attempts=(int)$u['failed_login_attempts']+1;
                $changes=['failed_login_attempts'=>$attempts];
                if ($attempts>=5) $changes=['failed_login_attempts'=>0,'locked_until'=>gmdate('Y-m-d H:i:s',time()+900)];
                $db->table('users')->where('id',$u['id'])->update($changes);
                AuditService::log($u['id'],'USER',$u['id'],'LOGIN_FAILED',null,['failedAttempts'=>$attempts],$ip);
                return ['error'=>'INVALID_CREDENTIALS','status'=>401];
            }
            $db->table('users')->where('id',$u['id'])->update(['failed_login_attempts'=>0,'locked_until'=>null]);
            return $this->session($u,$e,$ip);
        });
    }
    public function establishment(string $id): ?array {
        return Database::connect()->table('establishments')->where('id',$id)->where('active',1)->get()->getRowArray();
    }
    private function payload(array $u,array $e): array {
        return ['id'=>$u['id'],'username'=>$u['username'],'fullName'=>$u['full_name'],'role'=>$u['role'],'rosterCode'=>$u['roster_code'],
            'establishmentId'=>$e['id'],'establishmentName'=>$e['name'],'establishmentTimezone'=>$e['timezone']];
    }
    public function current(string $id): ?array {
        $u=Database::connect()->table('users')->where('id',$id)->where('active',1)->get()->getRowArray();
        $e=$u ? $this->establishment($u['establishment_id']) : null;
        return $u && $e ? $this->payload($u,$e) : null;
    }
    private function session(array $u,array $e,string $ip): array {
        $token=SecurityLib::generateSessionToken();
        $ttl=max(1,min(24,(int)(getenv('PULSO_SESSION_TTL_HOURS') ?: 12)))*3600;
        $id=SecurityLib::generateUuid();
        Database::connect()->table('sessions')->insert(['id'=>$id,'user_id'=>$u['id'],'token_hash'=>SecurityLib::hashToken($token),
            'expires_at'=>gmdate('Y-m-d H:i:s',time()+$ttl),'created_at'=>UnitOfWork::now(),'last_seen_at'=>UnitOfWork::now()]);
        AuditService::log($u['id'],'USER',$u['id'],'LOGIN_SUCCESS',null,['sessionId'=>$id],$ip);
        return ['token'=>$token,'ttl'=>$ttl,'user'=>$this->payload($u,$e)];
    }
    public function claveUnica(array $identity,string $ip): array {
        $number=$identity['RolUnico']['numero']??null; $dv=$identity['RolUnico']['DV']??null; $sub=$identity['sub']??null;
        if ((!is_int($number) && !is_string($number)) || !is_string($dv) || !is_string($sub) || $sub==='' || strlen($sub)>100) throw new DomainException('OAUTH_USER_ERROR',400);
        $rut=$number.'-'.strtoupper($dv);
        if (!preg_match('/^\d{1,8}-[0-9K]$/',$rut)) throw new DomainException('OAUTH_USER_ERROR',400);
        return $this->transaction(function ($db) use ($rut,$sub,$ip) {
            $u=$db->query('SELECT * FROM users WHERE rut = ? FOR UPDATE',[$rut])->getRowArray();
            if (!$u || ($u['clave_unica_sub'] && !hash_equals($u['clave_unica_sub'],$sub))) throw new DomainException('USER_NOT_REGISTERED',403);
            $e=$this->establishment($u['establishment_id']);
            if (!$u['active'] || !$e) throw new DomainException('ACCOUNT_DISABLED',403);
            $db->table('users')->where('id',$u['id'])->update(['clave_unica_sub'=>$sub,'failed_login_attempts'=>0,'locked_until'=>null]);
            return $this->session($u,$e,$ip);
        });
    }
    public function logout(string $token,?string $userId,string $ip): void {
        Database::connect()->table('sessions')->where('token_hash',SecurityLib::hashToken($token))->update(['revoked_at'=>UnitOfWork::now()]);
        if ($userId) AuditService::log($userId,'USER',$userId,'LOGOUT',null,null,$ip);
    }
}

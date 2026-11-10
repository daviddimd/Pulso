<?php
namespace App\Models;
use App\Libraries\{UnitOfWork,UserAccounts};
use Config\Database;
use DomainException;

final class EstablishmentRepository
{
    /** Provisioning is CLI-only; an institution's administrator cannot create other tenants. */
    public function provision(string $code,string $name,string $timezone,string $username,string $password): array {
        $code=UnitOfWork::text($code,30); $name=UnitOfWork::text($name,200); $username=UnitOfWork::text($username,50);
        if (!preg_match('/^[A-Za-z0-9_-]+$/',$code) || !in_array($timezone,\DateTimeZone::listIdentifiers(),true)) throw new DomainException('INVALID_ESTABLISHMENT',400);
        if (strlen($password)<12 || strlen($password)>1024) throw new DomainException('ADMIN_PASSWORD_TOO_SHORT',400);
        $db=Database::connect(); $db->transException(true)->transBegin();
        try {
            if ($db->table('establecimientos')->where('code',$code)->countAllResults() || $db->table('usuarios')->where('username',$username)->countAllResults()) throw new DomainException('ESTABLISHMENT_OR_USERNAME_EXISTS',409);
            $now=UnitOfWork::now();
            $db->table('establecimientos')->insert(['code'=>$code,'name'=>$name,'timezone'=>$timezone,'active'=>1,'created_at'=>$now,'updated_at'=>$now]);
            $id=(string)$db->insertID();
            $admin=UserAccounts::create($db,['establishment_id'=>$id,'username'=>$username,'full_name'=>mb_substr('Administración · '.$name,0,120),'password_hash'=>password_hash($password,PASSWORD_ARGON2ID),'active'=>1,'created_at'=>$now,'updated_at'=>$now],'ADMIN');
            if (!$db->transStatus()) throw new \RuntimeException('Provisioning failed');
            $db->transCommit(); return ['establishmentId'=>$id,'adminId'=>$admin];
        } catch (\Throwable $e) { $db->transRollback(); throw $e; }
    }
}

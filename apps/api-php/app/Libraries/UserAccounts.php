<?php
namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;

final class UserAccounts
{
    public static function query(BaseConnection $db)
    {
        return $db->table('usuarios u')->select('u.*, f.establishment_id, f.codigo_roster AS roster_code, r.codigo AS role')->join('funcionarios f', 'f.id_funcionario=u.id_funcionario')->join('roles r', 'r.id_rol=u.id_rol');
    }

    /**
     * Console-only reset for a forgotten password: sets the new hash, unlocks the account,
     * revokes its open sessions and records the change in the account's institution.
     */
    public static function resetPassword(BaseConnection $db, string $username, string $password): array
    {
        if (mb_strlen($password) < 12 || strlen($password) > 1024) throw new \DomainException('PASSWORD_TOO_SHORT', 400);
        $user = self::query($db)->where('u.username', $username)->get()->getRowArray();
        if (!$user) throw new \DomainException('USER_NOT_FOUND', 404);
        $now = UnitOfWork::now();
        $db->transException(true)->transBegin();
        try {
            $db->table('usuarios')->where('id_usuario', $user['id_usuario'])->update(['password_hash' => SecurityLib::hashPassword($password),
                'failed_login_attempts' => 0, 'locked_until' => null, 'updated_at' => $now]);
            $db->table('sesiones')->where('user_id', $user['id_usuario'])->where('revoked_at', null)->update(['revoked_at' => $now]);
            AuditService::log((string)$user['establishment_id'], null, 'USER', (string)$user['id_usuario'], 'PASSWORD_RESET_CONSOLE');
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            throw $e;
        }
        return ['username' => $user['username'], 'role' => $user['role'], 'active' => (bool)$user['active']];
    }

    public static function create(BaseConnection $db, array $account, string $role): string
    {
        $roleRow = $db->table('roles')->where('codigo', $role)->get()->getRowArray();
        if (!$roleRow) throw new \RuntimeException('Rol institucional inexistente.');
        $db->table('funcionarios')->insert(['establishment_id'=>$account['establishment_id'], 'nombre'=>$account['full_name'],
            'codigo_roster'=>$account['roster_code'] ?? null]);
        $staffId = $db->insertID();
        unset($account['establishment_id'], $account['roster_code']);
        $db->table('usuarios')->insert($account + ['id_funcionario'=>$staffId, 'id_rol'=>$roleRow['id_rol']]);
        return (string)$db->insertID();
    }
}

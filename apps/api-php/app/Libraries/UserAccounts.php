<?php
namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;

final class UserAccounts
{
    public static function query(BaseConnection $db)
    {
        return $db->table('usuarios u')->select('u.*, f.id_establecimiento, f.codigo_roster, r.codigo AS role')->join('funcionarios f', 'f.id_funcionario=u.id_funcionario')->join('roles r', 'r.id_rol=u.id_rol');
    }

    /**
     * Console-only reset for a forgotten password: sets the new hash, unlocks the account,
     * revokes its open sessions and records the change in the account's institution.
     */
    public static function resetPassword(BaseConnection $db, string $username, string $password): array
    {
        if (mb_strlen($password) < 12 || strlen($password) > 1024) throw new \DomainException('PASSWORD_TOO_SHORT', 400);
        $user = self::query($db)->where('u.nombre_usuario', $username)->get()->getRowArray();
        if (!$user) throw new \DomainException('USER_NOT_FOUND', 404);
        $now = UnitOfWork::now();
        $db->transException(true)->transBegin();
        try {
            $db->table('usuarios')->where('id_usuario', $user['id_usuario'])->update(['hash_contrasena' => SecurityLib::hashPassword($password),
                'intentos_fallidos' => 0, 'bloqueado_hasta' => null, 'fecha_actualizacion' => $now]);
            $db->table('sesiones')->where('id_usuario', $user['id_usuario'])->where('fecha_revocacion', null)->update(['fecha_revocacion' => $now]);
            AuditService::log((string)$user['id_establecimiento'], null, 'USUARIO', (string)$user['id_usuario'], 'RESTABLECER_CONTRASENA');
            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            throw $e;
        }
        return ['username' => $user['nombre_usuario'], 'role' => $user['role'], 'active' => (bool)$user['activo']];
    }

    public static function create(BaseConnection $db, array $account, string $role): string
    {
        $roleRow = $db->table('roles')->where('codigo', Codes::stored(Codes::ROLE, $role))->get()->getRowArray();
        if (!$roleRow) throw new \RuntimeException('Rol institucional inexistente.');
        $db->table('funcionarios')->insert(['id_establecimiento'=>$account['id_establecimiento'], 'nombre'=>$account['nombre_completo'],
            'codigo_roster'=>$account['codigo_roster'] ?? null]);
        $staffId = $db->insertID();
        unset($account['id_establecimiento'], $account['codigo_roster']);
        $db->table('usuarios')->insert($account + ['id_funcionario'=>$staffId, 'id_rol'=>$roleRow['id_rol']]);
        return (string)$db->insertID();
    }
}

<?php
namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;

final class UserAccounts
{
    public static function query(BaseConnection $db)
    {
        return $db->table('usuarios u')->select('u.*, f.establishment_id, f.codigo_roster AS roster_code, r.codigo AS role')->join('funcionarios f', 'f.id_funcionario=u.id_funcionario')->join('roles r', 'r.id_rol=u.id_rol');
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

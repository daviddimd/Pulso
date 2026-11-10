<?php

namespace App\Commands;

use App\Libraries\UnitOfWork;
use CodeIgniter\CLI\{BaseCommand, CLI};
use Config\Database;

final class ManageRoles extends BaseCommand
{
    protected $group = 'Pulso';
    protected $name = 'pulso:roles';
    protected $description = 'Lista, registra o actualiza definiciones del catálogo institucional de roles.';
    protected $usage = 'pulso:roles [codigo nombre descripcion]';

    public function run(array $params)
    {
        $roles = Database::connect()->table('roles');
        if ($params === []) {
            CLI::table(array_map('array_values', $roles->orderBy('id_rol')->get()->getResultArray()),
                ['ID', 'Código', 'Nombre', 'Descripción']);
            return;
        }

        if (count($params) !== 3) throw new \InvalidArgumentException($this->usage);
        [$code, $name, $description] = $params;
        $code = strtoupper($code);
        if (!preg_match('/^[A-Z][A-Z0-9_]{1,29}$/D', $code)) throw new \InvalidArgumentException('Código de rol inválido.');
        $definition = ['nombre_rol'=>UnitOfWork::text($name, 100), 'descripcion'=>UnitOfWork::text($description, 250)];
        $existing = $roles->where('codigo', $code)->get()->getRowArray();
        if ($existing) {
            $roles->where('id_rol', $existing['id_rol'])->update($definition);
        } else {
            $roles->insert(['codigo'=>$code] + $definition);
        }
        CLI::write('Catálogo actualizado.', 'green');
    }
}

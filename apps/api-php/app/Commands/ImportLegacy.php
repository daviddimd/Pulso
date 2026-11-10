<?php
namespace App\Commands;

use App\Libraries\{LegacyTripImport, UnitOfWork};
use CodeIgniter\CLI\{BaseCommand, CLI};
use Config\Database;

final class ImportLegacy extends BaseCommand
{
    protected $group = 'Pulso';
    protected $name = 'pulso:import';
    protected $description = 'Importa un respaldo JSON anterior en una base Pulso vacía.';

    public function run(array $params)
    {
        $path = $params[0] ?? '';
        if (!is_file($path)) throw new \RuntimeException('Falta el respaldo JSON.');
        $data = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        foreach (array_diff(LegacyTripImport::TABLES, ['establishments', 'sessions']) as $table) {
            if (!isset($data[$table]) || !is_array($data[$table])) throw new \RuntimeException('Respaldo incompleto.');
        }
        $db = Database::connect();
        if ($db->table('establecimientos')->countAllResults()) throw new \RuntimeException('La base de destino debe estar vacía.');

        $db->transException(true)->transBegin();
        try {
            $tenant = 'HRT';
            $source = function (string $table) use ($data, $tenant): array {
                if ($table === 'sessions') return [];
                if ($table === 'establishments') return [[
                    'id'=>$tenant, 'code'=>$tenant, 'name'=>'Hospital Regional de Talca',
                    'timezone'=>'America/Santiago', 'active'=>1, 'created_at'=>UnitOfWork::now(),
                ]];
                return array_map(function (array $row) use ($tenant): array {
                    $row['establishment_id'] = $tenant;
                    foreach ($row as $key => $value) {
                        if ($value !== null && (str_ends_with($key, '_at') || $key === 'locked_until')) {
                            $row[$key] = (new \DateTimeImmutable($value))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
                        }
                        if (is_bool($value)) $row[$key] = (int)$value;
                        if (in_array($key, ['before_data','after_data'], true) && $value !== null) {
                            $row[$key] = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
                        }
                    }
                    return $row;
                }, $data[$table]);
            };
            (new LegacyTripImport($db))->copy($source);
            if (!$db->transStatus()) throw new \RuntimeException('Falló la importación.');
            $db->transCommit();
            CLI::write('Importación completada. Las sesiones del respaldo no se trasladan.', 'green');
        } catch (\Throwable $e) {
            $db->transRollback();
            throw $e;
        }
    }
}

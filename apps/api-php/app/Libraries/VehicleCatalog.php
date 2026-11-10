<?php
namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;

final class VehicleCatalog
{
    public const UNKNOWN_MAKE = 'Sin marca registrada';

    public static function reference(BaseConnection $db, string $table, string $key, array $values): string
    {
        $builder = $db->table($table);
        $existing = $builder->select($key)->where($values)->get()->getRowArray();
        if ($existing) return (string)$existing[$key];

        // Concurrent registrations from different institutions may share a catalog entry.
        $columns = implode(', ', array_keys($values));
        $placeholders = implode(', ', array_fill(0, count($values), '?'));
        $db->query("INSERT INTO $table ($columns) VALUES ($placeholders) ON DUPLICATE KEY UPDATE $key = LAST_INSERT_ID($key)", array_values($values));
        return (string)$db->insertID();
    }

    public static function ids(BaseConnection $db, ?string $type, ?string $model, ?string $make = null, string $prefix = ''): array
    {
        $typeId = $type === null ? null : self::reference($db, $prefix . 'tipos_vehiculo', 'id_tipo_vehiculo', ['nombre' => $type]);
        if ($model === null) return ['id_tipo_vehiculo' => $typeId, 'id_modelo_vehiculo' => null];

        $makeId = self::reference($db, $prefix . 'marcas_vehiculo', 'id_marca_vehiculo', ['nombre' => $make ?? self::UNKNOWN_MAKE]);
        $modelId = self::reference($db, $prefix . 'modelos_vehiculo', 'id_modelo_vehiculo', ['id_marca_vehiculo' => $makeId, 'nombre' => $model]);
        return ['id_tipo_vehiculo' => $typeId, 'id_modelo_vehiculo' => $modelId];
    }

    public static function query(BaseConnection $db)
    {
        return $db->table('vehiculos v')->select('v.*, t.nombre AS vehicle_type, m.nombre AS model, f.nombre AS make')
            ->join('tipos_vehiculo t', 't.id_tipo_vehiculo=v.id_tipo_vehiculo', 'left')
            ->join('modelos_vehiculo m', 'm.id_modelo_vehiculo=v.id_modelo_vehiculo', 'left')
            ->join('marcas_vehiculo f', 'f.id_marca_vehiculo=m.id_marca_vehiculo', 'left');
    }
}

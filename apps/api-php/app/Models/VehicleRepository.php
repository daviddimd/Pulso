<?php
namespace App\Models;
use App\Libraries\{UnitOfWork, AuditService, VehicleCatalog};
use Config\Database;
use DomainException;
final class VehicleRepository
{
    private function dto(array $v, ?array $busy = null): array
    {
        $busy ??= $this->busyVehicles();
        return [
            'id' => (string) $v['id_vehiculo'],
            'roleCode' => $v['codigo_movil'],
            'licensePlate' => $v['patente'],
            'model' => $v['model'],
            'year' => $v['anio'] === null ? null : (int) $v['anio'],
            'vehicleType' => $v['vehicle_type'],
            'make' =>
                ($v['make'] ?? null) === VehicleCatalog::UNKNOWN_MAKE ? null : $v['make'] ?? null,
            'currentOdometerKm' =>
                $v['odometro_actual'] === null ? null : (int) $v['odometro_actual'],
            'active' => (bool) $v['activo'],
            'updatedAt' => UnitOfWork::iso($v['fecha_actualizacion']),
            'inService' => isset($busy[$v['id_vehiculo']]),
        ];
    }
    public function listing(array $actor): array
    {
        $q = VehicleCatalog::query(Database::connect())->where(
            'v.id_establecimiento',
            $actor['establishmentId'],
        );
        if ($actor['role'] !== 'ADMIN') {
            $q->where('v.activo', 1);
        }
        $busy = $this->busyVehicles();
        return array_map(
            fn($v) => $this->dto($v, $busy),
            $q->orderBy('v.codigo_movil')->get()->getResultArray(),
        );
    }

    private function busyVehicles(): array
    {
        $rows = Database::connect()
            ->table('viajes_tramos')
            ->select('id_vehiculo')
            ->where('fecha_fin', null)
            ->get()
            ->getResultArray();
        return array_flip(array_column($rows, 'id_vehiculo'));
    }

    private const ODOMETER_KEYS = "'$.odometro_actual', '$.current_odometer_km'";

    private static function jsonOdometer(string $column): string
    {
        return sprintf(
            "COALESCE(JSON_EXTRACT(a.%1\$s, '$.odometro_actual'), JSON_EXTRACT(a.%1\$s, '$.current_odometer_km'))",
            $column,
        );
    }

    private static function odometer(array $data): ?int
    {
        $value = $data['odometro_actual'] ?? ($data['current_odometer_km'] ?? null);
        return $value === null ? null : (int) $value;
    }
    public function odometerHistory(string $id, array $actor, int $page = 1): array
    {
        $db = Database::connect();
        if (
            !UnitOfWork::validId($id) ||
            !$db
                ->table('vehiculos')
                ->where('id_vehiculo', $id)
                ->where('id_establecimiento', $actor['establishmentId'])
                ->get()
                ->getRowArray()
        ) {
            throw new DomainException('NOT_FOUND', 404);
        }

        $q = $db
            ->table('registros_auditoria a')
            ->where('a.id_establecimiento', $actor['establishmentId'])
            ->where('a.tipo_entidad', 'VEHICULO')
            ->where('a.id_entidad', $id)
            ->groupStart()
            ->where('a.accion', 'AJUSTE_ODOMETRO')
            ->orGroupStart()
            ->where('a.accion', 'ACTUALIZAR')
            ->where(
                "JSON_CONTAINS_PATH(a.datos_nuevos, 'one', " . self::ODOMETER_KEYS . ') = 1',
                null,
                false,
            )
            ->groupStart()
            ->where(
                'NOT (' .
                    self::jsonOdometer('datos_anteriores') .
                    ' <=> ' .
                    self::jsonOdometer('datos_nuevos') .
                    ')',
                null,
                false,
            )
            ->orWhere(
                "NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.datos_nuevos, '$.reason')), 'null') IS NOT NULL",
                null,
                false,
            )
            ->groupEnd()
            ->groupEnd()
            ->groupEnd();
        $total = (clone $q)->countAllResults();
        $page = max(1, $page);
        $rows = $q
            ->select(
                'a.id_registro_auditoria, a.fecha_creacion, a.datos_anteriores, a.datos_nuevos, ' .
                    'u.nombre_completo',
            )
            ->join(
                'usuarios u',
                'u.id_usuario=a.id_usuario_actor AND u.id_funcionario IN ' .
                    '(SELECT id_funcionario FROM funcionarios WHERE id_establecimiento=' .
                    $db->escape($actor['establishmentId']) .
                    ')',
                'left',
            )
            ->orderBy('a.id_registro_auditoria', 'DESC')
            ->limit(20, ($page - 1) * 20)
            ->get()
            ->getResultArray();
        $corrections = array_map(function ($r) {
            $before = json_decode($r['datos_anteriores'] ?? 'null', true) ?? [];
            $after = json_decode($r['datos_nuevos'] ?? 'null', true) ?? [];
            return [
                'id' => (string) $r['id_registro_auditoria'],
                'createdAt' => UnitOfWork::iso($r['fecha_creacion']),
                'previousOdometerKm' => self::odometer($before),
                'newOdometerKm' => self::odometer($after),
                'reason' => $after['reason'] ?? null,
                'actor' => $r['nombre_completo'] ? ['fullName' => $r['nombre_completo']] : null,
            ];
        }, $rows);
        return [
            'corrections' => $corrections,
            'total' => $total,
            'page' => $page,
            'pageSize' => 20,
        ];
    }
    public function create(array $b, array $a): array
    {
        $row = UnitOfWork::run($a, function ($db) use ($a, $b) {
            $year = $b['year'] ?? null;
            if ($year !== null && (!is_int($year) || $year < 1900 || $year > (int) date('Y') + 1)) {
                throw new DomainException('INVALID_SERVICE_DATA', 400);
            }
            $r = [
                'id_establecimiento' => $a['establishmentId'],
                'codigo_movil' => UnitOfWork::text($b['roleCode'] ?? null, 30),
                'patente' => strtoupper(UnitOfWork::text($b['licensePlate'] ?? null, 20)),
                'anio' => $year,
                'odometro_actual' => UnitOfWork::km($b['currentOdometerKm'] ?? null),
                'activo' => 1,
                'fecha_creacion' => UnitOfWork::now(),
                'fecha_actualizacion' => UnitOfWork::now(),
            ];
            $type = isset($b['vehicleType']) ? UnitOfWork::text($b['vehicleType'], 60) : null;
            $model = isset($b['model']) ? UnitOfWork::text($b['model'], 120) : null;
            $make = isset($b['make']) ? UnitOfWork::text($b['make'], 120) : null;
            if ($make !== null && $model === null) {
                throw new DomainException('INVALID_SERVICE_DATA', 400);
            }
            $db->table('vehiculos')->insert(
                $r + VehicleCatalog::ids($db, $type, $model, $make, '', $a['establishmentId']),
            );
            $id = (string) $db->insertID();
            $r = VehicleCatalog::query($db)->where('v.id_vehiculo', $id)->get()->getRowArray();
            AuditService::log(
                $a['establishmentId'],
                $a['id'],
                'VEHICULO',
                $r['id_vehiculo'],
                'CREAR',
                null,
                $r,
            );
            return $r;
        });
        return $this->dto($row);
    }
    public function update(string $id, array $b, array $a): array
    {
        $row = UnitOfWork::run($a, function ($db) use ($id, $a, $b) {
            if (!UnitOfWork::validId($id)) {
                throw new DomainException('NOT_FOUND', 404);
            }
            $v = VehicleCatalog::query($db)
                ->where('v.id_vehiculo', $id)
                ->where('v.id_establecimiento', $a['establishmentId'])
                ->get()
                ->getRowArray();
            if (!$v) {
                throw new DomainException('NOT_FOUND', 404);
            }
            if (($b['expectedUpdatedAt'] ?? null) !== UnitOfWork::iso($v['fecha_actualizacion'])) {
                throw new DomainException('STALE_RECORD', 409);
            }
            foreach (array_keys($b) as $field) {
                if (!in_array($field, ['expectedUpdatedAt', 'currentOdometerKm', 'reason'], true)) {
                    throw new DomainException('IMMUTABLE_VEHICLE_DATA', 400);
                }
            }
            if (!array_key_exists('currentOdometerKm', $b)) {
                throw new DomainException('INVALID_SERVICE_DATA', 400);
            }
            $active = $db
                ->table('viajes_tramos')
                ->where('id_vehiculo', $id)
                ->where('fecha_fin', null)
                ->countAllResults();
            $updates = [];
            if (array_key_exists('currentOdometerKm', $b)) {
                if ($active) {
                    throw new DomainException('VEHICLE_IN_SERVICE', 409);
                }
                $reason = UnitOfWork::text($b['reason'] ?? null, 500);
                $updates['odometro_actual'] = UnitOfWork::km($b['currentOdometerKm']);
            }

            $stamp = max(
                (new \DateTimeImmutable('now'))->format('U.u'),
                (new \DateTimeImmutable($v['fecha_actualizacion']))->format('U.u') + 0.001,
            );
            $updates['fecha_actualizacion'] = \DateTimeImmutable::createFromFormat(
                'U.u',
                sprintf('%.6F', $stamp),
            )
                ->setTimezone(new \DateTimeZone('UTC'))
                ->format('Y-m-d H:i:s.v');
            $db->table('vehiculos')->where('id_vehiculo', $id)->update($updates);
            $fresh = array_merge($v, $updates);
            AuditService::log(
                $a['establishmentId'],
                $a['id'],
                'VEHICULO',
                $id,
                'AJUSTE_ODOMETRO',
                $v,
                $fresh + ['reason' => $reason],
            );
            return $fresh;
        });
        return $this->dto($row);
    }
}

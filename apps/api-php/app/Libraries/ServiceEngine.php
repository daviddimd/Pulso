<?php
namespace App\Libraries;

use Config\Database;
use DomainException;

final class ServiceEngine
{
    private $db;
    public function __construct()
    {
        $this->db = Database::connect();
    }

    public function resource(
        string $table,
        ?string $id,
        array $actor,
        bool $required = false,
    ): ?array {
        if (!$id) {
            if ($required) {
                throw new DomainException('ASSIGNMENT_REQUIRED', 400);
            }
            return null;
        }
        $key = match ($table) {
            'usuarios' => 'id_usuario',
            'vehiculos' => 'id_vehiculo',
            'centros_costos' => 'id_centro_costo',
        };
        $query = $this->db->table($table)->select("$table.*");
        if ($table === 'usuarios') {
            $query
                ->join('funcionarios f', 'f.id_funcionario=usuarios.id_funcionario')
                ->join('roles r', 'r.id_rol=usuarios.id_rol')
                ->where('r.codigo', 'CHOFER');
        }
        $row = $query
            ->where("$table.$key", $id)
            ->where('id_establecimiento', $actor['establishmentId'])
            ->where('activo', 1)
            ->get()
            ->getRowArray();
        if (!$row) {
            throw new DomainException(
                match ($table) {
                    'usuarios' => 'DRIVER_UNAVAILABLE',
                    'vehiculos' => 'VEHICULO_NO_DISPONIBLE',
                    default => 'COST_CENTER_UNAVAILABLE',
                },
                400,
            );
        }
        return $row;
    }

    public function create(array $body, array $actor): string
    {
        return UnitOfWork::run($actor, function () use ($body, $actor) {
            $address = UnitOfWork::text($body['serviceAddress'] ?? null, 350, 2);
            $activity = UnitOfWork::text($body['actionPerformed'] ?? null, 250, 2);
            $driver =
                $actor['role'] === 'DRIVER'
                    ? $actor['id']
                    : UnitOfWork::id($body['driverId'] ?? null);
            $vehicle = UnitOfWork::id($body['vehicleId'] ?? null);
            $cc = UnitOfWork::id($body['costCenterId'] ?? null);
            if ($cc === '') {
                throw new DomainException('COST_CENTER_REQUIRED', 400);
            }
            $this->resource('usuarios', $driver, $actor);
            $this->resource('vehiculos', $vehicle, $actor);
            $this->resource('centros_costos', $cc, $actor);
            if (isset($body['startNow']) && !is_bool($body['startNow'])) {
                throw new DomainException('INVALID_SERVICE_DATA', 400);
            }
            $now = UnitOfWork::now();
            $row = [
                'id_establecimiento' => $actor['establishmentId'],
                'id_chofer' => $driver,
                'id_vehiculo' => $vehicle,
                'id_centro_costo' => $cc,
                'id_usuario_creador' => $actor['id'],
                'origen' => Codes::stored(Codes::ORIGIN, $actor['role']),
                'version' => 0,
                'estado' => $driver ? 'ASIGNADO' : 'PENDIENTE',
                'destino' => $address,
                'actividad' => $activity,
                'fecha_creacion' => $now,
                'fecha_actualizacion' => $now,
            ];
            $id = $this->insertTrip($row);
            $row['id_viaje'] = $id;
            $this->revision($id, $address, $actor, 1);
            AuditService::log(
                $actor['establishmentId'],
                $actor['id'],
                'VIAJE',
                $id,
                'CREAR',
                null,
                $row,
            );
            if ($body['startNow'] ?? false) {
                $this->apply('start', $row, ['version' => 0], $actor);
            }
            return $id;
        });
    }

    public function executeCommand(string $command, string $id, array $body, array $actor): void
    {
        if (!UnitOfWork::validId($id)) {
            throw new DomainException('NOT_FOUND', 404);
        }
        UnitOfWork::run($actor, function () use ($command, $id, $body, $actor) {
            $row = $this->db
                ->table('viajes')
                ->where('id_viaje', $id)
                ->where('id_establecimiento', $actor['establishmentId'])
                ->get()
                ->getRowArray();
            if (!$row) {
                throw new DomainException('NOT_FOUND', 404);
            }
            $this->apply($command, $row, $body, $actor);
        });
    }

    private function apply(string $command, array $s, array $b, array $a): void
    {
        if (!isset($b['version']) || !is_int($b['version'])) {
            throw new DomainException('INVALID_SERVICE_DATA', 400);
        }
        if ($b['version'] !== (int) $s['version']) {
            throw new DomainException('STALE_SERVICE', 409);
        }
        $admin = $a['role'] === 'ADMIN';
        $own =
            $a['role'] === 'DRIVER' &&
            $a['id'] === (string) (isset($s['id_chofer']) ? (string) $s['id_chofer'] : null);
        if (!$admin && !$own) {
            throw new DomainException('FORBIDDEN', 403);
        }
        $now = UnitOfWork::now();
        $changes = [];
        switch ($command) {
            case 'start':
                if (!$own) {
                    throw new DomainException('FORBIDDEN', 403);
                }
                if ($s['estado'] !== 'ASIGNADO') {
                    throw new DomainException('INVALID_TRANSITION', 400);
                }
                $vehicleId = isset($s['id_vehiculo'])
                    ? (string) $s['id_vehiculo']
                    : UnitOfWork::id($b['vehicleId'] ?? null);
                if (
                    $s['id_vehiculo'] &&
                    isset($b['vehicleId']) &&
                    $b['vehicleId'] !== (string) $s['id_vehiculo']
                ) {
                    throw new DomainException('ADMIN_REASSIGNMENT_REQUIRED', 403);
                }
                $changes = [
                    'id_vehiculo' => $vehicleId,
                    'estado' => 'EN_CURSO',
                    'fecha_inicio' => $now,
                    'odometro_salida' => $this->openLeg(
                        (string) $s['id_viaje'],
                        $s['id_chofer'],
                        $vehicleId,
                        $a,
                        $now,
                    ),
                ];
                break;
            case 'complete':
                if (!$own) {
                    throw new DomainException('FORBIDDEN', 403);
                }
                if ($s['estado'] !== 'EN_CURSO') {
                    throw new DomainException('INVALID_TRANSITION', 400);
                }
                $km = UnitOfWork::km($b['odometerKm'] ?? null);
                $this->recordArrival($s, $km, $now);
                $changes = [
                    'estado' => 'FINALIZADO',
                    'fecha_fin' => $now,
                    'odometro_llegada' => $km,
                ];
                break;
            case 'assignment':
                if (!$admin) {
                    throw new DomainException('FORBIDDEN', 403);
                }
                if (!in_array($s['estado'], ['PENDIENTE', 'ASIGNADO', 'EN_CURSO'], true)) {
                    throw new DomainException('INVALID_TRANSITION', 400);
                }
                $driver = array_key_exists('driverId', $b)
                    ? UnitOfWork::id($b['driverId'])
                    : (isset($s['id_chofer'])
                        ? (string) $s['id_chofer']
                        : null);
                $vehicle = array_key_exists('vehicleId', $b)
                    ? UnitOfWork::id($b['vehicleId'])
                    : (isset($s['id_vehiculo'])
                        ? (string) $s['id_vehiculo']
                        : null);
                if (
                    ($driver ?? '') === (string) $s['id_chofer'] &&
                    ($vehicle ?? '') === (string) $s['id_vehiculo']
                ) {
                    throw new DomainException('ASSIGNMENT_UNCHANGED', 400);
                }
                $this->resource('usuarios', $driver, $a, $s['estado'] === 'EN_CURSO');
                $this->resource('vehiculos', $vehicle, $a, $s['estado'] === 'EN_CURSO');
                $this->available($driver, $vehicle, (string) $s['id_viaje']);
                if ($s['estado'] === 'EN_CURSO') {
                    if (!isset($b['odometerKm'])) {
                        throw new DomainException('HANDOVER_ODOMETER_REQUIRED', 400);
                    }
                    $km = UnitOfWork::km($b['odometerKm']);
                    $this->recordArrival($s, $km, $now);
                    $this->openLeg((string) $s['id_viaje'], $driver, $vehicle, $a, $now);
                }
                $changes = [
                    'id_chofer' => $driver,
                    'id_vehiculo' => $vehicle,
                    'estado' =>
                        $s['estado'] === 'EN_CURSO'
                            ? 'EN_CURSO'
                            : ($driver
                                ? 'ASIGNADO'
                                : 'PENDIENTE'),
                ];
                break;
            case 'address':
                if (!$admin) {
                    throw new DomainException('FORBIDDEN', 403);
                }
                $changes['destino'] = UnitOfWork::text($b['serviceAddress'] ?? null, 350, 2);
                $latest = $this->db
                    ->table('revisiones_direccion')
                    ->selectMax('revision')
                    ->where('id_establecimiento', $a['establishmentId'])
                    ->where('id_viaje', (string) $s['id_viaje'])
                    ->get()
                    ->getRowArray();
                $this->revision(
                    (string) $s['id_viaje'],
                    $changes['destino'],
                    $a,
                    (int) $latest['revision'] + 1,
                );
                break;
            case 'cost-center':
                if (!$admin) {
                    throw new DomainException('FORBIDDEN', 403);
                }
                if (!array_key_exists('costCenterId', $b) || $b['costCenterId'] === '') {
                    throw new DomainException('COST_CENTER_REQUIRED', 400);
                }
                $this->resource('centros_costos', UnitOfWork::id($b['costCenterId']), $a);
                $changes['id_centro_costo'] = $b['costCenterId'];
                break;
            case 'cancel':
                if (!$admin) {
                    throw new DomainException('FORBIDDEN', 403);
                }
                if (
                    !in_array($s['estado'], ['PENDIENTE', 'ASIGNADO'], true) ||
                    !empty($s['fecha_inicio'])
                ) {
                    throw new DomainException('CANCEL_ONLY_BEFORE_START', 400);
                }
                $changes = [
                    'estado' => 'CANCELADO',
                    'fecha_cancelacion' => $now,
                    'motivo_cancelacion' => UnitOfWork::text(
                        $b['reason'] ?? ($b['voidReason'] ?? null),
                        500,
                    ),
                ];
                break;
            default:
                throw new DomainException('NOT_FOUND', 404);
        }
        $this->save(
            $s,
            $changes,
            $a,
            Codes::stored(Codes::ACTION, strtoupper(str_replace('-', '_', $command))),
            $now,
        );
    }

    private function save(array $s, array $changes, array $a, string $action, string $now): void
    {
        $changes += ['version' => (int) $s['version'] + 1, 'fecha_actualizacion' => $now];
        $ok = $this->db
            ->table('viajes')
            ->where('id_viaje', $s['id_viaje'])
            ->where('version', $s['version'])
            ->update($changes);
        if (!$ok || $this->db->affectedRows() !== 1) {
            throw new DomainException('STALE_SERVICE', 409);
        }
        AuditService::log(
            $a['establishmentId'],
            $a['id'],
            'VIAJE',
            (string) $s['id_viaje'],
            $action,
            $s,
            array_merge($s, $changes),
        );
    }
    private function available(?string $driver, ?string $vehicle, ?string $except = null): void
    {
        foreach (['id_chofer' => $driver, 'id_vehiculo' => $vehicle] as $field => $id) {
            if (!$id) {
                continue;
            }
            $q = $this->db
                ->table('viajes_tramos')
                ->where($field === 'id_chofer' ? 'id_chofer' : 'id_vehiculo', $id)
                ->where('fecha_fin', null);
            if ($except) {
                $q->where('id_viaje !=', $except);
            }
            if ($q->countAllResults()) {
                throw new DomainException(
                    $field === 'id_chofer'
                        ? 'EL_CHOFER_YA_COMENZO_EL_SERVICIO'
                        : 'EL_VEHICULO_YA_ESTA_EN_USO',
                    409,
                );
            }
        }
    }
    private function insertTrip(array $row): string
    {
        $this->db->table('viajes')->insert($row);
        return (string) $this->db->insertID();
    }

    private function openLeg(
        string $trip,
        ?string $driver,
        ?string $vehicle,
        array $actor,
        string $now,
    ): int {
        $this->resource('usuarios', $driver, $actor, true);
        $v = $this->resource('vehiculos', $vehicle, $actor, true);
        $this->available($driver, $vehicle);
        if ($v['odometro_actual'] === null) {
            throw new DomainException('INITIAL_ODOMETER_REQUIRED', 400);
        }
        $this->db->table('viajes_tramos')->insert([
            'id_establecimiento' => $actor['establishmentId'],
            'id_viaje' => $trip,
            'id_chofer' => $driver,
            'id_vehiculo' => $vehicle,
            'fecha_inicio' => $now,
            'odometro_inicio' => $v['odometro_actual'],
        ]);
        return (int) $v['odometro_actual'];
    }

    private function recordArrival(array $trip, int $km, string $now): void
    {
        $leg = $this->db
            ->table('viajes_tramos')
            ->where('id_establecimiento', $trip['id_establecimiento'])
            ->where('id_viaje', $trip['id_viaje'])
            ->where('fecha_fin', null)
            ->get()
            ->getRowArray();
        if (!$leg) {
            throw new DomainException('INVALID_TRANSITION', 400);
        }
        $vehicle = $this->db
            ->table('vehiculos')
            ->where('id_vehiculo', $leg['id_vehiculo'])
            ->get()
            ->getRowArray();
        if ($km < max((int) $leg['odometro_inicio'], (int) $vehicle['odometro_actual'])) {
            throw new DomainException('ODOMETER_BELOW_CURRENT', 400);
        }
        $this->db
            ->table('viajes_tramos')
            ->where('id_viaje_tramo', $leg['id_viaje_tramo'])
            ->update(['fecha_fin' => $now, 'odometro_fin' => $km]);
        $this->db
            ->table('vehiculos')
            ->where('id_vehiculo', $leg['id_vehiculo'])
            ->update(['odometro_actual' => $km, 'fecha_actualizacion' => $now]);
    }

    private function revision(string $service, string $address, array $actor, int $number): void
    {
        $this->db->table('revisiones_direccion')->insert([
            'id_establecimiento' => $actor['establishmentId'],
            'id_viaje' => $service,
            'revision' => $number,
            'direccion' => $address,
            'id_usuario_actor' => $actor['id'],
            'origen' => Codes::stored(Codes::ORIGIN, $actor['role']),
            'fecha_creacion' => UnitOfWork::now(),
        ]);
    }
}

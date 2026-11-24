<?php
namespace App\Models;
use App\Libraries\{Codes, ServiceEngine, UnitOfWork, VehicleCatalog, UserAccounts};
use Config\Database;

final class ServiceRepository
{
    private $db;
    private array $cache = [];

    public function __construct(private array $actor)
    {
        $this->db = Database::connect();
    }
    public function query()
    {
        $q = $this->db
            ->table('viajes b')
            ->select('b.*')
            ->where('b.id_establecimiento', $this->actor['establishmentId']);
        if ($this->actor['role'] !== 'ADMIN') {
            $participation = $this->db
                ->table('viajes_tramos')
                ->select('id_viaje')
                ->where('id_establecimiento', $this->actor['establishmentId'])
                ->where('id_chofer', $this->actor['id']);
            $q->groupStart()
                ->where('b.id_chofer', $this->actor['id'])
                ->orWhereIn('b.id_viaje', $participation)
                ->groupEnd();
        }
        return $q;
    }
    public function find(string $id): ?array
    {
        if (!UnitOfWork::validId($id)) {
            return null;
        }
        $row = $this->query()->where('b.id_viaje', $id)->get()->getRowArray();
        if (!$row) {
            $alias = $this->db
                ->table('folios_viajes_anteriores')
                ->where('id_folio_anterior', $id)
                ->where('id_establecimiento', $this->actor['establishmentId'])
                ->get()
                ->getRowArray();
            if ($alias) {
                $row = $this->query()
                    ->where('b.id_viaje', $alias['id_viaje'])
                    ->get()
                    ->getRowArray();
            }
        }
        return $row ? $this->serialize($row) : null;
    }
    public function listing(array $filters): array
    {
        $q = $this->query();
        foreach (['driverId' => 'id_chofer', 'vehicleId' => 'id_vehiculo'] as $param => $column) {
            if (empty($filters[$param])) {
                continue;
            }
            $id = UnitOfWork::id($filters[$param]);
            $participation = $this->db
                ->table('viajes_tramos')
                ->select('id_viaje')
                ->where('id_establecimiento', $this->actor['establishmentId'])
                ->where($column === 'id_chofer' ? 'id_chofer' : 'id_vehiculo', $id);
            $q->groupStart()
                ->where('b.' . $column, $id)
                ->orWhereIn('b.id_viaje', $participation)
                ->groupEnd();
        }
        $all = clone $q;
        if (!empty($filters['status'])) {
            $q->where('b.estado', Codes::stored(Codes::STATUS, (string) $filters['status']));
        }
        $total = (clone $q)->countAllResults();
        $page = max(1, (int) ($filters['page'] ?? 1));
        $rows = $q
            ->orderBy('b.fecha_creacion', 'DESC')
            ->orderBy('b.id_viaje', 'DESC')
            ->limit(30, ($page - 1) * 30)
            ->get()
            ->getResultArray();
        $activeQuery = (clone $all)->where('b.estado', 'EN_CURSO');
        if ($this->actor['role'] !== 'ADMIN') {
            $activeQuery->where('b.id_chofer', $this->actor['id']);
        }
        $active = $activeQuery->orderBy('b.fecha_inicio')->get()->getResultArray();
        $upcoming = $all
            ->whereIn('b.estado', ['ASIGNADO', 'PENDIENTE'])
            ->orderBy('b.fecha_creacion')
            ->get()
            ->getResultArray();
        return [
            'entries' => array_map($this->serialize(...), $rows),
            'active' => array_map($this->serialize(...), $active),
            'upcoming' => array_map($this->serialize(...), $upcoming),
            'total' => $total,
            'page' => $page,
        ];
    }
    private function remember(string $kind, mixed $id, callable $load): ?array
    {
        if (!$id) {
            return null;
        }
        return $this->cache[$kind][$id] ??= $load($id) ?: null;
    }

    private function user(mixed $id, bool $anyInstitution = false): ?array
    {
        return $this->remember($anyInstitution ? 'anyUser' : 'user', $id, function ($id) use (
            $anyInstitution,
        ) {
            $q = UserAccounts::query($this->db)->where('u.id_usuario', $id);
            if (!$anyInstitution) {
                $q->where('f.id_establecimiento', $this->actor['establishmentId']);
            }
            return $q->get()->getRowArray();
        });
    }

    private function vehicle(mixed $id, bool $anyInstitution = false): ?array
    {
        return $this->remember($anyInstitution ? 'anyVehicle' : 'vehicle', $id, function ($id) use (
            $anyInstitution,
        ) {
            $q = VehicleCatalog::query($this->db)->where('v.id_vehiculo', $id);
            if (!$anyInstitution) {
                $q->where('v.id_establecimiento', $this->actor['establishmentId']);
            }
            return $q->get()->getRowArray();
        });
    }

    private function costCenter(mixed $id): ?array
    {
        return $this->remember(
            'costCenter',
            $id,
            fn($id) => $this->db
                ->table('centros_costos')
                ->where('id_centro_costo', $id)
                ->where('id_establecimiento', $this->actor['establishmentId'])
                ->get()
                ->getRowArray(),
        );
    }

    public function serialize(array $s): array
    {
        $driverDto = fn($u) => $u
            ? [
                'id' => (string) $u['id_usuario'],
                'fullName' => $u['nombre_completo'],
                'rosterCode' => $u['codigo_roster'],
            ]
            : null;
        $vehicleDto = fn($v) => $v
            ? [
                'id' => (string) $v['id_vehiculo'],
                'roleCode' => $v['codigo_movil'],
                'licensePlate' => $v['patente'],
                'model' => $v['model'],
            ]
            : null;
        $cc = $this->costCenter($s['id_centro_costo']);
        $driver = $driverDto($this->user($s['id_chofer']));
        $mobile = $vehicleDto($this->vehicle($s['id_vehiculo']));
        $dep = $s['odometro_salida'] === null ? null : (int) $s['odometro_salida'];
        $arr = $s['odometro_llegada'] === null ? null : (int) $s['odometro_llegada'];
        $reading = [];
        $legs = $this->db
            ->table('viajes_tramos')
            ->where('id_establecimiento', $this->actor['establishmentId'])
            ->where('id_viaje', $s['id_viaje'])
            ->orderBy('fecha_inicio')
            ->orderBy('id_viaje_tramo')
            ->get()
            ->getResultArray();

        $distance = $legs ? 0 : ($dep !== null && $arr !== null ? $arr - $dep : null);
        foreach ($legs as $leg) {
            $start = $leg['odometro_inicio'] === null ? null : (int) $leg['odometro_inicio'];
            $end = $leg['odometro_fin'] === null ? null : (int) $leg['odometro_fin'];
            $distance =
                $distance !== null && $start !== null && $end !== null
                    ? $distance + $end - $start
                    : null;
            $reading[] = [
                'id' => (string) $leg['id_viaje_tramo'],
                'startedAt' => UnitOfWork::iso($leg['fecha_inicio']),
                'endedAt' => UnitOfWork::iso($leg['fecha_fin']),
                'departureOdometerKm' => $start,
                'arrivalOdometerKm' => $end,
                'driver' => $driverDto($this->user($leg['id_chofer'], true)),
                'vehicle' => $vehicleDto($this->vehicle($leg['id_vehiculo'], true)),
            ];
        }
        $destinations = array_column(
            $this->db
                ->table('viajes_destinos')
                ->select('direccion')
                ->where('id_establecimiento', $this->actor['establishmentId'])
                ->where('id_viaje', $s['id_viaje'])
                ->orderBy('orden')
                ->get()
                ->getResultArray(),
            'direccion',
        );
        $revs = $this->db
            ->table('revisiones_direccion')
            ->where('id_establecimiento', $this->actor['establishmentId'])
            ->where('id_viaje', (string) $s['id_viaje'])
            ->orderBy('revision', 'DESC')
            ->get()
            ->getResultArray();
        return [
            'id' => (string) $s['id_viaje'],
            'version' => (int) $s['version'],
            'status' => Codes::api(Codes::STATUS, $s['estado']),
            'serviceAddress' => ServiceEngine::route($destinations),
            'destinations' => $destinations,
            'originalAddress' => $revs
                ? $revs[count($revs) - 1]['direccion']
                : ServiceEngine::route($destinations),
            'actionPerformed' => $s['actividad'],
            'driverId' => self::optionalId($s['id_chofer']),
            'vehicleId' => self::optionalId($s['id_vehiculo']),
            'driver' => $driver,
            'vehicle' => $mobile,
            'costCenterId' => self::optionalId($s['id_centro_costo']),
            'costCenter' => $cc
                ? [
                    'id' => (string) $cc['id_centro_costo'],
                    'code' => $cc['codigo'],
                    'name' => $cc['nombre'],
                    'active' => (bool) $cc['activo'],
                ]
                : null,
            'startedAt' => UnitOfWork::iso($s['fecha_inicio']),
            'endedAt' => UnitOfWork::iso($s['fecha_fin']),
            'cancelledAt' => UnitOfWork::iso($s['fecha_cancelacion']),
            'createdAt' => UnitOfWork::iso($s['fecha_creacion']),
            'updatedAt' => UnitOfWork::iso($s['fecha_actualizacion']),
            'voidReason' => $s['motivo_cancelacion'],
            'odometerKm' => $arr,
            'departureOdometerKm' => $dep,
            'distanceKm' => $distance,
            'legs' => $reading,
            'addressRevisions' => array_map(
                fn($r) => [
                    'id' => (string) $r['id_revision_direccion'],
                    'revision' => (int) $r['revision'],
                    'address' => $r['direccion'],
                    'source' => Codes::api(Codes::ORIGIN, $r['origen']),
                    'createdAt' => UnitOfWork::iso($r['fecha_creacion']),
                    'actor' => $driverDto($this->user($r['id_usuario_actor'])),
                ],
                $revs,
            ),
        ];
    }
    private static function optionalId(mixed $id): ?string
    {
        return $id === null ? null : (string) $id;
    }

    private function auditIds(array $entry): array
    {
        $aliases = $this->db
            ->table('folios_viajes_anteriores')
            ->where('id_viaje', $entry['id'])
            ->where('id_establecimiento', $this->actor['establishmentId'])
            ->get()
            ->getResultArray();
        return array_unique(
            array_merge([$entry['id']], array_column($aliases, 'id_folio_anterior')),
        );
    }

    public function audit(string $id): array
    {
        $entry = $this->find($id);
        if (!$entry) {
            throw new \DomainException('NOT_FOUND', 404);
        }
        $rows = Database::connect()
            ->table('registros_auditoria a')
            ->select('a.*,u.nombre_completo')
            ->join('usuarios u', 'u.id_usuario=a.id_usuario_actor', 'left')
            ->where('a.id_establecimiento', $this->actor['establishmentId'])
            ->whereIn('a.id_entidad', $this->auditIds($entry))
            ->where('a.tipo_entidad', 'VIAJE')
            ->orderBy('a.id_registro_auditoria', 'DESC')
            ->limit(200)
            ->get()
            ->getResultArray();
        return array_map(
            fn($r) => [
                'id' => (string) $r['id_registro_auditoria'],
                'action' => $r['accion'],
                'actor' => $r['nombre_completo'] ? ['fullName' => $r['nombre_completo']] : null,
                'createdAt' => UnitOfWork::iso($r['fecha_creacion']),
                'beforeData' => $r['datos_anteriores']
                    ? json_decode($r['datos_anteriores'], true)
                    : null,
                'afterData' => $r['datos_nuevos'] ? json_decode($r['datos_nuevos'], true) : null,
            ],
            $rows,
        );
    }
}

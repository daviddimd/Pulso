<?php
namespace App\Libraries;

use Config\Database;
use DomainException;

final class ServiceEngine
{
    private $db;
    public function __construct() { $this->db = Database::connect(); }

    public function resource(string $table, ?string $id, array $actor, bool $required = false): ?array
    {
        if (!$id) {
            if ($required) throw new DomainException('ASSIGNMENT_REQUIRED', 400);
            return null;
        }
        $key = match ($table) { 'usuarios' => 'id_usuario', 'vehiculos' => 'id_vehiculo', 'centros_costos' => 'id_centro_costo' };
        $query = $this->db->table($table)->select("$table.*");
        if ($table === 'usuarios') $query->join('roles r', 'r.id_rol=usuarios.id_rol')->where('r.codigo', 'DRIVER');
        $row = $query->where("$table.$key", $id)->where('establishment_id', $actor['establishmentId'])->where('active', 1)->get()->getRowArray();
        if (!$row) {
            throw new DomainException(match($table) { 'usuarios' => 'DRIVER_UNAVAILABLE', 'vehiculos' => 'VEHICULO_NO_DISPONIBLE', default => 'COST_CENTER_UNAVAILABLE' }, 400);
        }
        return $row;
    }

    public function create(array $body, array $actor): string
    {
        return UnitOfWork::run($actor, function () use ($body, $actor) {
            $address = UnitOfWork::text($body['serviceAddress'] ?? null, 350, 2);
            $activity = UnitOfWork::text($body['actionPerformed'] ?? null, 250, 2);
            $driver = $actor['role'] === 'DRIVER' ? $actor['id'] : UnitOfWork::id($body['driverId'] ?? null);
            $vehicle = UnitOfWork::id($body['vehicleId'] ?? null);
            $cc = UnitOfWork::id($body['costCenterId'] ?? null);
            if ($cc === '') throw new DomainException('COST_CENTER_REQUIRED', 400);
            $this->resource('usuarios', $driver, $actor);
            $this->resource('vehiculos', $vehicle, $actor);
            $this->resource('centros_costos', $cc, $actor);
            if (isset($body['startNow']) && !is_bool($body['startNow'])) throw new DomainException('INVALID_SERVICE_DATA', 400);
            $now = UnitOfWork::now();
            $row = ['establishment_id' => $actor['establishmentId'], 'driver_id' => $driver, 'vehicle_id' => $vehicle,
                'cost_center_id' => $cc, 'created_by_user_id' => $actor['id'], 'origin' => $actor['role'], 'version' => 0,
                'status' => $driver ? 'ASSIGNED' : 'PENDING', 'destino' => $address, 'actividad' => $activity,
                'created_at' => $now, 'updated_at' => $now];
            $id = $this->insertTrip($row);
            $row['id_viaje'] = $id;
            $this->revision($id, $address, $actor, 1);
            AuditService::log($actor['id'], 'BITACORA', $id, 'CREATE', null, $row);
            if ($body['startNow'] ?? false) $this->apply('start', $row, ['version' => 0], $actor);
            return $id;
        });
    }

    public function executeCommand(string $command, string $id, array $body, array $actor): ?string
    {
        if (!UnitOfWork::validId($id)) throw new DomainException('NOT_FOUND', 404);
        return UnitOfWork::run($actor, function () use ($command, $id, $body, $actor) {
            $row = $this->db->table('viajes')->where('id_viaje', $id)->where('establishment_id', $actor['establishmentId'])->get()->getRowArray();
            if (!$row) throw new DomainException('NOT_FOUND', 404);
            return $this->apply($command, $row, $body, $actor);
        });
    }

    private function apply(string $command, array $s, array $b, array $a): ?string
    {
        if (!isset($b['version']) || !is_int($b['version'])) throw new DomainException('INVALID_SERVICE_DATA', 400);
        if ($b['version'] !== (int)$s['version']) throw new DomainException('STALE_SERVICE', 409);
        $admin = $a['role'] === 'ADMIN';
        $own = $a['role'] === 'DRIVER' && $a['id'] === (string)(isset($s['driver_id']) ? (string)$s['driver_id'] : null);
        if (!$admin && !$own) throw new DomainException('FORBIDDEN', 403);
        $now = UnitOfWork::now();
        $changes = [];
        switch ($command) {
            case 'start':
                if (!$own) throw new DomainException('FORBIDDEN', 403);
                if ($s['status'] !== 'ASSIGNED') throw new DomainException('INVALID_TRANSITION', 400);
                $vehicleId = isset($s['vehicle_id']) ? (string)$s['vehicle_id'] : UnitOfWork::id($b['vehicleId'] ?? null);
                if ($s['vehicle_id'] && isset($b['vehicleId']) && $b['vehicleId'] !== (string)$s['vehicle_id']) throw new DomainException('ADMIN_REASSIGNMENT_REQUIRED', 403);
                $changes = ['vehicle_id' => $vehicleId, 'status' => 'IN_PROGRESS', 'started_at' => $now,
                    'departure_odometer_km' => $this->departure($s['driver_id'], $vehicleId, $a)];
                break;
            case 'complete':
                if (!$own) throw new DomainException('FORBIDDEN', 403);
                if ($s['status'] !== 'IN_PROGRESS') throw new DomainException('INVALID_TRANSITION', 400);
                $km = UnitOfWork::km($b['odometerKm'] ?? null);
                $this->recordArrival($s, $km, $now);
                $changes = ['status' => 'COMPLETED', 'ended_at' => $now, 'arrival_odometer_km' => $km];
                break;
            case 'assignment':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                if (!in_array($s['status'], ['PENDING','ASSIGNED','IN_PROGRESS'], true)) throw new DomainException('INVALID_TRANSITION', 400);
                $driver = array_key_exists('driverId', $b) ? UnitOfWork::id($b['driverId']) : (isset($s['driver_id']) ? (string)$s['driver_id'] : null);
                $vehicle = array_key_exists('vehicleId', $b) ? UnitOfWork::id($b['vehicleId']) : (isset($s['vehicle_id']) ? (string)$s['vehicle_id'] : null);
                if (($driver ?? '') === (string)$s['driver_id'] && ($vehicle ?? '') === (string)$s['vehicle_id']) throw new DomainException('ASSIGNMENT_UNCHANGED', 400);
                $this->resource('usuarios', $driver, $a, $s['status'] === 'IN_PROGRESS');
                $this->resource('vehiculos', $vehicle, $a, $s['status'] === 'IN_PROGRESS');
                $this->available($driver, $vehicle, (string)$s['id_viaje']);
                if ($s['status'] === 'IN_PROGRESS') {
                    if (!isset($b['odometerKm'])) throw new DomainException('HANDOVER_ODOMETER_REQUIRED', 400);
                    $km = UnitOfWork::km($b['odometerKm']);
                    $this->recordArrival($s, $km, $now);
                    $this->save($s, ['status'=>'COMPLETED', 'ended_at'=>$now, 'arrival_odometer_km'=>$km], $a, 'HANDOVER_CLOSE', $now);
                    $next = [
                        'establishment_id'=>$s['establishment_id'], 'driver_id'=>$driver, 'vehicle_id'=>$vehicle,
                        'cost_center_id'=>$s['cost_center_id'], 'destino'=>$s['destino'], 'actividad'=>$s['actividad'],
                        'created_by_user_id'=>$a['id'], 'origin'=>$a['role'], 'status'=>'IN_PROGRESS',
                        'id_viaje_anterior'=>$s['id_viaje'], 'started_at'=>$now, 'created_at'=>$now, 'updated_at'=>$now,
                        'departure_odometer_km'=>$this->departure($driver, $vehicle, $a),
                    ];
                    $nextId = $this->insertTrip($next);
                    $this->revision($nextId, $next['destino'], $a, 1);
                    AuditService::log($a['id'], 'BITACORA', $nextId, 'HANDOVER_OPEN', null, $next);
                    return $nextId;
                }
                $changes = ['driver_id' => $driver, 'vehicle_id' => $vehicle, 'status' => $driver ? 'ASSIGNED' : 'PENDING'];
                break;
            case 'address':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                $changes['destino'] = UnitOfWork::text($b['serviceAddress'] ?? null, 350, 2);
                $latest = $this->db->table('revisiones_direccion')->selectMax('revision')->where('service_id', (string)$s['id_viaje'])->get()->getRowArray();
                $this->revision((string)$s['id_viaje'], $changes['destino'], $a, (int)$latest['revision'] + 1);
                break;
            case 'cost-center':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                if (!array_key_exists('costCenterId', $b) || $b['costCenterId'] === '') throw new DomainException('COST_CENTER_REQUIRED', 400);
                $this->resource('centros_costos', UnitOfWork::id($b['costCenterId']), $a);
                $changes['cost_center_id'] = $b['costCenterId'];
                break;
            case 'cancel':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                if (!in_array($s['status'], ['PENDING','ASSIGNED'], true) || !empty($s['started_at'])) throw new DomainException('CANCEL_ONLY_BEFORE_START', 400);
                $changes = ['status' => 'CANCELLED', 'cancelled_at' => $now, 'void_reason' => UnitOfWork::text($b['reason'] ?? $b['voidReason'] ?? null, 500)];
                break;
            default: throw new DomainException('NOT_FOUND', 404);
        }
        $this->save($s, $changes, $a, strtoupper(str_replace('-', '_', $command)), $now);
        return null;
    }

    private function save(array $s, array $changes, array $a, string $action, string $now): void
    {
        $changes += ['version' => (int)$s['version'] + 1, 'updated_at' => $now];
        $ok = $this->db->table('viajes')->where('id_viaje', $s['id_viaje'])->where('version', $s['version'])->update($changes);
        if (!$ok || $this->db->affectedRows() !== 1) throw new DomainException('STALE_SERVICE', 409);
        AuditService::log($a['id'], 'BITACORA', (string)$s['id_viaje'], $action, $s, array_merge($s, $changes));
    }
    private function available(?string $driver, ?string $vehicle, ?string $except = null): void
    {
        foreach (['driver_id' => $driver, 'vehicle_id' => $vehicle] as $field => $id) {
            if (!$id) continue;
            $q = $this->db->table('viajes')->where($field, $id)->where('status', 'IN_PROGRESS');
            if ($except) $q->where('id_viaje !=', $except);
            if ($q->countAllResults()) throw new DomainException($field === 'driver_id' ? 'EL_CHOFER_YA_COMENZO_EL_SERVICIO' : 'EL_VEHICULO_YA_ESTA_EN_USO', 409);
        }
    }
    private function insertTrip(array $row): string
    {
        $this->db->table('viajes')->insert($row);
        return (string)$this->db->insertID();
    }

    private function departure(?string $driver, ?string $vehicle, array $actor): int
    {
        $this->resource('usuarios', $driver, $actor, true);
        $v = $this->resource('vehiculos', $vehicle, $actor, true);
        $this->available($driver, $vehicle);
        if ($v['current_odometer_km'] === null) throw new DomainException('INITIAL_ODOMETER_REQUIRED', 400);
        return (int)$v['current_odometer_km'];
    }

    private function recordArrival(array $trip, int $km, string $now): void
    {
        $vehicle = $this->db->table('vehiculos')->where('id_vehiculo', $trip['vehicle_id'])->get()->getRowArray();
        if ($km < max((int)$trip['departure_odometer_km'], (int)$vehicle['current_odometer_km'])) {
            throw new DomainException('ODOMETER_BELOW_CURRENT', 400);
        }
        $this->db->table('vehiculos')->where('id_vehiculo', $trip['vehicle_id'])->update(['current_odometer_km'=>$km, 'updated_at'=>$now]);
    }

    private function revision(string $service, string $address, array $actor, int $number): void
    {
        $this->db->table('revisiones_direccion')->insert(['service_id' => $service,
            'revision' => $number, 'address' => $address, 'actor_user_id' => $actor['id'], 'source' => $actor['role'], 'created_at' => UnitOfWork::now()]);
    }
}

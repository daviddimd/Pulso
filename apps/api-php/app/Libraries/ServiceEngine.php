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
        $row = $this->db->table($table)->where('id', $id)->where('establishment_id', $actor['establishmentId'])->where('active', 1)->get()->getRowArray();
        if (!$row || ($table === 'users' && $row['role'] !== 'DRIVER')) {
            throw new DomainException(match($table) { 'users' => 'DRIVER_UNAVAILABLE', 'vehicles' => 'VEHICULO_NO_DISPONIBLE', default => 'COST_CENTER_UNAVAILABLE' }, 400);
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
            $this->resource('users', $driver, $actor);
            $this->resource('vehicles', $vehicle, $actor);
            $this->resource('cost_centers', $cc, $actor);
            if (isset($body['startNow']) && !is_bool($body['startNow'])) throw new DomainException('INVALID_SERVICE_DATA', 400);
            $now = UnitOfWork::now();
            $id = SecurityLib::generateUuid();
            $row = ['id' => $id, 'establishment_id' => $actor['establishmentId'], 'driver_id' => $driver, 'vehicle_id' => $vehicle,
                'cost_center_id' => $cc, 'created_by_user_id' => $actor['id'], 'origin' => $actor['role'], 'version' => 0,
                'status' => $driver ? 'ASSIGNED' : 'PENDING', 'service_address' => $address, 'action_performed' => $activity,
                'created_at' => $now, 'updated_at' => $now];
            $this->db->table('bitacora_entries')->insert($row);
            $this->revision($id, $address, $actor, 1);
            AuditService::log($actor['id'], 'BITACORA', $id, 'CREATE', null, $row);
            if ($body['startNow'] ?? false) $this->apply('start', $row, ['version' => 0], $actor);
            return $id;
        });
    }

    public function executeCommand(string $command, string $id, array $body, array $actor): void
    {
        UnitOfWork::run($actor, function () use ($command, $id, $body, $actor) {
            $row = $this->db->table('bitacora_entries')->where('id', $id)->where('establishment_id', $actor['establishmentId'])->get()->getRowArray();
            if (!$row) throw new DomainException('NOT_FOUND', 404);
            $this->apply($command, $row, $body, $actor);
        });
    }

    private function apply(string $command, array $s, array $b, array $a): void
    {
        if (!isset($b['version']) || !is_int($b['version'])) throw new DomainException('INVALID_SERVICE_DATA', 400);
        if ($b['version'] !== (int)$s['version']) throw new DomainException('STALE_SERVICE', 409);
        $admin = $a['role'] === 'ADMIN';
        $own = $a['role'] === 'DRIVER' && $a['id'] === $s['driver_id'];
        if (!$admin && !$own) throw new DomainException('FORBIDDEN', 403);
        $now = UnitOfWork::now();
        $changes = [];
        switch ($command) {
            case 'start':
                if (!$own) throw new DomainException('FORBIDDEN', 403);
                if ($s['status'] !== 'ASSIGNED') throw new DomainException('INVALID_TRANSITION', 400);
                $vehicleId = $s['vehicle_id'] ?? UnitOfWork::id($b['vehicleId'] ?? null);
                if ($s['vehicle_id'] && isset($b['vehicleId']) && $b['vehicleId'] !== $s['vehicle_id']) throw new DomainException('ADMIN_REASSIGNMENT_REQUIRED', 403);
                $this->openLeg($s['id'], $s['driver_id'], $vehicleId, $a);
                $changes = ['vehicle_id' => $vehicleId, 'status' => 'IN_PROGRESS', 'started_at' => $now];
                break;
            case 'complete':
                if (!$own) throw new DomainException('FORBIDDEN', 403);
                if ($s['status'] !== 'IN_PROGRESS') throw new DomainException('INVALID_TRANSITION', 400);
                $km = UnitOfWork::km($b['odometerKm'] ?? null);
                $this->closeLeg($s, $km);
                $changes = ['status' => 'COMPLETED', 'ended_at' => $now, 'odometer_km' => $km];
                break;
            case 'assignment':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                if (!in_array($s['status'], ['PENDING','ASSIGNED','IN_PROGRESS'], true)) throw new DomainException('INVALID_TRANSITION', 400);
                $driver = array_key_exists('driverId', $b) ? UnitOfWork::id($b['driverId']) : $s['driver_id'];
                $vehicle = array_key_exists('vehicleId', $b) ? UnitOfWork::id($b['vehicleId']) : $s['vehicle_id'];
                if ($driver === $s['driver_id'] && $vehicle === $s['vehicle_id']) throw new DomainException('ASSIGNMENT_UNCHANGED', 400);
                $this->resource('users', $driver, $a, $s['status'] === 'IN_PROGRESS');
                $this->resource('vehicles', $vehicle, $a, $s['status'] === 'IN_PROGRESS');
                $this->available($driver, $vehicle, $s['id']);
                if ($s['status'] === 'IN_PROGRESS') {
                    if (!isset($b['odometerKm'])) throw new DomainException('HANDOVER_ODOMETER_REQUIRED', 400);
                    $this->closeLeg($s, UnitOfWork::km($b['odometerKm']));
                    $this->openLeg($s['id'], $driver, $vehicle, $a);
                }
                $changes = ['driver_id' => $driver, 'vehicle_id' => $vehicle, 'status' => $s['status'] === 'IN_PROGRESS' ? 'IN_PROGRESS' : ($driver ? 'ASSIGNED' : 'PENDING')];
                break;
            case 'address':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                $changes['service_address'] = UnitOfWork::text($b['serviceAddress'] ?? null, 350, 2);
                $latest = $this->db->table('service_address_revisions')->selectMax('revision')->where('service_id', $s['id'])->get()->getRowArray();
                $this->revision($s['id'], $changes['service_address'], $a, (int)$latest['revision'] + 1);
                break;
            case 'cost-center':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                if (!array_key_exists('costCenterId', $b) || $b['costCenterId'] === '') throw new DomainException('COST_CENTER_REQUIRED', 400);
                $this->resource('cost_centers', UnitOfWork::id($b['costCenterId']), $a);
                $changes['cost_center_id'] = $b['costCenterId'];
                break;
            case 'cancel':
                if (!$admin) throw new DomainException('FORBIDDEN', 403);
                if (!in_array($s['status'], ['PENDING','ASSIGNED'], true) || !empty($s['started_at']) || $this->db->table('service_legs')->where('service_id',$s['id'])->countAllResults()) throw new DomainException('CANCEL_ONLY_BEFORE_START', 400);
                $changes = ['status' => 'CANCELLED', 'cancelled_at' => $now, 'void_reason' => UnitOfWork::text($b['reason'] ?? $b['voidReason'] ?? null, 500)];
                break;
            default: throw new DomainException('NOT_FOUND', 404);
        }
        $changes += ['version' => (int)$s['version'] + 1, 'updated_at' => $now];
        $ok = $this->db->table('bitacora_entries')->where('id', $s['id'])->where('version', $s['version'])->update($changes);
        if (!$ok || $this->db->affectedRows() !== 1) throw new DomainException('STALE_SERVICE', 409);
        AuditService::log($a['id'], 'BITACORA', $s['id'], strtoupper(str_replace('-', '_', $command)), $s, array_merge($s, $changes));
    }
    private function available(?string $driver, ?string $vehicle, ?string $except = null): void
    {
        foreach (['driver_id' => $driver, 'vehicle_id' => $vehicle] as $field => $id) {
            if (!$id) continue;
            $q = $this->db->table('service_legs')->where($field, $id)->where('ended_at', null);
            if ($except) $q->where('service_id !=', $except);
            if ($q->countAllResults()) throw new DomainException($field === 'driver_id' ? 'EL_CHOFER_YA_COMENZO_EL_SERVICIO' : 'EL_VEHICULO_YA_ESTA_EN_USO', 409);
        }
    }
    private function openLeg(string $service, ?string $driver, ?string $vehicle, array $actor): void
    {
        $this->resource('users', $driver, $actor, true);
        $v = $this->resource('vehicles', $vehicle, $actor, true);
        $this->available($driver, $vehicle);
        if ($v['current_odometer_km'] === null) throw new DomainException('INITIAL_ODOMETER_REQUIRED', 400);
        $this->db->table('service_legs')->insert(['id' => SecurityLib::generateUuid(), 'service_id' => $service, 'driver_id' => $driver,
            'vehicle_id' => $vehicle, 'started_at' => UnitOfWork::now(), 'departure_odometer_km' => $v['current_odometer_km'], 'created_at' => UnitOfWork::now()]);
    }
    private function closeLeg(array $service, int $km): void
    {
        $leg = $this->db->table('service_legs')->where('service_id', $service['id'])->where('ended_at', null)->get()->getRowArray();
        if (!$leg) throw new DomainException('INVALID_TRANSITION', 400);
        $vehicle = $this->db->table('vehicles')->where('id', $leg['vehicle_id'])->get()->getRowArray();
        if ($km < max((int)$leg['departure_odometer_km'], (int)$vehicle['current_odometer_km'])) throw new DomainException('ODOMETER_BELOW_CURRENT', 400);
        $this->db->table('service_legs')->where('id', $leg['id'])->update(['ended_at' => UnitOfWork::now(), 'arrival_odometer_km' => $km]);
        $this->db->table('vehicles')->where('id', $leg['vehicle_id'])->update(['current_odometer_km' => $km, 'updated_at' => UnitOfWork::now()]);
    }
    private function revision(string $service, string $address, array $actor, int $number): void
    {
        $this->db->table('service_address_revisions')->insert(['id' => SecurityLib::generateUuid(), 'service_id' => $service,
            'revision' => $number, 'address' => $address, 'actor_user_id' => $actor['id'], 'source' => $actor['role'], 'created_at' => UnitOfWork::now()]);
    }
}

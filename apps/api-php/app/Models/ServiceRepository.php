<?php
namespace App\Models;
use App\Libraries\{UnitOfWork, VehicleCatalog, UserAccounts};
use Config\Database;

final class ServiceRepository
{
    private $db;
    public function __construct(private array $actor) { $this->db = Database::connect(); }
    public function query() {
        $q = $this->db->table('viajes b')->select('b.*')->where('b.establishment_id', $this->actor['establishmentId']);
        if ($this->actor['role'] !== 'ADMIN') {
            $participation = $this->db->table('viajes_tramos')->select('id_viaje')->where('establishment_id', $this->actor['establishmentId'])->where('id_chofer', $this->actor['id']);
            $q->groupStart()->where('b.driver_id', $this->actor['id'])->orWhereIn('b.id_viaje', $participation)->groupEnd();
        }
        return $q;
    }
    public function find(string $id): ?array {
        if (!UnitOfWork::validId($id)) return null;
        $row = $this->query()->where('b.id_viaje', $id)->get()->getRowArray();
        if (!$row) {
            $alias = $this->db->table('folios_viajes_anteriores')->where('id_folio_anterior',$id)->where('establishment_id',$this->actor['establishmentId'])->get()->getRowArray();
            if ($alias) $row = $this->query()->where('b.id_viaje',$alias['id_viaje'])->get()->getRowArray();
        }
        return $row ? $this->serialize($row) : null;
    }
    public function listing(array $filters): array {
        $q = $this->query();
        foreach (['driverId' => 'driver_id', 'vehicleId' => 'vehicle_id'] as $param => $column) {
            if (empty($filters[$param])) continue;
            $id = UnitOfWork::id($filters[$param]);
            $participation = $this->db->table('viajes_tramos')->select('id_viaje')->where('establishment_id', $this->actor['establishmentId'])->where($column === 'driver_id' ? 'id_chofer' : 'id_vehiculo', $id);
            $q->groupStart()->where('b.'.$column, $id)->orWhereIn('b.id_viaje', $participation)->groupEnd();
        }
        $all = clone $q;
        if (!empty($filters['status'])) $q->where('b.status', $filters['status']);
        $total = (clone $q)->countAllResults();
        $page = max(1, (int)($filters['page'] ?? 1));
        $rows = $q->orderBy('b.created_at','DESC')->orderBy('b.id_viaje','DESC')->limit(30, ($page-1)*30)->get()->getResultArray();
        $activeQuery = (clone $all)->where('b.status','IN_PROGRESS');
        if ($this->actor['role'] !== 'ADMIN') $activeQuery->where('b.driver_id', $this->actor['id']);
        $active = $activeQuery->orderBy('b.started_at')->get()->getResultArray();
        $upcoming = $all->whereIn('b.status',['ASSIGNED','PENDING'])->orderBy('b.created_at')->get()->getResultArray();
        return ['entries'=>array_map($this->serialize(...),$rows), 'active'=>array_map($this->serialize(...),$active),
            'upcoming'=>array_map($this->serialize(...),$upcoming),'total'=>$total,'page'=>$page];
    }
    public function serialize(array $s): array {
        $user = fn($id) => $id ? UserAccounts::query($this->db)->where('u.id_usuario',$id)->where('f.establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $vehicle = fn($id) => $id ? VehicleCatalog::query($this->db)->where('v.id_vehiculo',$id)->where('v.establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $driverDto = fn($u) => $u ? ['id'=>(string)$u['id_usuario'],'fullName'=>$u['full_name'],'rosterCode'=>$u['roster_code']] : null;
        $vehicleDto = fn($v) => $v ? ['id'=>(string)$v['id_vehiculo'],'roleCode'=>$v['codigo_movil'],'licensePlate'=>$v['license_plate'],'model'=>$v['model']] : null;
        $cc = $s['cost_center_id'] ? $this->db->table('centros_costos')->where('id_centro_costo',$s['cost_center_id'])->where('establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $driver = $driverDto($user($s['driver_id']));
        $mobile = $vehicleDto($vehicle($s['vehicle_id']));
        $dep = $s['departure_odometer_km'] === null ? null : (int)$s['departure_odometer_km'];
        $arr = $s['arrival_odometer_km'] === null ? null : (int)$s['arrival_odometer_km'];
        $reading = [];
        $legs = $this->db->table('viajes_tramos')->where('establishment_id', $this->actor['establishmentId'])->where('id_viaje',$s['id_viaje'])->orderBy('fecha_inicio')->orderBy('id_viaje_tramo')->get()->getResultArray();
        // Historical trips without legs used a single vehicle, so their header readings remain valid.
        $distance = $legs ? 0 : ($dep !== null && $arr !== null ? $arr - $dep : null);
        foreach ($legs as $leg) {
            $start = $leg['odometro_inicio'] === null ? null : (int)$leg['odometro_inicio'];
            $end = $leg['odometro_fin'] === null ? null : (int)$leg['odometro_fin'];
            $distance = $distance !== null && $start !== null && $end !== null ? $distance + $end - $start : null;
            // Historical actors remain attributable after a staff transfer.
            $u = UserAccounts::query($this->db)->where('u.id_usuario',$leg['id_chofer'])->get()->getRowArray();
            $v = VehicleCatalog::query($this->db)->where('v.id_vehiculo',$leg['id_vehiculo'])->get()->getRowArray();
            $reading[] = ['id'=>(string)$leg['id_viaje_tramo'],'startedAt'=>UnitOfWork::iso($leg['fecha_inicio']),'endedAt'=>UnitOfWork::iso($leg['fecha_fin']),
                'departureOdometerKm'=>$start,'arrivalOdometerKm'=>$end,'driver'=>$driverDto($u),'vehicle'=>$vehicleDto($v)];
        }
        $revs = $this->db->table('revisiones_direccion')->where('establishment_id',$this->actor['establishmentId'])->where('service_id',(string)$s['id_viaje'])->orderBy('revision','DESC')->get()->getResultArray();
        return ['id'=>(string)$s['id_viaje'],'version'=>(int)$s['version'],'status'=>$s['status'],
            'serviceAddress'=>$s['destino'],'originalAddress'=>$revs ? $revs[count($revs)-1]['address'] : $s['destino'],'actionPerformed'=>$s['actividad'],
            'driverId'=>self::optionalId($s['driver_id']),'vehicleId'=>self::optionalId($s['vehicle_id']),'driver'=>$driver,'vehicle'=>$mobile,
            'costCenterId'=>self::optionalId($s['cost_center_id']),'costCenter'=>$cc ? ['id'=>(string)$cc['id_centro_costo'],'code'=>$cc['code'],'name'=>$cc['name'],'active'=>(bool)$cc['active']] : null,
            'startedAt'=>UnitOfWork::iso($s['started_at']),'endedAt'=>UnitOfWork::iso($s['ended_at']),'cancelledAt'=>UnitOfWork::iso($s['cancelled_at']),
            'createdAt'=>UnitOfWork::iso($s['created_at']),'updatedAt'=>UnitOfWork::iso($s['updated_at']),'voidReason'=>$s['void_reason'],
            'odometerKm'=>$arr,'departureOdometerKm'=>$dep,'distanceKm'=>$distance,'legs'=>$reading,
            'previousTripId'=>null,
            'addressRevisions'=>array_map(fn($r)=>['id'=>(string)$r['id_revision_direccion'],'revision'=>(int)$r['revision'],'address'=>$r['address'],'source'=>$r['source'],
                'createdAt'=>UnitOfWork::iso($r['created_at']),'actor'=>$driverDto($user($r['actor_user_id']))],$revs)];
    }
    private static function optionalId(mixed $id): ?string {
        return $id === null ? null : (string)$id;
    }

    private function auditIds(string $id): array {
        $entry=$this->find($id);
        if (!$entry) return [];
        $aliases=$this->db->table('folios_viajes_anteriores')->where('id_viaje',$entry['id'])->where('establishment_id',$this->actor['establishmentId'])->get()->getResultArray();
        return array_unique(array_merge([$entry['id']],array_column($aliases,'id_folio_anterior')));
    }

    public function audit(string $id): array {
        if (!$this->find($id)) throw new \DomainException('NOT_FOUND',404);
        $rows=Database::connect()->table('registros_auditoria a')->select('a.*,u.full_name')->join('usuarios u','u.id_usuario=a.actor_user_id','left')->where('a.establishment_id',$this->actor['establishmentId'])->whereIn('a.entity_id', $this->auditIds($id))->where('a.entity_type','BITACORA')->orderBy('a.id_registro_auditoria','DESC')->limit(200)->get()->getResultArray();
        return array_map(fn($r)=>['id'=>(string)$r['id_registro_auditoria'],'action'=>$r['action'],'actor'=>$r['full_name'] ? ['fullName'=>$r['full_name']] : null,
            'createdAt'=>UnitOfWork::iso($r['created_at']),'beforeData'=>$r['before_data'] ? json_decode($r['before_data'],true) : null,'afterData'=>$r['after_data'] ? json_decode($r['after_data'],true) : null],$rows);
    }
}

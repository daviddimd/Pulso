<?php
namespace App\Models;
use App\Libraries\{UnitOfWork, VehicleCatalog};
use Config\Database;

final class ServiceRepository
{
    private $db;
    public function __construct(private array $actor) { $this->db = Database::connect(); }
    public function query() {
        $q = $this->db->table('viajes b')->select('b.*')->where('b.establishment_id', $this->actor['establishmentId']);
        if ($this->actor['role'] !== 'ADMIN') $q->where('b.driver_id', $this->actor['id']);
        return $q;
    }
    public function find(string $id): ?array {
        if (!UnitOfWork::validId($id)) return null;
        $row = $this->query()->where('b.id_viaje', $id)->get()->getRowArray();
        return $row ? $this->serialize($row) : null;
    }
    public function listing(array $filters): array {
        $q = $this->query();
        foreach (['driverId' => 'driver_id', 'vehicleId' => 'vehicle_id'] as $param => $column) {
            if (empty($filters[$param])) continue;
            $q->where('b.'.$column, UnitOfWork::id($filters[$param]));
        }
        $all = clone $q;
        if (!empty($filters['status'])) $q->where('b.status', $filters['status']);
        $total = (clone $q)->countAllResults();
        $page = max(1, (int)($filters['page'] ?? 1));
        $rows = $q->orderBy('b.created_at','DESC')->orderBy('b.id_viaje','DESC')->limit(30, ($page-1)*30)->get()->getResultArray();
        $active = (clone $all)->where('b.status','IN_PROGRESS')->orderBy('b.started_at')->get()->getResultArray();
        $upcoming = $all->whereIn('b.status',['ASSIGNED','PENDING'])->orderBy('b.created_at')->get()->getResultArray();
        return ['entries'=>array_map($this->serialize(...),$rows), 'active'=>array_map($this->serialize(...),$active),
            'upcoming'=>array_map($this->serialize(...),$upcoming),'total'=>$total,'page'=>$page];
    }
    public function serialize(array $s): array {
        $user = fn($id) => $id ? $this->db->table('usuarios')->select('id_usuario,full_name,roster_code')->where('id_usuario',$id)->where('establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $vehicle = fn($id) => $id ? VehicleCatalog::query($this->db)->where('v.id_vehiculo',$id)->where('v.establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $driverDto = fn($u) => $u ? ['id'=>(string)$u['id_usuario'],'fullName'=>$u['full_name'],'rosterCode'=>$u['roster_code']] : null;
        $vehicleDto = fn($v) => $v ? ['id'=>(string)$v['id_vehiculo'],'roleCode'=>$v['codigo_movil'],'licensePlate'=>$v['license_plate'],'model'=>$v['model']] : null;
        $cc = $s['cost_center_id'] ? $this->db->table('centros_costos')->where('id_centro_costo',$s['cost_center_id'])->where('establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $driver = $driverDto($user($s['driver_id']));
        $mobile = $vehicleDto($vehicle($s['vehicle_id']));
        $dep = $s['departure_odometer_km'] === null ? null : (int)$s['departure_odometer_km'];
        $arr = $s['arrival_odometer_km'] === null ? null : (int)$s['arrival_odometer_km'];
        $distance = $dep !== null && $arr !== null ? $arr - $dep : null;
        // Keep the existing API/export contract as a projection of the single trip row.
        $reading = $s['started_at'] && $driver && $mobile ? [[
            'id'=>(string)$s['id_viaje'], 'startedAt'=>UnitOfWork::iso($s['started_at']), 'endedAt'=>UnitOfWork::iso($s['ended_at']),
            'departureOdometerKm'=>$dep, 'arrivalOdometerKm'=>$arr, 'driver'=>$driver, 'vehicle'=>$mobile,
        ]] : [];
        $revs = $this->db->table('revisiones_direccion')->where('service_id',(string)$s['id_viaje'])->orderBy('revision','DESC')->get()->getResultArray();
        return ['id'=>(string)$s['id_viaje'],'version'=>(int)$s['version'],'status'=>$s['status'],
            'serviceAddress'=>$s['destino'],'originalAddress'=>$revs ? $revs[count($revs)-1]['address'] : $s['destino'],'actionPerformed'=>$s['actividad'],
            'driverId'=>self::optionalId($s['driver_id']),'vehicleId'=>self::optionalId($s['vehicle_id']),'driver'=>$driver,'vehicle'=>$mobile,
            'costCenterId'=>self::optionalId($s['cost_center_id']),'costCenter'=>$cc ? ['id'=>(string)$cc['id_centro_costo'],'code'=>$cc['code'],'name'=>$cc['name'],'active'=>(bool)$cc['active']] : null,
            'startedAt'=>UnitOfWork::iso($s['started_at']),'endedAt'=>UnitOfWork::iso($s['ended_at']),'cancelledAt'=>UnitOfWork::iso($s['cancelled_at']),
            'createdAt'=>UnitOfWork::iso($s['created_at']),'updatedAt'=>UnitOfWork::iso($s['updated_at']),'voidReason'=>$s['void_reason'],
            'odometerKm'=>$arr,'departureOdometerKm'=>$dep,'distanceKm'=>$distance,'legs'=>$reading,
            'previousTripId'=>self::optionalId($s['id_viaje_anterior']),
            'addressRevisions'=>array_map(fn($r)=>['id'=>(string)$r['id_revision_direccion'],'revision'=>(int)$r['revision'],'address'=>$r['address'],'source'=>$r['source'],
                'createdAt'=>UnitOfWork::iso($r['created_at']),'actor'=>$driverDto($user($r['actor_user_id']))],$revs)];
    }
    private static function optionalId(mixed $id): ?string {
        return $id === null ? null : (string)$id;
    }

    public function audit(string $id): array {
        if (!$this->find($id)) throw new \DomainException('NOT_FOUND',404);
        $rows=Database::connect()->table('registros_auditoria a')->select('a.*,u.full_name')->join('usuarios u','u.id_usuario=a.actor_user_id','left')->where('a.entity_id',$id)->where('a.entity_type','BITACORA')->orderBy('a.id_registro_auditoria','DESC')->limit(200)->get()->getResultArray();
        return array_map(fn($r)=>['id'=>(string)$r['id_registro_auditoria'],'action'=>$r['action'],'actor'=>$r['full_name'] ? ['fullName'=>$r['full_name']] : null,
            'createdAt'=>UnitOfWork::iso($r['created_at']),'beforeData'=>$r['before_data'] ? json_decode($r['before_data'],true) : null,'afterData'=>$r['after_data'] ? json_decode($r['after_data'],true) : null],$rows);
    }
}

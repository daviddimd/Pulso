<?php
namespace App\Models;
use App\Libraries\UnitOfWork;
use Config\Database;

final class ServiceRepository
{
    private $db;
    public function __construct(private array $actor) { $this->db = Database::connect(); }
    public function query() {
        $q = $this->db->table('bitacora_entries b')->select('b.*')->where('b.establishment_id', $this->actor['establishmentId']);
        if ($this->actor['role'] !== 'ADMIN') $q->where('b.driver_id', $this->actor['id']);
        return $q;
    }
    public function find(string $id): ?array {
        $row = $this->query()->where('b.id', $id)->get()->getRowArray();
        return $row ? $this->serialize($row) : null;
    }
    public function listing(array $filters): array {
        $q = $this->query();
        foreach (['driverId' => 'driver_id', 'vehicleId' => 'vehicle_id'] as $param => $column) {
            if (empty($filters[$param])) continue;
            $sub = $this->db->table('service_legs')->select('service_id')->where($column, $filters[$param]);
            $q->groupStart()->where('b.'.$column, $filters[$param])->orWhereIn('b.id', $sub)->groupEnd();
        }
        $all = clone $q;
        if (!empty($filters['status'])) $q->where('b.status', $filters['status']);
        $total = (clone $q)->countAllResults();
        $page = max(1, (int)($filters['page'] ?? 1));
        $rows = $q->orderBy('b.created_at','DESC')->orderBy('b.id')->limit(30, ($page-1)*30)->get()->getResultArray();
        $active = (clone $all)->where('b.status','IN_PROGRESS')->orderBy('b.started_at')->get()->getResultArray();
        $upcoming = $all->whereIn('b.status',['ASSIGNED','PENDING'])->orderBy('b.created_at')->get()->getResultArray();
        return ['entries'=>array_map($this->serialize(...),$rows), 'active'=>array_map($this->serialize(...),$active),
            'upcoming'=>array_map($this->serialize(...),$upcoming),'total'=>$total,'page'=>$page];
    }
    public function serialize(array $s): array {
        $user = fn($id) => $id ? $this->db->table('users')->select('id,full_name,roster_code')->where('id',$id)->where('establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $vehicle = fn($id) => $id ? $this->db->table('vehicles')->where('id',$id)->where('establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $driverDto = fn($u) => $u ? ['id'=>$u['id'],'fullName'=>$u['full_name'],'rosterCode'=>$u['roster_code']] : null;
        $vehicleDto = fn($v) => $v ? ['id'=>$v['id'],'roleCode'=>$v['role_code'],'licensePlate'=>$v['license_plate'],'model'=>$v['model']] : null;
        $cc = $s['cost_center_id'] ? $this->db->table('cost_centers')->where('id',$s['cost_center_id'])->where('establishment_id',$this->actor['establishmentId'])->get()->getRowArray() : null;
        $legs = $this->db->table('service_legs')->where('service_id',$s['id'])->orderBy('started_at')->orderBy('id')->get()->getResultArray();
        $distance = count($legs) ? 0 : null;
        $legDtos = [];
        foreach ($legs as $l) {
            $dep = $l['departure_odometer_km'] === null ? null : (int)$l['departure_odometer_km'];
            $arr = $l['arrival_odometer_km'] === null ? null : (int)$l['arrival_odometer_km'];
            $distance = $distance !== null && $dep !== null && $arr !== null ? $distance + $arr - $dep : null;
            $legDtos[] = ['id'=>$l['id'],'startedAt'=>UnitOfWork::iso($l['started_at']),'endedAt'=>UnitOfWork::iso($l['ended_at']),
                'departureOdometerKm'=>$dep,'arrivalOdometerKm'=>$arr,'driver'=>$driverDto($user($l['driver_id'])),'vehicle'=>$vehicleDto($vehicle($l['vehicle_id']))];
        }
        $revs = $this->db->table('service_address_revisions')->where('service_id',$s['id'])->orderBy('revision','DESC')->get()->getResultArray();
        return ['id'=>$s['id'],'version'=>(int)$s['version'],'status'=>$s['status'],
            'serviceAddress'=>$s['service_address'],'originalAddress'=>$revs ? $revs[count($revs)-1]['address'] : $s['service_address'],'actionPerformed'=>$s['action_performed'],
            'driverId'=>$s['driver_id'],'vehicleId'=>$s['vehicle_id'],'driver'=>$driverDto($user($s['driver_id'])),'vehicle'=>$vehicleDto($vehicle($s['vehicle_id'])),
            'costCenterId'=>$s['cost_center_id'],'costCenter'=>$cc ? ['id'=>$cc['id'],'code'=>$cc['code'],'name'=>$cc['name'],'active'=>(bool)$cc['active']] : null,
            'startedAt'=>UnitOfWork::iso($s['started_at']),'endedAt'=>UnitOfWork::iso($s['ended_at']),'cancelledAt'=>UnitOfWork::iso($s['cancelled_at']),
            'createdAt'=>UnitOfWork::iso($s['created_at']),'updatedAt'=>UnitOfWork::iso($s['updated_at']),'voidReason'=>$s['void_reason'],
            'odometerKm'=>$s['odometer_km'] === null ? null : (int)$s['odometer_km'],'distanceKm'=>$distance,'legs'=>$legDtos,
            'addressRevisions'=>array_map(fn($r)=>['id'=>$r['id'],'revision'=>(int)$r['revision'],'address'=>$r['address'],'source'=>$r['source'],
                'createdAt'=>UnitOfWork::iso($r['created_at']),'actor'=>$driverDto($user($r['actor_user_id']))],$revs)];
    }
    public function audit(string $id): array {
        if (!$this->find($id)) throw new \DomainException('NOT_FOUND',404);
        $rows=Database::connect()->table('audit_logs a')->select('a.*,u.full_name')->join('users u','u.id=a.actor_user_id','left')->where('a.entity_id',$id)->where('a.entity_type','BITACORA')->orderBy('a.id','DESC')->limit(200)->get()->getResultArray();
        return array_map(fn($r)=>['id'=>(string)$r['id'],'action'=>$r['action'],'actor'=>$r['full_name'] ? ['fullName'=>$r['full_name']] : null,
            'createdAt'=>UnitOfWork::iso($r['created_at']),'beforeData'=>$r['before_data'] ? json_decode($r['before_data'],true) : null,'afterData'=>$r['after_data'] ? json_decode($r['after_data'],true) : null],$rows);
    }
}

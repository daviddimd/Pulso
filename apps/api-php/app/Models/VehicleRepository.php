<?php
namespace App\Models;
use App\Libraries\{UnitOfWork,SecurityLib,AuditService};
use Config\Database;
use DomainException;
final class VehicleRepository {
    private function dto(array $v): array {
        return ['id'=>$v['id'],'roleCode'=>$v['role_code'],'licensePlate'=>$v['license_plate'],'model'=>$v['model'],'year'=>$v['year']===null ? null : (int)$v['year'],
            'vehicleType'=>$v['vehicle_type'],'currentOdometerKm'=>$v['current_odometer_km']===null ? null : (int)$v['current_odometer_km'],'active'=>(bool)$v['active'],
            'updatedAt'=>UnitOfWork::iso($v['updated_at']),'inService'=>Database::connect()->table('service_legs')->where('vehicle_id',$v['id'])->where('ended_at',null)->countAllResults()>0];
    }
    public function listing(array $actor): array {
        $q=Database::connect()->table('vehicles')->where('establishment_id',$actor['establishmentId']);
        if ($actor['role'] !== 'ADMIN') $q->where('active',1);
        return array_map($this->dto(...),$q->orderBy('role_code')->get()->getResultArray());
    }
    public function odometerHistory(string $id,array $actor,int $page=1): array {
        $db=Database::connect();
        if (!$db->table('vehicles')->where('id',$id)->where('establishment_id',$actor['establishmentId'])->get()->getRowArray()) throw new DomainException('NOT_FOUND',404);
        // Include older UPDATE records, excluding edits that only changed identification.
        $q=$db->table('audit_logs a')->where('a.entity_type','VEHICLE')->where('a.entity_id',$id)
            ->groupStart()->where('a.action','ODOMETER_ADJUSTMENT')->orGroupStart()->where('a.action','UPDATE')
            ->where("JSON_CONTAINS_PATH(a.after_data, 'one', '$.current_odometer_km') = 1",null,false)
            ->groupStart()->where("NOT (JSON_EXTRACT(a.before_data, '$.current_odometer_km') <=> JSON_EXTRACT(a.after_data, '$.current_odometer_km'))",null,false)
            ->orWhere("NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.after_data, '$.reason')), 'null') IS NOT NULL",null,false)->groupEnd()->groupEnd()->groupEnd();
        $total=(clone $q)->countAllResults();
        $page=max(1,$page);
        $rows=$q->select('a.id,a.created_at,a.before_data,a.after_data,u.full_name')->join('users u','u.id=a.actor_user_id AND u.establishment_id='.$db->escape($actor['establishmentId']),'left')
            ->orderBy('a.id','DESC')->limit(20,($page-1)*20)->get()->getResultArray();
        $corrections=array_map(function($r) {
            $before=json_decode($r['before_data']??'null',true)??[];
            $after=json_decode($r['after_data']??'null',true)??[];
            return ['id'=>(string)$r['id'],'createdAt'=>UnitOfWork::iso($r['created_at']),
                'previousOdometerKm'=>isset($before['current_odometer_km'])?(int)$before['current_odometer_km']:null,
                'newOdometerKm'=>isset($after['current_odometer_km'])?(int)$after['current_odometer_km']:null,
                'reason'=>$after['reason']??null,'actor'=>$r['full_name']?['fullName'=>$r['full_name']]:null];
        },$rows);
        return ['corrections'=>$corrections,'total'=>$total,'page'=>$page,'pageSize'=>20];
    }
    public function create(array $b,array $a): array {
            $row=UnitOfWork::run($a,function($db) use ($a,$b) {
                $year=$b['year']??null;
                if ($year !== null && (!is_int($year)||$year<1900||$year>(int)date('Y')+1)) throw new DomainException('INVALID_SERVICE_DATA',400);
                $r=['id'=>SecurityLib::generateUuid(),'establishment_id'=>$a['establishmentId'],'role_code'=>UnitOfWork::text($b['roleCode']??null,30),
                    'license_plate'=>strtoupper(UnitOfWork::text($b['licensePlate']??null,20)),'model'=>isset($b['model']) ? UnitOfWork::text($b['model'],120) : null,
                    'vehicle_type'=>isset($b['vehicleType']) ? UnitOfWork::text($b['vehicleType'],60) : null,'year'=>$year,
                    'current_odometer_km'=>UnitOfWork::km($b['currentOdometerKm']??null),'active'=>1,'created_at'=>UnitOfWork::now(),'updated_at'=>UnitOfWork::now()];
                $db->table('vehicles')->insert($r);
                AuditService::log($a['id'],'VEHICLE',$r['id'],'CREATE',null,$r);
                return $r;
            });
            return $this->dto($row);
    }
    public function update(string $id,array $b,array $a): array {
            $row=UnitOfWork::run($a,function($db) use ($id,$a,$b) {
                $v=$db->table('vehicles')->where('id',$id)->where('establishment_id',$a['establishmentId'])->get()->getRowArray();
                if (!$v) throw new DomainException('NOT_FOUND',404);
                if (($b['expectedUpdatedAt']??null) !== UnitOfWork::iso($v['updated_at'])) throw new DomainException('STALE_RECORD',409);
                foreach (array_keys($b) as $field) if(!in_array($field,['expectedUpdatedAt','currentOdometerKm','reason'],true)) throw new DomainException('IMMUTABLE_VEHICLE_DATA',400);
                if (!array_key_exists('currentOdometerKm',$b)) throw new DomainException('INVALID_SERVICE_DATA',400);
                $active=$db->table('service_legs')->where('vehicle_id',$id)->where('ended_at',null)->countAllResults();
                $updates=[];
                if (array_key_exists('currentOdometerKm',$b)) {
                    if ($active) throw new DomainException('VEHICLE_IN_SERVICE',409);
                    $reason=UnitOfWork::text($b['reason']??null,500);
                    $updates['current_odometer_km']=UnitOfWork::km($b['currentOdometerKm']);
                }
                // Ensure the optimistic token changes even for two edits within one millisecond.
                $stamp=max((new \DateTimeImmutable('now'))->format('U.u'),(new \DateTimeImmutable($v['updated_at']))->format('U.u')+0.001);
                $updates['updated_at']=\DateTimeImmutable::createFromFormat('U.u',sprintf('%.6F',$stamp))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
                $db->table('vehicles')->where('id',$id)->update($updates);
                $fresh=array_merge($v,$updates);
                AuditService::log($a['id'],'VEHICLE',$id,'ODOMETER_ADJUSTMENT',$v,$fresh+['reason'=>$reason]);
                return $fresh;
            });
            return $this->dto($row);
    }
}

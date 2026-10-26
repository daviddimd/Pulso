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
                foreach (['licensePlate','model','year','vehicleType'] as $field) if(array_key_exists($field,$b)) throw new DomainException('IMMUTABLE_VEHICLE_DATA',400);
                $active=$db->table('service_legs')->where('vehicle_id',$id)->where('ended_at',null)->countAllResults();
                $updates=[];
                if (array_key_exists('active',$b)) {
                    if (!is_bool($b['active'])) throw new DomainException('INVALID_SERVICE_DATA',400);
                    if (!$b['active'] && $active) throw new DomainException('VEHICLE_IN_SERVICE',409);
                    $updates['active']=(int)$b['active'];
                }
                if (isset($b['roleCode'])) $updates['role_code']=UnitOfWork::text($b['roleCode'],30);
                if (array_key_exists('currentOdometerKm',$b)) {
                    if ($active) throw new DomainException('VEHICLE_IN_SERVICE',409);
                    UnitOfWork::text($b['reason']??null,500);
                    $updates['current_odometer_km']=UnitOfWork::km($b['currentOdometerKm']);
                }
                // Ensure the optimistic token changes even for two edits within one millisecond.
                $stamp=max((new \DateTimeImmutable('now'))->format('U.u'),(new \DateTimeImmutable($v['updated_at']))->format('U.u')+0.001);
                $updates['updated_at']=\DateTimeImmutable::createFromFormat('U.u',sprintf('%.6F',$stamp))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
                $db->table('vehicles')->where('id',$id)->update($updates);
                $fresh=array_merge($v,$updates);
                AuditService::log($a['id'],'VEHICLE',$id,'UPDATE',$v,$fresh+['reason'=>$b['reason']??null]);
                return $fresh;
            });
            return $this->dto($row);
    }
}

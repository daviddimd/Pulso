<?php
namespace App\Models;
use Config\Database;
use DomainException;
use DateTimeImmutable;
use DateTimeZone;
final class ReportRepository {
    public readonly string $from;
    public readonly string $to;
    private string $start;
    private string $end;
    private string $timezone;
    public function __construct(private array $actor,array $query) {
        $tz=new DateTimeZone(Database::connect()->table('establecimientos')->where('id_establecimiento',$actor['establishmentId'])->get()->getRowArray()['timezone']);
        $this->timezone=$tz->getName();
        $this->from=(string)($query['from']??''); $this->to=(string)($query['to']??'');
        $from=DateTimeImmutable::createFromFormat('!Y-m-d',$this->from,$tz);
        $to=DateTimeImmutable::createFromFormat('!Y-m-d',$this->to,$tz);
        if (!$from||!$to||$from->format('Y-m-d')!==$this->from||$to->format('Y-m-d')!==$this->to||$to<$from||$from->diff($to)->days>365) throw new DomainException('INVALID_DATE_RANGE',400);
        $this->start=$from->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $this->end=$to->modify('+1 day')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
    public function services(bool $cancelled=false): array {
        $repo=new ServiceRepository($this->actor);
        $q=$repo->query()->groupStart()->groupStart()->where('b.status','COMPLETED')->where('b.ended_at >=',$this->start)->where('b.ended_at <',$this->end)->groupEnd();
        if($cancelled) $q->orGroupStart()->where('b.status','CANCELLED')->where('b.cancelled_at >=',$this->start)->where('b.cancelled_at <',$this->end)->groupEnd();
        return array_map($repo->serialize(...),$q->groupEnd()->orderBy('b.ended_at')->get()->getResultArray());
    }
    public function summary(): array {
        $centers=Database::connect()->table('centros_costos')->where('establishment_id',$this->actor['establishmentId'])->orderBy('code')->get()->getResultArray();
        $rows=[];
        foreach($centers as $cc) $rows[(string)$cc['id_centro_costo']]=['id'=>(string)$cc['id_centro_costo'],'code'=>$cc['code'],'name'=>$cc['name'],'completedTrips'=>0,'completedKm'=>0,'completedUnknownKm'=>0,'cancelledTrips'=>0];
        foreach($this->services(true) as $s) {
            $key=$s['costCenterId']??'';
            if(!isset($rows[$key])) $rows[$key]=['id'=>null,'code'=>'S/C','name'=>'Indefinido','completedTrips'=>0,'completedKm'=>0,'completedUnknownKm'=>0,'cancelledTrips'=>0];
            if($s['status']==='CANCELLED') $rows[$key]['cancelledTrips']++;
            else { $rows[$key]['completedTrips']++; if($s['distanceKm']===null) $rows[$key]['completedUnknownKm']++; else $rows[$key]['completedKm']+=$s['distanceKm']; }
        }
        return ['from'=>$this->from,'to'=>$this->to,'rows'=>array_values($rows)];
    }
    public function daily(): array {
        $services=$this->services(); $legs=[]; $centers=[];
        foreach($services as $s) {
            foreach($s['legs'] as $l) $legs[]=['id'=>$l['id'],'serviceId'=>$s['id'],'driverName'=>$l['driver']['fullName'],'licensePlate'=>$l['vehicle']['licensePlate'],
                'startedAt'=>$l['startedAt'],'endedAt'=>$l['endedAt'],'departureOdometerKm'=>$l['departureOdometerKm'],'arrivalOdometerKm'=>$l['arrivalOdometerKm'],
                'traveledKm'=>$l['departureOdometerKm']===null||$l['arrivalOdometerKm']===null ? null : $l['arrivalOdometerKm']-$l['departureOdometerKm']];
            $key=$s['costCenterId']??'';
            if(!isset($centers[$key])) $centers[$key]=['code'=>$s['costCenter']['code']??'S/C','name'=>$s['costCenter']['name']??'Indefinido','trips'=>0,'km'=>0,'unknownKm'=>0];
            $centers[$key]['trips']++; $centers[$key]['km']+=$s['distanceKm']??0; if($s['distanceKm']===null) $centers[$key]['unknownKm']++;
        }
        return ['timezone'=>$this->timezone,'dateRange'=>['from'=>$this->from,'to'=>$this->to],'services'=>array_map(fn($s)=>['id'=>$s['id'],'driverName'=>$s['driver']['fullName']??null,'driverRosterCode'=>$s['driver']['rosterCode']??null,
            'licensePlate'=>$s['vehicle']['licensePlate']??null,'vehicleRoleCode'=>$s['vehicle']['roleCode']??null,'costCenterCode'=>$s['costCenter']['code']??null,'costCenterName'=>$s['costCenter']['name']??null,
            'serviceAddress'=>$s['serviceAddress'],'actionPerformed'=>$s['actionPerformed'],'startedAt'=>$s['startedAt'],'endedAt'=>$s['endedAt'],'odometerKm'=>$s['odometerKm'],'departureOdometerKm'=>$s['departureOdometerKm'],'previousTripId'=>$s['previousTripId'],'distanceKm'=>$s['distanceKm']],$services),
            'legs'=>$legs,'costCenters'=>array_values($centers)];
    }
}

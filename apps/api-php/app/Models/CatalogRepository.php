<?php
namespace App\Models;
use Config\Database;
final class CatalogRepository {
    public function driver(string $id,string $establishment): array {
        $db=Database::connect();
        $d=$db->table('users u')->select('u.id,u.full_name,u.username,u.roster_code,u.active,e.name as establishment_name')
            ->join('establishments e','e.id=u.establishment_id')->where('u.id',$id)->where('u.establishment_id',$establishment)->where('u.role','DRIVER')->get()->getRowArray();
        if (!$d) throw new \DomainException('NOT_FOUND',404);
        return ['id'=>$d['id'],'fullName'=>$d['full_name'],'username'=>$d['username'],'rosterCode'=>$d['roster_code'],
            'active'=>(bool)$d['active'],'establishmentName'=>$d['establishment_name'],
            'inService'=>$db->table('service_legs')->where('driver_id',$id)->where('ended_at',null)->countAllResults()>0];
    }
    public function drivers(string $establishment): array {
        $db=Database::connect();
        $drivers=$db->table('users')->where('establishment_id',$establishment)->where('role','DRIVER')->where('active',1)->orderBy('full_name')->get()->getResultArray();
        return array_map(function($d) use($db) {
            $legs=$db->table('service_legs')->select('service_id')->where('driver_id',$d['id'])->where('ended_at',null)->get()->getResultArray();
            return ['id'=>$d['id'],'fullName'=>$d['full_name'],'rosterCode'=>$d['roster_code'],'serviceLegs'=>array_map(fn($l)=>['serviceId'=>$l['service_id']],$legs)];
        },$drivers);
    }
    public function costCenters(string $establishment): array {
        $rows=Database::connect()->table('cost_centers')->where('establishment_id',$establishment)->where('active',1)->orderBy('code')->get()->getResultArray();
        return array_map(fn($c)=>['id'=>$c['id'],'code'=>$c['code'],'name'=>$c['name'],'active'=>(bool)$c['active']],$rows);
    }
}

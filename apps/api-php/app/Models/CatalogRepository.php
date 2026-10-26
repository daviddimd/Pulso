<?php
namespace App\Models;
use Config\Database;
final class CatalogRepository {
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

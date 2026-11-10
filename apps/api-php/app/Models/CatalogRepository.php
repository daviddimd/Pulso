<?php
namespace App\Models;
use App\Libraries\UnitOfWork;
use Config\Database;
final class CatalogRepository {
    public function driver(string $id,string $establishment): array {
        $db=Database::connect();
        if (!UnitOfWork::validId($id)) throw new \DomainException('NOT_FOUND',404);
        $d=$db->table('usuarios u')->select('u.id_usuario,u.full_name,u.username,u.roster_code,u.active,e.name as establishment_name')
            ->join('establecimientos e','e.id_establecimiento=u.establishment_id')->join('roles r','r.id_rol=u.id_rol')->where('u.id_usuario',$id)->where('u.establishment_id',$establishment)->where('r.codigo','DRIVER')->get()->getRowArray();
        if (!$d) throw new \DomainException('NOT_FOUND',404);
        return ['id'=>(string)$d['id_usuario'],'fullName'=>$d['full_name'],'username'=>$d['username'],'rosterCode'=>$d['roster_code'],
            'active'=>(bool)$d['active'],'establishmentName'=>$d['establishment_name'],
            'inService'=>$db->table('viajes')->where('driver_id',$id)->where('status','IN_PROGRESS')->countAllResults()>0];
    }
    public function drivers(string $establishment): array {
        $db=Database::connect();
        $drivers=$db->table('usuarios u')->select('u.*')->join('roles r','r.id_rol=u.id_rol')->where('u.establishment_id',$establishment)->where('r.codigo','DRIVER')->where('u.active',1)->orderBy('u.full_name')->get()->getResultArray();
        return array_map(function($d) use($db) {
            $legs=$db->table('viajes')->select('id_viaje')->where('driver_id',$d['id_usuario'])->where('status','IN_PROGRESS')->get()->getResultArray();
            return ['id'=>(string)$d['id_usuario'],'fullName'=>$d['full_name'],'rosterCode'=>$d['roster_code'],'serviceLegs'=>array_map(fn($l)=>['serviceId'=>(string)$l['id_viaje']],$legs)];
        },$drivers);
    }
    public function costCenters(string $establishment): array {
        $rows=Database::connect()->table('centros_costos')->where('establishment_id',$establishment)->where('active',1)->orderBy('code')->get()->getResultArray();
        return array_map(fn($c)=>['id'=>(string)$c['id_centro_costo'],'code'=>$c['code'],'name'=>$c['name'],'active'=>(bool)$c['active']],$rows);
    }
}

<?php
namespace App\Models;
use App\Libraries\UnitOfWork;
use Config\Database;
final class CatalogRepository {
    public function driver(string $id,string $establishment): array {
        $db=Database::connect();
        if (!UnitOfWork::validId($id)) throw new \DomainException('NOT_FOUND',404);
        $d=$db->table('usuarios u')->select('u.id_usuario,u.nombre_completo,u.nombre_usuario,f.codigo_roster,u.activo,e.nombre AS nombre_establecimiento')
            ->join('funcionarios f','f.id_funcionario=u.id_funcionario')->join('establecimientos e','e.id_establecimiento=f.id_establecimiento')->join('roles r','r.id_rol=u.id_rol')->where('u.id_usuario',$id)->where('f.id_establecimiento',$establishment)->where('r.codigo','CHOFER')->get()->getRowArray();
        if (!$d) throw new \DomainException('NOT_FOUND',404);
        return ['id'=>(string)$d['id_usuario'],'fullName'=>$d['nombre_completo'],'username'=>$d['nombre_usuario'],'rosterCode'=>$d['codigo_roster'],
            'active'=>(bool)$d['activo'],'establishmentName'=>$d['nombre_establecimiento'],
            'inService'=>$db->table('viajes_tramos')->where('id_chofer',$id)->where('id_establecimiento',$establishment)->where('fecha_fin',null)->countAllResults()>0];
    }
    public function drivers(string $establishment): array {
        $db=Database::connect();
        $drivers=$db->table('usuarios u')->select('u.*, f.codigo_roster')->join('funcionarios f','f.id_funcionario=u.id_funcionario')->join('roles r','r.id_rol=u.id_rol')->where('f.id_establecimiento',$establishment)->where('r.codigo','CHOFER')->where('u.activo',1)->orderBy('u.nombre_completo')->get()->getResultArray();
        return array_map(function($d) use($db,$establishment) {
            $legs=$db->table('viajes_tramos')->select('id_viaje')->where('id_chofer',$d['id_usuario'])->where('id_establecimiento',$establishment)->where('fecha_fin',null)->get()->getResultArray();
            return ['id'=>(string)$d['id_usuario'],'fullName'=>$d['nombre_completo'],'rosterCode'=>$d['codigo_roster'],'serviceLegs'=>array_map(fn($l)=>['serviceId'=>(string)$l['id_viaje']],$legs)];
        },$drivers);
    }
    public function costCenters(string $establishment): array {
        $rows=Database::connect()->table('centros_costos')->where('id_establecimiento',$establishment)->where('activo',1)->orderBy('codigo')->get()->getResultArray();
        return array_map(fn($c)=>['id'=>(string)$c['id_centro_costo'],'code'=>$c['codigo'],'name'=>$c['nombre'],'active'=>(bool)$c['activo']],$rows);
    }
}

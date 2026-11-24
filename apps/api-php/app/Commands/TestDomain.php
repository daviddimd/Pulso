<?php
namespace App\Commands;

use App\Libraries\{UserAccounts,VehicleCatalog};
use App\Models\{AuthRepository, ServiceRepository};
use CodeIgniter\CLI\BaseCommand;
use Config\Database;

final class TestDomain extends BaseCommand
{
    protected $group='Tests';
    protected $name='pulso:prueba-dominio';
    protected $description='Verifica invariantes de institución y concurrencia en pulso_test.';

    public function run(array $params)
    {
        $db=Database::connect();
        if (ENVIRONMENT==='production' || env('PULSO_INTEGRATION')!=='1' || $db->database!=='pulso_test') throw new \RuntimeException('Base no autorizada.');
        $check=function($condition,$message) {
            if (!$condition) throw new \RuntimeException($message);
        };
        $check(!$db->fieldExists('id_establecimiento','usuarios'),'La institución debe heredarse del funcionario.');
        $check(!$db->fieldExists('id_chofer_activo','viajes'),'La ocupación debe residir en los tramos.');
        // Informe MER 09-11: every column carries a Spanish name.
        $english=['establishment_id','created_at','updated_at','active','code','name','timezone','status','driver_id','vehicle_id','username',
            'full_name','password_hash','license_plate','current_odometer_km','year','started_at','ended_at','action','entity_id','address','source','origin'];
        $left=$db->query("SELECT CONCAT(TABLE_NAME,'.',COLUMN_NAME) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME<>'migrations' AND COLUMN_NAME IN ('".implode("','",$english)."')")->getResultArray();
        $check($left===[],'Columnas en inglés: '.implode(', ',array_column($left,'c')));
        $states=$db->query("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='viajes' AND COLUMN_NAME='estado'")->getRowArray()['t'];
        $check($states==="enum('PENDIENTE','ASIGNADO','EN_CURSO','FINALIZADO','CANCELADO')",'Estados en inglés: '.$states);
        $roles=array_column($db->table('roles')->select('codigo')->get()->getResultArray(),'codigo');
        $check(!array_intersect($roles,['ADMIN','DRIVER','SUPERVISOR','DISPATCHER','REQUESTER']),'Roles en inglés: '.implode(', ',$roles));
        $auth=new AuthRepository();
        $session=$auth->login('a-driver2','test-password','127.0.0.1');
        $auditColumn=array_values(array_filter($db->getFieldData('registros_auditoria'),fn($f)=>$f->name==='id_establecimiento'))[0] ?? null;
        $check($auditColumn && !$auditColumn->nullable,'La auditoría debe registrar la institución obligatoriamente.');
        $loginAudit=$db->table('registros_auditoria')->where('tipo_entidad','USUARIO')->where('id_entidad','103')->where('accion','INGRESO')->orderBy('id_registro_auditoria','DESC')->get()->getRowArray();
        $check($loginAudit && (string)$loginAudit['id_establecimiento']==='1','El ingreso debe auditarse en la institución del funcionario.');
        $staff=$db->table('usuarios')->where('id_usuario',103)->get()->getRowArray()['id_funcionario'];
        $db->table('funcionarios')->where('id_funcionario',$staff)->update(['id_establecimiento'=>2]);
        try {
            $check($auth->sessionUser($session['token'])['establishmentId']==='2','La sesión debe seguir la institución vigente.');
            $check(UserAccounts::query($db)->where('u.id_usuario',103)->get()->getRowArray()['id_establecimiento']==2,'La cuenta debe heredar la institución.');
        } finally {
            $db->table('funcionarios')->where('id_funcionario',$staff)->update(['id_establecimiento'=>1]);
            $auth->logout($session['token'],'103','127.0.0.1');
        }
        $a=VehicleCatalog::ids($db,'Tipo compartido','Modelo compartido','Marca compartida','','1');
        $b=VehicleCatalog::ids($db,'Tipo compartido','Modelo compartido','Marca compartida','','2');
        $check($a['id_tipo_vehiculo']!==$b['id_tipo_vehiculo'] && $a['id_modelo_vehiculo']!==$b['id_modelo_vehiculo'],'Los catálogos deben ser propios.');
        $db->transException(true)->transBegin();
        try {
            $trip=['id_establecimiento'=>1,'estado'=>'EN_CURSO','id_chofer'=>102,'id_vehiculo'=>111,
                'fecha_inicio'=>'2026-11-22 10:00:00','destino'=>'Talca','actividad'=>'Prueba de integridad'];
            $db->table('viajes')->insert($trip);$id=$db->insertID();
            $leg=['id_establecimiento'=>1,'id_viaje'=>$id,'id_chofer'=>102,'id_vehiculo'=>111,'fecha_inicio'=>'2026-11-22 10:00:00','odometro_inicio'=>1000];
            $db->table('viajes_tramos')->insert($leg);
            $db->table('viajes')->insert($trip);$second=$db->insertID();
            try {
                $db->table('viajes_tramos')->insert(array_replace($leg,['id_viaje'=>$second]));
                throw new \RuntimeException('MySQL aceptó dos ocupaciones.');
            } catch (\CodeIgniter\Database\Exceptions\DatabaseException $e) {
                $check(str_contains($e->getMessage(),'Duplicate entry'),'Se esperaba rechazo por índice único.');
            }
            // Historical trips without legs keep the distance from their header readings.
            $db->table('viajes')->insert(['id_establecimiento'=>1,'estado'=>'FINALIZADO','origen'=>'HISTORICO','id_chofer'=>null,'id_vehiculo'=>null,
                'fecha_inicio'=>'2026-11-01 08:00:00','fecha_fin'=>'2026-11-01 09:00:00','odometro_salida'=>500,'odometro_llegada'=>530,
                'destino'=>'Curicó','actividad'=>'Viaje histórico','fecha_creacion'=>'2026-11-01 08:00:00','fecha_actualizacion'=>'2026-11-01 09:00:00']);
            $legacy=(new ServiceRepository(['establishmentId'=>'1','role'=>'ADMIN','id'=>'101']))->find((string)$db->insertID());
            $check($legacy['legs']===[] && $legacy['distanceKm']===30,'Un viaje histórico sin tramos conserva su distancia.');
        } finally {
            $db->transRollback();
        }
        $check(!$db->fieldExists('roster_code','usuarios') && $db->fieldExists('codigo_roster','funcionarios'),'El róster debe residir en el funcionario.');
        // A rejected statement fails the CodeIgniter transaction, so each rejection runs in its own.
        $rosterConflict=function(callable $conflict,string $accepted,string $expected) use ($db,$check) {
            $db->transException(true)->transBegin();
            try {
                $db->table('funcionarios')->insert(['id_establecimiento'=>1,'nombre'=>'Róster A','codigo_roster'=>'R-UNICO']);
                $db->table('funcionarios')->insert(['id_establecimiento'=>2,'nombre'=>'Róster B','codigo_roster'=>'R-UNICO']);
                try {
                    $conflict((string)$db->insertID());
                    throw new \RuntimeException($accepted);
                } catch (\CodeIgniter\Database\Exceptions\DatabaseException $e) {
                    $check(str_contains($e->getMessage(),'Duplicate entry'),$expected);
                }
            } finally {
                $db->transRollback();
            }
        };
        $rosterConflict(fn()=>$db->table('funcionarios')->insert(['id_establecimiento'=>1,'nombre'=>'Róster duplicado','codigo_roster'=>'R-UNICO']),
            'MySQL aceptó un róster duplicado en el establecimiento.','Se esperaba rechazo del róster duplicado.');
        $rosterConflict(fn($transfer)=>$db->table('funcionarios')->where('id_funcionario',$transfer)->update(['id_establecimiento'=>1]),
            'Un traslado duplicó el róster del establecimiento de destino.','Se esperaba rechazo del traslado con róster duplicado.');
        echo "Dominio: institución heredada, róster único, catálogos propios, índices únicos y distancia histórica verificados.\n";
    }
}

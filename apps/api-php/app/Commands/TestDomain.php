<?php
namespace App\Commands;

use App\Libraries\{UserAccounts,VehicleCatalog};
use App\Models\{AuthRepository, ServiceRepository};
use CodeIgniter\CLI\BaseCommand;
use Config\Database;

final class TestDomain extends BaseCommand
{
    protected $group='Tests';
    protected $name='pulso:test-domain';
    protected $description='Verifica invariantes de institución y concurrencia en pulso_test.';

    public function run(array $params)
    {
        $db=Database::connect();
        if (ENVIRONMENT==='production' || env('PULSO_INTEGRATION')!=='1' || $db->database!=='pulso_test') throw new \RuntimeException('Base no autorizada.');
        $check=function($condition,$message) {
            if (!$condition) throw new \RuntimeException($message);
        };
        $check(!$db->fieldExists('establishment_id','usuarios'),'La institución debe heredarse del funcionario.');
        $check(!$db->fieldExists('active_driver_id','viajes'),'La ocupación debe residir en los tramos.');
        $auth=new AuthRepository();
        $session=$auth->login('a-driver2','test-password','127.0.0.1');
        $auditColumn=array_values(array_filter($db->getFieldData('registros_auditoria'),fn($f)=>$f->name==='establishment_id'))[0] ?? null;
        $check($auditColumn && !$auditColumn->nullable,'La auditoría debe registrar la institución obligatoriamente.');
        $loginAudit=$db->table('registros_auditoria')->where('entity_type','USER')->where('entity_id','103')->where('action','LOGIN_SUCCESS')->orderBy('id_registro_auditoria','DESC')->get()->getRowArray();
        $check($loginAudit && (string)$loginAudit['establishment_id']==='1','El ingreso debe auditarse en la institución del funcionario.');
        $staff=$db->table('usuarios')->where('id_usuario',103)->get()->getRowArray()['id_funcionario'];
        $db->table('funcionarios')->where('id_funcionario',$staff)->update(['establishment_id'=>2]);
        try {
            $check($auth->sessionUser($session['token'])['establishmentId']==='2','La sesión debe seguir la institución vigente.');
            $check(UserAccounts::query($db)->where('u.id_usuario',103)->get()->getRowArray()['establishment_id']==2,'La cuenta debe heredar la institución.');
        } finally {
            $db->table('funcionarios')->where('id_funcionario',$staff)->update(['establishment_id'=>1]);
            $auth->logout($session['token'],'103','127.0.0.1');
        }
        $a=VehicleCatalog::ids($db,'Tipo compartido','Modelo compartido','Marca compartida','','1');
        $b=VehicleCatalog::ids($db,'Tipo compartido','Modelo compartido','Marca compartida','','2');
        $check($a['id_tipo_vehiculo']!==$b['id_tipo_vehiculo'] && $a['id_modelo_vehiculo']!==$b['id_modelo_vehiculo'],'Los catálogos deben ser propios.');
        $db->transException(true)->transBegin();
        try {
            $trip=['establishment_id'=>1,'status'=>'IN_PROGRESS','driver_id'=>102,'vehicle_id'=>111,
                'started_at'=>'2026-11-22 10:00:00','destino'=>'Talca','actividad'=>'Prueba de integridad'];
            $db->table('viajes')->insert($trip);$id=$db->insertID();
            $leg=['establishment_id'=>1,'id_viaje'=>$id,'id_chofer'=>102,'id_vehiculo'=>111,'fecha_inicio'=>'2026-11-22 10:00:00','odometro_inicio'=>1000];
            $db->table('viajes_tramos')->insert($leg);
            $db->table('viajes')->insert($trip);$second=$db->insertID();
            try {
                $db->table('viajes_tramos')->insert(array_replace($leg,['id_viaje'=>$second]));
                throw new \RuntimeException('MySQL aceptó dos ocupaciones.');
            } catch (\CodeIgniter\Database\Exceptions\DatabaseException $e) {
                $check(str_contains($e->getMessage(),'Duplicate entry'),'Se esperaba rechazo por índice único.');
            }
            // Historical trips without legs keep the distance from their header readings.
            $db->table('viajes')->insert(['establishment_id'=>1,'status'=>'COMPLETED','origin'=>'LEGACY','driver_id'=>null,'vehicle_id'=>null,
                'started_at'=>'2026-11-01 08:00:00','ended_at'=>'2026-11-01 09:00:00','departure_odometer_km'=>500,'arrival_odometer_km'=>530,
                'destino'=>'Curicó','actividad'=>'Viaje histórico','created_at'=>'2026-11-01 08:00:00','updated_at'=>'2026-11-01 09:00:00']);
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
                $db->table('funcionarios')->insert(['establishment_id'=>1,'nombre'=>'Róster A','codigo_roster'=>'R-UNICO']);
                $db->table('funcionarios')->insert(['establishment_id'=>2,'nombre'=>'Róster B','codigo_roster'=>'R-UNICO']);
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
        $rosterConflict(fn()=>$db->table('funcionarios')->insert(['establishment_id'=>1,'nombre'=>'Róster duplicado','codigo_roster'=>'R-UNICO']),
            'MySQL aceptó un róster duplicado en el establecimiento.','Se esperaba rechazo del róster duplicado.');
        $rosterConflict(fn($transfer)=>$db->table('funcionarios')->where('id_funcionario',$transfer)->update(['establishment_id'=>1]),
            'Un traslado duplicó el róster del establecimiento de destino.','Se esperaba rechazo del traslado con róster duplicado.');
        echo "Dominio: institución heredada, róster único, catálogos propios, índices únicos y distancia histórica verificados.\n";
    }
}

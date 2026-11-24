<?php
namespace App\Commands;
use CodeIgniter\CLI\BaseCommand;
use App\Libraries\{SecurityLib,UnitOfWork,UserAccounts,VehicleCatalog};
use Config\Database;
final class TestFixtures extends BaseCommand {
    protected $group='Tests'; protected $name='pulso:test-fixtures'; protected $description='Prepara exclusivamente pulso_test para pruebas de integración.';
    public function run(array $params) {
        $db=Database::connect();
        if(ENVIRONMENT==='production' || env('PULSO_INTEGRATION')!=='1' || $db->database!=='pulso_test') throw new \RuntimeException('Base de pruebas no autorizada');
        $db->query('SET FOREIGN_KEY_CHECKS=0');
        foreach(['sesiones','registros_auditoria','revisiones_direccion','folios_viajes_anteriores','viajes_tramos','viajes','vehiculos','centros_costos','usuarios','funcionarios','establecimientos'] as $table) $db->table($table)->emptyTable();
        $db->query('SET FOREIGN_KEY_CHECKS=1');
        $hash=trim(file_get_contents(ROOTPATH.'tests/node-argon2.txt')); $now=UnitOfWork::now();
        if (!SecurityLib::verifyPassword('test-password', $hash) || SecurityLib::verifyPassword('wrong-password', $hash)) throw new \RuntimeException('Falló la compatibilidad Argon2 con Node');
        foreach([1=>'a',2=>'b'] as $tenantId=>$tenant) {
            $db->table('establecimientos')->insert(['id_establecimiento'=>$tenantId,'codigo'=>$tenant,'nombre'=>'Establecimiento '.$tenant,'zona_horaria'=>$tenant==='a'?'America/Santiago':'Pacific/Easter','activo'=>1,'fecha_creacion'=>$now,'fecha_actualizacion'=>$now]);
            $base = 100 * $tenantId;
            foreach (['admin','driver1','driver2','driver3','retired'] as $index=>$role) {
                UserAccounts::create($db, ['id_usuario'=>$base+$index+1,'id_establecimiento'=>$tenantId,
                    'nombre_usuario'=>$tenant.'-'.$role,'nombre_completo'=>$tenant.' '.$role,'activo'=>$role==='retired'?0:1,
                    'hash_contrasena'=>$hash,'fecha_creacion'=>$now,'fecha_actualizacion'=>$now], $role==='admin'?'ADMIN':'DRIVER');
            }
            foreach ([1=>1000,2=>50000] as $i=>$km) {
                $db->table('vehiculos')->insert(['id_vehiculo'=>$base+10+$i,'id_establecimiento'=>$tenantId,
                    'codigo_movil'=>'7-'.$i,'patente'=>$tenant.'-PLATE'.$i,'anio'=>2020,
                    'odometro_actual'=>$km,'activo'=>1,'fecha_creacion'=>$now,'fecha_actualizacion'=>$now] +
                    VehicleCatalog::ids($db, null, 'Modelo '.$i, null, '', (string)$tenantId));
            }
            $db->table('centros_costos')->insert(['id_centro_costo'=>$base+21,'id_establecimiento'=>$tenantId,'codigo'=>'101','nombre'=>'Centro '.$tenant,'activo'=>1]);
            // Historical format: one odometer correction and one unrelated identity edit.
            $before=['current_odometer_km'=>49900,'role_code'=>'7-2'];
            $after=['current_odometer_km'=>50000,'role_code'=>'7-2','reason'=>'Lectura histórica contrastada'];
            $db->table('registros_auditoria')->insert(['id_establecimiento'=>$tenantId,'id_usuario_actor'=>$base+1,'tipo_entidad'=>'VEHICLE','id_entidad'=>(string)($base+12),'accion'=>'UPDATE','datos_anteriores'=>json_encode($before),'datos_nuevos'=>json_encode($after),'fecha_creacion'=>$now]);
            $db->table('registros_auditoria')->insert(['id_establecimiento'=>$tenantId,'id_usuario_actor'=>$base+1,'tipo_entidad'=>'VEHICLE','id_entidad'=>(string)($base+12),'accion'=>'UPDATE','datos_anteriores'=>json_encode($after),'datos_nuevos'=>json_encode(['odometro_actual'=>50000,'role_code'=>'7-OLD','reason'=>null]),'fecha_creacion'=>$now]);
        }
        echo "Fixtures de dos establecimientos listas.\n";
    }
}

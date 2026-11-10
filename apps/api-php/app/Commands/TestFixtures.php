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
        foreach(['sesiones','registros_auditoria','revisiones_direccion','viajes','vehiculos','centros_costos','usuarios','funcionarios','establecimientos'] as $table) $db->table($table)->emptyTable();
        $db->query('SET FOREIGN_KEY_CHECKS=1');
        $hash=trim(file_get_contents(ROOTPATH.'tests/node-argon2.txt')); $now=UnitOfWork::now();
        if (!SecurityLib::verifyPassword('test-password', $hash) || SecurityLib::verifyPassword('wrong-password', $hash)) throw new \RuntimeException('Falló la compatibilidad Argon2 con Node');
        foreach([1=>'a',2=>'b'] as $tenantId=>$tenant) {
            $db->table('establecimientos')->insert(['id_establecimiento'=>$tenantId,'code'=>$tenant,'name'=>'Establecimiento '.$tenant,'timezone'=>$tenant==='a'?'America/Santiago':'Pacific/Easter','active'=>1,'created_at'=>$now,'updated_at'=>$now]);
            $base = 100 * $tenantId;
            foreach (['admin','driver1','driver2','driver3','retired'] as $index=>$role) {
                UserAccounts::create($db, ['id_usuario'=>$base+$index+1,'establishment_id'=>$tenantId,
                    'username'=>$tenant.'-'.$role,'full_name'=>$tenant.' '.$role,'active'=>$role==='retired'?0:1,
                    'password_hash'=>$hash,'created_at'=>$now,'updated_at'=>$now], $role==='admin'?'ADMIN':'DRIVER');
            }
            foreach ([1=>1000,2=>50000] as $i=>$km) {
                $db->table('vehiculos')->insert(['id_vehiculo'=>$base+10+$i,'establishment_id'=>$tenantId,
                    'codigo_movil'=>'7-'.$i,'license_plate'=>$tenant.'-PLATE'.$i,'year'=>2020,
                    'current_odometer_km'=>$km,'active'=>1,'created_at'=>$now,'updated_at'=>$now] +
                    VehicleCatalog::ids($db, null, 'Modelo '.$i));
            }
            $db->table('centros_costos')->insert(['id_centro_costo'=>$base+21,'establishment_id'=>$tenantId,'code'=>'101','name'=>'Centro '.$tenant,'active'=>1]);
            // Historical format: one odometer correction and one unrelated identity edit.
            $before=['current_odometer_km'=>49900,'role_code'=>'7-2'];
            $after=['current_odometer_km'=>50000,'role_code'=>'7-2','reason'=>'Lectura histórica contrastada'];
            $db->table('registros_auditoria')->insert(['actor_user_id'=>$base+1,'entity_type'=>'VEHICLE','entity_id'=>(string)($base+12),'action'=>'UPDATE','before_data'=>json_encode($before),'after_data'=>json_encode($after),'created_at'=>$now]);
            $db->table('registros_auditoria')->insert(['actor_user_id'=>$base+1,'entity_type'=>'VEHICLE','entity_id'=>(string)($base+12),'action'=>'UPDATE','before_data'=>json_encode($after),'after_data'=>json_encode(['current_odometer_km'=>50000,'role_code'=>'7-OLD','reason'=>null]),'created_at'=>$now]);
        }
        echo "Fixtures de dos establecimientos listas.\n";
    }
}

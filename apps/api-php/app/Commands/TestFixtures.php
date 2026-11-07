<?php
namespace App\Commands;
use CodeIgniter\CLI\BaseCommand;
use App\Libraries\{SecurityLib,UnitOfWork};
use Config\Database;
final class TestFixtures extends BaseCommand {
    protected $group='Tests'; protected $name='pulso:test-fixtures'; protected $description='Prepara exclusivamente pulso_test para pruebas de integración.';
    public function run(array $params) {
        $db=Database::connect();
        if(ENVIRONMENT==='production' || env('PULSO_INTEGRATION')!=='1' || $db->database!=='pulso_test') throw new \RuntimeException('Base de pruebas no autorizada');
        $db->query('SET FOREIGN_KEY_CHECKS=0');
        foreach(['sessions','audit_logs','service_address_revisions','service_legs','bitacora_entries','vehicles','cost_centers','users','establishments'] as $table) $db->table($table)->emptyTable();
        $db->query('SET FOREIGN_KEY_CHECKS=1');
        $hash=trim(file_get_contents(ROOTPATH.'tests/node-argon2.txt')); $now=UnitOfWork::now();
        if (!SecurityLib::verifyPassword('test-password', $hash) || SecurityLib::verifyPassword('wrong-password', $hash)) throw new \RuntimeException('Falló la compatibilidad Argon2 con Node');
        foreach(['a','b'] as $tenant) {
            $db->table('establishments')->insert(['id'=>$tenant,'code'=>$tenant,'name'=>'Establecimiento '.$tenant,'timezone'=>$tenant==='a'?'America/Santiago':'Pacific/Easter','active'=>1,'created_at'=>$now,'updated_at'=>$now]);
            foreach(['admin','driver1','driver2','driver3','retired'] as $role) $db->table('users')->insert(['id'=>$tenant.'-'.$role,'establishment_id'=>$tenant,'username'=>$tenant.'-'.$role,'full_name'=>$tenant.' '.$role,'role'=>$role==='admin'?'ADMIN':'DRIVER','active'=>$role==='retired'?0:1,'password_hash'=>$hash,'created_at'=>$now,'updated_at'=>$now]);
            foreach([1=>1000,2=>50000] as $i=>$km) $db->table('vehicles')->insert(['id'=>$tenant.'-vehicle'.$i,'establishment_id'=>$tenant,'role_code'=>'7-'.$i,'license_plate'=>$tenant.'-PLATE'.$i,'model'=>'Modelo '.$i,'year'=>2020,'current_odometer_km'=>$km,'active'=>1,'created_at'=>$now,'updated_at'=>$now]);
            $db->table('cost_centers')->insert(['id'=>$tenant.'-center','establishment_id'=>$tenant,'code'=>'101','name'=>'Centro '.$tenant,'active'=>1]);
            // Historical format: one odometer correction and one unrelated identity edit.
            $before=['current_odometer_km'=>49900,'role_code'=>'7-2'];
            $after=['current_odometer_km'=>50000,'role_code'=>'7-2','reason'=>'Lectura histórica contrastada'];
            $db->table('audit_logs')->insert(['actor_user_id'=>$tenant.'-admin','entity_type'=>'VEHICLE','entity_id'=>$tenant.'-vehicle2','action'=>'UPDATE','before_data'=>json_encode($before),'after_data'=>json_encode($after),'created_at'=>$now]);
            $db->table('audit_logs')->insert(['actor_user_id'=>$tenant.'-admin','entity_type'=>'VEHICLE','entity_id'=>$tenant.'-vehicle2','action'=>'UPDATE','before_data'=>json_encode($after),'after_data'=>json_encode(['current_odometer_km'=>50000,'role_code'=>'7-OLD','reason'=>null]),'created_at'=>$now]);
        }
        echo "Fixtures de dos establecimientos listas.\n";
    }
}

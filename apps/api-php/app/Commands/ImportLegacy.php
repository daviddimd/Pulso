<?php
namespace App\Commands;
use CodeIgniter\CLI\{BaseCommand,CLI};
use App\Libraries\UnitOfWork;
use Config\Database;
final class ImportLegacy extends BaseCommand {
    protected $group='Pulso'; protected $name='pulso:import'; protected $description='Importa un respaldo JSON de PostgreSQL en una base Pulso vacía.';
    public function run(array $params) {
        $path=$params[0]??'';
        if (!is_file($path)) throw new \RuntimeException('Falta el respaldo JSON.');
        $data=json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
        $db=Database::connect();
        foreach(['users','vehicles','cost_centers','bitacora_entries','service_legs','service_address_revisions','audit_logs'] as $table) {
            if(!isset($data[$table])||!is_array($data[$table])) throw new \RuntimeException('Respaldo incompleto.');
            if($db->table($table)->countAllResults()) throw new \RuntimeException('La base de destino debe estar vacía.');
        }
        $db->transException(true)->transBegin();
        try {
            $est='c0000000-0000-4000-8000-000000000001';
            $db->table('establishments')->insert(['id'=>$est,'code'=>'HRT','name'=>'Hospital Regional de Talca','timezone'=>'America/Santiago','active'=>1,'created_at'=>UnitOfWork::now(),'updated_at'=>UnitOfWork::now()]);
            foreach($data as $table=>$rows) {
                if(!in_array($table,['users','vehicles','cost_centers','bitacora_entries','service_legs','service_address_revisions','audit_logs'],true)) continue;
                $fields=array_flip($db->getFieldNames($table));
                foreach($rows as $raw) {
                    if($table==='bitacora_entries' && !empty($raw['closure_pending'])) throw new \RuntimeException('Debe cerrar los viajes históricos pendientes antes de migrar.');
                    $row=array_intersect_key($raw,$fields);
                    if(isset($fields['establishment_id'])) $row['establishment_id']=$est;
                    foreach($row as $k=>$v) {
                        if($v!==null && (str_ends_with($k,'_at') || $k==='locked_until')) $row[$k]=(new \DateTimeImmutable($v))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
                        if(is_bool($v)) $row[$k]=(int)$v;
                        if(in_array($k,['before_data','after_data'],true)&&$v!==null) $row[$k]=json_encode($v,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
                    }
                    // Preserve historical cancellations without enabling that transition for new services.
                    if($table==='bitacora_entries' && $row['status']==='CANCELLED' && $row['started_at']!==null) $row['origin']='LEGACY';
                    $db->table($table)->insert($row);
                }
                CLI::write($table.': '.count($rows));
            }
            if(!$db->transStatus()) throw new \RuntimeException('Falló la importación.');
            $db->transCommit(); CLI::write('Importación completada; las sesiones anteriores no se trasladan.','green');
        } catch(\Throwable $e) { $db->transRollback(); throw $e; }
    }
}

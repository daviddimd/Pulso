<?php
namespace App\Database\Migrations;

use App\Libraries\VehicleCatalog;
use CodeIgniter\Database\Migration;

final class DomainTrips extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('viajes_tramos')) {
            throw new \RuntimeException(
                'Migración de viajes incompleta detectada. Restaure el respaldo verificado antes de reintentar.',
            );
        }
        $groups = $this->preflight();
        try {
            $this->migrate($groups);
        } catch (\Throwable $e) {
            throw new \RuntimeException(
                'La migración de viajes quedó incompleta. Restaure el respaldo verificado antes de reintentar: ' .
                    $e->getMessage(),
                0,
                $e,
            );
        }
    }

    private function preflight(): array
    {
        $orphans = $this->db
            ->query(
                "SELECT COUNT(*) AS n FROM revisiones_direccion r
            LEFT JOIN viajes v ON v.id_viaje=r.service_id WHERE v.id_viaje IS NULL",
            )
            ->getRowArray();
        if ((int) $orphans['n'] > 0) {
            throw new \RuntimeException('Hay revisiones de dirección sin viaje.');
        }
        $rows = $this->db->table('viajes')->orderBy('id_viaje')->get()->getResultArray();
        $byId = array_column($rows, null, 'id_viaje');
        $groups = [];
        foreach ($rows as $row) {
            $root = $row;
            $seen = [];
            while ($root['id_viaje_anterior'] !== null) {
                if (isset($seen[$root['id_viaje']])) {
                    throw new \RuntimeException('Relevo cíclico.');
                }
                $seen[$root['id_viaje']] = true;
                $root =
                    $byId[$root['id_viaje_anterior']] ??
                    throw new \RuntimeException('Viaje anterior inexistente.');
                if ($root['establishment_id'] !== $row['establishment_id']) {
                    throw new \RuntimeException('Relevo entre instituciones.');
                }
            }
            $groups[$root['id_viaje']][] = $row;
        }
        return $groups;
    }

    private function migrate(array $groups): void
    {
        $this->db->query("CREATE TABLE viajes_tramos (
            id_viaje_tramo INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            establishment_id INT UNSIGNED NOT NULL,id_viaje INT UNSIGNED NOT NULL,
            id_chofer INT UNSIGNED NOT NULL,id_vehiculo INT UNSIGNED NOT NULL,
            fecha_inicio DATETIME(3) NOT NULL,fecha_fin DATETIME(3) NULL,
            odometro_inicio INT UNSIGNED NULL,odometro_fin INT UNSIGNED NULL,
            active_driver_id INT UNSIGNED GENERATED ALWAYS AS(IF(fecha_fin IS NULL,id_chofer,NULL))
                STORED,
            active_vehicle_id INT UNSIGNED GENERATED ALWAYS AS(IF(fecha_fin IS
                NULL,id_vehiculo,NULL)) STORED,
            active_trip_id INT UNSIGNED GENERATED ALWAYS AS(IF(fecha_fin IS NULL,id_viaje,NULL))
                STORED,
            UNIQUE(active_driver_id),UNIQUE(active_vehicle_id),UNIQUE(active_trip_id),
            KEY(establishment_id,id_viaje),
            FOREIGN KEY(establishment_id) REFERENCES establecimientos(id_establecimiento),
            FOREIGN KEY(id_chofer) REFERENCES usuarios(id_usuario),
            FOREIGN KEY(id_vehiculo) REFERENCES vehiculos(id_vehiculo),
            CHECK(fecha_fin IS NULL OR fecha_fin>=fecha_inicio),
            CHECK(odometro_fin IS NULL OR odometro_inicio IS NULL OR odometro_fin>=odometro_inicio)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $this->db->query('ALTER TABLE viajes ADD UNIQUE(establishment_id,id_viaje)');
        $this->db->query('ALTER TABLE revisiones_direccion ADD establishment_id INT UNSIGNED NULL');
        $this->db->query(
            'UPDATE revisiones_direccion r JOIN viajes v ON v.id_viaje=r.service_id SET
                r.establishment_id=v.establishment_id',
        );
        $this->db->query("ALTER TABLE revisiones_direccion MODIFY establishment_id INT UNSIGNED NOT
                NULL,
            ADD FOREIGN KEY(establishment_id,service_id) REFERENCES
                viajes(establishment_id,id_viaje)");
        $this->db->query("CREATE TABLE folios_viajes_anteriores (
            id_folio_anterior INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,establishment_id INT UNSIGNED
                NOT NULL,
            id_viaje INT UNSIGNED NOT NULL,KEY(establishment_id,id_viaje),
            FOREIGN KEY(establishment_id,id_viaje) REFERENCES viajes(establishment_id,id_viaje))");

        foreach (
            $this->db
                ->query(
                    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='viajes' AND CONSTRAINT_TYPE='CHECK'",
                )
                ->getResultArray()
            as $check
        ) {
            $this->db->query('ALTER TABLE viajes DROP CHECK ' . $check['CONSTRAINT_NAME']);
        }
        $this->db->query(
            'ALTER TABLE viajes DROP COLUMN active_driver_id,DROP COLUMN active_vehicle_id',
        );
        $this->db->transException(true)->transBegin();
        try {
            foreach ($groups as $id => $chain) {
                usort(
                    $chain,
                    fn($a, $b) => [$a['started_at'], $a['id_viaje']] <=> [
                        $b['started_at'],
                        $b['id_viaje'],
                    ],
                );
                $first = $chain[0];
                $last = $chain[count($chain) - 1];
                $revision = 0;
                $this->db
                    ->table('revisiones_direccion')
                    ->whereIn('service_id', array_column($chain, 'id_viaje'))
                    ->set('revision', '-revision', false)
                    ->update();
                foreach ($chain as $trip) {
                    $this->db->table('folios_viajes_anteriores')->insert([
                        'id_folio_anterior' => $trip['id_viaje'],
                        'establishment_id' => $trip['establishment_id'],
                        'id_viaje' => $id,
                    ]);
                    if ($trip['started_at'] && $trip['driver_id'] && $trip['vehicle_id']) {
                        $this->db->table('viajes_tramos')->insert([
                            'establishment_id' => $trip['establishment_id'],
                            'id_viaje' => $id,
                            'id_chofer' => $trip['driver_id'],
                            'id_vehiculo' => $trip['vehicle_id'],
                            'fecha_inicio' => $trip['started_at'],
                            'fecha_fin' => $trip['ended_at'],
                            'odometro_inicio' => $trip['departure_odometer_km'],
                            'odometro_fin' => $trip['arrival_odometer_km'],
                        ]);
                    }
                    $revs = $this->db
                        ->table('revisiones_direccion')
                        ->where('service_id', $trip['id_viaje'])
                        ->orderBy('revision', 'DESC')
                        ->get()
                        ->getResultArray();
                    foreach ($revs as $r) {
                        $this->db
                            ->table('revisiones_direccion')
                            ->where('id_revision_direccion', $r['id_revision_direccion'])
                            ->update(['service_id' => $id, 'revision' => ++$revision]);
                    }
                }
                $header = $last;
                foreach (
                    ['id_viaje', 'id_viaje_anterior', 'active_driver_id', 'active_vehicle_id']
                    as $key
                ) {
                    unset($header[$key]);
                }
                $header['started_at'] = $first['started_at'];
                $header['departure_odometer_km'] = $first['departure_odometer_km'];
                $header['created_at'] = $first['created_at'];
                $header['created_by_user_id'] = $first['created_by_user_id'];
                $this->db->table('viajes')->where('id_viaje', $id)->update($header);
                foreach (array_reverse($chain) as $trip) {
                    if ((string) $trip['id_viaje'] === (string) $id) {
                        continue;
                    }
                    $this->db
                        ->table('viajes')
                        ->where('id_viaje', $trip['id_viaje'])
                        ->update(['id_viaje_anterior' => null]);
                }
                foreach (array_reverse($chain) as $trip) {
                    if ((string) $trip['id_viaje'] !== (string) $id) {
                        $this->db->table('viajes')->where('id_viaje', $trip['id_viaje'])->delete();
                    }
                }
            }
            $this->db->transCommit();
        } catch (\Throwable $e) {
            $this->db->transRollback();
            throw $e;
        }
        $this->db->query(
            'ALTER TABLE viajes_tramos ADD FOREIGN KEY(establishment_id,id_viaje) REFERENCES
                viajes(establishment_id,id_viaje)',
        );
        $keys = $this->db
            ->query(
                "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='viajes' AND
                COLUMN_NAME='id_viaje_anterior' AND REFERENCED_TABLE_NAME IS NOT NULL",
            )
            ->getResultArray();
        foreach ($keys as $key) {
            $this->db->query('ALTER TABLE viajes DROP FOREIGN KEY ' . $key['CONSTRAINT_NAME']);
        }
        $this->db->query('ALTER TABLE viajes DROP COLUMN id_viaje_anterior');
        $this->db->query(
            'ALTER TABLE viajes ADD CHECK(ended_at IS NULL OR started_at IS NULL OR
                ended_at>=started_at)',
        );
        $this->db->query("ALTER TABLE viajes ADD CHECK(origin='LEGACY' OR
            (status='PENDING' AND driver_id IS NULL AND started_at IS NULL AND ended_at IS NULL) OR
            (status='ASSIGNED' AND driver_id IS NOT NULL AND started_at IS NULL AND ended_at IS
                NULL) OR
            (status='IN_PROGRESS' AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND
                started_at IS NOT NULL AND ended_at IS NULL) OR
            (status='COMPLETED' AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND started_at
                IS NOT NULL AND ended_at IS NOT NULL) OR
            (status='CANCELLED' AND started_at IS NULL AND cancelled_at IS NOT NULL AND
                departure_odometer_km IS NULL AND arrival_odometer_km IS NULL))");
        $this->accounts();
        $this->catalogs();
    }

    private function accounts(): void
    {
        $keys = $this->db
            ->query(
                "SELECT DISTINCT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND
                COLUMN_NAME='establishment_id' AND REFERENCED_TABLE_NAME IS NOT NULL",
            )
            ->getResultArray();
        foreach ($keys as $key) {
            $this->db->query('ALTER TABLE usuarios DROP FOREIGN KEY ' . $key['CONSTRAINT_NAME']);
        }
        $this->db->query(
            'ALTER TABLE usuarios ADD FOREIGN KEY(id_funcionario) REFERENCES
                funcionarios(id_funcionario)',
        );

        $this->db->query('ALTER TABLE funcionarios ADD codigo_roster VARCHAR(30) NULL');
        $this->db->query(
            'UPDATE funcionarios f JOIN usuarios u ON u.id_funcionario=f.id_funcionario SET
                f.codigo_roster=u.roster_code',
        );
        $this->db->query(
            'ALTER TABLE funcionarios ADD UNIQUE KEY
                funcionario_establecimiento_roster(establishment_id,codigo_roster)',
        );
        $this->db->query('ALTER TABLE usuarios DROP INDEX establishment_id_roster_code');
        $this->db->query(
            'ALTER TABLE usuarios DROP COLUMN roster_code, DROP COLUMN establishment_id',
        );
    }

    private function catalogs(): void
    {
        foreach (
            [
                'tipos_vehiculo' => 'id_tipo_vehiculo',
                'marcas_vehiculo' => 'id_marca_vehiculo',
                'modelos_vehiculo' => 'id_modelo_vehiculo',
            ]
            as $table => $key
        ) {
            $this->db->query("CREATE TABLE propio_$table LIKE $table");
            $indexes = $this->db
                ->query("SHOW INDEX FROM propio_$table WHERE Non_unique=0 AND Key_name<>'PRIMARY'")
                ->getResultArray();
            foreach (array_unique(array_column($indexes, 'Key_name')) as $index) {
                $this->db->query("ALTER TABLE propio_$table DROP INDEX $index");
            }
            $this->db->query("ALTER TABLE propio_$table ADD establishment_id INT UNSIGNED NOT NULL,
                ADD UNIQUE(establishment_id,$key),ADD FOREIGN KEY(establishment_id) REFERENCES
                    establecimientos(id_establecimiento)");
            $columns =
                $table === 'modelos_vehiculo'
                    ? 'establishment_id,id_marca_vehiculo,nombre'
                    : 'establishment_id,nombre';
            $this->db->query("ALTER TABLE propio_$table ADD UNIQUE($columns)");
        }
        $this->db->query("ALTER TABLE propio_modelos_vehiculo ADD FOREIGN
                KEY(establishment_id,id_marca_vehiculo)
            REFERENCES propio_marcas_vehiculo(establishment_id,id_marca_vehiculo)");
        $changes = [];
        foreach ($this->db->table('vehiculos')->get()->getResultArray() as $v) {
            $type = null;
            $model = null;
            if ($v['id_tipo_vehiculo']) {
                $r = $this->db
                    ->table('tipos_vehiculo')
                    ->where('id_tipo_vehiculo', $v['id_tipo_vehiculo'])
                    ->get()
                    ->getRowArray();
                $type = VehicleCatalog::reference(
                    $this->db,
                    'propio_tipos_vehiculo',
                    'id_tipo_vehiculo',
                    ['establishment_id' => $v['establishment_id'], 'nombre' => $r['nombre']],
                );
            }
            if ($v['id_modelo_vehiculo']) {
                $r = $this->db
                    ->table('modelos_vehiculo m')
                    ->select('m.nombre,f.nombre AS marca')
                    ->join('marcas_vehiculo f', 'f.id_marca_vehiculo=m.id_marca_vehiculo')
                    ->where('m.id_modelo_vehiculo', $v['id_modelo_vehiculo'])
                    ->get()
                    ->getRowArray();
                $make = VehicleCatalog::reference(
                    $this->db,
                    'propio_marcas_vehiculo',
                    'id_marca_vehiculo',
                    ['establishment_id' => $v['establishment_id'], 'nombre' => $r['marca']],
                );
                $model = VehicleCatalog::reference(
                    $this->db,
                    'propio_modelos_vehiculo',
                    'id_modelo_vehiculo',
                    [
                        'establishment_id' => $v['establishment_id'],
                        'id_marca_vehiculo' => $make,
                        'nombre' => $r['nombre'],
                    ],
                );
            }
            $changes[] = [$v['id_vehiculo'], $type, $model];
        }
        $keys = $this->db
            ->query(
                "SELECT DISTINCT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='vehiculos' AND REFERENCED_TABLE_NAME IN
                ('tipos_vehiculo','modelos_vehiculo')",
            )
            ->getResultArray();
        foreach ($keys as $key) {
            $this->db->query('ALTER TABLE vehiculos DROP FOREIGN KEY ' . $key['CONSTRAINT_NAME']);
        }
        $this->db
            ->query("RENAME TABLE tipos_vehiculo TO global_tipos_vehiculo,marcas_vehiculo TO global_marcas_vehiculo,
            modelos_vehiculo TO global_modelos_vehiculo,propio_tipos_vehiculo TO tipos_vehiculo,
            propio_marcas_vehiculo TO marcas_vehiculo,propio_modelos_vehiculo TO modelos_vehiculo");
        foreach ($changes as [$id, $type, $model]) {
            $this->db
                ->table('vehiculos')
                ->where('id_vehiculo', $id)
                ->update(['id_tipo_vehiculo' => $type, 'id_modelo_vehiculo' => $model]);
        }
        $this->db->query("ALTER TABLE vehiculos ADD FOREIGN KEY(establishment_id,id_tipo_vehiculo)
                REFERENCES tipos_vehiculo(establishment_id,id_tipo_vehiculo),
            ADD FOREIGN KEY(establishment_id,id_modelo_vehiculo) REFERENCES
                modelos_vehiculo(establishment_id,id_modelo_vehiculo)");
        foreach (['modelos_vehiculo', 'marcas_vehiculo', 'tipos_vehiculo'] as $table) {
            $this->db->query("DROP TABLE global_$table");
        }
    }

    public function down()
    {
        throw new \RuntimeException(
            'Restaurar el respaldo previo para volver al esquema anterior.',
        );
    }
}

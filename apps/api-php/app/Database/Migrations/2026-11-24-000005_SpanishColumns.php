<?php
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

final class SpanishColumns extends Migration
{
    private const COMMON = [
        'establishment_id' => 'id_establecimiento',
        'created_at' => 'fecha_creacion',
        'updated_at' => 'fecha_actualizacion',
        'active' => 'activo',
    ];

    public const COLUMNS = [
        'centros_costos' => ['code' => 'codigo', 'name' => 'nombre'],
        'establecimientos' => [
            'code' => 'codigo',
            'name' => 'nombre',
            'timezone' => 'zona_horaria',
        ],
        'folios_viajes_anteriores' => [],
        'funcionarios' => [],
        'marcas_vehiculo' => [],
        'modelos_vehiculo' => [],
        'tipos_vehiculo' => [],
        'registros_auditoria' => [
            'actor_user_id' => 'id_usuario_actor',
            'entity_type' => 'tipo_entidad',
            'entity_id' => 'id_entidad',
            'action' => 'accion',
            'before_data' => 'datos_anteriores',
            'after_data' => 'datos_nuevos',
            'ip_address' => 'direccion_ip',
        ],
        'revisiones_direccion' => [
            'service_id' => 'id_viaje',
            'address' => 'direccion',
            'actor_user_id' => 'id_usuario_actor',
            'source' => 'origen',
        ],
        'sesiones' => [
            'user_id' => 'id_usuario',
            'token_hash' => 'hash_token',
            'expires_at' => 'fecha_expiracion',
            'revoked_at' => 'fecha_revocacion',
            'last_seen_at' => 'fecha_ultimo_uso',
        ],
        'usuarios' => [
            'username' => 'nombre_usuario',
            'full_name' => 'nombre_completo',
            'password_hash' => 'hash_contrasena',
            'failed_login_attempts' => 'intentos_fallidos',
            'locked_until' => 'bloqueado_hasta',
            'clave_unica_sub' => 'sub_clave_unica',
            'auth_provider' => 'proveedor_autenticacion',
        ],
        'vehiculos' => [
            'license_plate' => 'patente',
            'current_odometer_km' => 'odometro_actual',
            'year' => 'anio',
        ],
        'viajes' => [
            'cost_center_id' => 'id_centro_costo',
            'driver_id' => 'id_chofer',
            'vehicle_id' => 'id_vehiculo',
            'created_by_user_id' => 'id_usuario_creador',
            'origin' => 'origen',
            'cancelled_at' => 'fecha_cancelacion',
            'status' => 'estado',
            'started_at' => 'fecha_inicio',
            'ended_at' => 'fecha_fin',
            'departure_odometer_km' => 'odometro_salida',
            'arrival_odometer_km' => 'odometro_llegada',
            'void_reason' => 'motivo_cancelacion',
        ],
        'viajes_tramos' => [
            'active_driver_id' => 'id_chofer_activo',
            'active_vehicle_id' => 'id_vehiculo_activo',
            'active_trip_id' => 'id_viaje_activo',
        ],
    ];

    public function up()
    {
        $schema = $this->db->database;
        $pending = $this->db
            ->query(
                "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=?
            AND TABLE_NAME<>'migrations' AND COLUMN_NAME IN
                ('establishment_id','status','created_at','username')",
                [$schema],
            )
            ->getRowArray();
        if ((int) $pending['n'] === 0) {
            return;
        }

        $checks = $this->db
            ->query(
                "SELECT tc.TABLE_NAME AS t, cc.CONSTRAINT_NAME AS n, cc.CHECK_CLAUSE AS c
            FROM information_schema.CHECK_CONSTRAINTS cc JOIN information_schema.TABLE_CONSTRAINTS
                tc
              ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME
            WHERE cc.CONSTRAINT_SCHEMA=?",
                [$schema],
            )
            ->getResultArray();
        foreach ($checks as $check) {
            $this->db->query("ALTER TABLE `{$check['t']}` DROP CHECK `{$check['n']}`");
        }

        foreach (self::COLUMNS as $table => $specific) {
            $existing = array_column(
                $this->db
                    ->query(
                        "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA=? AND TABLE_NAME=?",
                        [$schema, $table],
                    )
                    ->getResultArray(),
                'c',
            );
            $renames = [];
            foreach (self::map($table) as $old => $new) {
                if (in_array($old, $existing, true)) {
                    $renames[] = "RENAME COLUMN `$old` TO `$new`";
                }
            }
            if ($renames) {
                $this->db->query("ALTER TABLE `$table` " . implode(', ', $renames));
            }
        }

        foreach ($checks as $check) {
            $clause = str_replace("\\'", "'", $check['c']);
            foreach (self::map($check['t']) as $old => $new) {
                $clause = str_replace("`$old`", "`$new`", $clause);
            }
            $this->db->query("ALTER TABLE `{$check['t']}` ADD CHECK ($clause)");
        }
        $this->renameIndexes($schema);
    }

    public static function map(string $table): array
    {
        return (self::COLUMNS[$table] ?? []) + self::COMMON;
    }

    private function renameIndexes(string $schema): void
    {
        $indexes = $this->db
            ->query(
                "SELECT TABLE_NAME AS t, INDEX_NAME AS n, MIN(NON_UNIQUE) AS nu,
                GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR '_') AS cols
            FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND INDEX_NAME<>'PRIMARY' AND
                TABLE_NAME<>'migrations'
            GROUP BY TABLE_NAME, INDEX_NAME ORDER BY TABLE_NAME, INDEX_NAME",
                [$schema],
            )
            ->getResultArray();
        $taken = [];
        foreach ($indexes as $index) {
            $taken[$index['t']][$index['n']] = true;
        }
        foreach ($indexes as $index) {
            $base = substr(((int) $index['nu'] === 0 ? 'uq_' : 'ix_') . $index['cols'], 0, 60);
            if ($base === $index['n']) {
                continue;
            }
            $name = $base;
            for ($i = 2; isset($taken[$index['t']][$name]); $i++) {
                $name = $base . '_' . $i;
            }
            $this->db->query("ALTER TABLE `{$index['t']}` RENAME INDEX `{$index['n']}` TO `$name`");
            unset($taken[$index['t']][$index['n']]);
            $taken[$index['t']][$name] = true;
        }
    }

    public function down()
    {
        throw new \RuntimeException(
            'Restaurar el respaldo previo para volver a los nombres anteriores.',
        );
    }
}

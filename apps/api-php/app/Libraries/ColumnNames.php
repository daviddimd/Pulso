<?php
namespace App\Libraries;

/**
 * Translation of the former English column names to the current Spanish ones.
 * Used to write legacy records into the current schema; mirrors migration SpanishColumns.
 */
final class ColumnNames
{
    private const COMMON = ['establishment_id' => 'id_establecimiento', 'created_at' => 'fecha_creacion',
        'updated_at' => 'fecha_actualizacion', 'active' => 'activo'];

    private const TABLES = [
        'centros_costos' => ['code' => 'codigo', 'name' => 'nombre'],
        'establecimientos' => ['code' => 'codigo', 'name' => 'nombre', 'timezone' => 'zona_horaria'],
        'registros_auditoria' => ['actor_user_id' => 'id_usuario_actor', 'entity_type' => 'tipo_entidad', 'entity_id' => 'id_entidad',
            'action' => 'accion', 'before_data' => 'datos_anteriores', 'after_data' => 'datos_nuevos', 'ip_address' => 'direccion_ip'],
        'revisiones_direccion' => ['service_id' => 'id_viaje', 'address' => 'direccion', 'actor_user_id' => 'id_usuario_actor', 'source' => 'origen'],
        'sesiones' => ['user_id' => 'id_usuario', 'token_hash' => 'hash_token', 'expires_at' => 'fecha_expiracion',
            'revoked_at' => 'fecha_revocacion', 'last_seen_at' => 'fecha_ultimo_uso'],
        'usuarios' => ['username' => 'nombre_usuario', 'full_name' => 'nombre_completo', 'password_hash' => 'hash_contrasena',
            'failed_login_attempts' => 'intentos_fallidos', 'locked_until' => 'bloqueado_hasta', 'clave_unica_sub' => 'sub_clave_unica',
            'auth_provider' => 'proveedor_autenticacion'],
        'vehiculos' => ['license_plate' => 'patente', 'current_odometer_km' => 'odometro_actual', 'year' => 'anio'],
        'viajes' => ['cost_center_id' => 'id_centro_costo', 'driver_id' => 'id_chofer', 'vehicle_id' => 'id_vehiculo',
            'created_by_user_id' => 'id_usuario_creador', 'origin' => 'origen', 'cancelled_at' => 'fecha_cancelacion', 'status' => 'estado',
            'started_at' => 'fecha_inicio', 'ended_at' => 'fecha_fin', 'departure_odometer_km' => 'odometro_salida',
            'arrival_odometer_km' => 'odometro_llegada', 'void_reason' => 'motivo_cancelacion'],
    ];

    /** Stored codes are Spanish too: [table][column] => Codes map. */
    private const VALUES = [
        'viajes' => ['estado' => Codes::STATUS, 'origen' => Codes::ORIGIN],
        'revisiones_direccion' => ['origen' => Codes::ORIGIN],
        'roles' => ['codigo' => Codes::ROLE],
        'registros_auditoria' => ['tipo_entidad' => Codes::ENTITY, 'accion' => Codes::ACTION],
    ];

    /** Renames the keys of a row bound for $table and translates its stored codes; unknown keys are kept. */
    public static function translate(string $table, array $row): array
    {
        $map = (self::TABLES[$table] ?? []) + self::COMMON;
        $translated = [];
        foreach ($row as $key => $value) $translated[$map[$key] ?? $key] = $value;
        foreach (self::VALUES[$table] ?? [] as $column => $codes) {
            if (is_string($translated[$column] ?? null)) $translated[$column] = Codes::stored($codes, $translated[$column]);
        }
        return $translated;
    }
}

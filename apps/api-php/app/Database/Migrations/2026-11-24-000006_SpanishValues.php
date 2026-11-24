<?php
namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Translates stored codes to Spanish: trip states, roles, origins and audit entity types and actions.
 * The API keeps its original codes (App\Libraries\Codes). Run offline after verifying a backup.
 */
final class SpanishValues extends Migration
{
    // Frozen copy of the maps at the time of this migration.
    private const STATUS = ['PENDING' => 'PENDIENTE', 'ASSIGNED' => 'ASIGNADO', 'IN_PROGRESS' => 'EN_CURSO', 'COMPLETED' => 'FINALIZADO', 'CANCELLED' => 'CANCELADO'];
    private const ROLE = ['ADMIN' => 'ADMINISTRACION', 'DRIVER' => 'CHOFER', 'SUPERVISOR' => 'JEFATURA', 'DISPATCHER' => 'DESPACHO', 'REQUESTER' => 'SOLICITANTE'];
    private const ORIGIN = ['ADMIN' => 'ADMINISTRACION', 'DRIVER' => 'CHOFER', 'LEGACY' => 'HISTORICO', 'DEMO' => 'DEMOSTRACION', 'USER' => 'USUARIO'];
    private const ENTITY = ['BITACORA' => 'VIAJE', 'USER' => 'USUARIO', 'VEHICLE' => 'VEHICULO', 'ESTABLISHMENT' => 'ESTABLECIMIENTO', 'DEMO' => 'DEMOSTRACION', 'MAINTENANCE' => 'MANTENCION'];
    private const ACTION = ['CREATE' => 'CREAR', 'START' => 'INICIAR', 'COMPLETE' => 'FINALIZAR', 'FINALIZE' => 'FINALIZAR',
        'ASSIGNMENT' => 'ASIGNAR', 'ADDRESS' => 'CORREGIR_DIRECCION', 'COST_CENTER' => 'ASIGNAR_CENTRO_COSTO',
        'CANCEL' => 'CANCELAR', 'CLOSE-CANCELLATION' => 'CERRAR_CANCELACION', 'UPDATE' => 'ACTUALIZAR',
        'HANDOVER_CLOSE' => 'CERRAR_RELEVO', 'HANDOVER_OPEN' => 'ABRIR_RELEVO',
        'LOGIN_SUCCESS' => 'INGRESO', 'LOGIN_FAILED' => 'INGRESO_FALLIDO', 'LOGOUT' => 'SALIDA',
        'ODOMETER_ADJUSTMENT' => 'AJUSTE_ODOMETRO', 'PASSWORD_RESET_CONSOLE' => 'RESTABLECER_CONTRASENA',
        'INITIAL_SETUP' => 'CONFIGURACION_INICIAL', 'CATALOG_IMPORT' => 'IMPORTAR_CATALOGO',
        'DEACTIVATE_DEMO' => 'DESACTIVAR_DEMOSTRACION', 'BACKUP_AND_DELETE' => 'RESPALDAR_Y_ELIMINAR',
        'DEMO_ODOMETER' => 'ODOMETRO_DEMOSTRACION', 'SEED' => 'SEMILLA', 'REPLACE_SAMPLE_SERVICES' => 'REEMPLAZAR_SERVICIOS_EJEMPLO',
        'REPLACE_SERVICES' => 'REEMPLAZAR_SERVICIOS', 'RESET_PROTOTYPE_PASSWORDS' => 'RESTABLECER_CLAVES_PROTOTIPO',
        'ARCHIVE_FIXTURE' => 'ARCHIVAR_PRUEBA', 'ROSTER_IMPORT' => 'IMPORTAR_ROSTER'];

    public function up()
    {
        $schema = $this->db->database;
        // CHECK constraints on viajes mention state and origin literals; drop them while the values change.
        $checks = $this->db->query("SELECT cc.CONSTRAINT_NAME AS n, cc.CHECK_CLAUSE AS c FROM information_schema.CHECK_CONSTRAINTS cc
            JOIN information_schema.TABLE_CONSTRAINTS tc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME
            WHERE cc.CONSTRAINT_SCHEMA=? AND tc.TABLE_NAME='viajes'", [$schema])->getResultArray();
        foreach ($checks as $check) $this->db->query("ALTER TABLE viajes DROP CHECK `{$check['n']}`");

        $all = "'" . implode("','", array_merge(array_keys(self::STATUS), array_values(self::STATUS))) . "'";
        $this->db->query("ALTER TABLE viajes MODIFY estado ENUM($all) NOT NULL DEFAULT 'PENDING'");
        $this->translate('viajes', 'estado', self::STATUS);
        $this->db->query("ALTER TABLE viajes MODIFY estado ENUM('" . implode("','", self::STATUS) . "') NOT NULL DEFAULT 'PENDIENTE'");

        $this->translate('viajes', 'origen', self::ORIGIN);
        $this->translate('revisiones_direccion', 'origen', self::ORIGIN);
        foreach (['viajes', 'revisiones_direccion'] as $table) $this->db->query("ALTER TABLE $table ALTER origen SET DEFAULT 'USUARIO'");
        $this->translate('roles', 'codigo', self::ROLE);
        $this->translate('registros_auditoria', 'tipo_entidad', self::ENTITY);
        $this->translate('registros_auditoria', 'accion', self::ACTION);

        foreach ($checks as $check) {
            $clause = str_replace("\\'", "'", $check['c']);
            foreach (self::STATUS + self::ORIGIN as $old => $new) $clause = str_replace("'$old'", "'$new'", $clause);
            $this->db->query("ALTER TABLE viajes ADD CHECK ($clause)");
        }
    }

    private function translate(string $table, string $column, array $map): void
    {
        $case = '';
        foreach ($map as $old => $new) $case .= ' WHEN ' . $this->db->escape($old) . ' THEN ' . $this->db->escape($new);
        $this->db->query("UPDATE `$table` SET `$column` = CASE `$column`$case ELSE `$column` END
            WHERE `$column` IN ('" . implode("','", array_keys($map)) . "')");
    }

    public function down()
    {
        throw new \RuntimeException('Restaurar el respaldo previo para volver a los códigos anteriores.');
    }
}

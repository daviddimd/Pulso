<?php
namespace App\Libraries;

final class Codes
{
    public const STATUS = [
        'PENDING' => 'PENDIENTE',
        'ASSIGNED' => 'ASIGNADO',
        'IN_PROGRESS' => 'EN_CURSO',
        'COMPLETED' => 'FINALIZADO',
        'CANCELLED' => 'CANCELADO',
    ];
    public const ROLE = [
        'ADMIN' => 'ADMINISTRACION',
        'DRIVER' => 'CHOFER',
        'SUPERVISOR' => 'JEFATURA',
        'DISPATCHER' => 'DESPACHO',
        'REQUESTER' => 'SOLICITANTE',
    ];
    public const ORIGIN = [
        'ADMIN' => 'ADMINISTRACION',
        'DRIVER' => 'CHOFER',
        'LEGACY' => 'HISTORICO',
        'DEMO' => 'DEMOSTRACION',
        'USER' => 'USUARIO',
    ];
    public const ENTITY = [
        'BITACORA' => 'VIAJE',
        'USER' => 'USUARIO',
        'VEHICLE' => 'VEHICULO',
        'ESTABLISHMENT' => 'ESTABLECIMIENTO',
        'DEMO' => 'DEMOSTRACION',
        'MAINTENANCE' => 'MANTENCION',
    ];
    public const ACTION = [
        'CREATE' => 'CREAR',
        'START' => 'INICIAR',
        'COMPLETE' => 'FINALIZAR',
        'FINALIZE' => 'FINALIZAR',
        'ASSIGNMENT' => 'ASIGNAR',
        'ADDRESS' => 'CORREGIR_DIRECCION',
        'STOP' => 'AGREGAR_PARADA',
        'COST_CENTER' => 'ASIGNAR_CENTRO_COSTO',
        'CANCEL' => 'CANCELAR',
        'CLOSE-CANCELLATION' => 'CERRAR_CANCELACION',
        'UPDATE' => 'ACTUALIZAR',
        'HANDOVER_CLOSE' => 'CERRAR_RELEVO',
        'HANDOVER_OPEN' => 'ABRIR_RELEVO',
        'LOGIN_SUCCESS' => 'INGRESO',
        'LOGIN_FAILED' => 'INGRESO_FALLIDO',
        'LOGOUT' => 'SALIDA',
        'ODOMETER_ADJUSTMENT' => 'AJUSTE_ODOMETRO',
        'PASSWORD_RESET_CONSOLE' => 'RESTABLECER_CONTRASENA',
        'INITIAL_SETUP' => 'CONFIGURACION_INICIAL',
        'CATALOG_IMPORT' => 'IMPORTAR_CATALOGO',
        'DEACTIVATE_DEMO' => 'DESACTIVAR_DEMOSTRACION',
        'BACKUP_AND_DELETE' => 'RESPALDAR_Y_ELIMINAR',
        'DEMO_ODOMETER' => 'ODOMETRO_DEMOSTRACION',
        'SEED' => 'SEMILLA',
        'REPLACE_SAMPLE_SERVICES' => 'REEMPLAZAR_SERVICIOS_EJEMPLO',
        'REPLACE_SERVICES' => 'REEMPLAZAR_SERVICIOS',
        'RESET_PROTOTYPE_PASSWORDS' => 'RESTABLECER_CLAVES_PROTOTIPO',
        'ARCHIVE_FIXTURE' => 'ARCHIVAR_PRUEBA',
        'ROSTER_IMPORT' => 'IMPORTAR_ROSTER',
    ];

    public static function stored(array $map, ?string $code): ?string
    {
        return $code === null ? null : $map[$code] ?? $code;
    }

    public static function api(array $map, ?string $code): ?string
    {
        if ($code === null) {
            return null;
        }
        $found = array_search($code, $map, true);
        return $found === false ? $code : $found;
    }
}

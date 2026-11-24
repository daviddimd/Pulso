<?php
namespace App\Libraries;
use Config\Database;
final class AuditService
{
    public static function log(
        string $establishmentId,
        ?string $actorUserId,
        string $entityType,
        string $entityId,
        string $action,
        ?array $before = null,
        ?array $after = null,
        ?string $ipAddress = null,
    ): void {
        Database::connect()
            ->table('registros_auditoria')
            ->insert([
                'id_establecimiento' => $establishmentId,
                'id_usuario_actor' => $actorUserId,
                'tipo_entidad' => $entityType,
                'id_entidad' => $entityId,
                'accion' => $action,
                'datos_anteriores' =>
                    $before === null
                        ? null
                        : json_encode($before, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'datos_nuevos' =>
                    $after === null
                        ? null
                        : json_encode($after, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'direccion_ip' => $ipAddress,
                'fecha_creacion' => UnitOfWork::now(),
            ]);
    }
}

<?php
namespace App\Libraries;
use Config\Database;
final class AuditService {
    public static function log(?string $actorUserId,string $entityType,string $entityId,string $action,?array $before=null,?array $after=null,?string $ipAddress=null): void {
        Database::connect()->table('registros_auditoria')->insert(['actor_user_id'=>$actorUserId,'entity_type'=>$entityType,'entity_id'=>$entityId,'action'=>$action,
            'before_data'=>$before === null ? null : json_encode($before,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),
            'after_data'=>$after === null ? null : json_encode($after,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),'ip_address'=>$ipAddress,'created_at'=>UnitOfWork::now()]);
    }
}

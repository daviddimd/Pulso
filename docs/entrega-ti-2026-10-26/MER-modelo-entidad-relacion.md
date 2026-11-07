# MER y diccionario

Fecha: 2026-10-26. Versión 1.0.

## Fuente

Metadatos de las nueve entidades de la base local. Ver MER-Pulso.svg, modelo-metadatos.json y modelo-estructura.sql.

## Integridad

Cada usuario pertenece a un establecimiento. El acceso operacional deriva la institución de la sesión, nunca de un parámetro libre del navegador.

Usuarios, vehículos, centros y servicios tienen establishment_id. Tramos y revisiones se filtran a través del servicio; sesiones a través del usuario. Las FK físicas son por id; la coherencia entre instituciones se valida en los repositorios y ServiceEngine.

Unicidad: users.username, users.rut, users.clave_unica_sub y vehicles.license_plate son globales; users(establishment_id, roster_code), vehicles(establishment_id, role_code), cost_centers(establishment_id, code) son por institución.

Columnas active_driver_id, active_vehicle_id y active_service_id son IF(ended_at IS NULL, id_recurso, NULL), STORED y UNIQUE: un tramo activo por recurso y servicio.

ServiceEngine aplica transacción y bloqueo de fila del establecimiento. version protege servicios; expectedUpdatedAt protege ajustes de kilometraje.

Las lecturas deben ser enteras no negativas; llegada no inferior a salida ni al odómetro actual del vehículo. La suma de diferencias de los tramos determina el recorrido, incluso con cambio de móvil.

CANCELLED exige no haber iniciado el servicio; no existen nuevos kilómetros de cancelación ni viajes de regreso asociados. La migración conserva una excepción origin=LEGACY para registros históricos: no habilita cancelaciones en ruta mediante la API.

Rol, patente, tipo, modelo, año y activación del vehículo no son editables por PATCH. Solo kilometraje, con motivo y sin tramo abierto.

audit_logs.entity_id es una referencia lógica polimórfica, no FK. La auditoría es de aplicación, no un registro criptográficamente inmutable ni protección frente a administradores de la base.

La tabla migrations del framework es infraestructura y queda fuera del MER funcional. El SQL adjunto es estructura de referencia; la instalación debe utilizar las migraciones CodeIgniter.

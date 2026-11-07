# Pulso / entrega para revisión TI

Fecha: 2026-10-26. No equivale a aceptación institucional ni certificado de producción.

Los cinco PDF están en la carpeta pdf del ZIP. Fuentes editables:
- Pulso-procesos.bpmn: BPMN 2.0 con tres procesos y geometría DI; importar en editor compatible.
- BPMN-*.svg: representación vectorial de los tres procesos.
- MER-Pulso.svg, modelo-metadatos.json y modelo-estructura.sql: MER y esquema sin registros.
- UML-casos-de-uso.puml y UML-*.svg: casos de uso editables y vistas por actor.
- REQ-requerimientos-moscow.md: línea base y transcripción de solicitud TI.
- AUDITORIA-cumplimiento-2026-10-26.md: matriz y límites de verificación.
- inventario-auditado.json: hashes del código revisado, sin secretos.

La documentación reemplaza los borradores operacionales anteriores. Las cancelaciones solo existen antes del inicio; solo se edita el kilometraje de un vehículo. La excepción histórica LEGACY no habilita nuevas cancelaciones en ruta. No incluye .env, credenciales, registros de usuarios ni bitácoras.

Pendiente de TI: versión literal «MySQL 16.x», habilitación real de Clave Única, despliegue y aceptación del piloto. Instalar base mediante migraciones, no ejecutar el SQL de referencia sobre una base existente.

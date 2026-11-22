# Pulso / entrega para revisión TI

Fecha: 2026-11-22. No equivale a aceptación institucional ni certificado de producción.

Los cinco PDF están en la carpeta pdf del ZIP. Fuentes editables:
- Pulso-procesos.bpmn: BPMN 2.0 con tres procesos y geometría DI; importar en editor compatible.
- BPMN-*.svg: representación vectorial de los tres procesos.
- MER-Pulso.svg, MER-Usuarios.svg, MER-Flota.svg, modelo-metadatos.json y modelo-estructura.sql: MER y esquema sin registros.
- UML-casos-de-uso.puml y UML-*.svg: casos de uso editables y vistas por actor.
- REQ-requerimientos-moscow.md: línea base y transcripción de solicitud TI.
- AUDITORIA-cumplimiento-2026-11-22.md: matriz y límites de verificación.
- inventario-auditado.json: hashes del código revisado, sin secretos.

Esta entrega incorpora el informe MER del 09-11-2026 y las observaciones posteriores de TI confirmadas el 22-11-2026 sobre institución heredada, catálogos por establecimiento y relevos dentro del viaje. Las cancelaciones solo existen antes del inicio; solo se edita el kilometraje de un vehículo. La excepción histórica LEGACY no habilita nuevas cancelaciones en ruta. No incluye .env, credenciales, registros de usuarios ni bitácoras.

Pendiente de TI: versión literal «MySQL 16.x», habilitación real de Clave Única, despliegue y aceptación del piloto. Para actualizar una base existente, detener el servicio y comprobar un respaldo restaurable antes de ejecutar php spark migrate. Usar el SQL adjunto como referencia. La reversión requiere restauración.

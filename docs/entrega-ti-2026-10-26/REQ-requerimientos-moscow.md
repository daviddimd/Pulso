# Requerimientos MoSCoW

Fecha: 2026-10-26. Versión 1.0.

## TEC-01 / Must / CodeIgniter 4.x y PHP 8.4.x, separación MVC.

Estado: Verificado local

Criterio: CI 4.7.5 / PHP 8.4.27; controladores, repositorios, dominio y vista React.

Evidencia: composer.lock; app/Controllers; app/Models; apps/web/src

## TEC-02 / Must / Frontend HTML5, Bootstrap 5.x y React; Ajax mediante JavaScript.

Estado: Verificado local

Criterio: React 19.2.8; Bootstrap utilities 5.3.8; fetch REST. No requiere jQuery al usar React.

Evidencia: apps/web/package.json; src/main.tsx; src/operations.ts

## TEC-03 / Must / Base de datos: MySQL 16.x, según correo de TI.

Estado: Pendiente TI

Criterio: Motor local MySQL 8.4.11. Confirmar producto y versión exactos; no asumir PostgreSQL ni MariaDB.

Evidencia: metadata de la base; migración CreatePulsoTables

## TEC-04 / Must / PDF con FPDF 1.9.x.

Estado: Verificado local

Criterio: FPDF 1.9.0; respuestas PDF verificadas en pruebas de API.

Evidencia: PdfExporter.php; ExportsController.php; CostCentersController.php

## TEC-05 / Must / Excel con SheetJS / xlsx.

Estado: Verificado local

Criterio: SheetJS 0.20.3 compilado dentro del frontend; sin carga de scripts remotos al exportar.

Evidencia: src/xlsx-export.ts; lockfile frontend

## TEC-06 / Must / Bibliotecas y fuentes servidas localmente; sin CDN en ejecución.

Estado: Verificado estático

Criterio: CSS, JS, fuentes y SVG locales. La URL npm de SheetJS se usa al instalar/compilar, no por el navegador en producción.

Evidencia: main.tsx; index.html compilado; assets locales

## TEC-07 / Must / Operación independiente por establecimiento.

Estado: Verificado local

Criterio: Consultas y mutaciones por institución; catálogos propios, zona horaria y provisión de administrador por consola.

Evidencia: AuthFilter; repositorios; UnitOfWork; pruebas de aislamiento

## TEC-08 / Must / Facilitar integración de autenticación con Clave Única.

Estado: Implementado; piloto pendiente

Criterio: Inicio OAuth, state de un solo uso, callback, consulta de identidad y vínculo a RUN registrado. Falta validación con proveedor real.

Evidencia: ClaveUnicaClient; AuthController; AuthRepository; TestAuth

## DOC-01 / Must / Diagrama de procesos BPMN.

Estado: Entregado

Criterio: Tres procesos BPMN descriptivos con XML editable y DI, SVG y PDF.

Evidencia: 01-Pulso-Procesos-BPMN.pdf; Pulso-procesos.bpmn

## DOC-02 / Must / Modelo entidad-relación.

Estado: Entregado

Criterio: Nueve entidades, cardinalidades, claves y diccionario obtenido del esquema real.

Evidencia: 02-Pulso-Modelo-Entidad-Relacion.pdf

## DOC-03 / Must / Casos de uso UML.

Estado: Entregado

Criterio: Actores, frontera del sistema y trece casos con flujos y excepciones.

Evidencia: 03-Pulso-Casos-de-Uso-UML.pdf

## DOC-04 / Must / Copia de requerimientos levantados; MoSCoW deseable.

Estado: Entregado para revisión

Criterio: Matriz derivada del correo TI y acuerdos del usuario; debe ser validada por la contraparte funcional.

Evidencia: 04-Pulso-Requerimientos-MoSCoW.pdf

## RF-01 / Must / Crear servicio con destino, actividad y centro de costos o Indefinido.

Estado: Verificado local

Criterio: Sin actividad o destino no se guarda. Indefinido es cost_center_id NULL y se asigna después.

Evidencia: ServiceEngine::create; CostCenterField

## RF-02 / Must / Solo un servicio simultáneo por chofer y vehículo.

Estado: Verificado local

Criterio: Tramos activos únicos y validaciones transaccionales. Servicios futuros no ocupan recursos todavía.

Evidencia: service_legs; ServiceEngine; prueba concurrente

## RF-03 / Must / Iniciar y finalizar desde el chofer asignado.

Estado: Verificado local

Criterio: Inicio toma lectura del vehículo; cierre exige odómetro válido y registra fechas. Administración no suplanta al chofer.

Evidencia: ServiceEngine start / complete

## RF-04 / Must / Cancelación solo administrativa y previa al inicio.

Estado: Verificado local

Criterio: PENDING / ASSIGNED sin started_at ni tramos. IN_PROGRESS no se cancela.

Evidencia: ServiceEngine cancel; prueba de rechazo sin efectos

## RF-05 / Must / Permitir reasignación de chofer o vehículo.

Estado: Verificado local

Criterio: En ruta exige lectura del móvil saliente y registra nuevo tramo con lectura propia del entrante.

Evidencia: ServiceEngine assignment

## RF-06 / Must / Corregir dirección con historial y aviso al chofer.

Estado: Implementado

Criterio: Aviso visible al actualizar datos; Entendido lo oculta en ese navegador. No es confirmación central en servidor.

Evidencia: service_address_revisions; AddressChangeAlerts

## RF-07 / Must / Vehículo con identidad fija; solo ajustar kilometraje.

Estado: Verificado local

Criterio: Alta permitida; PATCH rechaza rol, patente, tipo, modelo, año y active. Motivo y versión obligatorios para km.

Evidencia: VehicleRepository; VehicleCard; pruebas API

## RF-08 / Must / Exportar bitácora solo con completados del período.

Estado: Verificado local

Criterio: Se usa ended_at y zona del establecimiento; excluye pendientes, activos y cancelados.

Evidencia: ReportRepository::daily; pruebas exportación

## RF-09 / Must / Totales por centro con viajes y km.

Estado: Verificado local

Criterio: Completados y cancelados separados; km solo completados con lecturas completas. Mostrar centros con actividad e incluir restantes opcionalmente.

Evidencia: ReportRepository::summary; CostCenterReport

## RF-10 / Must / Historial de servicios por chofer y vehículo.

Estado: Implementado

Criterio: Acceso administrativo desde sus nombres; incluye participación de tramos anteriores.

Evidencia: OperationsDashboard; ServiceRepository

## RNF-01 / Must / Aislamiento, control de acceso y sesiones.

Estado: Verificado local

Criterio: Roles ADMIN / DRIVER, Argon2id, cookie HttpOnly, token hash, bloqueo 5 fallos / 15 min. HTTPS y despliegue se verifican con TI.

Evidencia: AuthRepository; AuthFilter; AuthController

## RNF-02 / Must / Evitar sobrescrituras y conservar trazabilidad.

Estado: Verificado local

Criterio: Versiones, expectedUpdatedAt, transacciones y audit_logs. No se promete inmutabilidad frente al DBA.

Evidencia: UnitOfWork; ServiceEngine; AuditService

## UX-01 / Should / Interfaz móvil legible, sobria y con temas claro/oscuro.

Estado: Implementado

Criterio: Controles amplios, SVG locales, navegación adaptable y reduced-motion. Falta aceptación en dispositivos institucionales.

Evidencia: CSS responsive; ThemeToggle; componentes

## UX-02 / Should / Autocompletar centro por código o nombre.

Estado: Implementado

Criterio: Un campo con sugerencias y primera opción Indefinido.

Evidencia: CostCenterField.tsx

## FUT-01 / Could / Canales de avisos centralizados y acuse de lectura.

Estado: Fuera de versión

Criterio: Solo se ofrece aviso en la app mediante actualización periódica y reconocimiento local.

Evidencia: Propuesta; sin compromiso actual

## EX-01 / Won’t / Cancelar viajes ya iniciados o registrar km de cancelación.

Estado: Excluido

Criterio: Después de iniciar se finaliza con odómetro real. No hay retorno automático asociado.

Evidencia: Regla confirmada 26-10-2026

## EX-02 / Won’t / Modificar rol u otra identidad de un vehículo registrado.

Estado: Excluido

Criterio: Solo ajuste administrativo de kilometraje.

Evidencia: Regla confirmada 26-10-2026

## EX-03 / Won’t / Gestionar información clínica o fichas de pacientes.

Estado: Fuera de alcance

Criterio: Herramienta operacional de movilización. Los campos libres no son un sistema clínico.

Evidencia: Alcance funcional

## Anexo: mensaje de TI

Estimado, buenas tardes. Lo solicitado:

Asunto: Lineamientos técnicos para la aceptación de desarrollos externos

Para que el área de Desarrollo pueda evaluar y aceptar un desarrollo elaborado una unidad externa a TIC, es indispensable e inexcusable que el entregable cumpla estrictamente con los siguientes lineamientos técnicos:

Lenguajes y tecnologías soportadas

Backend: CodeIgniter 4.x (PHP 8.4.x) - obligatorio arquitectura MVC.

Frontend: HTML5, Bootstrap 5.x, JavaScript/jQuery, Ajax, React.

Base de datos: MySQL 16.x.

Librerías de salida: PDF (FPDF 1.9.x), Excel (SheetJS / xlsx).

Documentación obligatoria

Diagrama de procesos (BPMN).
Modelo Entidad-Relación de la base de datos (MER).
Casos de uso UML.
Copia de Requerimientos levantados (deseable Formato MosCow).

Nota importante:

El sistema debe ser desarrollado con enfoque multiestablecimiento, aunque inicialmente no este pensado para esto, de modo que pueda operar de forma independiente y escalable en distintas instituciones si se requiriera. Asimismo, no se permite el uso de librerías linkeadas (referenciadas vía CDN o servidores externos), por normas de seguridad institucional; todas deben estar alojadas localmente. Finalmente, el mecanismo de autenticación de usuarios y contraseñas -en caso de no ser desarrollado por el equipo- debe permitir y facilitar la integración con Clave Única, especialmente si la plataforma estará expuesta en internet y no solo en intranet.

El cumplimiento de estos lineamientos es un requisito estricto y no negociable para la implementación y adopción del desarrollo dentro de nuestra área. Entregables que no se ajusten a lo expuesto no podrán ser aceptados.

Quedo atento a cualquier consulta adicional.

Saludos cordiales,

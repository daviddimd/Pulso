# Corroboración de lineamientos TI

Fecha: 2026-11-10. Versión 2.0.

## Resultado

Cumplimiento local del stack y aislamiento. Aceptación integral pendiente: versión de MySQL solicitada, habilitación real Clave Única y despliegue hospitalario.

## Matriz

TEC-01: CodeIgniter 4.x y PHP 8.4.x, separación MVC.
Estado: Verificado local
CI 4.7.5 / PHP 8.4.27; controladores, repositorios, dominio y vista React.
Evidencia: composer.lock; app/Controllers; app/Models; apps/web/src

TEC-02: Frontend HTML5, Bootstrap 5.x y React; Ajax mediante JavaScript.
Estado: Verificado local
React 19.2.8; Bootstrap utilities 5.3.8; fetch REST. No requiere jQuery al usar React.
Evidencia: apps/web/package.json; src/main.tsx; src/operations.ts

TEC-03: Base de datos: MySQL 16.x, según correo de TI.
Estado: Pendiente TI
Motor local MySQL 8.4.11. Confirmar producto y versión exactos; no asumir PostgreSQL ni MariaDB.
Evidencia: metadata de la base; migración CreatePulsoTables

TEC-04: PDF con FPDF 1.9.x.
Estado: Verificado local
FPDF 1.9.0; respuestas PDF verificadas en pruebas de API.
Evidencia: PdfExporter.php; ExportsController.php; CostCentersController.php

TEC-05: Excel con SheetJS / xlsx.
Estado: Verificado local
SheetJS 0.20.3 compilado dentro del frontend; sin carga de scripts remotos al exportar.
Evidencia: src/xlsx-export.ts; lockfile frontend

TEC-06: Bibliotecas y fuentes servidas localmente; sin CDN en ejecución.
Estado: Verificado estático
CSS, JS, fuentes y SVG locales. La URL npm de SheetJS se usa al instalar/compilar, no por el navegador en producción.
Evidencia: main.tsx; index.html compilado; assets locales

TEC-07: Operación independiente por establecimiento.
Estado: Verificado local
Consultas y mutaciones por institución; catálogos propios, zona horaria y provisión de administrador por consola.
Evidencia: AuthFilter; repositorios; UnitOfWork; pruebas de aislamiento

TEC-08: Facilitar integración de autenticación con Clave Única.
Estado: Implementado; piloto pendiente
Inicio OAuth, state de un solo uso, callback, consulta de identidad y vínculo a RUN registrado. Falta validación con proveedor real.
Evidencia: ClaveUnicaClient; AuthController; AuthRepository; TestAuth

DOC-01: Diagrama de procesos BPMN.
Estado: Entregado
Tres procesos BPMN descriptivos con XML editable y DI, SVG y PDF.
Evidencia: 01-Pulso-Procesos-BPMN.pdf; Pulso-procesos.bpmn

DOC-02: Modelo entidad-relación.
Estado: Entregado
Trece entidades, cardinalidades, claves y diccionario obtenido del esquema real.
Evidencia: 02-Pulso-Modelo-Entidad-Relacion.pdf

DOC-03: Casos de uso UML.
Estado: Entregado
Actores, frontera del sistema y trece casos con flujos y excepciones.
Evidencia: 03-Pulso-Casos-de-Uso-UML.pdf

DOC-04: Copia de requerimientos levantados; MoSCoW deseable.
Estado: Entregado para revisión
Matriz derivada del correo TI y acuerdos del usuario; debe ser validada por la contraparte funcional.
Evidencia: 04-Pulso-Requerimientos-MoSCoW.pdf

## Validación

Suite local PHP/MySQL y sesión, build y lint correctos. No hay pruebas de carga regional ni homologación real Clave Única.

## Arquitectura

Controllers REST + Models/repositorios + Libraries de dominio; vista React compilada servida por FrontendController. Sin Node en ejecución productiva.

## Salidas externas

No hay scripts CSS o fuentes de CDN en ejecución. Maps es enlace voluntario; Clave Única usa HTTPS al proveedor cuando esté habilitado.

## Límites

Aislamiento lógico por aplicación, FK por id y usuario de una sola institución. Auditoría no criptográficamente inmutable. origin=LEGACY preserva registros históricos sin permitir nuevas cancelaciones en ruta.

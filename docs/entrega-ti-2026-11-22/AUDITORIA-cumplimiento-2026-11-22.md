# Corroboración de lineamientos TI

Fecha: 2026-11-22. Versión 3.0.

## Resultado

Cumplimiento local del stack y aislamiento. Aceptación integral pendiente: versión de MySQL solicitada, habilitación real Clave Única y despliegue hospitalario.

## Matriz

TEC-01: CodeIgniter 4.x y PHP 8.4.x, separación MVC.
Estado: Verificado local
CI 4.7.5 / PHP 8.4.27; controladores, repositorios, dominio y vista React.
Evidencia: registro de versiones de Composer; controladores y modelos del servidor; código de la interfaz

TEC-02: Interfaz: HTML5, Bootstrap 5.x y React; Ajax mediante JavaScript.
Estado: Verificado local
React 19.2.8; Bootstrap utilities 5.3.8; fetch REST. No requiere jQuery al usar React.
Evidencia: manifiesto de dependencias de la interfaz; punto de entrada de la interfaz; cliente de la API en la interfaz

TEC-03: Base de datos: MySQL 16.x, según correo de TI.
Estado: Pendiente TI
Motor local MySQL 8.4.11. Confirmar producto y versión exactos; no asumir PostgreSQL ni MariaDB.
Evidencia: metadatos de la base; migración inicial

TEC-04: PDF con FPDF 1.9.x.
Estado: Verificado local
FPDF 1.9.0; respuestas PDF verificadas en pruebas de API.
Evidencia: generador PDF; controlador de exportaciones; controlador de centros de costos

TEC-05: Excel con SheetJS / xlsx.
Estado: Verificado local
SheetJS 0.20.3 compilado dentro de la interfaz; sin carga de scripts remotos al exportar.
Evidencia: módulo de exportación a Excel; registro de versiones de la interfaz

TEC-06: Bibliotecas y fuentes servidas localmente; sin CDN en ejecución.
Estado: Verificado estático
CSS, JS, fuentes y SVG locales. La URL npm de SheetJS se usa al instalar/compilar, no por el navegador en producción.
Evidencia: punto de entrada de la interfaz; página compilada; recursos locales

TEC-07: Operación independiente por establecimiento.
Estado: Verificado local
Consultas y mutaciones por institución; catálogos propios, zona horaria y provisión de la primera institución en /configurar y de las siguientes por consola.
Evidencia: filtro de sesión; repositorios; unidad transaccional; pruebas de aislamiento

TEC-08: Facilitar integración de autenticación con Clave Única.
Estado: Implementado; piloto pendiente
Inicio OAuth, state de un solo uso, callback, consulta de identidad y vínculo a RUN registrado. Falta validación con proveedor real.
Evidencia: cliente ClaveÚnica; controlador de acceso; repositorio de acceso; pruebas de acceso

DOC-01: Diagrama de procesos BPMN.
Estado: Entregado
Tres procesos BPMN descriptivos con XML editable y DI, SVG y PDF.
Evidencia: 01-Pulso-Procesos-BPMN.pdf; Pulso-procesos.bpmn

DOC-02: Modelo entidad-relación.
Estado: Entregado
Catorce entidades de negocio, alias históricos, cardinalidades, claves y diccionario obtenido del esquema real.
Evidencia: 02-Pulso-Modelo-Entidad-Relacion.pdf

DOC-03: Casos de uso UML.
Estado: Entregado
Actores, frontera del sistema y dieciséis casos con flujos y excepciones.
Evidencia: 03-Pulso-Casos-de-Uso-UML.pdf

DOC-04: Copia de requerimientos levantados; MoSCoW deseable.
Estado: Entregado para revisión
Matriz derivada del correo TI y acuerdos del usuario; debe ser validada por la contraparte funcional.
Evidencia: 04-Pulso-Requerimientos-MoSCoW.pdf

## Validación

Suite local PHP/MySQL y sesión, build y lint correctos. No hay pruebas de carga regional ni homologación real Clave Única.

## Arquitectura

Controllers REST + Models/repositorios + Libraries de dominio; vista React compilada servida por controlador de la interfaz. Sin Node en ejecución productiva.

## Salidas externas

No hay scripts CSS o fuentes de CDN en ejecución. Maps es enlace voluntario; Clave Única usa HTTPS al proveedor cuando esté habilitado.

## Límites

Aislamiento lógico por aplicación, FK por id y usuario de una sola institución. Auditoría no criptográficamente inmutable. origen HISTORICO preserva registros históricos sin permitir nuevas cancelaciones en ruta.

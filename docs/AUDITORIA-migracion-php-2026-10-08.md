> HISTÓRICO: evaluación del 08-10-2026. No acredita el estado actual. Consultar entrega-ti-2026-10-26/AUDITORIA-cumplimiento-2026-10-26.md.

# Auditoría de migración de Pulso — 8 de octubre de 2026

## Dictamen

La elección de React + CodeIgniter + MySQL es compatible, en principio, con los lineamientos recibidos. Sin embargo, la migración PHP encontrada está incompleta y tiene defectos de seguridad, compatibilidad e integridad de datos. No debe declararse lista para aceptación institucional ni sustituir todavía al backend anterior.

Revisión estática de `apps/api-php`, sus consumidores en `apps/web`, documentación y configuración del repositorio. No se modificaron datos, credenciales ni código funcional durante esta auditoría. No se eliminaron archivos. Las referencias corresponden al estado local, que contiene cambios sin confirmar en Git.

## Hallazgos prioritarios

### P1 — Asociación insegura de identidad en ClaveÚnica

`apps/api-php/app/Controllers/AuthController.php:235–245` permite que `sub` sea nulo y busca `rut = RUN recibido OR clave_unica_sub = sub`. Con un `sub` ausente, la condición puede seleccionar una cuenta cuyo identificador externo sea NULL, aunque su RUN sea distinto. La comprobación posterior de cuenta activa no garantiza que sea la persona correcta.

Corregir la asociación de identidad para fallar ante datos insuficientes o contradictorios; no ejecutar una búsqueda alternativa por un identificador nulo. Probar RUN desconocido, identificador ausente, identidades discordantes y cuentas desactivadas antes de habilitar este acceso. La presencia de un cliente OAuth no demuestra una integración validada.

### P1 — Falta aislamiento efectivo entre establecimientos

`ServicesController.php:256` y `:280–285` buscan servicios por ID sin condicionar por establecimiento. `VehiclesController.php:132` hace lo mismo al editar vehículos. Tener `establishment_id` y un filtro de autenticación no limita automáticamente esas consultas: un administrador autenticado podría operar sobre IDs de otra institución.

La creación y reasignación tampoco comprueban de forma integral que chofer, vehículo y centro de costos pertenezcan al mismo establecimiento. Todas las lecturas, comandos, relaciones e informes deben partir de un ámbito institucional autorizado. Probar con dos establecimientos, intercambiando IDs conocidos en cada endpoint, incluyendo historial y exportaciones.

### P1 — React y PHP no comparten el mismo contrato REST

Ejemplos comprobados:

| Operación | React espera | PHP entrega |
|---|---|---|
| Usuario actual | `{ user }` | Objeto de usuario directo |
| Lista administrativa de servicios | `{ entries, total, ... }` | `{ data, pagination }` |
| Vehículos | `{ vehicles }` | Array directo |
| Choferes | `{ drivers }` | Array directo |
| Centros de costos | `{ costCenters }` | Array directo |
| Resumen de centros | `{ from, to, rows }` y campos de kilómetros esperados | Array con otra estructura |
| Crear servicio | `{ entry }` | Servicio directo |

Referencias: `AuthController::me`, `ServicesController::index/create/formatService`, `VehiclesController::index`, `AdminController::drivers`, `CostCentersController::index/summary`, `apps/web/src/App.tsx` y `apps/web/src/operations.ts`.

Además, los servicios serializados omiten relaciones anidadas y datos consumidos por la interfaz. Las revisiones de dirección se ordenan ascendentemente, mientras la interfaz usa la primera como la más reciente. Cambiar solamente la URL del backend no conserva el funcionamiento. Fijar un contrato y ejecutar pruebas de cada respuesta contra los consumidores reales.

### P1 — Cálculo incorrecto de kilómetros

`CostCentersController.php:136` suma `odometer_km`, y `ExportsController.php:43/157` usa ese mismo valor para kilómetros del servicio y agregados. El odómetro final no es la distancia recorrida: pasar de 50.012 a 50.020 representa 8 km, no 50.020 km.

Calcular distancias a partir de los tramos, sin convertir mediciones desconocidas en cero. Aplicar la misma definición al panel, Excel y PDF. Incluir servicios con varios tramos y centros desactivados con actividad histórica.

### P1 — Reasignar un vehículo mezcla sus odómetros

`ServiceEngine.php:296` abre el nuevo tramo con `departure_odometer_km = handoverKm`, incluso cuando cambia el vehículo. Esa lectura corresponde al vehículo que entrega el servicio. El nuevo tramo debe partir del odómetro propio del vehículo entrante. Probar un cambio entre vehículos con lecturas muy diferentes.

### P1 — La detección de conflictos no comprueba filas modificadas

`ServiceEngine.php:110/198/320/356/422/469/534` compara el resultado de `Query Builder update()` mediante `=== 0`. El resultado de esa operación es booleano; no es el contador de filas afectadas. Por eso una actualización condicionada por versión que no modifica ninguna fila no se identifica correctamente como conflicto.

La versión del cliente también es opcional. Exigirla en los comandos que corresponda, comprobar filas afectadas y garantizar que tramos, odómetros, servicio y auditoría se confirmen o reviertan juntos. Las restricciones únicas de tramos activos son una buena base, pero no resuelven todos estos conflictos. Probar dos peticiones simultáneas de finalizar y reasignar.

### P1 — El arranque PHP no corresponde al esqueleto declarado

`composer.json` declara CodeIgniter `^4.6` y PHP `^8.4`, pero `public/index.php:11` usa el arranque antiguo mediante `system/bootstrap.php`. `spark` también usa el arranque antiguo. El appstarter oficial de CI 4.6 utiliza `Boot.php` y `Boot::bootWeb` / el arranque CLI correspondiente.

Faltan dependencias instaladas, archivo de bloqueo de Composer, estructura writable y una configuración completa contrastada con el appstarter de la versión elegida. Instalar desde un esqueleto oficial compatible y trasladar el código de aplicación antes de intentar certificarlo. La comprobación mínima de PHP del punto de entrada dice 8.1 y debe ser coherente con PHP 8.4.x exigido por TIC. `^8.4` por sí solo tampoco limita a la rama 8.4.x.

### P1 — Excel todavía no está conectado

`ExportsController::daily` y `CostCentersController::export` entregan JSON. La interfaz sigue descargando la respuesta como blob con extensión `.xlsx` (`OperationsDashboard` y `CostCenterReport.tsx:17`). El resultado sería JSON renombrado, no un libro Excel válido.

Existe `apps/web/src/xlsx-export.ts`, pero no está conectado a esos botones. Integrarlo con los contratos nuevos y comprobar abriendo los libros resultantes. PDF existe como implementación inicial; requiere validar kilómetros, contenido, textos largos y presentación. No se comprobó la salida PDF ejecutándola.

### P1 — Configuración privada PHP no excluida de Git

`git status` muestra `apps/api-php/.env` como archivo nuevo y `git check-ignore` no lo excluye. No implica que ya se haya publicado, pero un agregado general lo incorporaría al repositorio. Añadir reglas de exclusión y una plantilla sin secretos antes de actualizar GitHub. No se reprodujeron sus valores en esta auditoría.

### P2 — CORS acepta cualquier origen con credenciales

`CorsFilter.php:33–39` refleja cualquier cabecera Origin y habilita credenciales. `CORS_ORIGIN` solamente actúa cuando no llega Origin: no es una lista de autorización. Usar orígenes permitidos explícitos o mismo origen, y revisar conjuntamente cookies y protección de operaciones frente a solicitudes de otros sitios. Este hallazgo no presupone por sí solo una elusión de SameSite.

### P2 — Errores ocultos y paginación incompleta

La creación con inicio inmediato confirma primero el servicio y captura el error de inicio sin devolverlo como fallo al cliente (`ServicesController::create`). Puede informar éxito sin haber iniciado el viaje. `mine` recorta a 50 registros y calcula activos/próximos sobre ese subconjunto, sin respetar completamente la paginación esperada. Recuperar el viaje activo independientemente de la página y mantener respuestas explícitas ante fallos.

## Contraste con la solicitud institucional

| Requisito | Estado observado |
|---|---|
| CodeIgniter 4.x / PHP 8.4.x | Declarado; arranque y ejecución pendientes de corregir/verificar. |
| MVC | Carpetas de modelos/controladores y lógica de dominio presentes. Muchos accesos usan Query Builder directamente; documentar responsabilidades reales. React puede ser la capa de presentación, sin reescribirla en PHP. |
| Frontend permitido | React existente compila. Bootstrap está declarado, pero no se encontró integrado en el código del frontend. Confirmar si TIC exige su uso o lo enumera entre tecnologías permitidas. |
| MySQL 16.x | Requisito ambiguo: esa denominación no corresponde a las ramas documentadas consultadas. Pedir motor y versión exactos; no sustituirlo por MariaDB o PostgreSQL por cuenta propia. |
| FPDF 1.9.x | Declarado en Composer; instalación y salida sin verificar. No reemplazarlo por otra librería sin acuerdo de TIC. |
| SheetJS/xlsx | Dependencia y utilidad presentes, pero flujo de descarga incompleto. |
| Multiestablecimiento | Modelo iniciado, aislamiento insuficiente. |
| Bibliotecas locales | No se detectaron importaciones CDN en las entradas y fuentes revisadas. La compilación produce recursos locales. Pendiente comprobar despliegue y tráfico real. |
| Preparación para ClaveÚnica | Cliente/rutas/campos presentes; fallo de asociación de identidad y validación integral pendiente. |
| BPMN | El archivo contiene un flowchart Mermaid, no un diagrama BPMN formal. |
| MER | Hay un borrador Mermaid de entidades y relaciones; contrastarlo con la migración ejecutada definitiva. |
| Casos de uso UML | El archivo usa flowchart, no la notación específica de casos de uso UML. |
| Requerimientos | Existe matriz MoSCoW, pero contradice reglas actuales y declara cumplimientos no demostrados. |

Las librerías descargadas durante la preparación e incluidas en el despliegue local no son equivalentes a cargar un CDN durante el uso. Enlaces de navegación a Maps y la comunicación con el proveedor de identidad tampoco son bibliotecas externas; documentar estos accesos para que TIC defina su política de red.

## Documentación a corregir

- `REQ-requerimientos-moscow.md` marca como cumplidos aislamiento, Excel y ClaveÚnica sin evidencia suficiente. Cambiar por estado real y pruebas de aceptación.
- RF-04 y BPMN todavía contemplan cancelar en progreso, contrario a la decisión vigente: cancelar solamente antes de iniciar.
- RF-16 vuelve a proponer viajes de regreso, que fueron retirados del alcance.
- La matriz sustituye MySQL por MySQL/MariaDB sin confirmación de TIC. Conservar el requisito original y registrar la duda pendiente.
- Alinear obligatoriedad de las librerías institucionales con la matriz: no presentarlas como una elección opcional del desarrollador.
- Preparar BPMN y UML con su notación correspondiente, en formato editable y legible para revisión.
- Actualizar README con instalación PHP, compilación React, configuración institucional, migraciones, respaldos, recuperación, permisos y pruebas. Incluir un procedimiento de migración de datos si se conservará la base anterior: una semilla no migra datos existentes.

## ¿Qué archivos borrar?

No borrar todavía `apps/api`, Prisma, migraciones PostgreSQL ni sus pruebas. Son la implementación de referencia y permiten comparar comportamientos mientras PHP se completa. El comando raíz de desarrollo todavía inicia `apps/api`, por lo que el backend antiguo sigue en uso.

Tampoco borrar TypeScript del frontend: Vite lo compila a JavaScript estático, que puede servir Apache u otro servidor del hospital. No requiere Node ejecutándose en producción para atender la interfaz.

Después de aprobar la sustitución:

1. Retirar del despliegue PHP el backend Node, Prisma y configuraciones PostgreSQL, conservando la referencia en Git.
2. Retirar scripts de demostración y semillas de presentación del paquete de producción, junto con credenciales de prueba; no confundirlos con migraciones necesarias.
3. Excluir `.env`, dependencias descargadas, logs, respaldos y cachés del código versionado según su función. `vendor` y el frontend compilado sí deben estar disponibles en el servidor o generarse durante el despliegue.
4. Evaluar rutas heredadas de cancelación/cierre y campos antiguos solamente después de inventariar los datos históricos y sus consumidores.
5. Integrar la utilidad SheetJS existente; su falta de uso actual no es razón para descartarla antes de resolver Excel.

No hay una limpieza de archivos que por sí sola deje terminada esta migración.

## Verificaciones realizadas y límites

- Lint del frontend: correcto.
- Compilación TypeScript del frontend: correcta.
- Build de producción React/Vite: correcto.
- Revisión estática de contratos, autorización, consultas, comandos, salidas y documentación: hallazgos anteriores.
- PHP, Composer y MySQL no están disponibles en PATH en este entorno. No se ejecutaron backend PHP, migraciones MySQL, pruebas concurrentes, autenticación real ni generación PDF. No se afirma que hayan pasado.
- No se encontraron pruebas PHP del proyecto que acrediten equivalencia funcional.

## Orden de cierre recomendado

1. Confirmar con TIC el motor/versión de base de datos y el formato esperado de despliegue MVC con React.
2. Proteger archivos privados y completar el esqueleto CI/PHP reproducible.
3. Corregir asociación de identidad, aislamiento institucional, odómetros y transacciones.
4. Alinear contratos, conectar Excel y probar toda la interfaz contra PHP, con el backend anterior detenido.
5. Ejecutar pruebas con dos instituciones, concurrencia, exportaciones y los estados de servicio vigentes.
6. Corregir los entregables documentales y preparar la instalación. Retirar legado del paquete final después de estas comprobaciones.

## Referencias técnicas contrastadas

- Arranque oficial CI 4.6: https://raw.githubusercontent.com/codeigniter4/appstarter/v4.6.0/public/index.php
- Query Builder CI 4.6, retorno de update: https://raw.githubusercontent.com/codeigniter4/CodeIgniter4/v4.6.0/system/Database/BaseBuilder.php
- Versiones MySQL: https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html
- SheetJS: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/ — la documentación advierte que el paquete del registro npm está desactualizado; revisar la distribución oficial y almacenarla localmente, sin carga CDN en ejecución.
- Distribución FPDF: https://packagist.org/packages/setasign/fpdf

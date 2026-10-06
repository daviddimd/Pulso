# Pulso · Oficina de Movilización del Hospital de Talca

Prototipo operacional sobre React/Vite, Fastify y Prisma/PostgreSQL.
Conserva autenticación y roles DRIVER/ADMIN. No incorpora campos de pacientes,
identificadores clínicos ni requerimientos.

## Probar sin modificar los datos existentes

Con dependencias instaladas y PostgreSQL disponible, configurar localmente
`apps/api/.env.test` con `DATABASE_URL` apuntando exclusivamente a `pulso_test`.
No versionar credenciales. El usuario PostgreSQL necesita crear esquemas en esa BD.

Desde la raíz:

```powershell
npm.cmd --prefix apps/api run prototype
```

Abre http://localhost:5177 (API: http://localhost:3107). El comando crea un esquema
temporal aleatorio, ensaya las migraciones y carga los usuarios de demostración y vehículos del catálogo
del seed. Pulsa Enter en esa terminal para cerrar ambos servidores y eliminar
únicamente ese esquema. Los datos de esta demostración no son persistentes.
No ejecutar más de una demostración simultánea en esos puertos.
El prototipo incluye 11 servicios de prueba con direcciones reales: ocho completados,
uno pendiente, uno asignado y uno cancelado. Sus lecturas de 50.000 a 120.033 km
son inventadas para probar los flujos, no corresponden al kilometraje real.
El lanzador comprueba los puertos antes de crear el esquema o cargar semillas.
Si indica que están ocupados, usa la instancia ya abierta o ciérrala con Enter
en su terminal antes de volver a ejecutar el comando.

Credenciales exclusivas de demostración, ya utilizadas por la beta:

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Administrador | admin | admin |
| Chofer | chofer01 (hasta chofer09) | chofer |

Las cuentas usan los nueve nombres de la nómina institucional y claves provisionales. Los ocho vehículos corresponden a la foto
`IMG_3732.JPEG` (filas 10–17), con rol, patente, tipo, año y modelo transcritos.
No se inventan kilometrajes: administración debe registrar la lectura inicial.
Lo anterior aplica a `vehicles:import` y al seed básico. El seed de demostración
sí establece lecturas ficticias, identificadas en auditoría como `DEMO_ODOMETER`.
El seed rechaza producción y no restablece contraseñas, activación ni odómetros
de registros que ya existen.

## Flujo implementado

- Un chofer puede guardar varios servicios o crear e iniciar. Solo un tramo activo
  por chofer y vehículo, con índices únicos parciales en PostgreSQL.
- Administración crea pendientes, asigna chofer/vehículo, reasigna y cancela.
- La selección inicial de vehículo puede hacerla el chofer al iniciar si aún no
  tiene uno asignado. Cambiar una asignación existente requiere administración.
- Reasignar durante el viaje cierra el tramo anterior con lectura de kilometraje
  y abre el siguiente con el odómetro del vehículo correspondiente.
- Una cancelación durante el viaje deja cierre pendiente y conserva la ocupación.
  El chofer registra los kilómetros; después puede crear un regreso vinculado.
- La dirección original conocida y cada corrección se conservan en revisiones.
  Administración puede corregirla incluso después de finalizar.
- La actividad a realizar es obligatoria. Los textos deben contener únicamente
  información operacional, nunca información clínica.
- El odómetro de salida es automático. Una lectura inicial desconocida requiere
  registro administrativo. Los ajustes administrativos exigen motivo y vehículo
  sin tramo activo; no reescriben lecturas históricas.
- Polling cada 15 segundos, al recuperar foco y conexión. No hay notificaciones
  garantizadas con la aplicación cerrada o el teléfono bloqueado.
- Excel incluye solo COMPLETED por fecha de finalización en America/Santiago,
  ambos días incluidos, con hojas de servicios, tramos y centros de costos. Máximo 366 días entre
  fechas. Las distancias históricas desconocidas quedan vacías.

El centro de costos es obligatorio al crear e iniciar servicios. Administración puede
asignarlo o corregirlo con auditoría, incluso en servicios cerrados. Los registros
anteriores conservan su centro desconocido hasta que administración los clasifique.
Número de orden
institucional: pendiente; por ahora se identifica el servicio con su UUID.
Tipos/año/modelo de vehículos son opcionales para migrar el historial sin inventar
valores.

Para actualizar el catálogo de la base persistente configurada en `apps/api/.env`:

```powershell
npm.cmd --prefix apps/api run vehicles:import
```

La importación conserva IDs, historial y kilometrajes existentes. Desactiva los
ocho vehículos ficticios conocidos sin borrarlos; si alguno tiene un tramo activo,
lo informa y lo conserva activo hasta su cierre. Puede repetirse sin duplicar
vehículos ni restablecer lecturas. Las pruebas automatizadas mantienen sus fixtures
ficticios en un esquema aislado.

### Semilla de demostración persistente

```powershell
npm.cmd --prefix apps/api run seed:demo
```

Solo se admite en pulso_dev o pulso_test, fuera de producción. Mantiene los ocho
vehículos de la foto, el administrador y las cuentas chofer01…chofer09 de la nómina;
agrega 11 servicios con origen interno DEMO, direcciones públicas verificadas y
actividades operacionales sin etiquetas de prueba en los textos visibles.
Las fuentes están en `apps/api/prisma/service-destinations.ts`. Los viajes y
kilometrajes siguen siendo simulados; las direcciones reales no acreditan viajes.
Para reemplazar la semilla anterior: desde apps/api ejecutar
`node --import tsx prisma/demo-data.ts --replace`. Conserva kilometrajes, guarda
una copia interna de los servicios anteriores en auditoría y crea nuevos IDs.
Solo reemplaza los once IDs originales sin modificaciones ni viajes activos.
Los completados tienen fecha 28 de septiembre de 2026 para probar el Excel.
Es repetible sin duplicar ni restablecer modificaciones. Rechaza inventar lecturas
en vehículos que ya tienen kilometraje o tramos ajenos a esta semilla.
Antes del piloto real se debe preparar una base limpia con lecturas verificadas.

### Alojamiento del piloto (pendiente de configurar)

Propuesta: aplicación Node/React en Render Free y PostgreSQL en Neon Free.
Mantener frontend y API bajo el mismo origen HTTPS simplifica las cookies de sesión.
Render duerme tras 15 minutos sin tráfico y tarda aproximadamente un minuto en
reactivarse; no ofrece garantías de producción en su plan gratis. No usar su
PostgreSQL gratuito para persistencia del piloto: caduca a los 30 días.
Neon Free dispone de cuotas de cómputo, almacenamiento y transferencia; el número
de usuarios por sí solo no garantiza mantenerse dentro de ellas. El polling cada
15 segundos mantiene consultas mientras haya sesiones abiertas.

Fuentes verificadas el 28/09/2026:
- https://render.com/docs/free
- https://neon.com/docs/introduction/plans

Falta elegir las cuentas del proveedor, configurar despliegue de frontend/API,
secretos, HTTPS y migraciones, y comprobar login/exportación desde una red externa.
La prueba piloto comenzará cuando exista esa URL pública. Las reglas
institucionales adicionales continúan pendientes de definición.

## Centros de costos y nómina institucional

Importación desde las planillas recibidas el 3 de octubre de 2026: 134 centros
(código y nombre) y nueve choferes. El catálogo transcrito está en
`apps/api/prisma/institutional-data.ts`.

Tras aplicar migraciones, para cargar o repetir la importación local:

```powershell
npm.cmd --prefix apps/api run institutional:import
```

El comando solo admite pulso_dev. Conserva IDs y claves de los choferes oficiales
ya importados. Desactiva las diez cuentas ficticias conocidas y revoca sus
sesiones, pero conserva sus nombres e historiales; no atribuye viajes antiguos
a los nuevos choferes. Rechaza archivar un chofer con un tramo abierto.
Las nuevas cuentas usan la contraseña provisional `chofer`:

| Usuario | Chofer |
| --- | --- |
| chofer01 | Miguel Ángel Pacheco Alfaro |
| chofer02 | Carlos José Canales Sepulveda |
| chofer03 | Belisario Alexis Gutierrez Gonzalez |
| chofer04 | Oscar Valdivia Mejias |
| chofer05 | Luis Alfonso Cerda Arevalo |
| chofer06 | Cesar Martinez Espinoza |
| chofer07 | Hector Felipe Gonzalez Ruiz |
| chofer08 | Juan Ricardo Gonzalez Veliz |
| chofer09 | Cristian Enrique Castro Salazar |

La pestaña administrativa **Centros de costos** consulta un período por fecha de
cierre (America/Santiago) y separa viajes/km completados y cancelados con recorrido.
No incluye cancelados sin salida, sin recorrido ni pendientes de cerrar. Las
lecturas históricas incompletas se cuentan por separado y no se convierten en
kilómetros cero. Un regreso vinculado hereda el centro y cuenta como otro viaje.
El Excel conserva solo completados y añade centro por servicio y resumen por centro.
Los servicios anteriores sin centro aparecen como **Sin centro asignado**.

`GET /api/cost-centers` lista centros activos para usuarios autenticados;
`GET /api/cost-centers/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` es solo administrativo.

## Pruebas

```powershell
npm.cmd --prefix apps/api run check
npm.cmd --prefix apps/web run lint
npm.cmd --prefix apps/web run build
```

Las pruebas de integración usan un esquema temporal aislado dentro de pulso_test.
Ejecutarlas con su lanzador, no directamente: primero se verifica la conversión
de registros históricos, se aplica todo el esquema, se carga el seed y se ejecutan
las pruebas. Al terminar se elimina únicamente el esquema creado por esa ejecución.
Si se mata el proceso abruptamente puede quedar un esquema pulso_test_* huérfano.
Las pruebas unitarias se ejecutan por separado con `npm run test:unit` en apps/api.

## Migraciones y activación en una base persistente

Migraciones operacionales (aplicadas en la base local de desarrollo):

1. `20260926000100_service_states`: amplía el enum.
2. `20260926000200_operational_services`: amplía tablas, conserva IDs, crea
   revisiones/tramos históricos y restricciones. OPEN pasa a IN_PROGRESS y VOIDED
   a CANCELLED. No se inventa kilometraje de salida ni autor de datos históricos.
3. `20261003000100_cost_centers_and_roster`: catálogo de centros, relación con
   servicios y código de nómina; conserva los centros históricos desconocidos.

Antes de activar sobre una base persistente: respaldarla, revisar sus migraciones
aplicadas y ensayar con una copia. Detener el backend antiguo mientras se aplica
la conversión; no deben convivir escritores del modelo anterior con el nuevo.
Desde apps/api, los comandos explícitos son:

```powershell
.\node_modules\.bin\prisma.cmd migrate status --config prisma7.config.ts
.\node_modules\.bin\prisma.cmd migrate deploy --config prisma7.config.ts
```

Después iniciar con `npm.cmd run dev` desde la raíz. Ese comando usa la base
persistente de apps/api/.env; necesita las migraciones nuevas. No ejecuta seeds.
Un rollback después de escribir servicios nuevos requiere una estrategia de
restauración/conversión; no basta con arrancar la versión antigua.

## Contratos

`/api/services` crea y lista (listado global solo ADMIN);
`/api/services/mine` lista los propios y devuelve por separado el servicio activo.
Las consultas están paginadas de a 30, ordenadas por actualización.
Cada POST sobre `/api/services/:id/{start,complete,assignment,address,cost-center,cancel,close-cancellation,return}`
requiere la versión conocida. Un conflicto devuelve 409: refrescar antes de repetir.
Las transacciones son serializables, sin reintentos automáticos de mutaciones.
Todas las acciones operacionales se auditan dentro de la transacción.

`GET /api/services/:id/audit` muestra los últimos 100 eventos a administración;
la BD conserva el historial completo. `/api/vehicles` permite gestión administrativa,
activación/desactivación y ajuste de odómetro con control de versión por updatedAt.
Solo administración registra vehículos nuevos. Patente, tipo, modelo y año se
definen al registrar y son de solo lectura después: PATCH rechaza esos campos.
El rol institucional puede cambiar conservando el ID y los viajes del vehículo.
`GET /api/exports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` exporta el período;
`?date=YYYY-MM-DD` sigue admitido.
Las rutas /api/bitacoras de la beta siguen como adaptadores a la misma lógica
operacional, incluyendo su representación OPEN/VOIDED en respuestas.

## Ingreso de destinos

El destino se escribe manualmente con calle, número y comuna. Crear servicios,
corregir direcciones y registrar regresos comparten el mismo campo. Se conservan
las validaciones de longitud y el historial de correcciones. El enlace a Google
Maps del servicio sigue disponible para consultar el destino.

Se retiró el autocompletado externo después de medir demoras de 2,7 a 5,9 segundos
y coincidencias imprecisas con direcciones de Talca. Escribir en el campo no genera
consultas a proveedores ni consume créditos. No se requiere clave de mapas.

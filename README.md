# Pulso

Backend: CodeIgniter 4, PHP 8.4.27 o posterior de la rama 8.4 y MySQL. Interfaz: React compilado y servido localmente, sin CDN.

## Desarrollo

Node.js 24.22.1 o posterior de la rama 24 LTS (ver `.node-version`).

```sh
npm run dev
```

Interfaz: http://localhost:5177. Versión compilada servida por PHP: http://localhost:8080.

En este equipo, el arranque utiliza las herramientas privadas de `.runtime`. En otros equipos se necesita PHP 8.4.27+ de la rama 8.4 (o `PHP_BINARY`), Composer y una base MySQL configurada en `apps/api-php/.env`, usando `.env.example` como plantilla. Instalar dependencias con `composer install` dentro de `apps/api-php` y `npm ci` dentro de `apps/web`.

```sh
npm run php -- migrate
npm test
npm run lint
npm run build
```

Las pruebas usan exclusivamente la base `pulso_test`; nunca la base configurada para la aplicación. El build coloca la interfaz y sus dependencias locales en `apps/api-php/public`.

## Servidor PHP

Configurar el directorio público del sitio en `apps/api-php/public`, PHP 8.4.27+ de la rama 8.4 con extensiones intl, mbstring, mysqli, openssl, curl y gd, y permisos de escritura para `apps/api-php/writable`. Instalar dependencias con `composer install --no-dev`, compilar la interfaz y ejecutar `php spark migrate`. Configurar HTTPS, el acceso MySQL y la URL institucional en `.env`; nunca publicar ese archivo ni exponer la raíz del repositorio.

La semilla `PulsoSeeder` es exclusiva para prototipo y no se ejecuta en producción. ClaveÚnica requiere credenciales institucionales; el acceso local mantiene los usuarios existentes. Los respaldos locales de la migración están excluidos de Git.

## Actualización del modelo de viajes

Para actualizar una instalación existente, detén la aplicación, verifica un respaldo restaurable de MySQL y ejecuta `php spark migrate` desde `apps/api-php`. La migración del 22 de noviembre consolida los viajes enlazados anteriores y conserva sus folios como alias. Cada recorrido queda registrado en `viajes_tramos`. La institución del usuario deriva del funcionario, el código de róster es único por establecimiento en `funcionarios` y los catálogos de flota pertenecen a cada establecimiento. La migración `AuditEstablishment` asigna `establishment_id` a cada registro de auditoría; si encuentra registros sin institución identificable y hay varios establecimientos, se detiene para asignarlos manualmente. Para volver al esquema anterior, restaura el respaldo en una base separada.

Registrar un relevo cierra el tramo vigente e inicia otro dentro del mismo viaje, en una sola transacción. El kilometraje total suma las diferencias de odómetros de los tramos. Los índices únicos de `viajes_tramos` impiden ocupar simultáneamente un chofer o un vehículo. El catálogo de roles se consulta con `php spark pulso:roles` y se mantiene pasando `codigo nombre descripcion`. Los permisos de esta versión corresponden a los perfiles Administración y Chofer.

Consulta los [documentos de la revisión MER](docs/entrega-ti-2026-11-22/LEEME.md) o descarga el [paquete completo](output/Pulso-Entregables-TI-2026-11-22.zip).

Actualización de seguridad del 21 de octubre de 2026: instalar PHP 8.4.27+ y Node.js 24.22.1+. Configurar `session.upload_progress.enabled=0` en el PHP del servidor según el aviso adicional del 23 de octubre; `public/.user.ini` incluye ese ajuste para los SAPIs que lo admiten. En Apache con mod_php debe aplicarlo TI en su configuración PHP. Reiniciar los procesos que usaban versiones anteriores.

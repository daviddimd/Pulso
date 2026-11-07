# Casos de uso UML

Fecha: 2026-10-26. Versión 1.0.

## CU-01 Iniciar y cerrar sesión

Actores: Chofer, Administración

Precondición: Cuenta y establecimiento activos.

Flujo: Validar credenciales; crear sesión con token aleatorio y hash en base; revocar al salir.

Excepciones: Credenciales inválidas: rechazo; cinco fallos bloquean 15 minutos. Clave Única solo si está configurada.

## CU-02 Registrar servicio

Actores: Chofer, Administración

Precondición: Sesión válida.

Flujo: Ingresar destino, actividad y centro o Indefinido; opcionalmente chofer y vehículo. Guardar o iniciar.

Excepciones: Sin chofer: PENDING. Con chofer: ASSIGNED. El chofer queda asignado a sí mismo. startNow fallido revierte el registro completo.

## CU-03 Consultar servicios e historial

Actores: Chofer, Administración

Precondición: Sesión válida.

Flujo: Filtrar por estado; consultar datos y tramos. Administración consulta también por chofer o vehículo.

Excepciones: Chofer solo ve sus servicios actuales/asignados. Administración solo consulta su institución.

## CU-04 Iniciar viaje

Actores: Chofer

Precondición: ASSIGNED y chofer actual; vehículo activo y odómetro conocido.

Flujo: Tomar automáticamente odómetro actual, abrir tramo y pasar a IN_PROGRESS.

Excepciones: Recurso ocupado: rechazo. El administrador no puede iniciar en nombre del chofer. Un cambio de vehículo ya asignado requiere administración.

## CU-05 Finalizar viaje

Actores: Chofer

Precondición: IN_PROGRESS; chofer actualmente asignado.

Flujo: Ingresar odómetro de llegada; validar; cerrar tramo, actualizar vehículo y marcar COMPLETED.

Excepciones: Lectura inferior o versión antigua: rechazo sin cierre. Administración no ejecuta complete por el chofer.

## CU-06 Asignar o reasignar recursos

Actores: Administración

Precondición: PENDING, ASSIGNED o IN_PROGRESS.

Flujo: Elegir recursos activos de la institución. En ruta registrar km del vehículo saliente, cerrar tramo y abrir otro.

Excepciones: Sin cambios: rechazo. Recurso ocupado o lectura inválida: rollback. No modifica la identidad del vehículo.

## CU-07 Corregir dirección

Actores: Administración

Precondición: Servicio existente de la institución y versión vigente.

Flujo: Guardar corrección y revisión de dirección; el chofer ve aviso y puede marcar Entendido.

Excepciones: El reconocimiento del aviso se conserva localmente en el navegador; no es un acuse centralizado de lectura.

## CU-08 Asignar centro de costos

Actores: Administración

Precondición: Servicio existente, centro activo de la institución.

Flujo: Cambiar centro o dejar Indefinido; registrar cambio auditado.

Excepciones: No se aceptan centros ajenos ni inactivos. El centro puede asignarse después del inicio o del cierre.

## CU-09 Cancelar antes del inicio

Actores: Administración

Precondición: PENDING o ASSIGNED, started_at nulo y ningún tramo.

Flujo: Registrar motivo y pasar a CANCELLED con fecha.

Excepciones: IN_PROGRESS y COMPLETED: rechazo. No hay cierre de cancelación, km cancelados ni creación automática de retorno.

## CU-10 Registrar vehículo

Actores: Administración

Precondición: Datos de identificación revisados.

Flujo: Registrar rol, patente, tipo, modelo, año y kilometraje inicial.

Excepciones: Identificadores duplicados o valores inválidos: rechazo. Tras crear, los datos identificativos quedan fijos.

## CU-11 Ajustar kilometraje

Actores: Administración

Precondición: Vehículo de su institución sin tramo activo y updatedAt vigente.

Flujo: Ingresar nueva lectura entera y motivo; guardar con auditoría.

Excepciones: No permite cambiar rol, patente, modelo, tipo, año ni activación. El ajuste administrativo puede corregir inconsistencias del odómetro.

## CU-12 Consultar centros y exportar

Actores: Administración

Precondición: Período válido de hasta 365 días de diferencia.

Flujo: Consultar bitácora o resumen por centro; exportar Excel local o PDF del servidor.

Excepciones: Bitácora incluye solo completados por fecha de finalización. Resumen cuenta cancelados por separado y no suma sus km. Fechas en zona institucional.

## CU-13 Provisionar establecimiento

Actores: Operador TI

Precondición: Acceso autorizado a consola del servidor.

Flujo: Ejecutar pulso:establishment con código, nombre, zona IANA y usuario; clave inicial por variable de entorno.

Excepciones: Código/usuario duplicado o zona inválida: rechazo. Crea institución y administrador; no copia catálogos de otras instituciones.

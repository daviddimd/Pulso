# Casos de uso UML

Fecha: 2026-11-22. Versión 3.0.

## CU-01 Iniciar y cerrar sesión

Actores: Chofer, Administración

Precondición: Cuenta y establecimiento activos.

Flujo: Validar credenciales; crear sesión con token aleatorio y hash en base; revocar al salir.

Excepciones: Credenciales inválidas: rechazo; cinco fallos bloquean 15 minutos. Clave Única solo si está configurada.

## CU-02 Registrar servicio

Actores: Chofer, Administración

Precondición: Sesión válida.

Flujo: Ingresar una o más direcciones en orden de recorrido (hasta 10), actividad y centro o Indefinido; opcionalmente chofer y vehículo. Guardar o iniciar.

Excepciones: Sin chofer: PENDIENTE. Con chofer: ASIGNADO. El chofer queda asignado a sí mismo. opción Iniciar ahora fallido revierte el registro completo.

## CU-03 Consultar servicios e historial

Actores: Chofer, Administración

Precondición: Sesión válida.

Flujo: Filtrar por estado; consultar datos y lecturas del viaje. Administración consulta también por chofer o vehículo.

Excepciones: Chofer consulta sus servicios asignados y aquellos donde participó, dentro de su institución vigente. Solo opera el chofer actualmente asignado. Administración solo consulta su institución.

## CU-04 Iniciar viaje

Actores: Chofer

Precondición: ASIGNADO y chofer actual; vehículo activo y odómetro conocido.

Flujo: Tomar automáticamente odómetro actual, registrar salida y pasar a EN_CURSO.

Excepciones: Recurso ocupado: rechazo. El administrador no puede iniciar en nombre del chofer. Un cambio de vehículo ya asignado requiere administración.

## CU-05 Finalizar viaje

Actores: Chofer

Precondición: EN_CURSO; chofer actualmente asignado.

Flujo: Ingresar odómetro de llegada; validar; registrar llegada, actualizar vehículo y marcar FINALIZADO.

Excepciones: Lectura inferior o versión antigua: rechazo sin cierre. Administración no ejecuta complete por el chofer.

## CU-06 Asignar o reasignar recursos

Actores: Administración

Precondición: PENDIENTE, ASIGNADO o EN_CURSO.

Flujo: Elegir recursos activos de la institución. En ruta registrar km del vehículo saliente, cerrar el tramo actual e iniciar otro dentro del mismo viaje en la misma transacción.

Excepciones: Sin cambios: rechazo. Recurso ocupado o lectura inválida: se revierte toda la operación. No modifica la identidad del vehículo.

## CU-07 Corregir direcciones

Actores: Administración

Precondición: Servicio existente de la institución y versión vigente.

Flujo: Agregar, quitar o corregir paradas y guardar la nueva ruta como revisión; el chofer ve aviso y puede marcar Entendido.

Excepciones: El reconocimiento del aviso se conserva localmente en el navegador; no es un acuse centralizado de lectura.

## CU-08 Asignar centro de costos

Actores: Administración

Precondición: Servicio existente, centro activo de la institución.

Flujo: Cambiar centro o dejar Indefinido; registrar cambio auditado.

Excepciones: No se aceptan centros ajenos ni inactivos. El centro puede asignarse después del inicio o del cierre.

## CU-09 Cancelar antes del inicio

Actores: Administración

Precondición: PENDIENTE o ASIGNADO, fecha_inicio nulo.

Flujo: Registrar motivo y pasar a CANCELADO con fecha.

Excepciones: EN_CURSO y FINALIZADO: rechazo. No hay cierre de cancelación, km cancelados ni creación automática de retorno.

## CU-10 Registrar vehículo

Actores: Administración

Precondición: Datos de identificación revisados.

Flujo: Registrar rol, patente, tipo, modelo, año y kilometraje inicial.

Excepciones: Identificadores duplicados o valores inválidos: rechazo. Tras crear, los datos identificativos quedan fijos.

## CU-11 Ajustar kilometraje

Actores: Administración

Precondición: Vehículo de su institución sin viaje activo y fecha de actualización vigente vigente.

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

Flujo: Ejecutar pulso:establecimiento con código, nombre, zona IANA y usuario; clave inicial por variable de entorno.

Excepciones: Código/usuario duplicado o zona inválida: rechazo. Crea institución y administrador; no copia catálogos de otras instituciones.

## CU-14 Gestionar cuentas

Actores: Administración

Precondición: Sesión de administración.

Flujo: Consultar las cuentas de la institución y crear cuentas de chofer o de administración con nombre, usuario, código de róster opcional y contraseña inicial de al menos 12 caracteres.

Excepciones: Usuario duplicado, róster repetido en la institución o rol distinto de Chofer o Administración: rechazo. La cuenta queda en la institución del administrador. La auditoría no guarda la contraseña ni su hash.

## CU-15 Configurar instalación nueva

Actores: Operador TI

Precondición: Base migrada sin instituciones y acceso al servidor para leer el código de un solo uso.

Flujo: Abrir /configurar, ingresar el código obtenido con pulso:codigo-configuracion y crear la institución y su cuenta de administración.

Excepciones: Código inválido: rechazo sin efectos. Con una institución existente /configurar queda cerrado. El código se elimina al usarse.

## CU-16 Restablecer contraseña

Actores: Operador TI

Precondición: Acceso autorizado a consola del servidor.

Flujo: Ejecutar pulso:clave con el usuario; la contraseña nueva se entrega por variable de entorno. Desbloquea la cuenta y cierra sus sesiones.

Excepciones: Contraseña de menos de 12 caracteres o usuario inexistente: rechazo. Las contraseñas no se recuperan; solo se reemplazan. Queda registrado en la auditoría.

## CU-17 Agregar parada durante el viaje

Actores: Administración

Precondición: Viaje pendiente, asignado o en curso de la institución y versión vigente.

Flujo: Ingresar la dirección y la tarea de la parada; se agrega al final de la ruta con quién la registró y cuándo, se guarda la nueva ruta como revisión y el chofer recibe el aviso.

Excepciones: Viaje finalizado o cancelado, más de 10 paradas o datos incompletos: rechazo. El chofer no agrega paradas; las solicita a administración.

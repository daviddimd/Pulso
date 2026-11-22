# MER y diccionario

Fecha: 2026-11-22. Versión 3.0.

## Fuente

Metadatos de 14 entidades de negocio y una tabla de alias de la base local. Ver MER-Pulso.svg, MER-Usuarios.svg, MER-Flota.svg, modelo-metadatos.json y modelo-estructura.sql.

## Integridad

El modelo contiene 14 entidades de negocio y una tabla de alias de folios anteriores. Las PK son enteras y autoincrementables. migrations pertenece a la infraestructura de CodeIgniter.

usuarios hereda establishment_id desde funcionarios. El traslado del funcionario cambia la institución efectiva de su cuenta y de sus sesiones vigentes. Las participaciones históricas permanecen vinculadas a la institución del viaje.

viajes almacena el propósito, destino, estado, fechas, centro de costos y asignación vigente. Antes de partir, driver_id y vehicle_id expresan la reserva. Durante el viaje expresan los recursos actualmente asignados. La participación efectiva y sus lecturas se consultan en viajes_tramos.

El relevo cierra el tramo vigente, actualiza el odómetro del vehículo saliente y abre otro tramo en el mismo viaje. La operación es transaccional y exige la versión vigente. El folio, la fecha inicial y el centro de costos del viaje se conservan.

viajes_tramos contiene id_viaje, id_chofer, id_vehiculo, fecha_inicio, fecha_fin, odometro_inicio y odometro_fin. Sus columnas generadas active_driver_id, active_vehicle_id y active_trip_id son STORED y UNIQUE y se activan cuando fecha_fin es NULL.

Fuente única de verdad (informe del 09-11, sección 3): viajes_tramos es la única fuente de los recursos efectivamente usados (chofer, vehículo, fecha_inicio y fecha_fin) y de los kilómetros recorridos. viajes.driver_id y vehicle_id registran la asignación planificada, necesaria antes de que exista un tramo; durante el viaje la aplicación los iguala al tramo vigente en la misma transacción del relevo, y los informes de participación se calculan desde los tramos. viajes.departure_odometer_km y arrival_odometer_km son la lectura global de salida y llegada que pidió la segunda revisión; no se restan para obtener distancia. vehiculos.current_odometer_km es estado derivado: la aplicación lo actualiza al cerrar cada tramo, en la misma transacción, y rechaza lecturas menores a la vigente.

Los kilómetros del viaje son la suma de odometro_fin menos odometro_inicio de sus tramos. Si falta una lectura, el total es desconocido. Las lecturas globales de cabecera son referencias al primer y último vehículo y no se restan para obtener distancia. Excepción: un viaje histórico sin tramos usó un solo vehículo, por lo que su distancia es la diferencia de esas lecturas.

Cada tramo, revisión y registro de auditoría contiene establishment_id. Las FK compuestas impiden vincular tramos y revisiones a un viaje de otra institución. Las consultas operativas y de auditoría incluyen el filtro institucional.

usuarios no guarda el código de róster: funcionarios.codigo_roster es único por establecimiento, de modo que la regla se mantiene también al trasladar a un funcionario.

tipos_vehiculo, marcas_vehiculo y modelos_vehiculo son catálogos locales de cada establecimiento. Cada administrador registra los datos de su flota y la aplicación reutiliza los nombres existentes dentro de su institución.

roles es un catálogo de definiciones mantenido por consola. Los permisos operativos implementados corresponden a Administración y Chofer. Los perfiles adicionales requieren definición funcional.

revisiones_direccion conserva el texto, la secuencia, la fecha y el autor de cada corrección. La relación con el autor es opcional para preservar el legado.

registros_auditoria es una auditoría general: entity_id es VARCHAR porque referencia viajes, vehículos o usuarios según entity_type y conserva identificadores históricos (legacy:...). Por eso no tiene FK a la entidad auditada. La integridad institucional se asegura con establishment_id NOT NULL y FK a establecimientos, y las consultas filtran por él.

folios_viajes_anteriores conserva los folios de la versión de viajes enlazados y permite consultar el viaje consolidado y su auditoría. Los registros de auditoría originales mantienen su entity_id.

La migración agrupa cadenas anteriores en un solo viaje, conserva cada recorrido como tramo y clona los catálogos usados por cada institución. Debe ejecutarse con la aplicación detenida y un respaldo restaurable. MySQL DDL no se revierte como una transacción ordinaria.

Las cancelaciones operativas solo se admiten antes del inicio. Las excepciones LEGACY conservan registros históricos sin habilitar nuevas cancelaciones de viajes en curso.

# MER y diccionario

Fecha: 2026-11-10. Versión 2.0.

## Fuente

Metadatos de 13 entidades de la base local. Ver MER-Pulso.svg, MER-Usuarios.svg, MER-Flota.svg, modelo-metadatos.json y modelo-estructura.sql.

## Integridad

Las 13 tablas operativas tienen una PK entera autoincrementable con nombre id_[entidad en singular]. El MER emplea los nombres del esquema físico. migrations es infraestructura de CodeIgniter.

Cada viaje tiene un único chofer y vehículo cuando se inicia. El destino se almacena como destino y la actividad como actividad. Antes de iniciar se puede cambiar la asignación sin crear otro viaje.

En un relevo se registra la llegada del viaje saliente y se abre otro en la misma transacción. El nuevo viaje enlaza al anterior mediante id_viaje_anterior. La FK y su unicidad limitan la cadena a un sucesor por viaje.

Las columnas generadas active_driver_id y active_vehicle_id tienen índices únicos. Se activan con status IN_PROGRESS y previenen dos viajes simultáneos para el mismo recurso.

departure_odometer_km y arrival_odometer_km son las lecturas del viaje. Distancia = llegada menos salida cuando se conocen ambas. Al cerrar, la aplicación actualiza el odómetro del vehículo. Los ajustes administrativos requieren motivo y quedan auditados.

Cada revisión de dirección tiene un viaje y puede referenciar un usuario autor. Se registra el destino al crear y después de cada corrección, con número de revisión y fecha. El autor puede faltar en el legado.

Los usuarios pertenecen a un establecimiento y a un funcionario de la misma institución. roles reemplaza al ENUM. Las definiciones se mantienen por consola con php spark pulso:roles. Los permisos operativos vigentes son Administración y Chofer.

Los perfiles Jefatura de Movilización, Despacho y Solicitante están en el catálogo. Sus permisos, aprobaciones y pantallas requieren definición funcional. Los funcionarios admiten unidad institucional.

La identificación vehicular usa codigo_movil, patente y referencias a catálogos de tipos y modelos. Cada modelo tiene una marca. Si el dato histórico de marca falta, el catálogo la registra como desconocida.

El aislamiento operacional deriva de la sesión y se valida en los repositorios y en ServiceEngine. El acceso por establecimiento es una regla de aplicación además de las relaciones físicas de pertenencia.

No se cancelan viajes iniciados. Las cancelaciones anteriores y los kilometrajes históricos desconocidos se conservan como LEGACY. Un viaje histórico con varios tramos se transforma en viajes enlazados, con sus lecturas y recursos originales.

El SQL es una referencia del esquema verificado. Para actualizar una instalación existente use las migraciones CodeIgniter con la aplicación detenida y un respaldo previo verificado.

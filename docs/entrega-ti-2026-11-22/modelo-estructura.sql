-- Pulso: solo estructura de referencia. Instalar con migraciones CodeIgniter.

CREATE TABLE `establecimientos` (
  `id_establecimiento` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'America/Santiago',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_establecimiento`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id_rol` int unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_rol` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `funcionarios` (
  `id_funcionario` int unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unidad` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `codigo_roster` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_funcionario`),
  UNIQUE KEY `establishment_id` (`establishment_id`,`id_funcionario`),
  UNIQUE KEY `funcionario_establecimiento_roster` (`establishment_id`,`codigo_roster`),
  CONSTRAINT `funcionarios_ibfk_1` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tipos_vehiculo` (
  `id_tipo_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `establishment_id` int unsigned NOT NULL,
  PRIMARY KEY (`id_tipo_vehiculo`),
  UNIQUE KEY `establishment_id` (`establishment_id`,`id_tipo_vehiculo`),
  UNIQUE KEY `establishment_id_2` (`establishment_id`,`nombre`),
  CONSTRAINT `tipos_vehiculo_ibfk_1` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `marcas_vehiculo` (
  `id_marca_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `establishment_id` int unsigned NOT NULL,
  PRIMARY KEY (`id_marca_vehiculo`),
  UNIQUE KEY `establishment_id` (`establishment_id`,`id_marca_vehiculo`),
  UNIQUE KEY `establishment_id_2` (`establishment_id`,`nombre`),
  CONSTRAINT `marcas_vehiculo_ibfk_1` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `modelos_vehiculo` (
  `id_modelo_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `id_marca_vehiculo` int unsigned NOT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `establishment_id` int unsigned NOT NULL,
  PRIMARY KEY (`id_modelo_vehiculo`),
  UNIQUE KEY `establishment_id` (`establishment_id`,`id_modelo_vehiculo`),
  UNIQUE KEY `establishment_id_2` (`establishment_id`,`id_marca_vehiculo`,`nombre`),
  CONSTRAINT `modelos_vehiculo_ibfk_1` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`),
  CONSTRAINT `modelos_vehiculo_ibfk_2` FOREIGN KEY (`establishment_id`, `id_marca_vehiculo`) REFERENCES `marcas_vehiculo` (`establishment_id`, `id_marca_vehiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id_usuario` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_rol` int unsigned NOT NULL,
  `id_funcionario` int unsigned NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `failed_login_attempts` int NOT NULL DEFAULT '0',
  `locked_until` datetime(3) DEFAULT NULL,
  `rut` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clave_unica_sub` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_provider` enum('local','clave_unica') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `id_funcionario` (`id_funcionario`),
  UNIQUE KEY `rut` (`rut`),
  UNIQUE KEY `clave_unica_sub` (`clave_unica_sub`),
  KEY `id_rol` (`id_rol`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`),
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionarios` (`id_funcionario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vehiculos` (
  `id_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `codigo_movil` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_plate` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_odometer_km` int unsigned DEFAULT NULL,
  `id_tipo_vehiculo` int unsigned DEFAULT NULL,
  `year` smallint unsigned DEFAULT NULL,
  `id_modelo_vehiculo` int unsigned DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_vehiculo`),
  UNIQUE KEY `license_plate` (`license_plate`),
  UNIQUE KEY `vehicle_tenant_role` (`establishment_id`,`codigo_movil`),
  KEY `establishment_id` (`establishment_id`),
  KEY `id_tipo_vehiculo` (`id_tipo_vehiculo`),
  KEY `id_modelo_vehiculo` (`id_modelo_vehiculo`),
  KEY `establishment_id_2` (`establishment_id`,`id_tipo_vehiculo`),
  KEY `establishment_id_3` (`establishment_id`,`id_modelo_vehiculo`),
  CONSTRAINT `vehiculos_ibfk_3` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `vehiculos_ibfk_4` FOREIGN KEY (`establishment_id`, `id_tipo_vehiculo`) REFERENCES `tipos_vehiculo` (`establishment_id`, `id_tipo_vehiculo`),
  CONSTRAINT `vehiculos_ibfk_5` FOREIGN KEY (`establishment_id`, `id_modelo_vehiculo`) REFERENCES `modelos_vehiculo` (`establishment_id`, `id_modelo_vehiculo`),
  CONSTRAINT `vehiculos_chk_1` CHECK (((`current_odometer_km` >= 0) or (`current_odometer_km` is null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `centros_costos` (
  `id_centro_costo` int unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_centro_costo`),
  UNIQUE KEY `establishment_id_code` (`establishment_id`,`code`),
  KEY `establishment_id` (`establishment_id`),
  CONSTRAINT `centros_costos_ibfk_1` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `viajes` (
  `id_viaje` int unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `cost_center_id` int unsigned DEFAULT NULL,
  `driver_id` int unsigned DEFAULT NULL,
  `vehicle_id` int unsigned DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `origin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `version` int unsigned NOT NULL DEFAULT '0',
  `cancelled_at` datetime(3) DEFAULT NULL,
  `status` enum('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `started_at` datetime(3) DEFAULT NULL,
  `ended_at` datetime(3) DEFAULT NULL,
  `destino` varchar(350) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `actividad` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `departure_odometer_km` int unsigned DEFAULT NULL,
  `arrival_odometer_km` int unsigned DEFAULT NULL,
  `void_reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_viaje`),
  UNIQUE KEY `establishment_id_2` (`establishment_id`,`id_viaje`),
  KEY `establishment_id` (`establishment_id`),
  KEY `cost_center_id` (`cost_center_id`),
  KEY `driver_id` (`driver_id`),
  KEY `vehicle_id` (`vehicle_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  KEY `driver_id_started_at` (`driver_id`,`started_at`),
  KEY `cost_center_id_status_ended_at` (`cost_center_id`,`status`,`ended_at`),
  KEY `vehicle_id_started_at` (`vehicle_id`,`started_at`),
  KEY `status_started_at` (`status`,`started_at`),
  KEY `status_ended_at` (`status`,`ended_at`),
  KEY `establishment_id_status` (`establishment_id`,`status`),
  CONSTRAINT `viajes_ibfk_1` FOREIGN KEY (`cost_center_id`) REFERENCES `centros_costos` (`id_centro_costo`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_3` FOREIGN KEY (`driver_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_4` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_5` FOREIGN KEY (`vehicle_id`) REFERENCES `vehiculos` (`id_vehiculo`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_chk_1` CHECK (((`ended_at` is null) or (`started_at` is null) or (`ended_at` >= `started_at`))),
  CONSTRAINT `viajes_chk_2` CHECK (((`origin` = _utf8mb4'LEGACY') or ((`status` = _utf8mb4'PENDING') and (`driver_id` is null) and (`started_at` is null) and (`ended_at` is null)) or ((`status` = _utf8mb4'ASSIGNED') and (`driver_id` is not null) and (`started_at` is null) and (`ended_at` is null)) or ((`status` = _utf8mb4'IN_PROGRESS') and (`driver_id` is not null) and (`vehicle_id` is not null) and (`started_at` is not null) and (`ended_at` is null)) or ((`status` = _utf8mb4'COMPLETED') and (`driver_id` is not null) and (`vehicle_id` is not null) and (`started_at` is not null) and (`ended_at` is not null)) or ((`status` = _utf8mb4'CANCELLED') and (`started_at` is null) and (`cancelled_at` is not null) and (`departure_odometer_km` is null) and (`arrival_odometer_km` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `viajes_tramos` (
  `id_viaje_tramo` int unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `id_viaje` int unsigned NOT NULL,
  `id_chofer` int unsigned NOT NULL,
  `id_vehiculo` int unsigned NOT NULL,
  `fecha_inicio` datetime(3) NOT NULL,
  `fecha_fin` datetime(3) DEFAULT NULL,
  `odometro_inicio` int unsigned DEFAULT NULL,
  `odometro_fin` int unsigned DEFAULT NULL,
  `active_driver_id` int unsigned GENERATED ALWAYS AS (if((`fecha_fin` is null),`id_chofer`,NULL)) STORED,
  `active_vehicle_id` int unsigned GENERATED ALWAYS AS (if((`fecha_fin` is null),`id_vehiculo`,NULL)) STORED,
  `active_trip_id` int unsigned GENERATED ALWAYS AS (if((`fecha_fin` is null),`id_viaje`,NULL)) STORED,
  PRIMARY KEY (`id_viaje_tramo`),
  UNIQUE KEY `active_driver_id` (`active_driver_id`),
  UNIQUE KEY `active_vehicle_id` (`active_vehicle_id`),
  UNIQUE KEY `active_trip_id` (`active_trip_id`),
  KEY `establishment_id` (`establishment_id`,`id_viaje`),
  KEY `id_chofer` (`id_chofer`),
  KEY `id_vehiculo` (`id_vehiculo`),
  CONSTRAINT `viajes_tramos_ibfk_1` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`),
  CONSTRAINT `viajes_tramos_ibfk_2` FOREIGN KEY (`id_chofer`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `viajes_tramos_ibfk_3` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`),
  CONSTRAINT `viajes_tramos_ibfk_4` FOREIGN KEY (`establishment_id`, `id_viaje`) REFERENCES `viajes` (`establishment_id`, `id_viaje`),
  CONSTRAINT `viajes_tramos_chk_1` CHECK (((`fecha_fin` is null) or (`fecha_fin` >= `fecha_inicio`))),
  CONSTRAINT `viajes_tramos_chk_2` CHECK (((`odometro_fin` is null) or (`odometro_inicio` is null) or (`odometro_fin` >= `odometro_inicio`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `revisiones_direccion` (
  `id_revision_direccion` int unsigned NOT NULL AUTO_INCREMENT,
  `service_id` int unsigned NOT NULL,
  `revision` int NOT NULL,
  `address` varchar(350) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` int unsigned DEFAULT NULL,
  `source` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `created_at` datetime(3) DEFAULT NULL,
  `establishment_id` int unsigned NOT NULL,
  PRIMARY KEY (`id_revision_direccion`),
  UNIQUE KEY `service_id_revision` (`service_id`,`revision`),
  KEY `service_id` (`service_id`),
  KEY `actor_user_id` (`actor_user_id`),
  KEY `establishment_id` (`establishment_id`,`service_id`),
  CONSTRAINT `revisiones_direccion_ibfk_1` FOREIGN KEY (`actor_user_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `revisiones_direccion_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `viajes` (`id_viaje`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `revisiones_direccion_ibfk_3` FOREIGN KEY (`establishment_id`, `service_id`) REFERENCES `viajes` (`establishment_id`, `id_viaje`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sesiones` (
  `id_sesion` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `token_hash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `last_seen_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_sesion`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `user_id_expires_at` (`user_id`,`expires_at`),
  CONSTRAINT `sesiones_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `registros_auditoria` (
  `id_registro_auditoria` bigint unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `actor_user_id` int unsigned DEFAULT NULL,
  `entity_type` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `ip_address` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_registro_auditoria`),
  KEY `entity_type_entity_id_created_at` (`entity_type`,`entity_id`,`created_at`),
  KEY `actor_user_id_created_at` (`actor_user_id`,`created_at`),
  KEY `auditoria_establecimiento_entidad` (`establishment_id`,`entity_type`,`entity_id`),
  CONSTRAINT `fk_auditoria_establecimiento` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`),
  CONSTRAINT `registros_auditoria_ibfk_1` FOREIGN KEY (`actor_user_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `folios_viajes_anteriores` (
  `id_folio_anterior` int unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `id_viaje` int unsigned NOT NULL,
  PRIMARY KEY (`id_folio_anterior`),
  KEY `establishment_id` (`establishment_id`,`id_viaje`),
  CONSTRAINT `folios_viajes_anteriores_ibfk_1` FOREIGN KEY (`establishment_id`, `id_viaje`) REFERENCES `viajes` (`establishment_id`, `id_viaje`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

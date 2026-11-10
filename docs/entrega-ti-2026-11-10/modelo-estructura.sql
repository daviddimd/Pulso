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
  PRIMARY KEY (`id_funcionario`),
  UNIQUE KEY `establishment_id` (`establishment_id`,`id_funcionario`),
  CONSTRAINT `funcionarios_ibfk_1` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tipos_vehiculo` (
  `id_tipo_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_tipo_vehiculo`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `marcas_vehiculo` (
  `id_marca_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_marca_vehiculo`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `modelos_vehiculo` (
  `id_modelo_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `id_marca_vehiculo` int unsigned NOT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_modelo_vehiculo`),
  UNIQUE KEY `id_marca_vehiculo` (`id_marca_vehiculo`,`nombre`),
  CONSTRAINT `modelos_vehiculo_ibfk_1` FOREIGN KEY (`id_marca_vehiculo`) REFERENCES `marcas_vehiculo` (`id_marca_vehiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id_usuario` int unsigned NOT NULL AUTO_INCREMENT,
  `establishment_id` int unsigned NOT NULL,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `roster_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
  UNIQUE KEY `establishment_id_roster_code` (`establishment_id`,`roster_code`),
  KEY `establishment_id` (`establishment_id`),
  KEY `id_rol` (`id_rol`),
  KEY `establishment_id_2` (`establishment_id`,`id_funcionario`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`),
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`establishment_id`, `id_funcionario`) REFERENCES `funcionarios` (`establishment_id`, `id_funcionario`),
  CONSTRAINT `usuarios_ibfk_3` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT
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
  CONSTRAINT `vehiculos_ibfk_1` FOREIGN KEY (`id_tipo_vehiculo`) REFERENCES `tipos_vehiculo` (`id_tipo_vehiculo`),
  CONSTRAINT `vehiculos_ibfk_2` FOREIGN KEY (`id_modelo_vehiculo`) REFERENCES `modelos_vehiculo` (`id_modelo_vehiculo`),
  CONSTRAINT `vehiculos_ibfk_3` FOREIGN KEY (`establishment_id`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT,
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
  `id_viaje_anterior` int unsigned DEFAULT NULL,
  `active_driver_id` int unsigned GENERATED ALWAYS AS (if((`status` = _utf8mb4'IN_PROGRESS'),`driver_id`,NULL)) STORED,
  `active_vehicle_id` int unsigned GENERATED ALWAYS AS (if((`status` = _utf8mb4'IN_PROGRESS'),`vehicle_id`,NULL)) STORED,
  `void_reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_viaje`),
  UNIQUE KEY `active_driver_id` (`active_driver_id`),
  UNIQUE KEY `active_vehicle_id` (`active_vehicle_id`),
  UNIQUE KEY `id_viaje_anterior` (`id_viaje_anterior`),
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
  CONSTRAINT `viajes_ibfk_6` FOREIGN KEY (`id_viaje_anterior`) REFERENCES `viajes` (`id_viaje`),
  CONSTRAINT `viajes_chk_1` CHECK (((`arrival_odometer_km` is null) or (`departure_odometer_km` is null) or (`arrival_odometer_km` >= `departure_odometer_km`))),
  CONSTRAINT `viajes_chk_2` CHECK (((`ended_at` is null) or (`started_at` is null) or (`ended_at` >= `started_at`))),
  CONSTRAINT `viajes_chk_3` CHECK (((`origin` = _utf8mb4'LEGACY') or ((`status` = _utf8mb4'PENDING') and (`driver_id` is null) and (`started_at` is null) and (`ended_at` is null) and (`departure_odometer_km` is null) and (`arrival_odometer_km` is null)) or ((`status` = _utf8mb4'ASSIGNED') and (`driver_id` is not null) and (`started_at` is null) and (`ended_at` is null) and (`departure_odometer_km` is null) and (`arrival_odometer_km` is null)) or ((`status` = _utf8mb4'IN_PROGRESS') and (`driver_id` is not null) and (`vehicle_id` is not null) and (`started_at` is not null) and (`ended_at` is null) and (`departure_odometer_km` is not null) and (`arrival_odometer_km` is null)) or ((`status` = _utf8mb4'COMPLETED') and (`driver_id` is not null) and (`vehicle_id` is not null) and (`started_at` is not null) and (`ended_at` is not null) and (`departure_odometer_km` is not null) and (`arrival_odometer_km` is not null)) or ((`status` = _utf8mb4'CANCELLED') and (`cancelled_at` is not null) and (`started_at` is null) and (`ended_at` is null) and (`departure_odometer_km` is null) and (`arrival_odometer_km` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `revisiones_direccion` (
  `id_revision_direccion` int unsigned NOT NULL AUTO_INCREMENT,
  `service_id` int unsigned NOT NULL,
  `revision` int NOT NULL,
  `address` varchar(350) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` int unsigned DEFAULT NULL,
  `source` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `created_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_revision_direccion`),
  UNIQUE KEY `service_id_revision` (`service_id`,`revision`),
  KEY `service_id` (`service_id`),
  KEY `actor_user_id` (`actor_user_id`),
  CONSTRAINT `revisiones_direccion_ibfk_1` FOREIGN KEY (`actor_user_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `revisiones_direccion_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `viajes` (`id_viaje`) ON DELETE RESTRICT ON UPDATE RESTRICT
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
  CONSTRAINT `registros_auditoria_ibfk_1` FOREIGN KEY (`actor_user_id`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

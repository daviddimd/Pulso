CREATE TABLE establecimientos (
  id_establecimiento INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'America/Santiago',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_establecimiento),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
  id_rol INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre_rol VARCHAR(100) NOT NULL,
  descripcion VARCHAR(250) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE funcionarios (
  id_funcionario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  establishment_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  unidad VARCHAR(150) NULL,
  UNIQUE (establishment_id, id_funcionario),
  FOREIGN KEY (establishment_id) REFERENCES establecimientos(id_establecimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tipos_vehiculo (
  id_tipo_vehiculo INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE marcas_vehiculo (
  id_marca_vehiculo INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modelos_vehiculo (
  id_modelo_vehiculo INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_marca_vehiculo INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  UNIQUE (id_marca_vehiculo, nombre),
  FOREIGN KEY (id_marca_vehiculo) REFERENCES marcas_vehiculo(id_marca_vehiculo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usuarios (
  id_usuario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `establishment_id` INT UNSIGNED NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roster_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  id_rol INT UNSIGNED NOT NULL,
  id_funcionario INT UNSIGNED NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `failed_login_attempts` int NOT NULL DEFAULT '0',
  `locked_until` datetime(3) DEFAULT NULL,
  `rut` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clave_unica_sub` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_provider` enum('local','clave_unica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `rut` (`rut`),
  UNIQUE KEY `clave_unica_sub` (`clave_unica_sub`),
  UNIQUE KEY `establishment_id_roster_code` (`establishment_id`,`roster_code`),
  KEY `establishment_id` (`establishment_id`),
  UNIQUE (id_funcionario),
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol),
  FOREIGN KEY (establishment_id, id_funcionario) REFERENCES funcionarios(establishment_id, id_funcionario),
  FOREIGN KEY (`establishment_id`) REFERENCES establecimientos(id_establecimiento) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vehiculos (
  id_vehiculo INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `establishment_id` INT UNSIGNED NOT NULL,
  `codigo_movil` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_plate` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_odometer_km` int unsigned DEFAULT NULL,
  id_tipo_vehiculo INT UNSIGNED NULL,
  `year` smallint unsigned DEFAULT NULL,
  id_modelo_vehiculo INT UNSIGNED NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_vehiculo),
  UNIQUE KEY `license_plate` (`license_plate`),
  UNIQUE KEY `vehicle_tenant_role` (`establishment_id`,`codigo_movil`),
  KEY `establishment_id` (`establishment_id`),
  FOREIGN KEY (id_tipo_vehiculo) REFERENCES tipos_vehiculo(id_tipo_vehiculo),
  FOREIGN KEY (id_modelo_vehiculo) REFERENCES modelos_vehiculo(id_modelo_vehiculo),
  FOREIGN KEY (`establishment_id`) REFERENCES establecimientos(id_establecimiento) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CHECK (((`current_odometer_km` >= 0) or (`current_odometer_km` is null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE centros_costos (
  id_centro_costo INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `establishment_id` INT UNSIGNED NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_centro_costo),
  UNIQUE KEY `establishment_id_code` (`establishment_id`,`code`),
  KEY `establishment_id` (`establishment_id`),
  FOREIGN KEY (`establishment_id`) REFERENCES establecimientos(id_establecimiento) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE viajes (
  id_viaje INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `establishment_id` INT UNSIGNED NOT NULL,
  `cost_center_id` INT UNSIGNED DEFAULT NULL,
  `driver_id` INT UNSIGNED DEFAULT NULL,
  `vehicle_id` INT UNSIGNED DEFAULT NULL,
  `created_by_user_id` INT UNSIGNED DEFAULT NULL,
  `origin` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `version` int unsigned NOT NULL DEFAULT '0',
  `cancelled_at` datetime(3) DEFAULT NULL,
  `status` enum('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `started_at` datetime(3) DEFAULT NULL,
  `ended_at` datetime(3) DEFAULT NULL,
  `destino` varchar(350) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actividad` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  departure_odometer_km INT UNSIGNED NULL,
  arrival_odometer_km INT UNSIGNED NULL,
  id_viaje_anterior INT UNSIGNED NULL,
  active_driver_id INT UNSIGNED GENERATED ALWAYS AS (IF(status = 'IN_PROGRESS', driver_id, NULL)) STORED,
  active_vehicle_id INT UNSIGNED GENERATED ALWAYS AS (IF(status = 'IN_PROGRESS', vehicle_id, NULL)) STORED,
  `void_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_viaje),
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
  FOREIGN KEY (`cost_center_id`) REFERENCES centros_costos(id_centro_costo) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (`created_by_user_id`) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (`driver_id`) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (`establishment_id`) REFERENCES establecimientos(id_establecimiento) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (`vehicle_id`) REFERENCES vehiculos(id_vehiculo) ON DELETE RESTRICT ON UPDATE RESTRICT,
  UNIQUE (active_driver_id),
  UNIQUE (active_vehicle_id),
  UNIQUE (id_viaje_anterior),
  FOREIGN KEY (id_viaje_anterior) REFERENCES viajes(id_viaje),
  CHECK (arrival_odometer_km IS NULL OR departure_odometer_km IS NULL OR arrival_odometer_km >= departure_odometer_km),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
  CHECK (origin = 'LEGACY' OR (
    (status = 'PENDING' AND driver_id IS NULL AND started_at IS NULL AND ended_at IS NULL AND departure_odometer_km IS NULL AND arrival_odometer_km IS NULL) OR
    (status = 'ASSIGNED' AND driver_id IS NOT NULL AND started_at IS NULL AND ended_at IS NULL AND departure_odometer_km IS NULL AND arrival_odometer_km IS NULL) OR
    (status = 'IN_PROGRESS' AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND started_at IS NOT NULL AND ended_at IS NULL AND departure_odometer_km IS NOT NULL AND arrival_odometer_km IS NULL) OR
    (status = 'COMPLETED' AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND started_at IS NOT NULL AND ended_at IS NOT NULL AND departure_odometer_km IS NOT NULL AND arrival_odometer_km IS NOT NULL) OR
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND started_at IS NULL AND ended_at IS NULL AND departure_odometer_km IS NULL AND arrival_odometer_km IS NULL)
  ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE revisiones_direccion (
  id_revision_direccion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_id` INT UNSIGNED NOT NULL,
  `revision` int NOT NULL,
  `address` varchar(350) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` INT UNSIGNED DEFAULT NULL,
  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `created_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_revision_direccion),
  UNIQUE KEY `service_id_revision` (`service_id`,`revision`),
  KEY `service_id` (`service_id`),
  KEY `actor_user_id` (`actor_user_id`),
  FOREIGN KEY (`actor_user_id`) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (`service_id`) REFERENCES viajes(id_viaje) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sesiones (
  id_sesion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `last_seen_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_sesion),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `user_id_expires_at` (`user_id`,`expires_at`),
  FOREIGN KEY (`user_id`) REFERENCES usuarios(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE registros_auditoria (
  id_registro_auditoria BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_user_id` INT UNSIGNED DEFAULT NULL,
  `entity_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (id_registro_auditoria),
  KEY `entity_type_entity_id_created_at` (`entity_type`,`entity_id`,`created_at`),
  KEY `actor_user_id_created_at` (`actor_user_id`,`created_at`),
  FOREIGN KEY (`actor_user_id`) REFERENCES usuarios(id_usuario) ON DELETE SET NULL ON UPDATE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

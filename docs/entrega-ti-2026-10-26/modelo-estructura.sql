-- Pulso: solo estructura de referencia. Instalar con migraciones CodeIgniter.

CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `entity_type_entity_id_created_at` (`entity_type`,`entity_id`,`created_at`),
  KEY `actor_user_id_created_at` (`actor_user_id`,`created_at`),
  CONSTRAINT `audit_logs_actor_user_id_foreign` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bitacora_entries` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `establishment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cost_center_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origin` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `version` int unsigned NOT NULL DEFAULT '0',
  `cancelled_at` datetime(3) DEFAULT NULL,
  `status` enum('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `started_at` datetime(3) DEFAULT NULL,
  `ended_at` datetime(3) DEFAULT NULL,
  `service_address` varchar(350) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_performed` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `odometer_km` int unsigned DEFAULT NULL,
  `void_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
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
  CONSTRAINT `bitacora_entries_cost_center_id_foreign` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `bitacora_entries_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `bitacora_entries_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `bitacora_entries_establishment_id_foreign` FOREIGN KEY (`establishment_id`) REFERENCES `establishments` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `bitacora_entries_vehicle_id_foreign` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `bitacora_odometer_nonnegative` CHECK (((`odometer_km` >= 0) or (`odometer_km` is null))),
  CONSTRAINT `service_operational_state` CHECK (((`origin` = _utf8mb4'LEGACY') or ((`status` = _utf8mb4'PENDING') and (`driver_id` is null) and (`started_at` is null)) or ((`status` = _utf8mb4'ASSIGNED') and (`driver_id` is not null) and (`started_at` is null)) or ((`status` = _utf8mb4'IN_PROGRESS') and (`driver_id` is not null) and (`vehicle_id` is not null) and (`started_at` is not null) and (`ended_at` is null)) or ((`status` = _utf8mb4'COMPLETED') and (`driver_id` is not null) and (`vehicle_id` is not null) and (`started_at` is not null) and (`ended_at` is not null)) or ((`status` = _utf8mb4'CANCELLED') and (`cancelled_at` is not null) and (`started_at` is null) and (`odometer_km` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cost_centers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `establishment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `establishment_id_code` (`establishment_id`,`code`),
  KEY `establishment_id` (`establishment_id`),
  CONSTRAINT `cost_centers_establishment_id_foreign` FOREIGN KEY (`establishment_id`) REFERENCES `establishments` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `establishments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'America/Santiago',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_address_revisions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `revision` int NOT NULL,
  `address` varchar(350) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `created_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `service_id_revision` (`service_id`,`revision`),
  KEY `service_id` (`service_id`),
  KEY `actor_user_id` (`actor_user_id`),
  CONSTRAINT `service_address_revisions_actor_user_id_foreign` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `service_address_revisions_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `bitacora_entries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_legs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `driver_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vehicle_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime(3) NOT NULL,
  `ended_at` datetime(3) DEFAULT NULL,
  `departure_odometer_km` int unsigned DEFAULT NULL,
  `arrival_odometer_km` int unsigned DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `active_driver_id` char(36) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`ended_at` is null),`driver_id`,NULL)) STORED,
  `active_vehicle_id` char(36) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`ended_at` is null),`vehicle_id`,NULL)) STORED,
  `active_service_id` char(36) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`ended_at` is null),`service_id`,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_active_driver` (`active_driver_id`),
  UNIQUE KEY `idx_active_vehicle` (`active_vehicle_id`),
  UNIQUE KEY `idx_active_service` (`active_service_id`),
  KEY `service_id` (`service_id`),
  KEY `driver_id` (`driver_id`),
  KEY `vehicle_id` (`vehicle_id`),
  KEY `service_id_started_at` (`service_id`,`started_at`),
  CONSTRAINT `service_legs_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `service_legs_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `bitacora_entries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `service_legs_vehicle_id_foreign` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `service_leg_dates` CHECK (((`ended_at` is null) or (`ended_at` >= `started_at`))),
  CONSTRAINT `service_leg_km` CHECK (((`departure_odometer_km` is null) or (`arrival_odometer_km` is null) or ((`departure_odometer_km` >= 0) and (`arrival_odometer_km` >= 0) and (`arrival_odometer_km` >= `departure_odometer_km`))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `revoked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `last_seen_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `user_id_expires_at` (`user_id`,`expires_at`),
  CONSTRAINT `sessions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `establishment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roster_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('DRIVER','ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `failed_login_attempts` int NOT NULL DEFAULT '0',
  `locked_until` datetime(3) DEFAULT NULL,
  `rut` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clave_unica_sub` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_provider` enum('local','clave_unica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `rut` (`rut`),
  UNIQUE KEY `clave_unica_sub` (`clave_unica_sub`),
  UNIQUE KEY `establishment_id_roster_code` (`establishment_id`,`roster_code`),
  KEY `establishment_id` (`establishment_id`),
  CONSTRAINT `users_establishment_id_foreign` FOREIGN KEY (`establishment_id`) REFERENCES `establishments` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vehicles` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `establishment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_plate` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_odometer_km` int unsigned DEFAULT NULL,
  `vehicle_type` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `year` smallint unsigned DEFAULT NULL,
  `model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `license_plate` (`license_plate`),
  UNIQUE KEY `vehicle_tenant_role` (`establishment_id`,`role_code`),
  KEY `establishment_id` (`establishment_id`),
  CONSTRAINT `vehicles_establishment_id_foreign` FOREIGN KEY (`establishment_id`) REFERENCES `establishments` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `vehicle_odometer_nonnegative` CHECK (((`current_odometer_km` >= 0) or (`current_odometer_km` is null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
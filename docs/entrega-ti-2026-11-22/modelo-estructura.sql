-- Pulso: solo estructura de referencia. Instalar con migraciones CodeIgniter.

CREATE TABLE `establecimientos` (
  `id_establecimiento` int unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `zona_horaria` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'America/Santiago',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `fecha_creacion` datetime(3) DEFAULT NULL,
  `fecha_actualizacion` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_establecimiento`),
  UNIQUE KEY `uq_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id_rol` int unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_rol` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `uq_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `funcionarios` (
  `id_funcionario` int unsigned NOT NULL AUTO_INCREMENT,
  `id_establecimiento` int unsigned NOT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unidad` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `codigo_roster` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id_funcionario`),
  UNIQUE KEY `uq_id_establecimiento_id_funcionario` (`id_establecimiento`,`id_funcionario`),
  UNIQUE KEY `uq_id_establecimiento_codigo_roster` (`id_establecimiento`,`codigo_roster`),
  CONSTRAINT `funcionarios_ibfk_1` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tipos_vehiculo` (
  `id_tipo_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_establecimiento` int unsigned NOT NULL,
  PRIMARY KEY (`id_tipo_vehiculo`),
  UNIQUE KEY `uq_id_establecimiento_id_tipo_vehiculo` (`id_establecimiento`,`id_tipo_vehiculo`),
  UNIQUE KEY `uq_id_establecimiento_nombre` (`id_establecimiento`,`nombre`),
  CONSTRAINT `tipos_vehiculo_ibfk_1` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `marcas_vehiculo` (
  `id_marca_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_establecimiento` int unsigned NOT NULL,
  PRIMARY KEY (`id_marca_vehiculo`),
  UNIQUE KEY `uq_id_establecimiento_id_marca_vehiculo` (`id_establecimiento`,`id_marca_vehiculo`),
  UNIQUE KEY `uq_id_establecimiento_nombre` (`id_establecimiento`,`nombre`),
  CONSTRAINT `marcas_vehiculo_ibfk_1` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `modelos_vehiculo` (
  `id_modelo_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `id_marca_vehiculo` int unsigned NOT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_establecimiento` int unsigned NOT NULL,
  PRIMARY KEY (`id_modelo_vehiculo`),
  UNIQUE KEY `uq_id_establecimiento_id_modelo_vehiculo` (`id_establecimiento`,`id_modelo_vehiculo`),
  UNIQUE KEY `uq_id_establecimiento_id_marca_vehiculo_nombre` (`id_establecimiento`,`id_marca_vehiculo`,`nombre`),
  CONSTRAINT `modelos_vehiculo_ibfk_1` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`),
  CONSTRAINT `modelos_vehiculo_ibfk_2` FOREIGN KEY (`id_establecimiento`, `id_marca_vehiculo`) REFERENCES `marcas_vehiculo` (`id_establecimiento`, `id_marca_vehiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id_usuario` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre_usuario` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_completo` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hash_contrasena` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_rol` int unsigned NOT NULL,
  `id_funcionario` int unsigned NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `intentos_fallidos` int NOT NULL DEFAULT '0',
  `bloqueado_hasta` datetime(3) DEFAULT NULL,
  `rut` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_clave_unica` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proveedor_autenticacion` enum('local','clave_unica') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `fecha_creacion` datetime(3) DEFAULT NULL,
  `fecha_actualizacion` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uq_nombre_usuario` (`nombre_usuario`),
  UNIQUE KEY `uq_id_funcionario` (`id_funcionario`),
  UNIQUE KEY `uq_rut` (`rut`),
  UNIQUE KEY `uq_sub_clave_unica` (`sub_clave_unica`),
  KEY `ix_id_rol` (`id_rol`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`),
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionarios` (`id_funcionario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vehiculos` (
  `id_vehiculo` int unsigned NOT NULL AUTO_INCREMENT,
  `id_establecimiento` int unsigned NOT NULL,
  `codigo_movil` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `patente` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `odometro_actual` int unsigned DEFAULT NULL,
  `id_tipo_vehiculo` int unsigned DEFAULT NULL,
  `anio` smallint unsigned DEFAULT NULL,
  `id_modelo_vehiculo` int unsigned DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `fecha_creacion` datetime(3) DEFAULT NULL,
  `fecha_actualizacion` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_vehiculo`),
  UNIQUE KEY `uq_patente` (`patente`),
  UNIQUE KEY `uq_id_establecimiento_codigo_movil` (`id_establecimiento`,`codigo_movil`),
  KEY `ix_id_establecimiento` (`id_establecimiento`),
  KEY `ix_id_tipo_vehiculo` (`id_tipo_vehiculo`),
  KEY `ix_id_modelo_vehiculo` (`id_modelo_vehiculo`),
  KEY `ix_id_establecimiento_id_tipo_vehiculo` (`id_establecimiento`,`id_tipo_vehiculo`),
  KEY `ix_id_establecimiento_id_modelo_vehiculo` (`id_establecimiento`,`id_modelo_vehiculo`),
  CONSTRAINT `vehiculos_ibfk_3` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `vehiculos_ibfk_4` FOREIGN KEY (`id_establecimiento`, `id_tipo_vehiculo`) REFERENCES `tipos_vehiculo` (`id_establecimiento`, `id_tipo_vehiculo`),
  CONSTRAINT `vehiculos_ibfk_5` FOREIGN KEY (`id_establecimiento`, `id_modelo_vehiculo`) REFERENCES `modelos_vehiculo` (`id_establecimiento`, `id_modelo_vehiculo`),
  CONSTRAINT `vehiculos_chk_1` CHECK (((`odometro_actual` >= 0) or (`odometro_actual` is null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `centros_costos` (
  `id_centro_costo` int unsigned NOT NULL AUTO_INCREMENT,
  `id_establecimiento` int unsigned NOT NULL,
  `codigo` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `fecha_creacion` datetime(3) DEFAULT NULL,
  `fecha_actualizacion` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_centro_costo`),
  UNIQUE KEY `uq_id_establecimiento_codigo` (`id_establecimiento`,`codigo`),
  KEY `ix_id_establecimiento` (`id_establecimiento`),
  CONSTRAINT `centros_costos_ibfk_1` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `viajes` (
  `id_viaje` int unsigned NOT NULL AUTO_INCREMENT,
  `id_establecimiento` int unsigned NOT NULL,
  `id_centro_costo` int unsigned DEFAULT NULL,
  `id_chofer` int unsigned DEFAULT NULL,
  `id_vehiculo` int unsigned DEFAULT NULL,
  `id_usuario_creador` int unsigned DEFAULT NULL,
  `origen` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `version` int unsigned NOT NULL DEFAULT '0',
  `fecha_cancelacion` datetime(3) DEFAULT NULL,
  `estado` enum('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `fecha_inicio` datetime(3) DEFAULT NULL,
  `fecha_fin` datetime(3) DEFAULT NULL,
  `destino` varchar(350) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `actividad` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `odometro_salida` int unsigned DEFAULT NULL,
  `odometro_llegada` int unsigned DEFAULT NULL,
  `motivo_cancelacion` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_creacion` datetime(3) DEFAULT NULL,
  `fecha_actualizacion` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_viaje`),
  UNIQUE KEY `uq_id_establecimiento_id_viaje` (`id_establecimiento`,`id_viaje`),
  KEY `ix_id_establecimiento` (`id_establecimiento`),
  KEY `ix_id_centro_costo` (`id_centro_costo`),
  KEY `ix_id_chofer` (`id_chofer`),
  KEY `ix_id_vehiculo` (`id_vehiculo`),
  KEY `ix_id_usuario_creador` (`id_usuario_creador`),
  KEY `ix_id_chofer_fecha_inicio` (`id_chofer`,`fecha_inicio`),
  KEY `ix_id_centro_costo_estado_fecha_fin` (`id_centro_costo`,`estado`,`fecha_fin`),
  KEY `ix_id_vehiculo_fecha_inicio` (`id_vehiculo`,`fecha_inicio`),
  KEY `ix_estado_fecha_inicio` (`estado`,`fecha_inicio`),
  KEY `ix_estado_fecha_fin` (`estado`,`fecha_fin`),
  KEY `ix_id_establecimiento_estado` (`id_establecimiento`,`estado`),
  CONSTRAINT `viajes_ibfk_1` FOREIGN KEY (`id_centro_costo`) REFERENCES `centros_costos` (`id_centro_costo`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_2` FOREIGN KEY (`id_usuario_creador`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_3` FOREIGN KEY (`id_chofer`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_4` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_ibfk_5` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `viajes_chk_1` CHECK (((`fecha_fin` is null) or (`fecha_inicio` is null) or (`fecha_fin` >= `fecha_inicio`))),
  CONSTRAINT `viajes_chk_2` CHECK (((`origen` = _utf8mb4'LEGACY') or ((`estado` = _utf8mb4'PENDING') and (`id_chofer` is null) and (`fecha_inicio` is null) and (`fecha_fin` is null)) or ((`estado` = _utf8mb4'ASSIGNED') and (`id_chofer` is not null) and (`fecha_inicio` is null) and (`fecha_fin` is null)) or ((`estado` = _utf8mb4'IN_PROGRESS') and (`id_chofer` is not null) and (`id_vehiculo` is not null) and (`fecha_inicio` is not null) and (`fecha_fin` is null)) or ((`estado` = _utf8mb4'COMPLETED') and (`id_chofer` is not null) and (`id_vehiculo` is not null) and (`fecha_inicio` is not null) and (`fecha_fin` is not null)) or ((`estado` = _utf8mb4'CANCELLED') and (`fecha_inicio` is null) and (`fecha_cancelacion` is not null) and (`odometro_salida` is null) and (`odometro_llegada` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `viajes_tramos` (
  `id_viaje_tramo` int unsigned NOT NULL AUTO_INCREMENT,
  `id_establecimiento` int unsigned NOT NULL,
  `id_viaje` int unsigned NOT NULL,
  `id_chofer` int unsigned NOT NULL,
  `id_vehiculo` int unsigned NOT NULL,
  `fecha_inicio` datetime(3) NOT NULL,
  `fecha_fin` datetime(3) DEFAULT NULL,
  `odometro_inicio` int unsigned DEFAULT NULL,
  `odometro_fin` int unsigned DEFAULT NULL,
  `id_chofer_activo` int unsigned GENERATED ALWAYS AS (if((`fecha_fin` is null),`id_chofer`,NULL)) STORED,
  `id_vehiculo_activo` int unsigned GENERATED ALWAYS AS (if((`fecha_fin` is null),`id_vehiculo`,NULL)) STORED,
  `id_viaje_activo` int unsigned GENERATED ALWAYS AS (if((`fecha_fin` is null),`id_viaje`,NULL)) STORED,
  PRIMARY KEY (`id_viaje_tramo`),
  UNIQUE KEY `uq_id_chofer_activo` (`id_chofer_activo`),
  UNIQUE KEY `uq_id_vehiculo_activo` (`id_vehiculo_activo`),
  UNIQUE KEY `uq_id_viaje_activo` (`id_viaje_activo`),
  KEY `ix_id_establecimiento_id_viaje` (`id_establecimiento`,`id_viaje`),
  KEY `ix_id_chofer` (`id_chofer`),
  KEY `ix_id_vehiculo` (`id_vehiculo`),
  CONSTRAINT `viajes_tramos_ibfk_1` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`),
  CONSTRAINT `viajes_tramos_ibfk_2` FOREIGN KEY (`id_chofer`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `viajes_tramos_ibfk_3` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`),
  CONSTRAINT `viajes_tramos_ibfk_4` FOREIGN KEY (`id_establecimiento`, `id_viaje`) REFERENCES `viajes` (`id_establecimiento`, `id_viaje`),
  CONSTRAINT `viajes_tramos_chk_1` CHECK (((`fecha_fin` is null) or (`fecha_fin` >= `fecha_inicio`))),
  CONSTRAINT `viajes_tramos_chk_2` CHECK (((`odometro_fin` is null) or (`odometro_inicio` is null) or (`odometro_fin` >= `odometro_inicio`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `revisiones_direccion` (
  `id_revision_direccion` int unsigned NOT NULL AUTO_INCREMENT,
  `id_viaje` int unsigned NOT NULL,
  `revision` int NOT NULL,
  `direccion` varchar(350) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_usuario_actor` int unsigned DEFAULT NULL,
  `origen` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `fecha_creacion` datetime(3) DEFAULT NULL,
  `id_establecimiento` int unsigned NOT NULL,
  PRIMARY KEY (`id_revision_direccion`),
  UNIQUE KEY `uq_id_viaje_revision` (`id_viaje`,`revision`),
  KEY `ix_id_viaje` (`id_viaje`),
  KEY `ix_id_usuario_actor` (`id_usuario_actor`),
  KEY `ix_id_establecimiento_id_viaje` (`id_establecimiento`,`id_viaje`),
  CONSTRAINT `revisiones_direccion_ibfk_1` FOREIGN KEY (`id_usuario_actor`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `revisiones_direccion_ibfk_2` FOREIGN KEY (`id_viaje`) REFERENCES `viajes` (`id_viaje`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `revisiones_direccion_ibfk_3` FOREIGN KEY (`id_establecimiento`, `id_viaje`) REFERENCES `viajes` (`id_establecimiento`, `id_viaje`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sesiones` (
  `id_sesion` int unsigned NOT NULL AUTO_INCREMENT,
  `id_usuario` int unsigned NOT NULL,
  `hash_token` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_expiracion` datetime(3) NOT NULL,
  `fecha_revocacion` datetime(3) DEFAULT NULL,
  `fecha_creacion` datetime(3) DEFAULT NULL,
  `fecha_ultimo_uso` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_sesion`),
  UNIQUE KEY `uq_hash_token` (`hash_token`),
  KEY `ix_id_usuario_fecha_expiracion` (`id_usuario`,`fecha_expiracion`),
  CONSTRAINT `sesiones_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `registros_auditoria` (
  `id_registro_auditoria` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_establecimiento` int unsigned NOT NULL,
  `id_usuario_actor` int unsigned DEFAULT NULL,
  `tipo_entidad` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_entidad` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `accion` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `datos_anteriores` json DEFAULT NULL,
  `datos_nuevos` json DEFAULT NULL,
  `direccion_ip` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_creacion` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id_registro_auditoria`),
  KEY `ix_tipo_entidad_id_entidad_fecha_creacion` (`tipo_entidad`,`id_entidad`,`fecha_creacion`),
  KEY `ix_id_usuario_actor_fecha_creacion` (`id_usuario_actor`,`fecha_creacion`),
  KEY `ix_id_establecimiento_tipo_entidad_id_entidad` (`id_establecimiento`,`tipo_entidad`,`id_entidad`),
  CONSTRAINT `fk_auditoria_establecimiento` FOREIGN KEY (`id_establecimiento`) REFERENCES `establecimientos` (`id_establecimiento`),
  CONSTRAINT `registros_auditoria_ibfk_1` FOREIGN KEY (`id_usuario_actor`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `folios_viajes_anteriores` (
  `id_folio_anterior` int unsigned NOT NULL AUTO_INCREMENT,
  `id_establecimiento` int unsigned NOT NULL,
  `id_viaje` int unsigned NOT NULL,
  PRIMARY KEY (`id_folio_anterior`),
  KEY `ix_id_establecimiento_id_viaje` (`id_establecimiento`,`id_viaje`),
  CONSTRAINT `folios_viajes_anteriores_ibfk_1` FOREIGN KEY (`id_establecimiento`, `id_viaje`) REFERENCES `viajes` (`id_establecimiento`, `id_viaje`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

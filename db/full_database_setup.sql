-- ==============================================================================
-- L&F HOME DECOR - INSTALACIÓN COMPLETA (SCHEMA + VISTAS + SP + SEED)
-- Compatible con MariaDB 10.7+ y MySQL 8.0+
-- Importable directamente en phpMyAdmin o CLI:
-- mysql -u root -p lf_home_decor < db/full_database_setup.sql
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = "+00:00";

-- ------------------------------------------------------------------------------
-- 1. TABLAS PRINCIPALES (27 TABLAS)
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `auditoria`;
DROP TABLE IF EXISTS `pagos_venta`;
DROP TABLE IF EXISTS `detalle_ventas`;
DROP TABLE IF EXISTS `ventas`;
DROP TABLE IF EXISTS `canales_venta`;
DROP TABLE IF EXISTS `formas_pago`;
DROP TABLE IF EXISTS `clientes`;
DROP TABLE IF EXISTS `movimientos_inventario`;
DROP TABLE IF EXISTS `stock_producto`;
DROP TABLE IF EXISTS `bodegas`;
DROP TABLE IF EXISTS `variantes_producto`;
DROP TABLE IF EXISTS `secuencia_codigo_interno`;
DROP TABLE IF EXISTS `productos`;
DROP TABLE IF EXISTS `unidades_medida`;
DROP TABLE IF EXISTS `disenos`;
DROP TABLE IF EXISTS `colores`;
DROP TABLE IF EXISTS `tamanos`;
DROP TABLE IF EXISTS `materiales`;
DROP TABLE IF EXISTS `tipos_producto`;
DROP TABLE IF EXISTS `marcas`;
DROP TABLE IF EXISTS `categorias`;
DROP TABLE IF EXISTS `parametros_sistema`;
DROP TABLE IF EXISTS `auth_rate_limits`;
DROP TABLE IF EXISTS `sesiones_usuario`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `perfil_permisos`;
DROP TABLE IF EXISTS `permisos`;
DROP TABLE IF EXISTS `perfiles`;
DROP TABLE IF EXISTS `locales`;

CREATE TABLE `perfiles` (
  `id_perfil` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permisos` (
  `id_permiso` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(100) NOT NULL UNIQUE,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `perfil_permisos` (
  `id_perfil` INT NOT NULL,
  `id_permiso` INT NOT NULL,
  PRIMARY KEY (`id_perfil`, `id_permiso`),
  CONSTRAINT `fk_pp_perfil` FOREIGN KEY (`id_perfil`) REFERENCES `perfiles` (`id_perfil`) ON DELETE CASCADE,
  CONSTRAINT `fk_pp_permiso` FOREIGN KEY (`id_permiso`) REFERENCES `permisos` (`id_permiso`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `locales` (
  `id_local` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(150) NOT NULL,
  `codigo` VARCHAR(50) NULL UNIQUE,
  `direccion` VARCHAR(255) NULL,
  `telefono` VARCHAR(50) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id_usuario` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `cedula` VARCHAR(10) NOT NULL UNIQUE,
  `nombres` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(100) NOT NULL,
  `correo` VARCHAR(150) NOT NULL UNIQUE,
  `telefono` VARCHAR(50) NULL,
  `id_perfil` INT NOT NULL,
  `id_local` INT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `debe_cambiar_password` TINYINT(1) NOT NULL DEFAULT 1,
  `intentos_fallidos` INT NOT NULL DEFAULT 0,
  `bloqueado` TINYINT(1) NOT NULL DEFAULT 0,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `ultimo_acceso` DATETIME NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_usuarios_perfil` FOREIGN KEY (`id_perfil`) REFERENCES `perfiles` (`id_perfil`),
  CONSTRAINT `fk_usuarios_local` FOREIGN KEY (`id_local`) REFERENCES `locales` (`id_local`) ON DELETE SET NULL,
  INDEX `idx_usuarios_cedula` (`cedula`),
  INDEX `idx_usuarios_correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sesiones_usuario` (
  `id_sesion` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario` BIGINT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL UNIQUE,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_expiracion` DATETIME NOT NULL,
  `ip` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `revocada` TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT `fk_sesion_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE,
  INDEX `idx_sesion_usuario` (`id_usuario`),
  INDEX `idx_sesion_expiracion` (`fecha_expiracion`),
  INDEX `idx_sesion_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `auth_rate_limits` (
  `clave_hash` VARCHAR(64) PRIMARY KEY,
  `intentos` INT NOT NULL DEFAULT 0,
  `ventana_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bloqueado_hasta` DATETIME NULL,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `parametros_sistema` (
  `id_parametro` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(100) NOT NULL UNIQUE,
  `valor` TEXT NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `tipo_dato` VARCHAR(50) NOT NULL DEFAULT 'STRING',
  `editable` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `categorias` (
  `id_categoria` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(20) NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(500) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `marcas` (
  `id_marca` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(500) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tipos_producto` (
  `id_tipo` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(500) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `materiales` (
  `id_material` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(500) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tamanos` (
  `id_tamano` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(500) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `colores` (
  `id_color` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `codigo_hex` VARCHAR(10) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `disenos` (
  `id_diseno` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(500) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `unidades_medida` (
  `id_unidad` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(20) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `productos` (
  `id_producto` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_categoria` INT NOT NULL,
  `id_tipo` INT NOT NULL,
  `id_marca` INT NOT NULL,
  `descripcion` VARCHAR(250) NOT NULL,
  `detalle` TEXT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_por` BIGINT NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_prod_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`),
  CONSTRAINT `fk_prod_tipo` FOREIGN KEY (`id_tipo`) REFERENCES `tipos_producto` (`id_tipo`),
  CONSTRAINT `fk_prod_marca` FOREIGN KEY (`id_marca`) REFERENCES `marcas` (`id_marca`),
  CONSTRAINT `fk_prod_creador` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL,
  INDEX `idx_productos_desc` (`descripcion`),
  INDEX `idx_productos_cat` (`id_categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `secuencia_codigo_interno` (
  `id` INT AUTO_INCREMENT PRIMARY KEY
) ENGINE=InnoDB;

CREATE TABLE `variantes_producto` (
  `id_variante` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_producto` BIGINT NOT NULL,
  `codigo_interno` VARCHAR(40) NOT NULL UNIQUE,
  `codigo_gs1` VARCHAR(50) NULL,
  `id_material` INT NOT NULL,
  `id_tamano` INT NOT NULL,
  `id_color` INT NOT NULL,
  `id_diseno` INT NOT NULL,
  `id_unidad` INT NOT NULL,
  `precio_venta` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `porcentaje_iva` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  `stock_minimo` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `imagen_url` VARCHAR(500) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_var_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE CASCADE,
  CONSTRAINT `fk_var_material` FOREIGN KEY (`id_material`) REFERENCES `materiales` (`id_material`),
  CONSTRAINT `fk_var_tamano` FOREIGN KEY (`id_tamano`) REFERENCES `tamanos` (`id_tamano`),
  CONSTRAINT `fk_var_color` FOREIGN KEY (`id_color`) REFERENCES `colores` (`id_color`),
  CONSTRAINT `fk_var_diseno` FOREIGN KEY (`id_diseno`) REFERENCES `disenos` (`id_diseno`),
  CONSTRAINT `fk_var_unidad` FOREIGN KEY (`id_unidad`) REFERENCES `unidades_medida` (`id_unidad`),
  INDEX `idx_var_gs1` (`codigo_gs1`),
  INDEX `idx_var_interno` (`codigo_interno`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bodegas` (
  `id_bodega` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `id_local` INT NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bodega_local` FOREIGN KEY (`id_local`) REFERENCES `locales` (`id_local`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stock_producto` (
  `id_stock` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_variante` BIGINT NOT NULL,
  `id_bodega` INT NOT NULL,
  `cantidad` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_stock_variante_bodega` (`id_variante`, `id_bodega`),
  CONSTRAINT `fk_stock_variante` FOREIGN KEY (`id_variante`) REFERENCES `variantes_producto` (`id_variante`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_bodega` FOREIGN KEY (`id_bodega`) REFERENCES `bodegas` (`id_bodega`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `movimientos_inventario` (
  `id_movimiento` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_variante` BIGINT NOT NULL,
  `id_bodega` INT NOT NULL,
  `tipo` VARCHAR(50) NOT NULL,
  `cantidad` DECIMAL(12,2) NOT NULL,
  `stock_anterior` DECIMAL(12,2) NOT NULL,
  `stock_nuevo` DECIMAL(12,2) NOT NULL,
  `motivo` TEXT NULL,
  `referencia_tipo` VARCHAR(50) NULL,
  `referencia_id` BIGINT NULL,
  `usuario` BIGINT NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_mov_variante` FOREIGN KEY (`id_variante`) REFERENCES `variantes_producto` (`id_variante`),
  CONSTRAINT `fk_mov_bodega` FOREIGN KEY (`id_bodega`) REFERENCES `bodegas` (`id_bodega`),
  CONSTRAINT `fk_mov_usuario` FOREIGN KEY (`usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL,
  INDEX `idx_mov_fecha` (`fecha`),
  INDEX `idx_mov_ref` (`referencia_tipo`, `referencia_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clientes` (
  `id_cliente` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `identificacion` VARCHAR(20) NULL UNIQUE,
  `nombres` VARCHAR(100) NULL,
  `razon_social` VARCHAR(150) NULL,
  `correo` VARCHAR(150) NULL,
  `telefono` VARCHAR(50) NULL,
  `direccion` VARCHAR(255) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `canales_venta` (
  `id_canal` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `formas_pago` (
  `id_forma_pago` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `requiere_referencia` TINYINT(1) NOT NULL DEFAULT 0,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ventas` (
  `id_venta` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `numero_venta` VARCHAR(50) NOT NULL UNIQUE,
  `id_local` INT NOT NULL,
  `id_cliente` BIGINT NULL,
  `id_canal` INT NOT NULL,
  `id_usuario` BIGINT NOT NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `descuento` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `iva` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `observaciones` TEXT NULL,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'REGISTRADA',
  CONSTRAINT `fk_ventas_local` FOREIGN KEY (`id_local`) REFERENCES `locales` (`id_local`),
  CONSTRAINT `fk_ventas_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`) ON DELETE SET NULL,
  CONSTRAINT `fk_ventas_canal` FOREIGN KEY (`id_canal`) REFERENCES `canales_venta` (`id_canal`),
  CONSTRAINT `fk_ventas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  INDEX `idx_ventas_fecha` (`fecha`),
  INDEX `idx_ventas_numero` (`numero_venta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `detalle_ventas` (
  `id_detalle` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_venta` BIGINT NOT NULL,
  `id_variante` BIGINT NOT NULL,
  `cantidad` DECIMAL(12,2) NOT NULL,
  `precio_unitario` DECIMAL(12,2) NOT NULL,
  `descuento` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `porcentaje_iva` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `iva` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT `fk_det_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`) ON DELETE CASCADE,
  CONSTRAINT `fk_det_variante` FOREIGN KEY (`id_variante`) REFERENCES `variantes_producto` (`id_variante`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pagos_venta` (
  `id_pago` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_venta` BIGINT NOT NULL,
  `id_forma_pago` INT NOT NULL,
  `valor` DECIMAL(12,2) NOT NULL,
  `referencia` VARCHAR(150) NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pagos_venta` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`) ON DELETE CASCADE,
  CONSTRAINT `fk_pagos_forma` FOREIGN KEY (`id_forma_pago`) REFERENCES `formas_pago` (`id_forma_pago`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `auditoria` (
  `id_auditoria` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `usuario` BIGINT NULL,
  `tabla_afectada` VARCHAR(100) NOT NULL,
  `accion` VARCHAR(50) NOT NULL,
  `registro_id` BIGINT NULL,
  `valor_anterior` JSON NULL,
  `valor_nuevo` JSON NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_auditoria_tabla_registro` (`tabla_afectada`, `registro_id`),
  INDEX `idx_auditoria_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. VISTAS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW `vw_inventario_actual` AS
SELECT
  sp.id_stock,
  p.id_producto,
  vp.id_variante,
  b.id_bodega,
  p.descripcion AS producto,
  vp.codigo_gs1,
  b.nombre AS bodega,
  c.nombre AS categoria,
  m.nombre AS marca,
  t.nombre AS tamano,
  col.nombre AS color,
  sp.cantidad AS stock_actual,
  vp.stock_minimo,
  CASE
    WHEN sp.cantidad <= 0 THEN 'AGOTADO'
    WHEN sp.cantidad <= vp.stock_minimo THEN 'BAJO STOCK'
    ELSE 'DISPONIBLE'
  END AS estado_stock
FROM stock_producto sp
JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
JOIN bodegas b ON b.id_bodega = sp.id_bodega
LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
LEFT JOIN marcas m ON m.id_marca = p.id_marca
LEFT JOIN tamanos t ON t.id_tamano = vp.id_tamano
LEFT JOIN colores col ON col.id_color = vp.id_color
WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1;

CREATE OR REPLACE VIEW `vw_productos_bajo_stock` AS
SELECT * FROM `vw_inventario_actual`
WHERE `estado_stock` = 'BAJO STOCK';

CREATE OR REPLACE VIEW `vw_productos_agotados` AS
SELECT * FROM `vw_inventario_actual`
WHERE `estado_stock` = 'AGOTADO';

CREATE OR REPLACE VIEW `vw_dashboard_ventas` AS
SELECT
  COALESCE(SUM(CASE
    WHEN DATE(CONVERT_TZ(v.fecha, '+00:00', '-05:00')) = DATE(CONVERT_TZ(NOW(), @@session.time_zone, '-05:00'))
         AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
    THEN v.total ELSE 0 END), 0) AS ventas_hoy,
  COALESCE(SUM(CASE
    WHEN DATE_FORMAT(CONVERT_TZ(v.fecha, '+00:00', '-05:00'), '%Y-%m-01') = DATE_FORMAT(CONVERT_TZ(NOW(), @@session.time_zone, '-05:00'), '%Y-%m-01')
         AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
    THEN v.total ELSE 0 END), 0) AS ventas_mes,
  COALESCE(SUM(CASE
    WHEN DATE(CONVERT_TZ(v.fecha, '+00:00', '-05:00')) = DATE(CONVERT_TZ(NOW(), @@session.time_zone, '-05:00'))
         AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
    THEN 1 ELSE 0 END), 0) AS cantidad_ventas_hoy,
  COALESCE(SUM(CASE
    WHEN DATE_FORMAT(CONVERT_TZ(v.fecha, '+00:00', '-05:00'), '%Y-%m-01') = DATE_FORMAT(CONVERT_TZ(NOW(), @@session.time_zone, '-05:00'), '%Y-%m-01')
         AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
    THEN 1 ELSE 0 END), 0) AS cantidad_ventas_mes
FROM ventas v;

-- ------------------------------------------------------------------------------
-- 3. STORED PROCEDURES & TRIGGERS
-- ------------------------------------------------------------------------------

DELIMITER $$

DROP PROCEDURE IF EXISTS `sp_controlar_limite_login`$$
CREATE PROCEDURE `sp_controlar_limite_login`(
  IN `p_clave_hash` VARCHAR(64),
  IN `p_operacion` VARCHAR(20),
  OUT `p_permitido` TINYINT(1),
  OUT `p_reintentar_en` INT
)
BEGIN
  DECLARE v_intentos INT DEFAULT 0;
  DECLARE v_ventana_inicio DATETIME;
  DECLARE v_bloqueado_hasta DATETIME;
  DECLARE v_ahora DATETIME DEFAULT NOW();
  
  SET p_permitido = 1;
  SET p_reintentar_en = 0;

  IF p_operacion NOT IN ('CHECK', 'FAILURE', 'SUCCESS') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operación de control inválida.';
  END IF;

  IF p_operacion = 'SUCCESS' THEN
    DELETE FROM auth_rate_limits WHERE clave_hash = p_clave_hash;
  ELSE
    INSERT IGNORE INTO auth_rate_limits (clave_hash, intentos, ventana_inicio, actualizado_en)
    VALUES (p_clave_hash, 0, v_ahora, v_ahora);

    SELECT intentos, ventana_inicio, bloqueado_hasta
    INTO v_intentos, v_ventana_inicio, v_bloqueado_hasta
    FROM auth_rate_limits WHERE clave_hash = p_clave_hash FOR UPDATE;

    IF v_bloqueado_hasta IS NOT NULL AND v_bloqueado_hasta > v_ahora THEN
      SET p_permitido = 0;
      SET p_reintentar_en = TIMESTAMPDIFF(SECOND, v_ahora, v_bloqueado_hasta);
    ELSE
      IF v_ventana_inicio < DATE_SUB(v_ahora, INTERVAL 15 MINUTE) THEN
        SET v_intentos = 0;
        SET v_ventana_inicio = v_ahora;
        SET v_bloqueado_hasta = NULL;
        UPDATE auth_rate_limits
        SET intentos = 0, ventana_inicio = v_ahora, bloqueado_hasta = NULL, actualizado_en = v_ahora
        WHERE clave_hash = p_clave_hash;
      END IF;

      IF p_operacion = 'FAILURE' THEN
        SET v_intentos = v_intentos + 1;
        IF v_intentos >= 10 THEN
          SET v_bloqueado_hasta = DATE_ADD(v_ahora, INTERVAL 15 MINUTE);
          SET p_permitido = 0;
          SET p_reintentar_en = 900;
        END IF;
        UPDATE auth_rate_limits
        SET intentos = v_intentos, bloqueado_hasta = v_bloqueado_hasta, actualizado_en = v_ahora
        WHERE clave_hash = p_clave_hash;
      END IF;
    END IF;
  END IF;
END$$

DROP PROCEDURE IF EXISTS `sp_registrar_movimiento_inventario`$$
CREATE PROCEDURE `sp_registrar_movimiento_inventario`(
  IN `p_variante` BIGINT,
  IN `p_bodega` INT,
  IN `p_tipo` VARCHAR(50),
  IN `p_cantidad` DECIMAL(12,2),
  IN `p_usuario` BIGINT,
  IN `p_motivo` TEXT,
  IN `p_referencia_tipo` VARCHAR(50),
  IN `p_referencia_id` BIGINT,
  OUT `p_movimiento_id` BIGINT
)
BEGIN
  DECLARE v_tipo VARCHAR(50);
  DECLARE v_stock_id BIGINT;
  DECLARE v_stock_anterior DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_stock_nuevo DECIMAL(12,2);
  DECLARE v_factor INT;
  DECLARE v_exists INT;

  SET v_tipo = UPPER(TRIM(p_tipo));

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cantidad debe ser mayor que cero.';
  END IF;

  IF v_tipo NOT IN ('ENTRADA_INICIAL','COMPRA','VENTA','DEVOLUCION_COMPRA','DEVOLUCION_VENTA','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tipo de movimiento no permitido.';
  END IF;

  IF v_tipo IN ('ENTRADA_INICIAL','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA') AND (p_motivo IS NULL OR TRIM(p_motivo) = '') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El motivo es obligatorio para ajustes manuales.';
  END IF;

  SELECT COUNT(*) INTO v_exists FROM variantes_producto WHERE id_variante = p_variante AND activo = 1;
  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La variante no existe o está inactiva.';
  END IF;

  SELECT COUNT(*) INTO v_exists FROM bodegas WHERE id_bodega = p_bodega AND activo = 1;
  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bodega no existe o está inactiva.';
  END IF;

  IF p_usuario IS NOT NULL THEN
    SELECT COUNT(*) INTO v_exists FROM usuarios WHERE id_usuario = p_usuario AND activo = 1 AND bloqueado = 0;
    IF v_exists = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El usuario no está autorizado o está bloqueado.';
    END IF;
  END IF;

  SET v_factor = CASE WHEN v_tipo IN ('ENTRADA_INICIAL','COMPRA','DEVOLUCION_VENTA','AJUSTE_SOBRANTE','CORRECCION_ENTRADA') THEN 1 ELSE -1 END;

  SELECT id_stock, cantidad INTO v_stock_id, v_stock_anterior
  FROM stock_producto WHERE id_variante = p_variante AND id_bodega = p_bodega FOR UPDATE;

  IF v_stock_id IS NULL THEN
    IF v_factor < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe stock disponible para realizar la salida.';
    END IF;
    INSERT INTO stock_producto (id_variante, id_bodega, cantidad)
    VALUES (p_variante, p_bodega, 0.00);
    SET v_stock_id = LAST_INSERT_ID();
    SET v_stock_anterior = 0.00;
  END IF;

  SET v_stock_nuevo = v_stock_anterior + (p_cantidad * v_factor);
  IF v_stock_nuevo < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente.';
  END IF;

  UPDATE stock_producto SET cantidad = v_stock_nuevo WHERE id_stock = v_stock_id;

  INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario, fecha)
  VALUES (p_variante, p_bodega, v_tipo, p_cantidad, v_stock_anterior, v_stock_nuevo, NULLIF(TRIM(p_motivo), ''), NULLIF(TRIM(p_referencia_tipo), ''), p_referencia_id, p_usuario, NOW());

  SET p_movimiento_id = LAST_INSERT_ID();
END$$

DROP PROCEDURE IF EXISTS `sp_registrar_venta`$$
CREATE PROCEDURE `sp_registrar_venta`(
  IN `p_local` INT,
  IN `p_cliente` BIGINT,
  IN `p_canal` INT,
  IN `p_usuario` BIGINT,
  IN `p_descuento` DECIMAL(12,2),
  IN `p_items` JSON,
  IN `p_pagos` JSON,
  IN `p_observaciones` TEXT,
  OUT `p_id_venta` BIGINT,
  OUT `p_numero_venta` VARCHAR(50),
  OUT `p_total` DECIMAL(12,2)
)
proc_label: BEGIN
  DECLARE v_total_items INT DEFAULT 0;
  DECLARE v_total_pagos INT DEFAULT 0;
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_descuento DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_descuento_asignado DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_bruto DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_subtotal DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_iva DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_total DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_pago_total DECIMAL(12,2) DEFAULT 0.00;
  DECLARE v_numero VARCHAR(50);
  DECLARE v_sale_id BIGINT;
  DECLARE v_mov_id BIGINT;

  DECLARE v_item_var_id BIGINT;
  DECLARE v_item_cant DECIMAL(12,2);
  DECLARE v_item_precio DECIMAL(12,2);
  DECLARE v_item_iva_porc DECIMAL(5,2);
  DECLARE v_linea_bruta DECIMAL(12,2);
  DECLARE v_linea_descuento DECIMAL(12,2);
  DECLARE v_linea_total DECIMAL(12,2);
  DECLARE v_linea_subtotal DECIMAL(12,2);
  DECLARE v_linea_iva DECIMAL(12,2);
  DECLARE v_restante DECIMAL(12,2);
  DECLARE v_tomar DECIMAL(12,2);

  DECLARE v_pago_forma_id INT;
  DECLARE v_pago_valor DECIMAL(12,2);
  DECLARE v_pago_ref VARCHAR(150);
  DECLARE v_forma_codigo VARCHAR(50);
  DECLARE v_forma_req_ref TINYINT(1);

  DECLARE done INT DEFAULT FALSE;
  DECLARE v_cur_bodega INT;
  DECLARE v_cur_cant DECIMAL(12,2);
  DECLARE cur_stock CURSOR FOR 
    SELECT sp.id_bodega, sp.cantidad 
    FROM stock_producto sp 
    JOIN bodegas b ON b.id_bodega = sp.id_bodega 
    WHERE sp.id_variante = v_item_var_id AND b.id_local = p_local AND b.activo = 1 AND sp.cantidad > 0 
    ORDER BY sp.cantidad DESC;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  SET v_total_items = JSON_LENGTH(p_items);
  SET v_total_pagos = JSON_LENGTH(p_pagos);
  SET v_descuento = COALESCE(p_descuento, 0.00);

  IF v_total_items IS NULL OR v_total_items = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta debe contener al menos un producto.';
  END IF;
  IF v_total_pagos IS NULL OR v_total_pagos = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta debe contener al menos una forma de pago.';
  END IF;
  IF v_descuento < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El descuento no puede ser negativo.';
  END IF;

  SET v_i = 0;
  WHILE v_i < v_total_items DO
    SET v_item_var_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].id_variante')));
    SET v_item_cant = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].cantidad'))) AS DECIMAL(12,2));

    IF v_item_cant <= 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cantidad de producto debe ser mayor a cero.';
    END IF;

    SELECT vp.precio_venta, vp.porcentaje_iva INTO v_item_precio, v_item_iva_porc
    FROM variantes_producto vp
    JOIN productos p ON p.id_producto = vp.id_producto
    WHERE vp.id_variante = v_item_var_id AND vp.activo = 1 AND p.activo = 1;

    IF v_item_precio IS NULL OR v_item_precio <= 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Producto no disponible o precio inválido.';
    END IF;

    SET v_bruto = v_bruto + ROUND(v_item_precio * v_item_cant, 2);
    SET v_i = v_i + 1;
  END WHILE;

  IF v_descuento > v_bruto THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El descuento no puede superar el valor total de la venta.';
  END IF;

  SET v_total = v_bruto - v_descuento;

  SET v_i = 0;
  WHILE v_i < v_total_pagos DO
    SET v_pago_forma_id = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].id_forma_pago')));
    SET v_pago_valor = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].valor'))) AS DECIMAL(12,2));
    SET v_pago_ref = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].referencia')));

    SELECT codigo, requiere_referencia INTO v_forma_codigo, v_forma_req_ref
    FROM formas_pago WHERE id_forma_pago = v_pago_forma_id AND activo = 1;

    IF v_forma_codigo IS NULL OR v_pago_valor <= 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Forma de pago o valor inválido.';
    END IF;
    IF v_forma_codigo = 'MIXTO' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mixto debe desglosarse en formas de pago individuales.';
    END IF;
    IF v_forma_req_ref = 1 AND (v_pago_ref IS NULL OR CHAR_LENGTH(TRIM(v_pago_ref)) < 3) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La referencia de pago es obligatoria.';
    END IF;

    SET v_pago_total = v_pago_total + ROUND(v_pago_valor, 2);
    SET v_i = v_i + 1;
  END WHILE;

  IF ROUND(v_pago_total, 2) <> v_total THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La suma de pagos no coincide con el total de la venta.';
  END IF;

  SET v_i = 0;
  SET v_descuento_asignado = 0.00;
  WHILE v_i < v_total_items DO
    SET v_item_var_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].id_variante')));
    SET v_item_cant = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].cantidad'))) AS DECIMAL(12,2));

    SELECT precio_venta, porcentaje_iva INTO v_item_precio, v_item_iva_porc
    FROM variantes_producto WHERE id_variante = v_item_var_id;

    SET v_linea_bruta = ROUND(v_item_precio * v_item_cant, 2);
    IF (v_i + 1) = v_total_items THEN
      SET v_linea_descuento = v_descuento - v_descuento_asignado;
    ELSE
      SET v_linea_descuento = ROUND(v_descuento * (v_linea_bruta / NULLIF(v_bruto, 0)), 2);
    END IF;
    SET v_descuento_asignado = v_descuento_asignado + v_linea_descuento;
    SET v_linea_total = v_linea_bruta - v_linea_descuento;
    SET v_linea_subtotal = ROUND(v_linea_total / (1 + (v_item_iva_porc / 100)), 2);
    SET v_linea_iva = v_linea_total - v_linea_subtotal;

    SET v_subtotal = v_subtotal + v_linea_subtotal;
    SET v_iva = v_iva + v_linea_iva;
    SET v_i = v_i + 1;
  END WHILE;

  IF (v_subtotal + v_iva) <> v_total THEN
    SET v_iva = v_total - v_subtotal;
  END IF;

  SET v_numero = CONCAT('V-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 6)));

  INSERT INTO ventas (numero_venta, id_local, id_cliente, id_canal, id_usuario, fecha, subtotal, descuento, iva, total, observaciones, estado)
  VALUES (v_numero, p_local, p_cliente, p_canal, p_usuario, NOW(), v_subtotal, v_descuento, v_iva, v_total, NULLIF(TRIM(p_observaciones), ''), 'REGISTRADA');
  SET v_sale_id = LAST_INSERT_ID();

  SET v_i = 0;
  SET v_descuento_asignado = 0.00;
  WHILE v_i < v_total_items DO
    SET v_item_var_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].id_variante')));
    SET v_item_cant = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_i, '].cantidad'))) AS DECIMAL(12,2));

    SELECT precio_venta, porcentaje_iva INTO v_item_precio, v_item_iva_porc
    FROM variantes_producto WHERE id_variante = v_item_var_id;

    SET v_linea_bruta = ROUND(v_item_precio * v_item_cant, 2);
    IF (v_i + 1) = v_total_items THEN
      SET v_linea_descuento = v_descuento - v_descuento_asignado;
    ELSE
      SET v_linea_descuento = ROUND(v_descuento * (v_linea_bruta / NULLIF(v_bruto, 0)), 2);
    END IF;
    SET v_descuento_asignado = v_descuento_asignado + v_linea_descuento;
    SET v_linea_total = v_linea_bruta - v_linea_descuento;
    SET v_linea_subtotal = ROUND(v_linea_total / (1 + (v_item_iva_porc / 100)), 2);
    SET v_linea_iva = v_linea_total - v_linea_subtotal;

    INSERT INTO detalle_ventas (id_venta, id_variante, cantidad, precio_unitario, descuento, porcentaje_iva, subtotal, iva, total)
    VALUES (v_sale_id, v_item_var_id, v_item_cant, v_item_precio, v_linea_descuento, v_item_iva_porc, v_linea_subtotal, v_linea_iva, v_linea_total);

    SET v_restante = v_item_cant;
    SET done = FALSE;
    OPEN cur_stock;
    read_loop: LOOP
      FETCH cur_stock INTO v_cur_bodega, v_cur_cant;
      IF done OR v_restante <= 0 THEN
        LEAVE read_loop;
      END IF;
      SET v_tomar = LEAST(v_restante, v_cur_cant);
      CALL sp_registrar_movimiento_inventario(v_item_var_id, v_cur_bodega, 'VENTA', v_tomar, p_usuario, CONCAT('Venta ', v_numero), 'VENTA', v_sale_id, v_mov_id);
      SET v_restante = v_restante - v_tomar;
    END LOOP;
    CLOSE cur_stock;

    IF v_restante > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente en el local para completar la venta.';
    END IF;

    SET v_i = v_i + 1;
  END WHILE;

  SET v_i = 0;
  WHILE v_i < v_total_pagos DO
    SET v_pago_forma_id = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].id_forma_pago')));
    SET v_pago_valor = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].valor'))) AS DECIMAL(12,2));
    SET v_pago_ref = JSON_UNQUOTE(JSON_EXTRACT(p_pagos, CONCAT('$[', v_i, '].referencia')));

    INSERT INTO pagos_venta (id_venta, id_forma_pago, valor, referencia, fecha)
    VALUES (v_sale_id, v_pago_forma_id, ROUND(v_pago_valor, 2), NULLIF(TRIM(v_pago_ref), ''), NOW());
    SET v_i = v_i + 1;
  END WHILE;

  SET p_id_venta = v_sale_id;
  SET p_numero_venta = v_numero;
  SET p_total = v_total;
END$$

DROP TRIGGER IF EXISTS `trg_codigo_interno_producto`$$
CREATE TRIGGER `trg_codigo_interno_producto`
BEFORE INSERT ON `variantes_producto`
FOR EACH ROW
BEGIN
  DECLARE v_cat_cod VARCHAR(20);
  DECLARE v_tipo INT;
  DECLARE v_seq INT;

  IF NEW.codigo_interno IS NULL OR TRIM(NEW.codigo_interno) = '' THEN
    SELECT COALESCE(c.codigo, 'CAT'), p.id_tipo INTO v_cat_cod, v_tipo
    FROM productos p
    JOIN categorias c ON c.id_categoria = p.id_categoria
    WHERE p.id_producto = NEW.id_producto;

    INSERT INTO secuencia_codigo_interno VALUES (NULL);
    SET v_seq = LAST_INSERT_ID();

    SET NEW.codigo_interno = CONCAT(
      LEFT(UPPER(REGEXP_REPLACE(COALESCE(v_cat_cod, 'CAT'), '[^A-Za-z0-9]', '')), 8),
      '-T', COALESCE(v_tipo, 1), '-',
      LPAD(v_seq, 6, '0')
    );
  END IF;
END$$

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 4. DATOS INICIALES (SEED DATA)
-- ------------------------------------------------------------------------------

INSERT INTO `perfiles` (`codigo`, `nombre`, `descripcion`, `activo`) VALUES
('ADMINISTRADOR', 'Administrador', 'Acceso total y configuración del sistema', 1),
('VENTA_LOCAL', 'Venta Local', 'Operación comercial e inventario del local asignado', 1),
('ASESOR', 'Asesor', 'Consulta de productos y registro de sus propias ventas', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `permisos` (`codigo`, `nombre`, `descripcion`, `activo`) VALUES
('DASHBOARD_VER', 'Ver Dashboard', 'Permite visualizar estadísticas e indicadores generales', 1),
('PRODUCTO_VER', 'Ver Productos', 'Permite consultar el catálogo y fichas de productos', 1),
('PRODUCTO_CREAR', 'Crear Productos', 'Permite registrar nuevos productos y variantes', 1),
('PRODUCTO_EDITAR', 'Editar Productos', 'Permite modificar datos de productos existentes', 1),
('PRODUCTO_PRECIO', 'Modificar Precios', 'Permite cambiar precios de venta de variantes', 1),
('INVENTARIO_VER', 'Ver Inventario', 'Permite consultar existencias consolidadas por bodega', 1),
('INVENTARIO_AJUSTAR', 'Ajustar Inventario', 'Permite realizar ajustes manuales de stock', 1),
('VENTA_VER', 'Ver Ventas', 'Permite consultar historial y comprobantes de ventas', 1),
('VENTA_CREAR', 'Registrar Ventas', 'Permite procesar nuevas ventas en el punto de venta', 1),
('VENTA_ANULAR', 'Anular Ventas', 'Permite anular ventas emitidas y revertir stock', 1),
('USUARIO_VER', 'Ver Usuarios', 'Permite consultar la lista de usuarios del sistema', 1),
('USUARIO_CREAR', 'Crear Usuarios', 'Permite registrar nuevos usuarios y asignar perfiles', 1),
('USUARIO_EDITAR', 'Editar Usuarios', 'Permite modificar usuarios y resetear contraseñas', 1),
('USUARIO_ESTADO', 'Cambiar Estado de Usuarios', 'Permite activar, desactivar o bloquear usuarios', 1),
('AUDITORIA_VER', 'Ver Auditoría', 'Permite consultar el registro histórico de actividades', 1),
('CONFIGURACION_VER', 'Ver Configuración', 'Permite consultar y modificar catálogos y parámetros', 1),
('FINANZAS_VER', 'Ver Finanzas', 'Permite consultar reportes financieros y estados de cuenta', 1),
('REPORTES_VER', 'Ver Reportes', 'Permite consultar reportes consolidados del sistema', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
CROSS JOIN permisos perm
WHERE p.codigo = 'ADMINISTRADOR' AND perm.activo = 1;

INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
JOIN permisos perm ON perm.codigo IN (
  'DASHBOARD_VER', 'PRODUCTO_VER', 'INVENTARIO_VER', 'INVENTARIO_AJUSTAR', 'VENTA_VER', 'VENTA_CREAR'
)
WHERE p.codigo = 'VENTA_LOCAL' AND perm.activo = 1;

INSERT IGNORE INTO `perfil_permisos` (`id_perfil`, `id_permiso`)
SELECT p.id_perfil, perm.id_permiso
FROM perfiles p
JOIN permisos perm ON perm.codigo IN (
  'DASHBOARD_VER', 'PRODUCTO_VER', 'INVENTARIO_VER', 'VENTA_VER', 'VENTA_CREAR'
)
WHERE p.codigo = 'ASESOR' AND perm.activo = 1;

INSERT INTO `locales` (`id_local`, `codigo`, `nombre`, `direccion`, `telefono`, `activo`) VALUES
(1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `bodegas` (`id_bodega`, `nombre`, `id_local`, `descripcion`, `activo`) VALUES
(1, 'Bodega Principal Matriz', 1, 'Bodega central de almacenamiento', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `categorias` (`codigo`, `nombre`, `descripcion`, `activo`) VALUES
('SAB', 'Sábanas', 'Juegos de sábanas y piezas individuales', 1),
('EDR', 'Edredones', 'Edredones y rellenos para dormitorio', 1),
('COB', 'Cobertores', 'Cobertores y mantas', 1),
('ALM', 'Almohadas', 'Almohadas y complementos', 1),
('PRO', 'Protectores', 'Protectores de colchón y almohada', 1),
('TOA', 'Toallas', 'Toallas y textiles de baño', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `marcas` (`nombre`, `descripcion`, `activo`) VALUES
('L&F Home Decor', 'Marca principal de la empresa', 1),
('Genérica', 'Productos sin marca comercial específica', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `materiales` (`nombre`, `descripcion`, `activo`) VALUES
('Algodón', 'Fibra natural de algodón', 1),
('Microfibra', 'Tejido sintético de microfibra', 1),
('Sherpa', 'Tejido térmico tipo sherpa', 1),
('Viscoelástica', 'Espuma viscoelástica', 1),
('Poliéster', 'Fibra sintética de poliéster', 1),
('Impermeable', 'Material con protección contra líquidos', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `tamanos` (`nombre`, `descripcion`, `activo`) VALUES
('Individual', 'Tamaño individual', 1),
('1 1/2 Plazas', 'Tamaño de plaza y media', 1),
('2 Plazas', 'Tamaño matrimonial de dos plazas', 1),
('Queen', 'Tamaño Queen', 1),
('King', 'Tamaño King', 1),
('Estándar', 'Tamaño estándar para complementos', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `tipos_producto` (`nombre`, `descripcion`, `activo`) VALUES
('Textil Hogar', 'Textiles generales de hogar y dormitorio', 1),
('Complementos', 'Accesorios y complementos de descanso', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `colores` (`nombre`, `codigo_hex`, `activo`) VALUES
('Blanco', '#FFFFFF', 1),
('Beige', '#F5F5DC', 1),
('Gris', '#808080', 1),
('Azul Marino', '#000080', 1),
('Terracota', '#E2725B', 1)
ON DUPLICATE KEY UPDATE `codigo_hex` = VALUES(`codigo_hex`), `activo` = 1;

INSERT INTO `disenos` (`nombre`, `descripcion`, `activo`) VALUES
('Liso', 'Diseño en color entero sin patrones', 1),
('Estampado', 'Diseño con motivos gráficos variados', 1),
('Rayas', 'Diseño a rayas horizontales o verticales', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

INSERT INTO `unidades_medida` (`codigo`, `nombre`, `activo`) VALUES
('UND', 'Unidad', 1),
('JGO', 'Juego', 1),
('PAR', 'Par', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `formas_pago` (`codigo`, `nombre`, `requiere_referencia`, `activo`) VALUES
('EFECTIVO', 'Efectivo', 0, 1),
('TRANSFERENCIA', 'Transferencia', 1, 1),
('TARJETA', 'Tarjeta', 1, 1),
('DEUNA', 'DeUna', 1, 1),
('MIXTO', 'Mixto', 0, 1),
('CREDITO_INTERNO', 'Crédito interno', 0, 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `requiere_referencia` = VALUES(`requiere_referencia`), `activo` = 1;

INSERT INTO `canales_venta` (`codigo`, `nombre`, `activo`) VALUES
('LOCAL', 'Local', 1),
('ASESOR', 'Asesor', 1),
('WHATSAPP', 'WhatsApp', 1),
('FACEBOOK', 'Facebook', 1),
('INSTAGRAM', 'Instagram', 1),
('TIKTOK', 'TikTok', 1),
('OTROS', 'Otros', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `parametros_sistema` (`codigo`, `valor`, `descripcion`, `tipo_dato`, `editable`) VALUES
('IVA_PORCENTAJE', '15', 'Porcentaje de IVA aplicado a nuevos productos', 'NUMERIC', 1),
('ALERTA_STOCK', '5', 'Cantidad predeterminada para alerta de stock', 'NUMERIC', 1),
('COMISION_ASESOR', '60', 'Porcentaje de participación del asesor', 'NUMERIC', 1),
('COMISION_LOCAL', '40', 'Porcentaje de participación del local', 'NUMERIC', 1)
ON DUPLICATE KEY UPDATE `valor` = VALUES(`valor`), `descripcion` = VALUES(`descripcion`);

INSERT INTO `usuarios` (
  `id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`,
  `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`,
  `intentos_fallidos`, `bloqueado`, `activo`, `ultimo_acceso`
) VALUES (
  1,
  '1712345678',
  'Administrador',
  'Principal',
  'admin@lfhomedecor.com',
  '0999999999',
  1,
  1,
  '$2a$12$R.uJd7h555l2iA45w7F7iOBXUv0J1V/G9o45Yc/2bYxWc5Z/9OQce',
  0,
  0,
  0,
  1,
  NULL
)
ON DUPLICATE KEY UPDATE 
  `nombres` = VALUES(`nombres`),
  `apellidos` = VALUES(`apellidos`),
  `correo` = VALUES(`correo`),
  `id_perfil` = 1,
  `debe_cambiar_password` = 0,
  `intentos_fallidos` = 0,
  `bloqueado` = 0,
  `activo` = 1;

SET FOREIGN_KEY_CHECKS = 1;

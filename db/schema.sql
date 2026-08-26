-- ==============================================================================
-- L&F HOME DECOR - SCHEMA MARIADB 10.7+ / MYSQL 8.0+
-- Generado para administración e importación mediante phpMyAdmin / CLI
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. ESTRUCTURA BASE Y CONTROL DE ACCESO (AUTH Y PERMISOS)
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `perfil_permisos`;
DROP TABLE IF EXISTS `permisos`;
DROP TABLE IF EXISTS `auth_rate_limits`;
DROP TABLE IF EXISTS `sesiones_usuario`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `perfiles`;
DROP TABLE IF EXISTS `locales`;
DROP TABLE IF EXISTS `parametros_sistema`;

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

-- ------------------------------------------------------------------------------
-- 2. CATÁLOGOS DE PRODUCTOS Y AUXILIARES
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `categorias`;
DROP TABLE IF EXISTS `marcas`;
DROP TABLE IF EXISTS `tipos_producto`;
DROP TABLE IF EXISTS `materiales`;
DROP TABLE IF EXISTS `tamanos`;
DROP TABLE IF EXISTS `colores`;
DROP TABLE IF EXISTS `disenos`;
DROP TABLE IF EXISTS `unidades_medida`;

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

-- ------------------------------------------------------------------------------
-- 3. PRODUCTOS Y VARIANTES
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `variantes_producto`;
DROP TABLE IF EXISTS `productos`;

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

-- Secuencia para códigos internos en MariaDB
CREATE TABLE IF NOT EXISTS `secuencia_codigo_interno` (
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

-- ------------------------------------------------------------------------------
-- 4. INVENTARIO Y BODEGAS
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `movimientos_inventario`;
DROP TABLE IF EXISTS `stock_producto`;
DROP TABLE IF EXISTS `bodegas`;

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

-- ------------------------------------------------------------------------------
-- 5. CLIENTES, VENTAS Y FACTURACIÓN
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `pagos_venta`;
DROP TABLE IF EXISTS `detalle_ventas`;
DROP TABLE IF EXISTS `ventas`;
DROP TABLE IF EXISTS `canales_venta`;
DROP TABLE IF EXISTS `formas_pago`;
DROP TABLE IF EXISTS `clientes`;

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

-- ------------------------------------------------------------------------------
-- 6. AUDITORÍA DEL SISTEMA
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `auditoria`;

CREATE TABLE `auditoria` (
  `id_auditoria` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `usuario` BIGINT NULL,
  `tabla_afectada` VARCHAR(100) NOT NULL,
  `accion` VARCHAR(50) NOT NULL,
  `registro_id` BIGINT NULL,
  `valor_anterior` JSON NULL,
  `valor_nuevo` JSON NULL,
-- ------------------------------------------------------------------------------
-- 7. GASTOS Y COSTOS DEL NEGOCIO
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS `gastos`;

CREATE TABLE `gastos` (
  `id_gasto` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `fecha` DATE NOT NULL,
  `categoria` VARCHAR(50) NOT NULL, -- 'FIJO', 'VARIABLE', 'MARKETING', 'OPERATIVO', 'MEJORAS'
  `descripcion` VARCHAR(255) NOT NULL,
  `monto` DECIMAL(12,2) NOT NULL,
  `id_local` INT NULL,
  `id_usuario` BIGINT NULL,
  `beneficiario` VARCHAR(150) NULL,
  `observaciones` TEXT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_gastos_local` FOREIGN KEY (`id_local`) REFERENCES `locales` (`id_local`) ON DELETE SET NULL,
  CONSTRAINT `fk_gastos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL,
  INDEX `idx_gastos_fecha` (`fecha`),
  INDEX `idx_gastos_categoria` (`categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- L&F HOME DECOR - MIGRACIÓN DE DATOS REALES DESDE EXCEL
-- Generado automáticamente desde VENTAS_LOCAL_EDREDONES_Y_SABANAS_CONSOLIDADO_FINAL.xlsx
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. ASEGURAR TABLA PROVEEDORES
CREATE TABLE IF NOT EXISTS `proveedores` (
  `id_proveedor` INT AUTO_INCREMENT PRIMARY KEY,
  `ruc_cedula` VARCHAR(20) NOT NULL UNIQUE,
  `nombre` VARCHAR(150) NOT NULL,
  `telefono` VARCHAR(50) NULL,
  `correo` VARCHAR(120) NULL,
  `direccion` VARCHAR(255) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ASEGURAR TABLA COMPRAS
CREATE TABLE IF NOT EXISTS `compras` (
  `id_compra` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_proveedor` INT NOT NULL,
  `id_local` INT NOT NULL,
  `id_usuario` BIGINT NOT NULL,
  `numero_compra` VARCHAR(50) NOT NULL UNIQUE,
  `fecha` DATETIME NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `iva` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL,
  `observaciones` TEXT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_compras_proveedor` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`),
  CONSTRAINT `fk_compras_local` FOREIGN KEY (`id_local`) REFERENCES `locales` (`id_local`),
  CONSTRAINT `fk_compras_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  INDEX `idx_compras_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ASEGURAR TABLA DETALLE COMPRAS
CREATE TABLE IF NOT EXISTS `detalle_compras` (
  `id_detalle_compra` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_compra` BIGINT NOT NULL,
  `id_variante` BIGINT NOT NULL,
  `cantidad` INT NOT NULL,
  `precio_unitario` DECIMAL(12,2) NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `iva` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL,
  CONSTRAINT `fk_detalle_compras_compra` FOREIGN KEY (`id_compra`) REFERENCES `compras` (`id_compra`) ON DELETE CASCADE,
  CONSTRAINT `fk_detalle_compras_variante` FOREIGN KEY (`id_variante`) REFERENCES `variantes_producto` (`id_variante`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ASEGURAR TABLA GASTOS
CREATE TABLE IF NOT EXISTS `gastos` (
  `id_gasto` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `fecha` DATE NOT NULL,
  `categoria` VARCHAR(50) NOT NULL,
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

-- 5. ASEGURAR TABLA PAGOS DE COMISIONES (ABONOS)
CREATE TABLE IF NOT EXISTS `pagos_comisiones` (
  `id_pago_comision` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_usuario` BIGINT NOT NULL,
  `fecha` DATE NOT NULL,
  `monto` DECIMAL(12,2) NOT NULL,
  `forma_pago` VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
  `referencia` VARCHAR(100) NULL,
  `observaciones` TEXT NULL,
  `registrado_por` BIGINT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pagos_comisiones_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_pagos_comisiones_registrador` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id_usuario`),
  INDEX `idx_pagos_comisiones_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ASEGURAR LOCAL Y BODEGA MATRIZ
INSERT INTO `locales` (`id_local`, `codigo`, `nombre`, `direccion`, `telefono`, `activo`) VALUES
(1, 'MATRIZ', 'Local Matriz', 'Av. Principal #100', '0999999999', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

INSERT INTO `bodegas` (`id_bodega`, `nombre`, `id_local`, `descripcion`, `activo`) VALUES
(1, 'Bodega Principal Matriz', 1, 'Bodega central de almacenamiento', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

-- 6. INSERTAR ASESORES Y USUARIOS REALES (PASSWORD UNIFICADO: 1712345678)
INSERT INTO `usuarios` (`id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`, `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`, `intentos_fallidos`, `bloqueado`, `activo`) VALUES
(1, '1712345678', 'Administrador', 'Principal', 'admin@lfhomedecor.com', '0999999999', 1, 1, '$2b$12$NLoMl3EOTW2DezPQQRfEAeOWxD8Tminj/V0IQH5lY1IB3soItNSsG', 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE `nombres` = VALUES(`nombres`), `apellidos` = VALUES(`apellidos`), `correo` = VALUES(`correo`), `id_perfil` = VALUES(`id_perfil`), `password_hash` = VALUES(`password_hash`), `bloqueado` = 0, `intentos_fallidos` = 0, `activo` = 1;
INSERT INTO `usuarios` (`id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`, `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`, `intentos_fallidos`, `bloqueado`, `activo`) VALUES
(2, '1712345671', 'Aida', 'Álvarez', 'aida.alvarez@lfhomedecor.com', '0999999999', 3, 1, '$2b$12$NLoMl3EOTW2DezPQQRfEAeOWxD8Tminj/V0IQH5lY1IB3soItNSsG', 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE `nombres` = VALUES(`nombres`), `apellidos` = VALUES(`apellidos`), `correo` = VALUES(`correo`), `id_perfil` = VALUES(`id_perfil`), `password_hash` = VALUES(`password_hash`), `bloqueado` = 0, `intentos_fallidos` = 0, `activo` = 1;
INSERT INTO `usuarios` (`id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`, `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`, `intentos_fallidos`, `bloqueado`, `activo`) VALUES
(3, '1712345672', 'Fernanda', 'Oñate', 'fernanda.onate@lfhomedecor.com', '0999999999', 3, 1, '$2b$12$NLoMl3EOTW2DezPQQRfEAeOWxD8Tminj/V0IQH5lY1IB3soItNSsG', 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE `nombres` = VALUES(`nombres`), `apellidos` = VALUES(`apellidos`), `correo` = VALUES(`correo`), `id_perfil` = VALUES(`id_perfil`), `password_hash` = VALUES(`password_hash`), `bloqueado` = 0, `intentos_fallidos` = 0, `activo` = 1;
INSERT INTO `usuarios` (`id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`, `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`, `intentos_fallidos`, `bloqueado`, `activo`) VALUES
(5, '1712345674', 'Lizeth', 'Quishpe', 'lizeth.quishpe@lfhomedecor.com', '0999999999', 3, 1, '$2b$12$NLoMl3EOTW2DezPQQRfEAeOWxD8Tminj/V0IQH5lY1IB3soItNSsG', 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE `nombres` = VALUES(`nombres`), `apellidos` = VALUES(`apellidos`), `correo` = VALUES(`correo`), `id_perfil` = VALUES(`id_perfil`), `password_hash` = VALUES(`password_hash`), `bloqueado` = 0, `intentos_fallidos` = 0, `activo` = 1;
INSERT INTO `usuarios` (`id_usuario`, `cedula`, `nombres`, `apellidos`, `correo`, `telefono`, `id_perfil`, `id_local`, `password_hash`, `debe_cambiar_password`, `intentos_fallidos`, `bloqueado`, `activo`) VALUES
(6, '1712345670', 'Ventas', 'Local Matriz', 'local@lfhomedecor.com', '0999999999', 2, 1, '$2b$12$NLoMl3EOTW2DezPQQRfEAeOWxD8Tminj/V0IQH5lY1IB3soItNSsG', 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE `nombres` = VALUES(`nombres`), `apellidos` = VALUES(`apellidos`), `correo` = VALUES(`correo`), `id_perfil` = VALUES(`id_perfil`), `password_hash` = VALUES(`password_hash`), `bloqueado` = 0, `intentos_fallidos` = 0, `activo` = 1;

-- Desactivar usuario Iralda Manosalvas si existiera en la BD
UPDATE `usuarios` SET `activo` = 0 WHERE `cedula` = '1712345673' OR `nombres` LIKE '%Iralda%';

-- FORMAS DE PAGO (EFECTIVO, TRANSFERENCIA, DE UNA, MIXTO)
INSERT INTO `formas_pago` (`id_forma_pago`, `codigo`, `nombre`, `requiere_referencia`, `activo`) VALUES
(1, 'EFECTIVO', 'Efectivo', 0, 1),
(2, 'TRANSFERENCIA', 'Transferencia Bancaria', 1, 1),
(3, 'DE_UNA', 'De Una', 1, 1),
(4, 'MIXTO', 'Mixto (Efectivo + Transferencia)', 0, 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `codigo` = VALUES(`codigo`), `requiere_referencia` = VALUES(`requiere_referencia`), `activo` = 1;
UPDATE `formas_pago` SET `activo` = 0 WHERE `codigo` = 'TARJETA';

-- 7. INSERTAR PRODUCTOS Y VARIANTES REALES
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(1, 3, 1, 1, 'COBERTOR|2 PLAZAS', 'COBERTOR|2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(1, 1, 'LF-COB-001', 'LF-COB-001', 1, 3, 1, 1, 1, 25.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(2, 3, 1, 1, 'COBERTOR|2  1/2 PLAZAS', 'COBERTOR|2  1/2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(2, 2, 'LF-COB-002', 'LF-COB-002', 1, 4, 1, 1, 1, 30.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(3, 3, 1, 1, 'COBERTOR|1 1/2 PLAZAS', 'COBERTOR|1 1/2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(3, 3, 'LF-COB-003', 'LF-COB-003', 1, 2, 1, 1, 1, 20.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(4, 1, 1, 1, 'SABANAS|2 PLAZAS', 'SABANAS|2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(4, 4, 'LF-SAB-004', 'LF-SAB-004', 1, 3, 1, 1, 1, 15.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(5, 1, 1, 1, 'SABANAS|2  1/2 PLAZAS', 'SABANAS|2  1/2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(5, 5, 'LF-SAB-005', 'LF-SAB-005', 1, 4, 1, 1, 1, 16.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(6, 3, 1, 1, 'COBERTOR ECO|2 PLAZAS', 'COBERTOR ECO|2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(6, 6, 'LF-COB-006', 'LF-COB-006', 1, 3, 1, 1, 1, 14.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(7, 1, 1, 1, 'SABANAS ECO|2 PLAZAS', 'SABANAS ECO|2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(7, 7, 'LF-SAB-007', 'LF-SAB-007', 1, 3, 1, 1, 1, 11.50, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(8, 3, 1, 1, 'COBERTOR|3 PLAZAS', 'COBERTOR|3 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(8, 8, 'LF-COB-008', 'LF-COB-008', 1, 5, 1, 1, 1, 35.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(9, 5, 1, 1, 'CUBRE COLCHON|2 PLAZAS', 'CUBRE COLCHON|2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(9, 9, 'LF-CUB-009', 'LF-CUB-009', 1, 3, 1, 1, 1, 22.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(10, 5, 1, 1, 'CUBRE COLCHON|2  1/2 PLAZAS', 'CUBRE COLCHON|2  1/2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(10, 10, 'LF-CUB-010', 'LF-CUB-010', 1, 4, 1, 1, 1, 24.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(11, 5, 1, 1, 'CUBRE COLCHON|3 PLAZAS', 'CUBRE COLCHON|3 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(11, 11, 'LF-CUB-011', 'LF-CUB-011', 1, 5, 1, 1, 1, 26.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(12, 3, 1, 1, 'COBERTOR BRAMANTEOVEJERO|2 PLAZAS', 'COBERTOR BRAMANTEOVEJERO|2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(12, 12, 'LF-COB-012', 'LF-COB-012', 1, 3, 1, 1, 1, 20.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(13, 1, 1, 1, 'SABANAS|3 PLAZAS', 'SABANAS|3 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(13, 13, 'LF-SAB-013', 'LF-SAB-013', 1, 5, 1, 1, 1, 18.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(14, 4, 1, 1, 'FUNDAS DE ALMOHADA', 'FUNDAS DE ALMOHADA', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(14, 14, 'LF-ALM-014', 'LF-ALM-014', 1, 6, 1, 1, 1, 2.50, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(15, 3, 1, 1, 'COBERTOR ESPECIAL|3 PLAZAS', 'COBERTOR ESPECIAL|3 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(15, 15, 'LF-COB-015', 'LF-COB-015', 1, 5, 1, 1, 1, 28.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(16, 1, 1, 1, 'SABANAS|1 1/2 PLAZAS', 'SABANAS|1 1/2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(16, 16, 'LF-SAB-016', 'LF-SAB-016', 1, 2, 1, 1, 1, 14.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(17, 3, 1, 1, 'COBERTOR ESPECIAL|2 1/2 PLAZAS', 'COBERTOR ESPECIAL|2 1/2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(17, 17, 'LF-COB-017', 'LF-COB-017', 1, 4, 1, 1, 1, 26.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(18, 3, 1, 1, 'COBERTOR PLUS OVEJERO|2 PLAZAS', 'COBERTOR PLUS OVEJERO|2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(18, 18, 'LF-COB-018', 'LF-COB-018', 1, 3, 1, 1, 1, 30.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;
INSERT INTO `productos` (`id_producto`, `id_categoria`, `id_tipo`, `id_marca`, `descripcion`, `detalle`, `activo`) VALUES
(19, 3, 1, 1, 'COBERTOR PLUS OVEJERO|2 1/2 PLAZAS', 'COBERTOR PLUS OVEJERO|2 1/2 PLAZAS', 1)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `id_categoria` = VALUES(`id_categoria`), `activo` = 1;
INSERT INTO `variantes_producto` (`id_variante`, `id_producto`, `codigo_interno`, `codigo_gs1`, `id_material`, `id_tamano`, `id_color`, `id_diseno`, `id_unidad`, `precio_venta`, `porcentaje_iva`, `stock_minimo`, `activo`) VALUES
(19, 19, 'LF-COB-019', 'LF-COB-019', 1, 4, 1, 1, 1, 35.00, 15.00, 5, 1)
ON DUPLICATE KEY UPDATE `precio_venta` = VALUES(`precio_venta`), `id_tamano` = VALUES(`id_tamano`), `activo` = 1;

-- 8. INSERTAR PROVEEDOR GENERAL
INSERT INTO `proveedores` (`id_proveedor`, `ruc_cedula`, `nombre`, `telefono`, `correo`, `direccion`, `activo`) VALUES
(1, '1790012345001', 'Distribuidora Nacional de Blancos & Edredones', '0998877665', 'contacto@distribuidorablancos.ec', 'Quito, Ecuador', 1)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `activo` = 1;

-- 9. INSERTAR COMPRAS REALES AGRUPADAS POR FECHA (CON MÚLTIPLES DETALLES)
DELETE FROM `detalle_compras`;
DELETE FROM `compras`;
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(1, 1, 1, 1, 'COM-2026-0001', '2026-06-01 10:00:00', 1893.2, 283.98, 2177.18, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(1, 4, 40, 9.00, 313.2, 46.98, 360.18);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(1, 5, 10, 10.50, 91.3, 13.7, 105.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(1, 1, 89, 16.00, 1238.26, 185.74, 1424.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(1, 2, 16, 18.00, 250.43, 37.57, 288.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(2, 1, 1, 1, 'COM-2026-0002', '2026-06-06 10:00:00', 219.64, 32.95, 252.59, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(2, 3, 5, 14.50, 63.04, 9.46, 72.50);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(2, 4, 20, 9.00, 156.6, 23.49, 180.09);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(3, 1, 1, 1, 'COM-2026-0003', '2026-06-11 10:00:00', 337.83, 50.67, 388.50, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(3, 5, 37, 10.50, 337.82, 50.68, 388.50);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(4, 1, 1, 1, 'COM-2026-0004', '2026-06-25 10:00:00', 630.43, 94.57, 725.00, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(4, 6, 50, 10.00, 434.78, 65.22, 500.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(4, 7, 30, 7.50, 195.65, 29.35, 225.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(5, 1, 1, 1, 'COM-2026-0005', '2026-07-08 10:00:00', 1140.87, 171.13, 1312.00, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(5, 6, 31, 10.00, 269.57, 40.43, 310.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(5, 1, 30, 16.00, 417.39, 62.61, 480.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(5, 2, 29, 18.00, 453.91, 68.09, 522.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(6, 1, 1, 1, 'COM-2026-0006', '2026-07-16 10:00:00', 356.52, 53.48, 410.00, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(6, 1, 10, 16.00, 139.13, 20.87, 160.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(6, 6, 25, 10.00, 217.39, 32.61, 250.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(7, 1, 1, 1, 'COM-2026-0007', '2026-07-24 10:00:00', 965.22, 144.78, 1110.00, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(7, 2, 7, 21.00, 127.83, 19.17, 147.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(7, 9, 20, 16.00, 278.26, 41.74, 320.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(7, 10, 20, 18.50, 321.74, 48.26, 370.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(7, 11, 6, 21.00, 109.57, 16.43, 126.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(7, 8, 7, 21.00, 127.83, 19.17, 147.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(8, 1, 1, 1, 'COM-2026-0008', '2026-07-27 10:00:00', 474.78, 71.22, 546.00, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(8, 12, 30, 15.00, 391.31, 58.69, 450.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(8, 13, 8, 12.00, 83.48, 12.52, 96.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(9, 1, 1, 1, 'COM-2026-0009', '2026-08-08 10:00:00', 134.37, 20.16, 154.53, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(9, 4, 8, 9.00, 62.64, 9.4, 72.04);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(9, 7, 1, 7.50, 6.52, 0.98, 7.50);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(9, 14, 50, 1.50, 65.22, 9.78, 75.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(10, 1, 1, 1, 'COM-2026-0010', '2026-08-12 10:00:00', 231.19, 34.68, 265.87, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(10, 6, 13, 10.00, 113.04, 16.96, 130.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(10, 15, 1, 32.20, 28, 4.2, 32.20);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(10, 3, 1, 16.68, 14.5, 2.18, 16.68);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(10, 8, 1, 23.00, 20, 3, 23.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(10, 16, 8, 8.00, 55.65, 8.35, 64.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(11, 1, 1, 1, 'COM-2026-0011', '2026-08-20 10:00:00', 1281.74, 192.26, 1474.00, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(11, 1, 5, 16.00, 69.57, 10.43, 80.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(11, 17, 1, 26.00, 22.61, 3.39, 26.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(11, 4, 152, 9.00, 1189.57, 178.43, 1368.00);
INSERT INTO `compras` (`id_compra`, `id_proveedor`, `id_local`, `id_usuario`, `numero_compra`, `fecha`, `subtotal`, `iva`, `total`, `observaciones`, `estado`) VALUES
(12, 1, 1, 1, 'COM-2026-0012', '2026-08-26 10:00:00', 798.26, 119.74, 918.00, 'Compra agrupada por fecha desde consolidado Excel', 'REGISTRADA');
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(12, 4, 18, 9.00, 140.87, 21.13, 162.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(12, 2, 5, 18.00, 78.26, 11.74, 90.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(12, 1, 5, 16.00, 69.57, 10.43, 80.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(12, 6, 15, 10.00, 130.43, 19.57, 150.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(12, 18, 10, 19.00, 165.22, 24.78, 190.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(12, 19, 1, 21.00, 18.26, 2.74, 21.00);
INSERT INTO `detalle_compras` (`id_compra`, `id_variante`, `cantidad`, `precio_unitario`, `subtotal`, `iva`, `total`) VALUES
(12, 12, 15, 15.00, 195.65, 29.35, 225.00);

-- 10. INSERTAR GASTOS HISTÓRICOS DEL LOCAL
DELETE FROM `gastos`;
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-01', 'FIJO', 'Servicio de Luz Local Matriz (Junio)', 22.00, 1, 1, 'Empresa Eléctrica', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-01', 'FIJO', 'Arriendo Local Matriz - Línea Edredones (Junio)', 85.00, 1, 1, 'Propietario Local', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-01', 'FIJO', 'Arriendo Local Matriz - Línea Artesanías (Junio)', 85.00, 1, 1, 'Propietario Local', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-07-01', 'FIJO', 'Servicio de Luz Local Matriz (Julio)', 22.00, 1, 1, 'Empresa Eléctrica', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-07-01', 'FIJO', 'Arriendo Local Matriz - Línea Edredones (Julio)', 85.00, 1, 1, 'Propietario Local', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-07-01', 'FIJO', 'Arriendo Local Matriz - Línea Artesanías (Julio)', 85.00, 1, 1, 'Propietario Local', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-08-01', 'FIJO', 'Servicio de Luz Local Matriz (Agosto)', 22.00, 1, 1, 'Empresa Eléctrica', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-08-01', 'FIJO', 'Arriendo Local Matriz - Línea Edredones (Agosto)', 85.00, 1, 1, 'Propietario Local', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-08-01', 'FIJO', 'Arriendo Local Matriz - Línea Artesanías (Agosto)', 85.00, 1, 1, 'Propietario Local', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-15', 'MEJORAS', 'Mano de obra mejoras local', 50.00, 1, 1, 'Maestro de obra', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-15', 'MEJORAS', 'Madera y estructuras para exhibición', 190.00, 1, 1, 'Maderera', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-15', 'MEJORAS', 'Luminarias y luces LED', 48.00, 1, 1, 'Ferretería Eléctrica', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-15', 'MEJORAS', 'Instalación de luces y puntos eléctricos', 20.00, 1, 1, 'Electricista', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-20', 'MARKETING', 'Suscripción ChatGPT Plus (Automatización de Ventas)', 60.00, 1, 1, 'OpenAI', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-25', 'MARKETING', 'Publicidad en TikTok Ads', 18.00, 1, 1, 'TikTok Ads', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-06-28', 'MARKETING', 'Registro y renovación de dominio web mihogaryconfort.com', 36.80, 1, 1, 'Proveedor Dominio', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-07-05', 'OPERATIVO', 'Compra de 10 fundas para cobertor', 12.50, 1, 1, 'Distribuidora Fundas', 1);
INSERT INTO `gastos` (`fecha`, `categoria`, `descripcion`, `monto`, `id_local`, `id_usuario`, `beneficiario`, `activo`) VALUES
('2026-07-10', 'OPERATIVO', 'Impresión de talonarios de notas de venta y entrega', 16.00, 1, 1, 'Imprenta', 1);

-- 11. CALCULAR Y ASIGNAR STOCK DE INVENTARIO INICIAL (COMPRAS - VENTAS)
DELETE FROM `stock_producto`;
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(1, 1, 54, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(2, 1, 24, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(3, 1, 0, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(4, 1, 191, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(5, 1, 27, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(6, 1, 48, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(7, 1, 28, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(8, 1, 7, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(9, 1, 7, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(10, 1, 14, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(11, 1, 6, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(12, 1, 25, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(13, 1, 8, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(14, 1, 48, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(15, 1, 0, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(16, 1, 8, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(17, 1, 0, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(18, 1, 10, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);
INSERT INTO `stock_producto` (`id_variante`, `id_bodega`, `cantidad`, `fecha_actualizacion`) VALUES
(19, 1, 1, NOW())
ON DUPLICATE KEY UPDATE `cantidad` = VALUES(`cantidad`);

-- 12. INSERTAR VENTAS HISTÓRICAS CON DETALLE Y PAGOS
DELETE FROM `pagos_venta`;
DELETE FROM `detalle_ventas`;
DELETE FROM `ventas`;
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(1, 1, 1, 1, 2, 'V-2026-0001', '2026-06-01 12:00:00', 65.22, 0.00, 9.78, 75.00, 'Venta AA - Comis. Asesor $16.20 - Comis. Local $10.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(1, 1, 3, 25.00, 0.00, 15.00, 65.22, 9.78, 75.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(1, 1, 75.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(2, 1, 1, 1, 2, 'V-2026-0002', '2026-06-01 12:00:00', 52.17, 0.00, 7.83, 60.00, 'Venta AA - Comis. Asesor $14.40 - Comis. Local $9.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(2, 2, 2, 30.00, 0.00, 15.00, 52.17, 7.83, 60.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(2, 1, 60.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(3, 1, 1, 1, 2, 'V-2026-0003', '2026-06-01 12:00:00', 39.13, 0.00, 5.87, 45.00, 'Venta AA - Comis. Asesor $10.80 - Comis. Local $7.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(3, 4, 3, 15.00, 0.00, 15.00, 39.13, 5.87, 45.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(3, 1, 45.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(4, 1, 1, 1, 3, 'V-2026-0004', '2026-06-01 12:00:00', 104.35, 0.00, 15.65, 120.00, 'Venta FO - Comis. Asesor $28.80 - Comis. Local $19.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(4, 2, 4, 30.00, 0.00, 15.00, 104.35, 15.65, 120.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(4, 1, 120.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(5, 1, 1, 1, 3, 'V-2026-0005', '2026-06-01 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(5, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(5, 1, 25.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(6, 1, 1, 1, 3, 'V-2026-0006', '2026-06-01 12:00:00', 69.57, 0.00, 10.43, 80.00, 'Venta FO - Comis. Asesor $13.20 - Comis. Local $8.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(6, 3, 4, 20.00, 0.00, 15.00, 69.57, 10.43, 80.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(6, 1, 80.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(7, 1, 1, 1, 3, 'V-2026-0007', '2026-06-01 12:00:00', 15.65, 0.00, 2.35, 18.00, 'Venta FO - Comis. Asesor $4.50 - Comis. Local $3.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(7, 5, 1, 18.00, 0.00, 15.00, 15.65, 2.35, 18.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(7, 1, 18.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(8, 1, 1, 1, 3, 'V-2026-0008', '2026-06-01 12:00:00', 41.74, 0.00, 6.26, 48.00, 'Venta FO - Comis. Asesor $12.60 - Comis. Local $8.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(8, 4, 3, 16.00, 0.00, 15.00, 41.74, 6.26, 48.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(8, 1, 48.00, 'Efectivo', '2026-06-01 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(9, 1, 1, 1, 5, 'V-2026-0009', '2026-06-08 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta LQ - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(9, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(9, 1, 25.00, 'Efectivo', '2026-06-08 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(10, 1, 1, 1, 5, 'V-2026-0010', '2026-06-09 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta LQ - Comis. Asesor $8.40 - Comis. Local $5.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(10, 1, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(10, 1, 30.00, 'Efectivo', '2026-06-09 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(11, 1, 1, 1, 5, 'V-2026-0011', '2026-06-09 12:00:00', 13.04, 0.00, 1.96, 15.00, 'Venta LQ - Comis. Asesor $3.60 - Comis. Local $2.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(11, 4, 1, 15.00, 0.00, 15.00, 13.04, 1.96, 15.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(11, 1, 15.00, 'Efectivo', '2026-06-09 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(12, 1, 1, 1, 3, 'V-2026-0012', '2026-06-15 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta FO - Comis. Asesor $7.20 - Comis. Local $4.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(12, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(12, 1, 30.00, 'Efectivo', '2026-06-15 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(13, 1, 1, 1, 2, 'V-2026-0013', '2026-06-15 12:00:00', 78.26, 0.00, 11.74, 90.00, 'Venta AA - Comis. Asesor $21.60 - Comis. Local $14.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(13, 2, 3, 30.00, 0.00, 15.00, 78.26, 11.74, 90.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(13, 1, 90.00, 'Efectivo', '2026-06-15 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(14, 1, 1, 1, 2, 'V-2026-0014', '2026-06-15 12:00:00', 130.43, 0.00, 19.57, 150.00, 'Venta AA - Comis. Asesor $32.40 - Comis. Local $21.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(14, 1, 6, 25.00, 0.00, 15.00, 130.43, 19.57, 150.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(14, 1, 150.00, 'Efectivo', '2026-06-15 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(15, 1, 1, 1, 2, 'V-2026-0015', '2026-06-15 12:00:00', 69.57, 0.00, 10.43, 80.00, 'Venta AA - Comis. Asesor $22.80 - Comis. Local $15.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(15, 5, 4, 20.00, 0.00, 15.00, 69.57, 10.43, 80.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(15, 1, 80.00, 'Efectivo', '2026-06-15 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(16, 1, 1, 1, 2, 'V-2026-0016', '2026-06-15 12:00:00', 46.96, 0.00, 7.04, 54.00, 'Venta AA - Comis. Asesor $16.20 - Comis. Local $10.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(16, 4, 3, 18.00, 0.00, 15.00, 46.96, 7.04, 54.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(16, 1, 54.00, 'Efectivo', '2026-06-15 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(17, 1, 1, 1, 3, 'V-2026-0017', '2026-06-17 12:00:00', 86.96, 0.00, 13.04, 100.00, 'Venta FO - Comis. Asesor $21.60 - Comis. Local $14.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(17, 1, 4, 25.00, 0.00, 15.00, 86.96, 13.04, 100.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(17, 1, 100.00, 'Efectivo', '2026-06-17 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(18, 1, 1, 1, 3, 'V-2026-0018', '2026-06-17 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta FO - Comis. Asesor $7.20 - Comis. Local $4.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(18, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(18, 1, 30.00, 'Efectivo', '2026-06-17 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(19, 1, 1, 1, 3, 'V-2026-0019', '2026-06-17 12:00:00', 24.35, 0.00, 3.65, 28.00, 'Venta FO - Comis. Asesor $6.00 - Comis. Local $4.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(19, 4, 2, 14.00, 0.00, 15.00, 24.35, 3.65, 28.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(19, 1, 28.00, 'Efectivo', '2026-06-17 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(20, 1, 1, 1, 3, 'V-2026-0020', '2026-06-17 12:00:00', 13.91, 0.00, 2.09, 16.00, 'Venta FO - Comis. Asesor $3.30 - Comis. Local $2.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(20, 5, 1, 16.00, 0.00, 15.00, 13.91, 2.09, 16.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(20, 1, 16.00, 'Efectivo', '2026-06-17 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(21, 1, 1, 1, 3, 'V-2026-0021', '2026-06-16 12:00:00', 17.39, 0.00, 2.61, 20.00, 'Venta FO - Comis. Asesor $5.70 - Comis. Local $3.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(21, 5, 1, 20.00, 0.00, 15.00, 17.39, 2.61, 20.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(21, 1, 20.00, 'Efectivo', '2026-06-16 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(22, 1, 1, 1, 3, 'V-2026-0022', '2026-06-17 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta FO - Comis. Asesor $8.40 - Comis. Local $5.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(22, 1, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(22, 1, 30.00, 'Efectivo', '2026-06-17 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(23, 1, 1, 1, 3, 'V-2026-0023', '2026-08-19 12:00:00', 30.43, 0.00, 4.57, 35.00, 'Venta FO - Comis. Asesor $10.20 - Comis. Local $6.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(23, 2, 1, 35.00, 0.00, 15.00, 30.43, 4.57, 35.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(23, 1, 35.00, 'Efectivo', '2026-08-19 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(24, 1, 1, 1, 3, 'V-2026-0024', '2026-08-19 12:00:00', 17.39, 0.00, 2.61, 20.00, 'Venta FO - Comis. Asesor $5.70 - Comis. Local $3.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(24, 5, 1, 20.00, 0.00, 15.00, 17.39, 2.61, 20.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(24, 1, 20.00, 'Efectivo', '2026-08-19 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(25, 1, 1, 1, 3, 'V-2026-0025', '2026-06-26 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(25, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(25, 1, 25.00, 'Efectivo', '2026-06-26 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(26, 1, 1, 1, 2, 'V-2026-0026', '2026-06-18 12:00:00', 173.91, 0.00, 26.09, 200.00, 'Venta AA - Comis. Asesor $43.20 - Comis. Local $28.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(26, 1, 8, 25.00, 0.00, 15.00, 173.91, 26.09, 200.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(26, 1, 200.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(27, 1, 1, 1, 3, 'V-2026-0027', '2026-06-29 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(27, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(27, 1, 25.00, 'Efectivo', '2026-06-29 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(28, 1, 1, 1, 5, 'V-2026-0028', '2026-06-18 12:00:00', 65.22, 0.00, 9.78, 75.00, 'Venta LQ - Comis. Asesor $16.20 - Comis. Local $10.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(28, 1, 3, 25.00, 0.00, 15.00, 65.22, 9.78, 75.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(28, 1, 75.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(29, 1, 1, 1, 5, 'V-2026-0029', '2026-06-18 12:00:00', 36.52, 0.00, 5.48, 42.00, 'Venta LQ - Comis. Asesor $9.00 - Comis. Local $6.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(29, 4, 3, 14.00, 0.00, 15.00, 36.52, 5.48, 42.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(29, 1, 42.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(30, 1, 1, 1, 5, 'V-2026-0030', '2026-06-18 12:00:00', 86.96, 0.00, 13.04, 100.00, 'Venta LQ - Comis. Asesor $21.60 - Comis. Local $14.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(30, 1, 4, 25.00, 0.00, 15.00, 86.96, 13.04, 100.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(30, 1, 100.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(31, 1, 1, 1, 5, 'V-2026-0031', '2026-06-18 12:00:00', 36.52, 0.00, 5.48, 42.00, 'Venta LQ - Comis. Asesor $9.00 - Comis. Local $6.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(31, 4, 3, 14.00, 0.00, 15.00, 36.52, 5.48, 42.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(31, 1, 42.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(32, 1, 1, 1, 5, 'V-2026-0032', '2026-06-18 12:00:00', 43.48, 0.00, 6.52, 50.00, 'Venta LQ - Comis. Asesor $10.80 - Comis. Local $7.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(32, 1, 2, 25.00, 0.00, 15.00, 43.48, 6.52, 50.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(32, 1, 50.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(33, 1, 1, 1, 5, 'V-2026-0033', '2026-06-18 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta LQ - Comis. Asesor $7.20 - Comis. Local $4.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(33, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(33, 1, 30.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(34, 1, 1, 1, 5, 'V-2026-0034', '2026-06-18 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta LQ - Comis. Asesor $4.20 - Comis. Local $2.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(34, 2, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(34, 1, 25.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(35, 1, 1, 1, 5, 'V-2026-0035', '2026-06-18 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta LQ - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(35, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(35, 1, 25.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(36, 1, 1, 1, 5, 'V-2026-0036', '2026-06-18 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta LQ - Comis. Asesor $7.20 - Comis. Local $4.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(36, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(36, 1, 30.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(37, 1, 1, 1, 5, 'V-2026-0037', '2026-06-18 12:00:00', 65.22, 0.00, 9.78, 75.00, 'Venta LQ - Comis. Asesor $16.20 - Comis. Local $10.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(37, 1, 3, 25.00, 0.00, 15.00, 65.22, 9.78, 75.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(37, 1, 75.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(38, 1, 1, 1, 5, 'V-2026-0038', '2026-06-18 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta LQ - Comis. Asesor $5.40 - Comis. Local $3.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(38, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(38, 1, 25.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(39, 1, 1, 1, 5, 'V-2026-0039', '2026-06-18 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta LQ - Comis. Asesor $5.40 - Comis. Local $3.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(39, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(39, 1, 25.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(40, 1, 1, 1, 5, 'V-2026-0040', '2026-06-18 12:00:00', 17.39, 0.00, 2.61, 20.00, 'Venta LQ - Comis. Asesor $3.30 - Comis. Local $2.20 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(40, 3, 1, 20.00, 0.00, 15.00, 17.39, 2.61, 20.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(40, 1, 20.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(41, 1, 1, 1, 5, 'V-2026-0041', '2026-07-07 12:00:00', 43.48, 0.00, 6.52, 50.00, 'Venta LQ - Comis. Asesor $10.80 - Comis. Local $7.20 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(41, 1, 2, 25.00, 0.00, 15.00, 43.48, 6.52, 50.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(41, 1, 50.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(42, 1, 1, 1, 3, 'V-2026-0042', '2026-07-06 12:00:00', 19.13, 0.00, 2.87, 22.00, 'Venta FO - Comis. Asesor $6.90 - Comis. Local $4.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(42, 5, 1, 22.00, 0.00, 15.00, 19.13, 2.87, 22.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(42, 1, 22.00, 'Efectivo', '2026-07-06 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(43, 1, 1, 1, 3, 'V-2026-0043', '2026-07-08 12:00:00', 15.65, 0.00, 2.35, 18.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(43, 4, 1, 18.00, 0.00, 15.00, 15.65, 2.35, 18.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(43, 1, 18.00, 'Efectivo', '2026-07-08 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(44, 1, 1, 1, 3, 'V-2026-0044', '2026-07-13 12:00:00', 65.22, 0.00, 9.78, 75.00, 'Venta FO - Comis. Asesor $16.20 - Comis. Local $10.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(44, 1, 3, 25.00, 0.00, 15.00, 65.22, 9.78, 75.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(44, 1, 75.00, 'Efectivo', '2026-07-13 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(45, 1, 1, 1, 3, 'V-2026-0045', '2026-07-13 12:00:00', 12.17, 0.00, 1.83, 14.00, 'Venta FO - Comis. Asesor $3.00 - Comis. Local $2.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(45, 4, 1, 14.00, 0.00, 15.00, 12.17, 1.83, 14.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(45, 1, 14.00, 'Efectivo', '2026-07-13 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(46, 1, 1, 1, 3, 'V-2026-0046', '2026-07-13 12:00:00', 15.65, 0.00, 2.35, 18.00, 'Venta FO - Comis. Asesor $0.00 - Comis. Local $0.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(46, 4, 2, 9.00, 0.00, 15.00, 15.65, 2.35, 18.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(46, 1, 18.00, 'Efectivo', '2026-07-13 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(47, 1, 1, 1, 3, 'V-2026-0047', '2027-07-20 12:00:00', 65.22, 0.00, 9.78, 75.00, 'Venta FO - Comis. Asesor $16.20 - Comis. Local $10.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(47, 1, 3, 25.00, 0.00, 15.00, 65.22, 9.78, 75.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(47, 1, 75.00, 'Efectivo', '2027-07-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(48, 1, 1, 1, 5, 'V-2026-0048', '2026-07-07 12:00:00', 108.7, 0.00, 16.3, 125.00, 'Venta LQ - Comis. Asesor $27.00 - Comis. Local $18.00 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(48, 1, 5, 25.00, 0.00, 15.00, 108.7, 16.3, 125.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(48, 1, 125.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(49, 1, 1, 1, 5, 'V-2026-0049', '2026-07-07 12:00:00', 52.17, 0.00, 7.83, 60.00, 'Venta LQ - Comis. Asesor $14.40 - Comis. Local $9.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(49, 2, 2, 30.00, 0.00, 15.00, 52.17, 7.83, 60.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(49, 1, 60.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(50, 1, 1, 1, 5, 'V-2026-0050', '2026-07-07 12:00:00', 46.96, 0.00, 7.04, 54.00, 'Venta LQ - Comis. Asesor $16.20 - Comis. Local $10.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(50, 4, 3, 18.00, 0.00, 15.00, 46.96, 7.04, 54.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(50, 1, 54.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(51, 1, 1, 1, 5, 'V-2026-0051', '2026-07-07 12:00:00', 17.39, 0.00, 2.61, 20.00, 'Venta LQ - Comis. Asesor $5.70 - Comis. Local $3.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(51, 5, 1, 20.00, 0.00, 15.00, 17.39, 2.61, 20.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(51, 1, 20.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(52, 1, 1, 1, 5, 'V-2026-0052', '2026-07-07 12:00:00', 30.43, 0.00, 4.57, 35.00, 'Venta LQ - Comis. Asesor $10.20 - Comis. Local $6.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(52, 2, 1, 35.00, 0.00, 15.00, 30.43, 4.57, 35.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(52, 1, 35.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(53, 1, 1, 1, 5, 'V-2026-0053', '2026-07-07 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta LQ - Comis. Asesor $8.40 - Comis. Local $5.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(53, 1, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(53, 1, 30.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(54, 1, 1, 1, 5, 'V-2026-0054', '2026-07-07 12:00:00', 31.3, 0.00, 4.7, 36.00, 'Venta LQ - Comis. Asesor $10.80 - Comis. Local $7.20 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(54, 4, 2, 18.00, 0.00, 15.00, 31.3, 4.7, 36.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(54, 1, 36.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(55, 1, 1, 1, 5, 'V-2026-0055', '2026-07-07 12:00:00', 24.35, 0.00, 3.65, 28.00, 'Venta LQ - Comis. Asesor $7.20 - Comis. Local $4.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(55, 9, 1, 28.00, 0.00, 15.00, 24.35, 3.65, 28.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(55, 1, 28.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(56, 1, 1, 1, 5, 'V-2026-0056', '2026-07-07 12:00:00', 14.78, 0.00, 2.22, 17.00, 'Venta LQ - Comis. Asesor $4.20 - Comis. Local $2.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(56, 6, 1, 17.00, 0.00, 15.00, 14.78, 2.22, 17.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(56, 1, 17.00, 'Efectivo', '2026-07-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(57, 1, 1, 1, 3, 'V-2026-0057', '2026-07-20 12:00:00', 791.3, 0.00, 118.7, 910.00, 'Venta FO - Comis. Asesor $156.00 - Comis. Local $104.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(57, 6, 65, 14.00, 0.00, 15.00, 791.3, 118.7, 910.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(57, 1, 910.00, 'Efectivo', '2026-07-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(58, 1, 1, 1, 3, 'V-2026-0058', '2026-07-21 12:00:00', 20, 0.00, 3, 23.00, 'Venta FO - Comis. Asesor $4.80 - Comis. Local $3.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(58, 7, 2, 11.50, 0.00, 15.00, 20, 3, 23.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(58, 1, 23.00, 'Efectivo', '2026-07-21 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(59, 1, 1, 1, 3, 'V-2026-0059', '2026-08-03 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(59, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(59, 1, 25.00, 'Efectivo', '2026-08-03 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(60, 1, 1, 1, 3, 'V-2026-0060', '2026-08-03 12:00:00', 13.04, 0.00, 1.96, 15.00, 'Venta FO - Comis. Asesor $3.60 - Comis. Local $2.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(60, 4, 1, 15.00, 0.00, 15.00, 13.04, 1.96, 15.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(60, 1, 15.00, 'Efectivo', '2026-08-03 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(61, 1, 1, 1, 3, 'V-2026-0061', '2026-08-03 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(61, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(61, 1, 25.00, 'Efectivo', '2026-08-03 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(62, 1, 1, 1, 3, 'V-2026-0062', '2026-08-04 12:00:00', 12.17, 0.00, 1.83, 14.00, 'Venta FO - Comis. Asesor $2.40 - Comis. Local $1.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(62, 6, 1, 14.00, 0.00, 15.00, 12.17, 1.83, 14.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(62, 1, 14.00, 'Efectivo', '2026-08-04 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(63, 1, 1, 1, 3, 'V-2026-0063', '2026-08-04 12:00:00', 17.39, 0.00, 2.61, 20.00, 'Venta FO - Comis. Asesor $3.00 - Comis. Local $2.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(63, 12, 1, 20.00, 0.00, 15.00, 17.39, 2.61, 20.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(63, 1, 20.00, 'Efectivo', '2026-08-04 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(64, 1, 1, 1, 3, 'V-2026-0064', '2026-08-04 12:00:00', 95.65, 0.00, 14.35, 110.00, 'Venta FO - Comis. Asesor $18.00 - Comis. Local $12.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(64, 9, 5, 22.00, 0.00, 15.00, 95.65, 14.35, 110.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(64, 1, 110.00, 'Efectivo', '2026-08-04 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(65, 1, 1, 1, 5, 'V-2026-0065', '2026-08-05 12:00:00', 43.48, 0.00, 6.52, 50.00, 'Venta LQ - Comis. Asesor $10.80 - Comis. Local $7.20 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(65, 1, 2, 25.00, 0.00, 15.00, 43.48, 6.52, 50.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(65, 1, 50.00, 'Efectivo', '2026-08-05 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(66, 1, 1, 1, 5, 'V-2026-0066', '2026-08-05 12:00:00', 52.17, 0.00, 7.83, 60.00, 'Venta LQ - Comis. Asesor $14.40 - Comis. Local $9.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(66, 4, 4, 15.00, 0.00, 15.00, 52.17, 7.83, 60.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(66, 1, 60.00, 'Efectivo', '2026-08-05 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(67, 1, 1, 1, 3, 'V-2026-0067', '2026-08-07 12:00:00', 13.04, 0.00, 1.96, 15.00, 'Venta FO - Comis. Asesor $3.60 - Comis. Local $2.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(67, 4, 1, 15.00, 0.00, 15.00, 13.04, 1.96, 15.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(67, 1, 15.00, 'Efectivo', '2026-08-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(68, 1, 1, 1, 3, 'V-2026-0068', '2026-08-07 12:00:00', 52.17, 0.00, 7.83, 60.00, 'Venta FO - Comis. Asesor $9.00 - Comis. Local $6.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(68, 12, 3, 20.00, 0.00, 15.00, 52.17, 7.83, 60.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(68, 1, 60.00, 'Efectivo', '2026-08-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(69, 1, 1, 1, 3, 'V-2026-0069', '2026-08-07 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(69, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(69, 1, 25.00, 'Efectivo', '2026-08-07 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(70, 1, 1, 1, 5, 'V-2026-0070', '2026-08-12 12:00:00', 24.35, 0.00, 3.65, 28.00, 'Venta LQ - Comis. Asesor $4.80 - Comis. Local $3.20 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(70, 6, 2, 14.00, 0.00, 15.00, 24.35, 3.65, 28.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(70, 1, 28.00, 'Efectivo', '2026-08-12 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(71, 1, 1, 1, 3, 'V-2026-0071', '2026-08-12 12:00:00', 4.35, 0.00, 0.65, 5.00, 'Venta FO - Comis. Asesor $1.20 - Comis. Local $0.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(71, 14, 2, 2.50, 0.00, 15.00, 4.35, 0.65, 5.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(71, 1, 5.00, 'Efectivo', '2026-08-12 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(72, 1, 1, 1, 3, 'V-2026-0072', '2026-08-14 12:00:00', 17.39, 0.00, 2.61, 20.00, 'Venta FO - Comis. Asesor $3.00 - Comis. Local $2.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(72, 12, 1, 20.00, 0.00, 15.00, 17.39, 2.61, 20.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(72, 1, 20.00, 'Efectivo', '2026-08-14 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(73, 1, 1, 1, 3, 'V-2026-0073', '2026-08-17 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(73, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(73, 1, 25.00, 'Efectivo', '2026-08-17 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(74, 1, 1, 1, 3, 'V-2026-0074', '2026-08-14 12:00:00', 48.7, 0.00, 7.3, 56.00, 'Venta FO - Comis. Asesor $9.60 - Comis. Local $6.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(74, 6, 4, 14.00, 0.00, 15.00, 48.7, 7.3, 56.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(74, 1, 56.00, 'Efectivo', '2026-08-14 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(75, 1, 1, 1, 3, 'V-2026-0075', '2026-08-14 12:00:00', 65.22, 0.00, 9.78, 75.00, 'Venta FO - Comis. Asesor $16.20 - Comis. Local $10.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(75, 1, 3, 25.00, 0.00, 15.00, 65.22, 9.78, 75.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(75, 1, 75.00, 'Efectivo', '2026-08-14 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(76, 1, 1, 1, 3, 'V-2026-0076', '2026-08-17 12:00:00', 13.91, 0.00, 2.09, 16.00, 'Venta FO - Comis. Asesor $3.30 - Comis. Local $2.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(76, 5, 1, 16.00, 0.00, 15.00, 13.91, 2.09, 16.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(76, 1, 16.00, 'Efectivo', '2026-08-17 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(77, 1, 1, 1, 3, 'V-2026-0077', '2026-08-18 12:00:00', 19.13, 0.00, 2.87, 22.00, 'Venta FO - Comis. Asesor $3.60 - Comis. Local $2.40 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(77, 9, 1, 22.00, 0.00, 15.00, 19.13, 2.87, 22.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(77, 1, 22.00, 'Efectivo', '2026-08-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(78, 1, 1, 1, 3, 'V-2026-0078', '2026-06-18 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(78, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(78, 1, 25.00, 'Efectivo', '2026-06-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(79, 1, 1, 1, 3, 'V-2026-0079', '2026-08-18 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta FO - Comis. Asesor $7.20 - Comis. Local $4.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(79, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(79, 1, 30.00, 'Efectivo', '2026-08-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(80, 1, 1, 1, 3, 'V-2026-0080', '2026-08-18 12:00:00', 21.74, 0.00, 3.26, 25.00, 'Venta FO - Comis. Asesor $5.40 - Comis. Local $3.60 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(80, 1, 1, 25.00, 0.00, 15.00, 21.74, 3.26, 25.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(80, 1, 25.00, 'Efectivo', '2026-08-18 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(81, 1, 1, 1, 5, 'V-2026-0081', '2026-08-19 12:00:00', 10, 0.00, 1.5, 11.50, 'Venta LQ - Comis. Asesor $2.40 - Comis. Local $1.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(81, 7, 1, 11.50, 0.00, 15.00, 10, 1.5, 11.50);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(81, 1, 11.50, 'Efectivo', '2026-08-19 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(82, 1, 1, 1, 5, 'V-2026-0082', '2026-08-21 12:00:00', 12.17, 0.00, 1.83, 14.00, 'Venta LQ - Comis. Asesor $2.40 - Comis. Local $1.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(82, 6, 1, 14.00, 0.00, 15.00, 12.17, 1.83, 14.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(82, 1, 14.00, 'Efectivo', '2026-08-21 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(83, 1, 1, 1, 6, 'V-2026-0083', '2026-08-20 12:00:00', 140.87, 0.00, 21.13, 162.00, 'Venta LOCAL - Comis. Asesor $25.20 - Comis. Local $16.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(83, 6, 12, 13.50, 0.00, 15.00, 140.87, 21.13, 162.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(83, 1, 162.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(84, 1, 1, 1, 6, 'V-2026-0084', '2026-08-20 12:00:00', 193.04, 0.00, 28.96, 222.00, 'Venta LOCAL - Comis. Asesor $25.20 - Comis. Local $16.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(84, 12, 12, 18.50, 0.00, 15.00, 193.04, 28.96, 222.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(84, 1, 222.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(85, 1, 1, 1, 6, 'V-2026-0085', '2026-08-20 12:00:00', 226.09, 0.00, 33.91, 260.00, 'Venta LOCAL - Comis. Asesor $31.20 - Comis. Local $20.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(85, 1, 13, 20.00, 0.00, 15.00, 226.09, 33.91, 260.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(85, 1, 260.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(86, 1, 1, 1, 6, 'V-2026-0086', '2026-08-20 12:00:00', 217.39, 0.00, 32.61, 250.00, 'Venta LOCAL - Comis. Asesor $42.00 - Comis. Local $28.00 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(86, 2, 10, 25.00, 0.00, 15.00, 217.39, 32.61, 250.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(86, 1, 250.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(87, 1, 1, 1, 6, 'V-2026-0087', '2026-08-20 12:00:00', 143.48, 0.00, 21.52, 165.00, 'Venta LOCAL - Comis. Asesor $39.60 - Comis. Local $26.40 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(87, 4, 11, 15.00, 0.00, 15.00, 143.48, 21.52, 165.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(87, 1, 165.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(88, 1, 1, 1, 6, 'V-2026-0088', '2026-08-20 12:00:00', 111.3, 0.00, 16.7, 128.00, 'Venta LOCAL - Comis. Asesor $26.40 - Comis. Local $17.60 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(88, 5, 8, 16.00, 0.00, 15.00, 111.3, 16.7, 128.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(88, 1, 128.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(89, 1, 1, 1, 6, 'V-2026-0089', '2026-08-20 12:00:00', 114.78, 0.00, 17.22, 132.00, 'Venta LOCAL - Comis. Asesor $21.60 - Comis. Local $14.40 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(89, 9, 6, 22.00, 0.00, 15.00, 114.78, 17.22, 132.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(89, 1, 132.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(90, 1, 1, 1, 6, 'V-2026-0090', '2026-08-20 12:00:00', 125.22, 0.00, 18.78, 144.00, 'Venta LOCAL - Comis. Asesor $19.80 - Comis. Local $13.20 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(90, 10, 6, 24.00, 0.00, 15.00, 125.22, 18.78, 144.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(90, 1, 144.00, 'Efectivo', '2026-08-20 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(91, 1, 1, 1, 5, 'V-2026-0091', '2026-08-21 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta LQ - Comis. Asesor $7.20 - Comis. Local $4.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(91, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(91, 1, 30.00, 'Efectivo', '2026-08-21 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(92, 1, 1, 1, 5, 'V-2026-0092', '2026-08-22 12:00:00', 0, 0.00, 0, 0.00, 'Venta LQ - Comis. Asesor $0.00 - Comis. Local $0.00 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(92, 1, 1, 0.00, 0.00, 15.00, 0, 0, 0.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(92, 1, 0.00, 'Efectivo', '2026-08-22 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(93, 1, 1, 1, 5, 'V-2026-0093', '2026-08-22 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta LQ - Comis. Asesor $7.20 - Comis. Local $4.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(93, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(93, 1, 30.00, 'Efectivo', '2026-08-22 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(94, 1, 1, 1, 5, 'V-2026-0094', '2026-08-22 12:00:00', 13.91, 0.00, 2.09, 16.00, 'Venta LQ - Comis. Asesor $3.30 - Comis. Local $2.20 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(94, 5, 1, 16.00, 0.00, 15.00, 13.91, 2.09, 16.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(94, 1, 16.00, 'Efectivo', '2026-08-22 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(95, 1, 1, 1, 3, 'V-2026-0095', '2026-08-24 12:00:00', 43.48, 0.00, 6.52, 50.00, 'Venta FO - Comis. Asesor $10.80 - Comis. Local $7.20 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(95, 1, 2, 25.00, 0.00, 15.00, 43.48, 6.52, 50.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(95, 1, 50.00, 'Efectivo', '2026-08-24 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(96, 1, 1, 1, 3, 'V-2026-0096', '2026-08-24 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta FO - Comis. Asesor $7.20 - Comis. Local $4.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(96, 4, 2, 15.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(96, 1, 30.00, 'Efectivo', '2026-08-24 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(97, 1, 1, 1, 3, 'V-2026-0097', '2026-08-25 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta FO - Comis. Asesor $7.20 - Comis. Local $4.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(97, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(97, 1, 30.00, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(98, 1, 1, 1, 6, 'V-2026-0098', '2026-08-25 12:00:00', 39.13, 0.00, 5.87, 45.00, 'Venta LOCAL - Comis. Asesor $0.00 - Comis. Local $0.00 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(98, 12, 3, 15.00, 0.00, 15.00, 39.13, 5.87, 45.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(98, 1, 45.00, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(99, 1, 1, 1, 3, 'V-2026-0099', '2026-08-25 12:00:00', 22.61, 0.00, 3.39, 26.00, 'Venta FO - Comis. Asesor $0.00 - Comis. Local $0.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(99, 17, 1, 26.00, 0.00, 15.00, 22.61, 3.39, 26.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(99, 1, 26.00, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(100, 1, 1, 1, 5, 'V-2026-0100', '2026-08-25 12:00:00', 18.26, 0.00, 2.74, 21.00, 'Venta LQ - Comis. Asesor $0.00 - Comis. Local $0.00 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(100, 8, 1, 21.00, 0.00, 15.00, 18.26, 2.74, 21.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(100, 1, 21.00, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(101, 1, 1, 1, 5, 'V-2026-0101', '2026-08-25 12:00:00', 12.61, 0.00, 1.89, 14.50, 'Venta LQ - Comis. Asesor $0.00 - Comis. Local $0.00 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(101, 3, 1, 14.50, 0.00, 15.00, 12.61, 1.89, 14.50);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(101, 1, 14.50, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(102, 1, 1, 1, 5, 'V-2026-0102', '2026-08-25 12:00:00', 25.22, 0.00, 3.78, 29.00, 'Venta LQ - Comis. Asesor $0.00 - Comis. Local $0.00 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(102, 15, 1, 28.00, 0.00, 15.00, 25.22, 3.78, 29.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(102, 1, 29.00, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(103, 1, 1, 1, 5, 'V-2026-0103', '2026-08-25 12:00:00', 65.22, 0.00, 9.78, 75.00, 'Venta LQ - Comis. Asesor $16.20 - Comis. Local $10.80 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(103, 1, 3, 25.00, 0.00, 15.00, 65.22, 9.78, 75.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(103, 1, 75.00, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(104, 1, 1, 1, 5, 'V-2026-0104', '2026-08-25 12:00:00', 13.04, 0.00, 1.96, 15.00, 'Venta LQ - Comis. Asesor $3.60 - Comis. Local $2.40 [PENDIENTE]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(104, 4, 1, 15.00, 0.00, 15.00, 13.04, 1.96, 15.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(104, 1, 15.00, 'Efectivo', '2026-08-25 12:00:00');
INSERT INTO `ventas` (`id_venta`, `id_local`, `id_cliente`, `id_canal`, `id_usuario`, `numero_venta`, `fecha`, `subtotal`, `descuento`, `iva`, `total`, `observaciones`, `estado`) VALUES
(105, 1, 1, 1, 3, 'V-2026-0105', '2026-08-26 12:00:00', 26.09, 0.00, 3.91, 30.00, 'Venta FO - Comis. Asesor $7.20 - Comis. Local $4.80 [PAGADA]', 'REGISTRADA');
INSERT INTO `detalle_ventas` (`id_venta`, `id_variante`, `cantidad`, `precio_unitario`, `descuento`, `porcentaje_iva`, `subtotal`, `iva`, `total`) VALUES
(105, 2, 1, 30.00, 0.00, 15.00, 26.09, 3.91, 30.00);
INSERT INTO `pagos_venta` (`id_venta`, `id_forma_pago`, `valor`, `referencia`, `fecha`) VALUES
(105, 1, 30.00, 'Efectivo', '2026-08-26 12:00:00');

-- 13. INSERTAR ABONOS Y PAGOS DE COMISIONES REALES
DELETE FROM `pagos_comisiones`;
INSERT INTO `pagos_comisiones` (`id_usuario`, `fecha`, `monto`, `forma_pago`, `referencia`, `observaciones`, `registrado_por`, `activo`) VALUES
(2, '2026-06-30', 177.60, 'Transferencia', 'Transf #00129', 'Liquidación completa comisiones Junio - Aida Álvarez', 1, 1),
(5, '2026-07-15', 62.50, 'Transferencia', 'Transf #00184', 'Abono parcial comisiones - Lizeth Quishpe', 1, 1);

SET FOREIGN_KEY_CHECKS = 1;

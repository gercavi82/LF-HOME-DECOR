-- ==============================================================================
-- L&F HOME DECOR - CONCILIACIÓN AUTOMÁTICA FIFO DE ABONOS Y COMPRAS A PROVEEDORES
-- Compatible con MariaDB / MySQL 5.7+ / phpMyAdmin
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Asegurar columnas en compras
SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compras' AND COLUMN_NAME = 'total_abonado');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `compras` ADD COLUMN `total_abonado` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compras' AND COLUMN_NAME = 'saldo_pendiente');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `compras` ADD COLUMN `saldo_pendiente` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compras' AND COLUMN_NAME = 'estado_pago');
SET @sql := IF(@col_exist = 0, "ALTER TABLE `compras` ADD COLUMN `estado_pago` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Asegurar columnas en pagos_compras
SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pagos_compras' AND COLUMN_NAME = 'id_proveedor');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `pagos_compras` ADD COLUMN `id_proveedor` INT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pagos_compras' AND COLUMN_NAME = 'proveedor');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `pagos_compras` ADD COLUMN `proveedor` VARCHAR(200) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pagos_compras' AND COLUMN_NAME = 'monto_aplicado');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `pagos_compras` ADD COLUMN `monto_aplicado` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pagos_compras' AND COLUMN_NAME = 'saldo_disponible');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `pagos_compras` ADD COLUMN `saldo_disponible` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Crear tabla de aplicaciones N:M de abonos
CREATE TABLE IF NOT EXISTS `aplicaciones_abonos_proveedor` (
  `id_aplicacion` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `id_pago_cuenta` BIGINT NOT NULL,
  `id_compra` BIGINT NOT NULL,
  `id_proveedor` INT NOT NULL,
  `monto_aplicado` DECIMAL(12,2) NOT NULL,
  `fecha_aplicacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_por` BIGINT NULL,
  INDEX `idx_app_pago` (`id_pago_cuenta`),
  INDEX `idx_app_compra` (`id_compra`),
  INDEX `idx_app_prov` (`id_proveedor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Asociar id_proveedor en pagos_compras si no existía
UPDATE `pagos_compras` pc
JOIN `compras` c ON c.id_compra = pc.id_compra
SET pc.id_proveedor = c.id_proveedor
WHERE pc.id_proveedor IS NULL OR pc.id_proveedor = 0;

UPDATE `pagos_compras` SET `id_proveedor` = 1 WHERE `id_proveedor` IS NULL OR `id_proveedor` = 0;

SET FOREIGN_KEY_CHECKS = 1;

-- 5. Consulta de verificación inicial
SELECT 
  COUNT(*) AS total_facturas,
  SUM(total) AS total_compras,
  (SELECT SUM(monto) FROM pagos_compras WHERE activo = 1) AS total_depositos_proveedores
FROM compras
WHERE UPPER(COALESCE(estado, '')) NOT IN ('ANULADA', 'ANULADO');

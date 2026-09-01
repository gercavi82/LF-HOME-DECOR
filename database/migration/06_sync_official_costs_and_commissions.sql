-- ==============================================================================
-- L&F HOME DECOR - RESINCRONIZACIÓN OFICIAL DE COSTOS Y COMISIONES (60/40)
-- Compatible con MariaDB / MySQL 5.7+ / phpMyAdmin
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Asegurar parámetros del sistema de comisiones
INSERT INTO `parametros_sistema` (`codigo`, `valor`, `descripcion`, `tipo_dato`, `activo`) VALUES
('COMISION_ASESOR', '60', 'Porcentaje de utilidad neta para el asesor comercial', 'NUMERIC', 1),
('COMISION_LOCAL', '40', 'Porcentaje de utilidad neta para el local comercial', 'NUMERIC', 1)
ON DUPLICATE KEY UPDATE `valor` = VALUES(`valor`), `descripcion` = VALUES(`descripcion`), `activo` = 1;

-- 2. Asegurar columnas en tablas (si no existen se crean, si existen se ignoran)
-- Variantes Producto
SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'variantes_producto' AND COLUMN_NAME = 'costo_unitario');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `variantes_producto` ADD COLUMN `costo_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Detalle Ventas
SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'detalle_ventas' AND COLUMN_NAME = 'costo_unitario');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `detalle_ventas` ADD COLUMN `costo_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'detalle_ventas' AND COLUMN_NAME = 'costo_total');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `detalle_ventas` ADD COLUMN `costo_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'detalle_ventas' AND COLUMN_NAME = 'utilidad');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `detalle_ventas` ADD COLUMN `utilidad` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ventas
SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'costo_total');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `ventas` ADD COLUMN `costo_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'utilidad');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `ventas` ADD COLUMN `utilidad` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'comision_asesor');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `ventas` ADD COLUMN `comision_asesor` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'comision_local');
SET @sql := IF(@col_exist = 0, 'ALTER TABLE `ventas` ADD COLUMN `comision_local` DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Actualizar costos oficiales de catálogo según lista maestra Excel
UPDATE `variantes_producto` vp
SET vp.costo_unitario = CASE 
  WHEN vp.id_variante = 1 THEN 16.00
  WHEN vp.id_variante = 2 THEN 18.00
  WHEN vp.id_variante = 3 THEN 14.50
  WHEN vp.id_variante = 4 THEN 9.00
  WHEN vp.id_variante = 5 THEN 10.50
  WHEN vp.id_variante = 6 THEN 10.00
  WHEN vp.id_variante = 7 THEN 7.50
  WHEN vp.id_variante = 8 THEN 21.00
  WHEN vp.id_variante = 9 THEN 18.00
  WHEN vp.id_variante = 10 THEN 20.00
  WHEN vp.id_variante = 11 THEN 21.00
  WHEN vp.id_variante = 12 THEN 15.00
  WHEN vp.id_variante = 13 THEN 12.00
  WHEN vp.id_variante = 14 THEN 1.50
  WHEN vp.id_variante = 15 THEN 22.00
  WHEN vp.id_variante = 16 THEN 8.00
  WHEN vp.id_variante = 17 THEN 20.00
  WHEN vp.id_variante = 18 THEN 19.00
  WHEN vp.id_variante = 19 THEN 21.00
  ELSE COALESCE(
    (
      SELECT ROUND(dc.total / dc.cantidad, 2) 
      FROM detalle_compras dc 
      JOIN compras c ON c.id_compra = dc.id_compra 
      WHERE dc.id_variante = vp.id_variante AND UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
      ORDER BY c.fecha DESC, dc.id_detalle_compra DESC 
      LIMIT 1
    ),
    0.00
  )
END;

-- 4. Actualizar detalle_ventas con costo y utilidad reales
UPDATE `detalle_ventas` dv
JOIN `variantes_producto` vp ON vp.id_variante = dv.id_variante
SET 
  dv.costo_unitario = vp.costo_unitario,
  dv.costo_total = ROUND(vp.costo_unitario * dv.cantidad, 2),
  dv.utilidad = GREATEST(0, dv.total - ROUND(vp.costo_unitario * dv.cantidad, 2));

-- 5. Actualizar ventas históricas y recientes con costo_total, utilidad, comision_asesor (60%) y comision_local (40%)
UPDATE `ventas` v
SET 
  v.costo_total = COALESCE((
    SELECT SUM(dv.costo_total)
    FROM detalle_ventas dv
    WHERE dv.id_venta = v.id_venta
  ), 0.00),
  v.utilidad = GREATEST(0, v.total - COALESCE((
    SELECT SUM(dv.costo_total)
    FROM detalle_ventas dv
    WHERE dv.id_venta = v.id_venta
  ), 0.00)),
  v.comision_asesor = ROUND(GREATEST(0, v.total - COALESCE((
    SELECT SUM(dv.costo_total)
    FROM detalle_ventas dv
    WHERE dv.id_venta = v.id_venta
  ), 0.00)) * 0.60, 2),
  v.comision_local = ROUND(GREATEST(0, v.total - COALESCE((
    SELECT SUM(dv.costo_total)
    FROM detalle_ventas dv
    WHERE dv.id_venta = v.id_venta
  ), 0.00)) * 0.40, 2);

SET FOREIGN_KEY_CHECKS = 1;

-- 6. Verificación de resultados
SELECT 
  COUNT(*) AS total_ventas,
  SUM(total) AS venta_global,
  SUM(costo_total) AS costo_global,
  SUM(utilidad) AS utilidad_global,
  SUM(comision_asesor) AS total_comision_asesores,
  SUM(comision_local) AS total_comision_local
FROM ventas
WHERE UPPER(COALESCE(estado, '')) NOT IN ('ANULADA', 'ANULADO');

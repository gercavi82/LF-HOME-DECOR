-- ==============================================================================
-- L&F HOME DECOR - FASE 11: VERIFICACIÓN Y AUDITORÍA DE MIGRACIÓN
-- Archivo: database/migration/04_verify.sql
-- Ejecutar en MySQL / MariaDB para validar integridad y conteo de datos
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONTEO DE REGISTROS POR TABLA
-- Comparar los resultados con los totales de la base PostgreSQL / Supabase
-- ------------------------------------------------------------------------------

SELECT 'perfiles' AS tabla, COUNT(*) AS total_registros FROM `perfiles`
UNION ALL
SELECT 'permisos', COUNT(*) FROM `permisos`
UNION ALL
SELECT 'perfil_permisos', COUNT(*) FROM `perfil_permisos`
UNION ALL
SELECT 'locales', COUNT(*) FROM `locales`
UNION ALL
SELECT 'usuarios', COUNT(*) FROM `usuarios`
UNION ALL
SELECT 'categorias', COUNT(*) FROM `categorias`
UNION ALL
SELECT 'marcas', COUNT(*) FROM `marcas`
UNION ALL
SELECT 'tipos_producto', COUNT(*) FROM `tipos_producto`
UNION ALL
SELECT 'materiales', COUNT(*) FROM `materiales`
UNION ALL
SELECT 'tamanos', COUNT(*) FROM `tamanos`
UNION ALL
SELECT 'colores', COUNT(*) FROM `colores`
UNION ALL
SELECT 'disenos', COUNT(*) FROM `disenos`
UNION ALL
SELECT 'unidades_medida', COUNT(*) FROM `unidades_medida`
UNION ALL
SELECT 'productos', COUNT(*) FROM `productos`
UNION ALL
SELECT 'variantes_producto', COUNT(*) FROM `variantes_producto`
UNION ALL
SELECT 'bodegas', COUNT(*) FROM `bodegas`
UNION ALL
SELECT 'stock_producto', COUNT(*) FROM `stock_producto`
UNION ALL
SELECT 'movimientos_inventario', COUNT(*) FROM `movimientos_inventario`
UNION ALL
SELECT 'clientes', COUNT(*) FROM `clientes`
UNION ALL
SELECT 'formas_pago', COUNT(*) FROM `formas_pago`
UNION ALL
SELECT 'canales_venta', COUNT(*) FROM `canales_venta`
UNION ALL
SELECT 'ventas', COUNT(*) FROM `ventas`
UNION ALL
SELECT 'detalle_ventas', COUNT(*) FROM `detalle_ventas`
UNION ALL
SELECT 'pagos_venta', COUNT(*) FROM `pagos_venta`
UNION ALL
SELECT 'auditoria', COUNT(*) FROM `auditoria`
UNION ALL
SELECT 'parametros_sistema', COUNT(*) FROM `parametros_sistema`
UNION ALL
SELECT 'sesiones_usuario', COUNT(*) FROM `sesiones_usuario`;

-- ------------------------------------------------------------------------------
-- 2. VALIDACIÓN DE INTEGRIDAD REFERENCIAL Y HUÉRFANOS (DEBE RETORNAR 0 FILAS)
-- ------------------------------------------------------------------------------

-- 2.1 Usuarios con perfiles inválidos
SELECT u.id_usuario, u.cedula, u.id_perfil 
FROM usuarios u 
LEFT JOIN perfiles p ON p.id_perfil = u.id_perfil 
WHERE p.id_perfil IS NULL;

-- 2.2 Variantes sin producto padre
SELECT vp.id_variante, vp.id_producto 
FROM variantes_producto vp 
LEFT JOIN productos p ON p.id_producto = vp.id_producto 
WHERE p.id_producto IS NULL;

-- 2.3 Stock sin variante o bodega válida
SELECT sp.id_stock, sp.id_variante, sp.id_bodega 
FROM stock_producto sp
LEFT JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
LEFT JOIN bodegas b ON b.id_bodega = sp.id_bodega
WHERE vp.id_variante IS NULL OR b.id_bodega IS NULL;

-- 2.4 Detalle de ventas sin venta padre
SELECT dv.id_detalle, dv.id_venta 
FROM detalle_ventas dv
LEFT JOIN ventas v ON v.id_venta = dv.id_venta
WHERE v.id_venta IS NULL;

-- 2.5 Pagos sin venta padre
SELECT pv.id_pago, pv.id_venta 
FROM pagos_venta pv
LEFT JOIN ventas v ON v.id_venta = pv.id_venta
WHERE v.id_venta IS NULL;

-- ------------------------------------------------------------------------------
-- 3. VALIDACIÓN DE BALANCE FINANCIERO Y SUMAS DE CONTROL
-- ------------------------------------------------------------------------------

-- 3.1 Cuadre de Ventas vs Detalle de Ventas (Debe dar 0 diferencias)
SELECT 
  v.id_venta,
  v.numero_venta,
  v.total AS total_cabecera,
  COALESCE(SUM(dv.total), 0) AS total_detalle,
  ABS(v.total - COALESCE(SUM(dv.total), 0)) AS diferencia
FROM ventas v
JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
GROUP BY v.id_venta, v.numero_venta, v.total
HAVING diferencia > 0.01;

-- 3.2 Cuadre de Ventas vs Pagos Recibidos (Debe dar 0 diferencias)
SELECT 
  v.id_venta,
  v.numero_venta,
  v.total AS total_venta,
  COALESCE(SUM(pv.valor), 0) AS total_pagos,
  ABS(v.total - COALESCE(SUM(pv.valor), 0)) AS diferencia
FROM ventas v
JOIN pagos_venta pv ON pv.id_venta = v.id_venta
GROUP BY v.id_venta, v.numero_venta, v.total
HAVING diferencia > 0.01;

-- 3.3 Verificación de Usuarios con Password Hash Seguro
SELECT 
  id_usuario,
  cedula,
  nombres,
  apellidos,
  (CASE WHEN password_hash LIKE '$2a$%' OR password_hash LIKE '$2b$%' THEN 'BCRYPT_VALIDO' ELSE 'INVALIDO' END) AS estado_hash,
  debe_cambiar_password,
  bloqueado,
  activo
FROM usuarios;

-- ==============================================================================
-- L&F HOME DECOR - VISTAS MARIADB / MYSQL
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VISTA DE INVENTARIO CONSOLIDADO
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

-- ------------------------------------------------------------------------------
-- 2. VISTAS DE ALERTAS DE STOCK
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW `vw_productos_bajo_stock` AS
SELECT * FROM `vw_inventario_actual`
WHERE `estado_stock` = 'BAJO STOCK';

CREATE OR REPLACE VIEW `vw_productos_agotados` AS
SELECT * FROM `vw_inventario_actual`
WHERE `estado_stock` = 'AGOTADO';

-- ------------------------------------------------------------------------------
-- 3. VISTA DE DASHBOARD DE VENTAS (ZONA HORARIA ECUADOR: UTC-5)
-- ------------------------------------------------------------------------------
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

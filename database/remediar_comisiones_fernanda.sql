-- ==============================================================================
-- L&F HOME DECOR - SCRIPT DE DIAGNÓSTICO Y REMEDIACIÓN DE COMISIONES (FERNANDA OÑATE)
-- Ejecutar en phpMyAdmin o consola MySQL
-- ==============================================================================

-- 1. CONSULTA DE DIAGNÓSTICO: Ver a quién quedaron asignadas las ventas del 13 y 14 de Septiembre
SELECT 
  v.id_venta,
  v.numero_venta,
  v.fecha,
  v.id_usuario,
  CONCAT(u.nombres, ' ', u.apellidos) AS vendedor_actual,
  u.id_perfil,
  v.total,
  v.costo_total,
  v.utilidad,
  v.comision_asesor,
  v.comision_local,
  v.estado
FROM ventas v
JOIN usuarios u ON u.id_usuario = v.id_usuario
WHERE v.fecha >= '2026-09-13 00:00:00'
ORDER BY v.fecha DESC;

-- 2. SI LAS VENTAS DE FERNANDA QUEDARON CON OTRO USUARIO:
-- Opción A: Si quedaron a nombre de Administrador (id_usuario = 1):
UPDATE ventas 
SET id_usuario = 3 
WHERE fecha >= '2026-09-13 00:00:00' 
  AND UPPER(COALESCE(estado, '')) NOT IN ('ANULADA', 'ANULADO')
  AND id_usuario = 1;

-- Opción B: Si las 4 ventas del 13 y 15 de septiembre pertenecían a Fernanda Oñate (id_usuario = 3) 
-- y se registraron por error a nombre de Lizeth Quishpe (id_usuario = 5):
UPDATE ventas 
SET id_usuario = 3 
WHERE numero_venta LIKE 'V-20260913030317%'
   OR numero_venta LIKE 'V-20260913030228%'
   OR numero_venta LIKE 'V-20260913030032%'
   OR numero_venta LIKE 'V-20260915004903%';

-- 3. RECALCULAR COSTOS, UTILIDADES Y COMISIÓN 60/40 EN DETALLE Y CABECERA DE VENTAS:
UPDATE detalle_ventas dv
JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
SET 
  dv.costo_unitario = vp.costo_unitario,
  dv.costo_total = ROUND(vp.costo_unitario * dv.cantidad, 2),
  dv.utilidad = GREATEST(0, dv.total - ROUND(vp.costo_unitario * dv.cantidad, 2));

UPDATE ventas v
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

-- 4. VERIFICACIÓN: Ver la liquidación resultante de Fernanda Oñate (id_usuario = 3)
SELECT 
  u.id_usuario,
  CONCAT(u.nombres, ' ', u.apellidos) AS asesor,
  COUNT(v.id_venta) AS transacciones,
  COALESCE(SUM(v.total), 0) AS total_ventas,
  COALESCE(SUM(v.costo_total), 0) AS total_costo,
  COALESCE(SUM(v.utilidad), 0) AS total_utilidad,
  COALESCE(SUM(v.comision_asesor), 0) AS comision_asesor_60,
  (
    SELECT COALESCE(SUM(pc.monto), 0)
    FROM pagos_comisiones pc
    WHERE pc.id_usuario = u.id_usuario AND pc.activo = 1
  ) AS total_abonos,
  GREATEST(0, COALESCE(SUM(v.comision_asesor), 0) - (
    SELECT COALESCE(SUM(pc.monto), 0)
    FROM pagos_comisiones pc
    WHERE pc.id_usuario = u.id_usuario AND pc.activo = 1
  )) AS saldo_pendiente
FROM usuarios u
LEFT JOIN ventas v ON v.id_usuario = u.id_usuario AND UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
WHERE u.id_usuario = 3
GROUP BY u.id_usuario;

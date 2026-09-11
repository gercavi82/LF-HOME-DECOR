-- ============================================================================
-- AUDITORIA INTEGRAL DE CONSISTENCIA DE INVENTARIO
-- SISTEMA: L&F HOME DECOR / MI HOGAR Y CONFORT
-- OBJETIVO: Verificar la ecuación fundamental del inventario para cada variante y bodega:
-- INVENTARIO_FINAL = INICIAL + COMPRAS + DEV_CLIENTES - VENTAS - DEV_PROVEEDOR + AJUSTES_POS - AJUSTES_NEG
-- ============================================================================

-- SECCIÓN A: Registros con stock negativo en stock_producto (CRÍTICO)
SELECT 
    sp.id_stock,
    sp.id_variante,
    sp.id_bodega,
    p.descripcion AS producto,
    vp.codigo_gs1,
    b.nombre AS bodega,
    sp.cantidad AS stock_actual,
    sp.fecha_actualizacion
FROM stock_producto sp
JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
JOIN bodegas b ON b.id_bodega = sp.id_bodega
WHERE sp.cantidad < 0;

-- SECCIÓN B: Inconsistencias entre stock_producto y la suma histórica del Kardex
SELECT 
    sp.id_variante,
    sp.id_bodega,
    p.descripcion AS producto,
    vp.codigo_gs1,
    b.nombre AS bodega,
    sp.cantidad AS stock_en_tabla,
    COALESCE(k.saldo_kardex, 0) AS stock_segun_kardex,
    ROUND(sp.cantidad - COALESCE(k.saldo_kardex, 0), 4) AS diferencia,
    COALESCE(k.cant_inicial, 0) AS inicial,
    COALESCE(k.cant_compras, 0) AS compras,
    COALESCE(k.cant_ventas, 0) AS ventas,
    COALESCE(k.cant_dev_cliente, 0) AS dev_cliente,
    COALESCE(k.cant_dev_proveedor, 0) AS dev_proveedor,
    COALESCE(k.cant_ajustes_pos, 0) AS ajustes_pos,
    COALESCE(k.cant_ajustes_neg, 0) AS ajustes_neg
FROM stock_producto sp
JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
JOIN bodegas b ON b.id_bodega = sp.id_bodega
LEFT JOIN (
    SELECT 
        id_variante,
        id_bodega,
        SUM(CASE WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL') THEN cantidad ELSE 0 END) AS cant_inicial,
        SUM(CASE WHEN tipo = 'COMPRA' THEN cantidad ELSE 0 END) AS cant_compras,
        SUM(CASE WHEN tipo = 'VENTA' THEN cantidad ELSE 0 END) AS cant_ventas,
        SUM(CASE WHEN tipo IN ('DEVOLUCION_CLIENTE', 'DEVOLUCION_VENTA', 'DEVOLUCION') THEN cantidad ELSE 0 END) AS cant_dev_cliente,
        SUM(CASE WHEN tipo IN ('DEVOLUCION_PROVEEDOR', 'DEVOLUCION_COMPRA') THEN cantidad ELSE 0 END) AS cant_dev_proveedor,
        SUM(CASE WHEN tipo IN ('AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ENTRADA') THEN cantidad ELSE 0 END) AS cant_ajustes_pos,
        SUM(CASE WHEN tipo IN ('AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA', 'SALIDA') THEN cantidad ELSE 0 END) AS cant_ajustes_neg,
        SUM(
            CASE 
                WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL', 'COMPRA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_VENTA', 'DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ENTRADA') THEN cantidad
                WHEN tipo IN ('VENTA', 'DEVOLUCION_PROVEEDOR', 'DEVOLUCION_COMPRA', 'AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA', 'SALIDA') THEN -cantidad
                ELSE 0
            END
        ) AS saldo_kardex
    FROM movimientos_inventario
    GROUP BY id_variante, id_bodega
) k ON k.id_variante = sp.id_variante AND k.id_bodega = sp.id_bodega
WHERE ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) > 0.0001;

-- SECCIÓN C: Compras registradas en detalle_compras sin movimiento de entrada
SELECT 
    c.id_compra,
    c.numero_compra,
    c.fecha,
    dc.id_variante,
    dc.cantidad AS cantidad_comprada,
    p.descripcion AS producto,
    vp.codigo_gs1
FROM detalle_compras dc
JOIN compras c ON c.id_compra = dc.id_compra
JOIN variantes_producto vp ON vp.id_variante = dc.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
LEFT JOIN movimientos_inventario m 
    ON m.referencia_id = c.id_compra 
    AND m.referencia_tipo = 'COMPRA'
    AND m.id_variante = dc.id_variante
    AND m.tipo = 'COMPRA'
WHERE c.estado != 'ANULADA'
  AND m.id_movimiento IS NULL;

-- SECCIÓN D: Ventas registradas en detalle_ventas sin movimiento de salida
SELECT 
    v.id_venta,
    v.numero_venta,
    v.fecha,
    dv.id_variante,
    dv.cantidad AS cantidad_vendida,
    p.descripcion AS producto,
    vp.codigo_gs1
FROM detalle_ventas dv
JOIN ventas v ON v.id_venta = dv.id_venta
JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
LEFT JOIN movimientos_inventario m 
    ON m.referencia_id = v.id_venta 
    AND m.referencia_tipo = 'VENTA'
    AND m.id_variante = dv.id_variante
    AND m.tipo = 'VENTA'
WHERE v.estado != 'ANULADA'
  AND m.id_movimiento IS NULL;

-- SECCIÓN E: Movimientos de inventario huérfanos (variante o bodega inexistente)
SELECT 
    m.id_movimiento,
    m.fecha,
    m.id_variante,
    m.id_bodega,
    m.tipo,
    m.cantidad,
    CASE 
        WHEN vp.id_variante IS NULL THEN 'Variante inexistente'
        WHEN b.id_bodega IS NULL THEN 'Bodega inexistente'
        ELSE 'Correcto'
    END AS tipo_huerfano
FROM movimientos_inventario m
LEFT JOIN variantes_producto vp ON vp.id_variante = m.id_variante
LEFT JOIN bodegas b ON b.id_bodega = m.id_bodega
WHERE vp.id_variante IS NULL OR b.id_bodega IS NULL;

-- SECCIÓN F: Movimientos de inventario con cantidad negativa o cero
SELECT 
    id_movimiento,
    fecha,
    id_variante,
    id_bodega,
    tipo,
    cantidad,
    motivo
FROM movimientos_inventario
WHERE cantidad <= 0;

-- SECCIÓN G: Movimientos con tipo desconocido o no estandarizado
SELECT 
    DISTINCT tipo,
    COUNT(*) AS total_registros
FROM movimientos_inventario
GROUP BY tipo;

-- SECCIÓN H: Duplicados en stock_producto por (id_variante, id_bodega)
SELECT 
    id_variante,
    id_bodega,
    COUNT(*) AS total_filas
FROM stock_producto
GROUP BY id_variante, id_bodega
HAVING COUNT(*) > 1;

-- SECCIÓN I: Variantes activas que no tienen registro en stock_producto
SELECT 
    vp.id_variante,
    p.descripcion AS producto,
    vp.codigo_gs1,
    vp.codigo_interno
FROM variantes_producto vp
JOIN productos p ON p.id_producto = vp.id_producto
LEFT JOIN stock_producto sp ON sp.id_variante = vp.id_variante
WHERE vp.activo = 1 AND p.activo = 1 AND sp.id_stock IS NULL;

-- SECCIÓN H: Discontinuidades del Kardex (stock_nuevo[N] ≠ stock_anterior[N+1])
-- NOTA: Esta consulta requiere procesamiento por aplicación; la versión SQL detecta
-- casos donde stock_anterior difiere del stock_nuevo del movimiento previo (mismo variante/bodega)
SELECT
    m2.id_movimiento AS mov_actual,
    m2.id_variante,
    m2.id_bodega,
    p.descripcion AS producto,
    m1.id_movimiento AS mov_previo,
    m1.stock_nuevo AS stock_nuevo_previo,
    m2.stock_anterior AS stock_anterior_actual,
    ROUND(m2.stock_anterior - m1.stock_nuevo, 4) AS diferencia_discontinuidad,
    m1.fecha AS fecha_previo,
    m2.fecha AS fecha_actual
FROM movimientos_inventario m2
JOIN movimientos_inventario m1 ON (
    m1.id_variante = m2.id_variante
    AND m1.id_bodega = m2.id_bodega
    AND m1.id_movimiento = (
        SELECT MAX(m3.id_movimiento)
        FROM movimientos_inventario m3
        WHERE m3.id_variante = m2.id_variante
          AND m3.id_bodega = m2.id_bodega
          AND (m3.fecha < m2.fecha OR (m3.fecha = m2.fecha AND m3.id_movimiento < m2.id_movimiento))
    )
)
JOIN variantes_producto vp ON vp.id_variante = m2.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
WHERE ABS(m2.stock_anterior - m1.stock_nuevo) > 0.0001
ORDER BY m2.id_variante, m2.id_bodega, m2.fecha;

-- SECCIÓN I: Último stock_nuevo del Kardex vs stock_producto.cantidad
SELECT
    sp.id_variante,
    sp.id_bodega,
    p.descripcion AS producto,
    b.nombre AS bodega,
    sp.cantidad AS stock_tabla,
    m_last.stock_nuevo AS ultimo_stock_nuevo_kardex,
    ROUND(sp.cantidad - COALESCE(m_last.stock_nuevo, 0), 4) AS diferencia
FROM stock_producto sp
JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
JOIN bodegas b ON b.id_bodega = sp.id_bodega
LEFT JOIN movimientos_inventario m_last ON m_last.id_movimiento = (
    SELECT m_sub.id_movimiento
    FROM movimientos_inventario m_sub
    WHERE m_sub.id_variante = sp.id_variante AND m_sub.id_bodega = sp.id_bodega
    ORDER BY m_sub.fecha DESC, m_sub.id_movimiento DESC
    LIMIT 1
)
WHERE ABS(sp.cantidad - COALESCE(m_last.stock_nuevo, 0)) > 0.0001
ORDER BY ABS(sp.cantidad - COALESCE(m_last.stock_nuevo, 0)) DESC;

-- SECCIÓN J: Consistencia SUM(detalle_compras) vs SUM(movimientos COMPRA) por id_compra/variante
SELECT
    dc_agg.id_compra,
    c.numero_compra,
    c.fecha AS fecha_compra,
    dc_agg.id_variante,
    p.descripcion AS producto,
    dc_agg.cantidad_detalle,
    COALESCE(m_agg.cantidad_kardex, 0) AS cantidad_kardex,
    ROUND(dc_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0), 4) AS diferencia
FROM (
    SELECT id_compra, id_variante, SUM(cantidad) AS cantidad_detalle
    FROM detalle_compras
    GROUP BY id_compra, id_variante
) dc_agg
JOIN compras c ON c.id_compra = dc_agg.id_compra
JOIN variantes_producto vp ON vp.id_variante = dc_agg.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
LEFT JOIN (
    SELECT referencia_id, id_variante, SUM(cantidad) AS cantidad_kardex
    FROM movimientos_inventario
    WHERE tipo = 'COMPRA' AND referencia_tipo = 'COMPRA' AND referencia_id IS NOT NULL
    GROUP BY referencia_id, id_variante
) m_agg ON m_agg.referencia_id = dc_agg.id_compra AND m_agg.id_variante = dc_agg.id_variante
WHERE c.estado != 'ANULADA'
  AND ABS(dc_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) > 0.0001
ORDER BY ABS(dc_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) DESC;

-- SECCIÓN K: Consistencia SUM(detalle_ventas) vs SUM(movimientos VENTA) por id_venta/variante
SELECT
    dv_agg.id_venta,
    v.numero_venta,
    v.fecha AS fecha_venta,
    dv_agg.id_variante,
    p.descripcion AS producto,
    dv_agg.cantidad_detalle,
    COALESCE(m_agg.cantidad_kardex, 0) AS cantidad_kardex,
    ROUND(dv_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0), 4) AS diferencia
FROM (
    SELECT id_venta, id_variante, SUM(cantidad) AS cantidad_detalle
    FROM detalle_ventas
    GROUP BY id_venta, id_variante
) dv_agg
JOIN ventas v ON v.id_venta = dv_agg.id_venta
JOIN variantes_producto vp ON vp.id_variante = dv_agg.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
LEFT JOIN (
    SELECT referencia_id, id_variante, SUM(cantidad) AS cantidad_kardex
    FROM movimientos_inventario
    WHERE tipo = 'VENTA' AND referencia_tipo = 'VENTA' AND referencia_id IS NOT NULL
    GROUP BY referencia_id, id_variante
) m_agg ON m_agg.referencia_id = dv_agg.id_venta AND m_agg.id_variante = dv_agg.id_variante
WHERE v.estado != 'ANULADA'
  AND ABS(dv_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) > 0.0001
ORDER BY ABS(dv_agg.cantidad_detalle - COALESCE(m_agg.cantidad_kardex, 0)) DESC;

-- SECCIÓN ∑: Resumen cuantitativo general de consistencia (renombrado de J anterior)
SELECT
    COUNT(*) AS total_registros_stock,
    SUM(CASE WHEN ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) <= 0.0001 THEN 1 ELSE 0 END) AS consistentes,
    SUM(CASE WHEN ABS(sp.cantidad - COALESCE(k.saldo_kardex, 0)) > 0.0001 THEN 1 ELSE 0 END) AS inconsistentes,
    SUM(CASE WHEN sp.cantidad < 0 THEN 1 ELSE 0 END) AS stocks_negativos
FROM stock_producto sp
LEFT JOIN (
    SELECT
        id_variante,
        id_bodega,
        SUM(
            CASE
                WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL', 'COMPRA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_VENTA', 'DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ENTRADA') THEN cantidad
                WHEN tipo IN ('VENTA', 'DEVOLUCION_PROVEEDOR', 'DEVOLUCION_COMPRA', 'AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA', 'SALIDA') THEN -cantidad
                ELSE 0
            END
        ) AS saldo_kardex
    FROM movimientos_inventario
    GROUP BY id_variante, id_bodega
) k ON k.id_variante = sp.id_variante AND k.id_bodega = sp.id_bodega;

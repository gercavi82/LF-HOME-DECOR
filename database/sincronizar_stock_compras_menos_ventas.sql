-- ==============================================================================
-- SINCRONIZACIÓN MAESTRA DE STOCK: STOCK FINAL = INICIAL + COMPRAS - VENTAS
-- L&F HOME DECOR / MI HOGAR Y CONFORT
-- ==============================================================================
-- Este script alinea exactamente el stock físico de stock_producto y el Kardex 
-- a la regla estricta de negocio:
--
--     STOCK FINAL = COALESCE(INICIAL, 0) + COMPRAS - VENTAS
--
-- Ejemplo: Cobertor Económico 2 Plazas: Compras 134 - Ventas 83 = Stock 51.
-- ==============================================================================

START TRANSACTION;

-- ------------------------------------------------------------------------------
-- FASE 0: RESPALDO PREVENTIVO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_producto_backup_sync_cv LIKE stock_producto;
INSERT IGNORE INTO stock_producto_backup_sync_cv SELECT * FROM stock_producto;

CREATE TABLE IF NOT EXISTS movimientos_inventario_backup_sync_cv LIKE movimientos_inventario;
INSERT IGNORE INTO movimientos_inventario_backup_sync_cv SELECT * FROM movimientos_inventario;

-- ------------------------------------------------------------------------------
-- FASE 1: ELIMINAR AJUSTES ARTIFICIALES Y MOVIMIENTOS 'INICIAL' RESIDUALES
-- ------------------------------------------------------------------------------
-- Se eliminan tanto los ajustes físicos (-5, -46, etc.) como los inventarios iniciales 
-- residuales que fueron insertados artificialmente para que el stock sea 100% Compras - Ventas.
DELETE FROM movimientos_inventario 
WHERE referencia_tipo IN ('AJUSTE_FISICO', 'RECONSTRUCCION_INICIAL') 
   OR tipo IN ('INICIAL', 'ENTRADA_INICIAL')
   OR motivo LIKE '%Excel cuadre%' 
   OR motivo LIKE '%conteo físico en tienda%'
   OR motivo LIKE '%Reconstrucción histórica de inventario inicial%';

-- ------------------------------------------------------------------------------
-- FASE 2: ASEGURAR QUE TODAS LAS COMPRAS REALES ESTÉN EN EL KARDEX
-- ------------------------------------------------------------------------------
INSERT INTO movimientos_inventario (
    id_variante,
    id_bodega,
    tipo,
    cantidad,
    stock_anterior,
    stock_nuevo,
    fecha,
    motivo,
    referencia_tipo,
    referencia_id,
    usuario
)
SELECT 
    dc.id_variante,
    b.id_bodega,
    'COMPRA' AS tipo,
    ROUND(SUM(dc.cantidad) - COALESCE(k_compra.cant_kardex, 0), 4) AS cantidad,
    0 AS stock_anterior,
    0 AS stock_nuevo,
    c.fecha,
    CONCAT('Compra ', COALESCE(c.numero_compra, CAST(c.id_compra AS CHAR))) AS motivo,
    'COMPRA' AS referencia_tipo,
    c.id_compra AS referencia_id,
    1 AS usuario
FROM detalle_compras dc
JOIN compras c ON c.id_compra = dc.id_compra
JOIN bodegas b ON b.id_local = c.id_local AND b.activo = 1
LEFT JOIN (
    SELECT referencia_id, id_variante, id_bodega, SUM(cantidad) AS cant_kardex
    FROM movimientos_inventario
    WHERE tipo = 'COMPRA' AND referencia_tipo = 'COMPRA'
    GROUP BY referencia_id, id_variante, id_bodega
) k_compra ON k_compra.referencia_id = c.id_compra 
          AND k_compra.id_variante = dc.id_variante 
          AND k_compra.id_bodega = b.id_bodega
WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
GROUP BY c.id_compra, c.numero_compra, c.fecha, b.id_bodega, dc.id_variante, k_compra.cant_kardex
HAVING ROUND(SUM(dc.cantidad) - COALESCE(k_compra.cant_kardex, 0), 4) > 0.0001;

-- ------------------------------------------------------------------------------
-- FASE 3: ASEGURAR QUE TODAS LAS VENTAS REALES ESTÉN EN EL KARDEX
-- ------------------------------------------------------------------------------
INSERT INTO movimientos_inventario (
    id_variante,
    id_bodega,
    tipo,
    cantidad,
    stock_anterior,
    stock_nuevo,
    fecha,
    motivo,
    referencia_tipo,
    referencia_id,
    usuario
)
SELECT 
    dv.id_variante,
    b.id_bodega,
    'VENTA' AS tipo,
    ROUND(SUM(dv.cantidad) - COALESCE(k_venta.cant_kardex, 0), 4) AS cantidad,
    0 AS stock_anterior,
    0 AS stock_nuevo,
    v.fecha,
    CONCAT('Venta ', COALESCE(v.numero_venta, CAST(v.id_venta AS CHAR))) AS motivo,
    'VENTA' AS referencia_tipo,
    v.id_venta AS referencia_id,
    1 AS usuario
FROM detalle_ventas dv
JOIN ventas v ON v.id_venta = dv.id_venta
JOIN bodegas b ON b.id_local = v.id_local AND b.activo = 1
LEFT JOIN (
    SELECT referencia_id, id_variante, id_bodega, SUM(cantidad) AS cant_kardex
    FROM movimientos_inventario
    WHERE tipo = 'VENTA' AND referencia_tipo = 'VENTA'
    GROUP BY referencia_id, id_variante, id_bodega
) k_venta ON k_venta.referencia_id = v.id_venta 
         AND k_venta.id_variante = dv.id_variante 
         AND k_venta.id_bodega = b.id_bodega
WHERE UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
GROUP BY v.id_venta, v.numero_venta, v.fecha, b.id_bodega, dv.id_variante, k_venta.cant_kardex
HAVING ROUND(SUM(dv.cantidad) - COALESCE(k_venta.cant_kardex, 0), 4) > 0.0001;

-- ------------------------------------------------------------------------------
-- FASE 4: ACTUALIZAR STOCK_PRODUCTO EXACTAMENTE A: INICIAL + COMPRAS - VENTAS
-- ------------------------------------------------------------------------------
UPDATE stock_producto sp
JOIN (
    SELECT 
        sp_sub.id_stock,
        GREATEST(
            0,
            GREATEST(COALESCE(comp_det.total_compras, 0), COALESCE(k_tot.cant_compras, 0)) 
            - GREATEST(COALESCE(vent_det.total_ventas, 0), COALESCE(k_tot.cant_ventas, 0))
            + COALESCE(k_tot.cant_dev_cliente, 0)
            - COALESCE(k_tot.cant_dev_proveedor, 0)
        ) AS stock_correcto
    FROM stock_producto sp_sub
    LEFT JOIN (
        SELECT 
            dc.id_variante,
            b2.id_bodega,
            SUM(dc.cantidad) AS total_compras
        FROM detalle_compras dc
        JOIN compras c ON c.id_compra = dc.id_compra
        JOIN bodegas b2 ON b2.id_local = c.id_local AND b2.activo = 1
        WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
        GROUP BY dc.id_variante, b2.id_bodega
    ) comp_det ON comp_det.id_variante = sp_sub.id_variante AND comp_det.id_bodega = sp_sub.id_bodega
    LEFT JOIN (
        SELECT 
            dv.id_variante,
            b3.id_bodega,
            SUM(dv.cantidad) AS total_ventas
        FROM detalle_ventas dv
        JOIN ventas v ON v.id_venta = dv.id_venta
        JOIN bodegas b3 ON b3.id_local = v.id_local AND b3.activo = 1
        WHERE UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
        GROUP BY dv.id_variante, b3.id_bodega
    ) vent_det ON vent_det.id_variante = sp_sub.id_variante AND vent_det.id_bodega = sp_sub.id_bodega
    LEFT JOIN (
        SELECT 
            id_variante,
            id_bodega,
            SUM(CASE WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL') THEN cantidad ELSE 0 END) AS cant_inicial,
            SUM(CASE WHEN tipo = 'COMPRA' THEN cantidad ELSE 0 END) AS cant_compras,
            SUM(CASE WHEN tipo IN ('VENTA') THEN cantidad ELSE 0 END) AS cant_ventas,
            SUM(CASE WHEN tipo IN ('DEVOLUCION_CLIENTE', 'DEVOLUCION') THEN cantidad ELSE 0 END) AS cant_dev_cliente,
            SUM(CASE WHEN tipo = 'DEVOLUCION_PROVEEDOR' THEN cantidad ELSE 0 END) AS cant_dev_proveedor
        FROM movimientos_inventario
        GROUP BY id_variante, id_bodega
    ) k_tot ON k_tot.id_variante = sp_sub.id_variante AND k_tot.id_bodega = sp_sub.id_bodega
    LEFT JOIN (
        SELECT 
            id_variante,
            id_bodega,
            SUM(cantidad) AS cant_inicial
        FROM movimientos_inventario
        WHERE tipo IN ('INICIAL', 'ENTRADA_INICIAL')
        GROUP BY id_variante, id_bodega
    ) ini ON ini.id_variante = sp_sub.id_variante AND ini.id_bodega = sp_sub.id_bodega
) calc ON calc.id_stock = sp.id_stock
SET sp.cantidad = calc.stock_correcto,
    sp.fecha_actualizacion = NOW();

COMMIT;

-- ------------------------------------------------------------------------------
-- FASE 5: CONSULTA DE COMPROBACIÓN FINAL (COMPRAS - VENTAS = STOCK)
-- ------------------------------------------------------------------------------
SELECT 
    p.descripcion AS producto,
    b.nombre AS bodega,
    COALESCE(ini.cant_inicial, 0) AS inicial,
    GREATEST(COALESCE(comp_det.total_compras, 0), COALESCE(k_tot.cant_compras, 0)) AS compras,
    GREATEST(COALESCE(vent_det.total_ventas, 0), COALESCE(k_tot.cant_ventas, 0)) AS ventas,
    sp.cantidad AS stock_final_en_tabla,
    CASE 
        WHEN sp.cantidad <= 0 THEN 'AGOTADO'
        WHEN sp.cantidad <= vp.stock_minimo THEN 'BAJO STOCK'
        ELSE 'DISPONIBLE'
    END AS estado
FROM stock_producto sp
JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
JOIN bodegas b ON b.id_bodega = sp.id_bodega
LEFT JOIN (
    SELECT 
        dc.id_variante,
        b2.id_bodega,
        SUM(dc.cantidad) AS total_compras
    FROM detalle_compras dc
    JOIN compras c ON c.id_compra = dc.id_compra
    JOIN bodegas b2 ON b2.id_local = c.id_local AND b2.activo = 1
    WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
    GROUP BY dc.id_variante, b2.id_bodega
) comp_det ON comp_det.id_variante = sp.id_variante AND comp_det.id_bodega = sp.id_bodega
LEFT JOIN (
    SELECT 
        dv.id_variante,
        b3.id_bodega,
        SUM(dv.cantidad) AS total_ventas
    FROM detalle_ventas dv
    JOIN ventas v ON v.id_venta = dv.id_venta
    JOIN bodegas b3 ON b3.id_local = v.id_local AND b3.activo = 1
    WHERE UPPER(COALESCE(v.estado, '')) NOT IN ('ANULADA', 'ANULADO')
    GROUP BY dv.id_variante, b3.id_bodega
) vent_det ON vent_det.id_variante = sp.id_variante AND vent_det.id_bodega = sp.id_bodega
LEFT JOIN (
    SELECT 
        id_variante,
        id_bodega,
        SUM(CASE WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL') THEN cantidad ELSE 0 END) AS cant_inicial,
        SUM(CASE WHEN tipo = 'COMPRA' THEN cantidad ELSE 0 END) AS cant_compras,
        SUM(CASE WHEN tipo = 'VENTA' THEN cantidad ELSE 0 END) AS cant_ventas
    FROM movimientos_inventario
    GROUP BY id_variante, id_bodega
) k_tot ON k_tot.id_variante = sp.id_variante AND k_tot.id_bodega = sp.id_bodega
LEFT JOIN (
    SELECT 
        id_variante,
        id_bodega,
        SUM(cantidad) AS cant_inicial
    FROM movimientos_inventario
    WHERE tipo IN ('INICIAL', 'ENTRADA_INICIAL')
    GROUP BY id_variante, id_bodega
) ini ON ini.id_variante = sp.id_variante AND ini.id_bodega = sp.id_bodega
WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
ORDER BY p.descripcion ASC;

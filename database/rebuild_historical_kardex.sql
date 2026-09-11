-- ==============================================================================
-- RECONSTRUCCIÓN DEL KARDEX HISTÓRICO COMPLETO DE INVENTARIO
-- L&F HOME DECOR / MI HOGAR Y CONFORT
-- ==============================================================================
-- REGLAS ESTRICTAS:
--  ✅ NO modifica stock_producto.cantidad (el saldo físico actual se conserva).
--  ✅ NO elimina ni altera movimientos existentes de VENTA ni AJUSTE_FISICO.
--  ✅ Inserta los movimientos COMPRA históricos faltantes desde detalle_compras.
--  ✅ Inserta el movimiento INICIAL residual necesario para cuadrar el 100%.
--  ✅ Recalcula cronológicamente stock_anterior y stock_nuevo.
--  ✅ Idempotente: seguro para ejecutarse múltiples veces.
-- ==============================================================================

START TRANSACTION;

-- ------------------------------------------------------------------------------
-- FASE 0: RESPALDO PREVENTIVO CON TIMESTAMP
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario_backup_rebuild_20260910 LIKE movimientos_inventario;
INSERT IGNORE INTO movimientos_inventario_backup_rebuild_20260910 SELECT * FROM movimientos_inventario;

CREATE TABLE IF NOT EXISTS stock_producto_backup_rebuild_20260910 LIKE stock_producto;
INSERT IGNORE INTO stock_producto_backup_rebuild_20260910 SELECT * FROM stock_producto;

-- ------------------------------------------------------------------------------
-- FASE 1: INSERTAR COMPRAS HISTÓRICAS FALTANTES DESDE DETALLE_COMPRAS
-- ------------------------------------------------------------------------------
-- Se buscan compras no anuladas agrupadas por id_compra e id_variante
-- cuya cantidad en detalle_compras supere lo que actualmente tiene Kardex.
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
    CONCAT('Reconstrucción histórica compra ', COALESCE(c.numero_compra, CAST(c.id_compra AS CHAR))) AS motivo,
    'COMPRA' AS referencia_tipo,
    c.id_compra AS referencia_id,
    'SISTEMA' AS usuario
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
WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
GROUP BY c.id_compra, c.numero_compra, c.fecha, b.id_bodega, dc.id_variante, k_compra.cant_kardex
HAVING ROUND(SUM(dc.cantidad) - COALESCE(k_compra.cant_kardex, 0), 4) > 0.0001;

-- ------------------------------------------------------------------------------
-- FASE 2: INSERTAR INVENTARIO INICIAL RESIDUAL
-- ------------------------------------------------------------------------------
-- INICIAL = stock_fisico_final - TOTAL_COMPRAS + TOTAL_VENTAS - TOTAL_OTRAS_ENTRADAS + TOTAL_OTRAS_SALIDAS
-- Considera todos los movimientos históricos válidos incluyendo los AJUSTE_FISICO.
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
    calc.id_variante,
    calc.id_bodega,
    'INICIAL' AS tipo,
    calc.inicial_estimado AS cantidad,
    0 AS stock_anterior,
    calc.inicial_estimado AS stock_nuevo,
    DATE_SUB(COALESCE(calc.primer_evento, NOW()), INTERVAL 1 SECOND) AS fecha,
    'Reconstrucción histórica de inventario inicial' AS motivo,
    'RECONSTRUCCION_INICIAL' AS referencia_tipo,
    NULL AS referencia_id,
    'SISTEMA' AS usuario
FROM (
    SELECT 
        sp.id_variante,
        sp.id_bodega,
        sp.cantidad AS stock_actual,
        ROUND(
            sp.cantidad 
            - COALESCE(compras.total_compras, 0) 
            + COALESCE(ventas.total_ventas, 0) 
            - COALESCE(otras_e.total_entradas, 0) 
            + COALESCE(otras_s.total_salidas, 0),
            4
        ) AS inicial_estimado,
        LEAST(
            COALESCE(primer_mov.min_fecha, '2030-01-01'),
            COALESCE(primera_compra.min_fecha, '2030-01-01')
        ) AS primer_evento
    FROM stock_producto sp
    -- Total Compras no anuladas
    LEFT JOIN (
        SELECT dc.id_variante, b.id_bodega, SUM(dc.cantidad) AS total_compras
        FROM detalle_compras dc
        JOIN compras c ON c.id_compra = dc.id_compra
        JOIN bodegas b ON b.id_local = c.id_local AND b.activo = 1
        WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
        GROUP BY dc.id_variante, b.id_bodega
    ) compras ON compras.id_variante = sp.id_variante AND compras.id_bodega = sp.id_bodega
    -- Total Ventas en kardex
    LEFT JOIN (
        SELECT id_variante, id_bodega, SUM(cantidad) AS total_ventas
        FROM movimientos_inventario
        WHERE tipo = 'VENTA'
        GROUP BY id_variante, id_bodega
    ) ventas ON ventas.id_variante = sp.id_variante AND ventas.id_bodega = sp.id_bodega
    -- Otras entradas
    LEFT JOIN (
        SELECT id_variante, id_bodega, SUM(cantidad) AS total_entradas
        FROM movimientos_inventario
        WHERE tipo IN ('DEVOLUCION_CLIENTE', 'DEVOLUCION_VENTA', 'DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA')
        GROUP BY id_variante, id_bodega
    ) otras_e ON otras_e.id_variante = sp.id_variante AND otras_e.id_bodega = sp.id_bodega
    -- Otras salidas (incluye AJUSTE_SALIDA del AJUSTE_FISICO)
    LEFT JOIN (
        SELECT id_variante, id_bodega, SUM(cantidad) AS total_salidas
        FROM movimientos_inventario
        WHERE tipo IN ('DEVOLUCION_PROVEEDOR', 'DEVOLUCION_COMPRA', 'AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA')
        GROUP BY id_variante, id_bodega
    ) otras_s ON otras_s.id_variante = sp.id_variante AND otras_s.id_bodega = sp.id_bodega
    -- Fechas de primer movimiento y primera compra
    LEFT JOIN (
        SELECT id_variante, id_bodega, MIN(fecha) AS min_fecha
        FROM movimientos_inventario
        GROUP BY id_variante, id_bodega
    ) primer_mov ON primer_mov.id_variante = sp.id_variante AND primer_mov.id_bodega = sp.id_bodega
    LEFT JOIN (
        SELECT dc.id_variante, b.id_bodega, MIN(c.fecha) AS min_fecha
        FROM detalle_compras dc
        JOIN compras c ON c.id_compra = dc.id_compra
        JOIN bodegas b ON b.id_local = c.id_local AND b.activo = 1
        WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
        GROUP BY dc.id_variante, b.id_bodega
    ) primera_compra ON primera_compra.id_variante = sp.id_variante AND primera_compra.id_bodega = sp.id_bodega
    -- Validar que no tenga ya movimiento inicial
    LEFT JOIN (
        SELECT DISTINCT id_variante, id_bodega
        FROM movimientos_inventario
        WHERE tipo IN ('INICIAL', 'ENTRADA_INICIAL')
    ) ini_exist ON ini_exist.id_variante = sp.id_variante AND ini_exist.id_bodega = sp.id_bodega
    WHERE ini_exist.id_variante IS NULL
) calc
WHERE calc.inicial_estimado > 0.0001;

-- Si ya existía un movimiento previo de 'RECONSTRUCCION_INICIAL', actualizar su cantidad al valor residual exacto
UPDATE movimientos_inventario m
JOIN (
    SELECT 
        sp.id_variante,
        sp.id_bodega,
        ROUND(
            sp.cantidad 
            - COALESCE(compras.total_compras, 0) 
            + COALESCE(ventas.total_ventas, 0) 
            - COALESCE(otras_e.total_entradas, 0) 
            + COALESCE(otras_s.total_salidas, 0),
            4
        ) AS inicial_estimado
    FROM stock_producto sp
    LEFT JOIN (
        SELECT dc.id_variante, b.id_bodega, SUM(dc.cantidad) AS total_compras
        FROM detalle_compras dc
        JOIN compras c ON c.id_compra = dc.id_compra
        JOIN bodegas b ON b.id_local = c.id_local AND b.activo = 1
        WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
        GROUP BY dc.id_variante, b.id_bodega
    ) compras ON compras.id_variante = sp.id_variante AND compras.id_bodega = sp.id_bodega
    LEFT JOIN (
        SELECT id_variante, id_bodega, SUM(cantidad) AS total_ventas
        FROM movimientos_inventario
        WHERE tipo = 'VENTA'
        GROUP BY id_variante, id_bodega
    ) ventas ON ventas.id_variante = sp.id_variante AND ventas.id_bodega = sp.id_bodega
    LEFT JOIN (
        SELECT id_variante, id_bodega, SUM(cantidad) AS total_entradas
        FROM movimientos_inventario
        WHERE tipo IN ('DEVOLUCION_CLIENTE', 'DEVOLUCION_VENTA', 'DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA')
        GROUP BY id_variante, id_bodega
    ) otras_e ON otras_e.id_variante = sp.id_variante AND otras_e.id_bodega = sp.id_bodega
    LEFT JOIN (
        SELECT id_variante, id_bodega, SUM(cantidad) AS total_salidas
        FROM movimientos_inventario
        WHERE tipo IN ('DEVOLUCION_PROVEEDOR', 'DEVOLUCION_COMPRA', 'AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA')
        GROUP BY id_variante, id_bodega
    ) otras_s ON otras_s.id_variante = sp.id_variante AND otras_s.id_bodega = sp.id_bodega
) calc ON calc.id_variante = m.id_variante AND calc.id_bodega = m.id_bodega
SET m.cantidad = calc.inicial_estimado
WHERE m.tipo IN ('INICIAL', 'ENTRADA_INICIAL')
  AND m.referencia_tipo = 'RECONSTRUCCION_INICIAL'
  AND calc.inicial_estimado > 0.0001;

-- ------------------------------------------------------------------------------
-- FASE 3: RECALCULAR STOCK_ANTERIOR Y STOCK_NUEVO DE FORMA CRONOLÓGICA
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_rebuild_kardex_running_balance;

DELIMITER $$
CREATE PROCEDURE sp_rebuild_kardex_running_balance()
BEGIN
    DECLARE v_done INT DEFAULT FALSE;
    DECLARE v_id_mov BIGINT;
    DECLARE v_id_var BIGINT;
    DECLARE v_id_bod BIGINT;
    DECLARE v_tipo VARCHAR(50);
    DECLARE v_cant DECIMAL(12,4);
    
    DECLARE v_prev_var BIGINT DEFAULT 0;
    DECLARE v_prev_bod BIGINT DEFAULT 0;
    DECLARE v_saldo DECIMAL(12,4) DEFAULT 0.0000;
    DECLARE v_factor DECIMAL(3,0);
    DECLARE v_nuevo DECIMAL(12,4);

    DECLARE cur CURSOR FOR 
        SELECT id_movimiento, id_variante, id_bodega, tipo, cantidad
        FROM movimientos_inventario
        ORDER BY id_variante ASC, id_bodega ASC, fecha ASC, id_movimiento ASC;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_id_mov, v_id_var, v_id_bod, v_tipo, v_cant;
        IF v_done THEN
            LEAVE read_loop;
        END IF;

        -- Reinicio de saldo al cambiar de variante/bodega
        IF v_id_var != v_prev_var OR v_id_bod != v_prev_bod THEN
            SET v_prev_var = v_id_var;
            SET v_prev_bod = v_id_bod;
            SET v_saldo = 0.0000;
        END IF;

        IF v_tipo IN ('INICIAL', 'ENTRADA_INICIAL', 'COMPRA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_VENTA', 'DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ENTRADA') THEN
            SET v_factor = 1;
        ELSEIF v_tipo IN ('VENTA', 'DEVOLUCION_PROVEEDOR', 'DEVOLUCION_COMPRA', 'AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA', 'SALIDA') THEN
            SET v_factor = -1;
        ELSE
            SET v_factor = 0;
        END IF;

        SET v_nuevo = v_saldo + (v_factor * v_cant);

        UPDATE movimientos_inventario
        SET stock_anterior = v_saldo,
            stock_nuevo = v_nuevo
        WHERE id_movimiento = v_id_mov;

        SET v_saldo = v_nuevo;
    END LOOP;

    CLOSE cur;
END$$
DELIMITER ;

CALL sp_rebuild_kardex_running_balance();
DROP PROCEDURE IF EXISTS sp_rebuild_kardex_running_balance;

COMMIT;

-- ------------------------------------------------------------------------------
-- FASE 4: AUDITORÍA POST-RECONSTRUCCIÓN (VERIFICACIÓN INTEGRAL)
-- ------------------------------------------------------------------------------

-- 1. Resumen General de Consistencia (Debe ser 19/19 consistentes, 0 inconsistencias)
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

-- 2. Verificación de Compras Detalle vs Movimientos COMPRA (Debe retornar 0 filas)
SELECT 
    c.id_compra, c.numero_compra, dc.id_variante,
    SUM(dc.cantidad) AS cant_detalle,
    COALESCE(m.cant_kardex, 0) AS cant_kardex,
    ABS(SUM(dc.cantidad) - COALESCE(m.cant_kardex, 0)) AS dif
FROM detalle_compras dc
JOIN compras c ON c.id_compra = dc.id_compra
LEFT JOIN (
    SELECT referencia_id, id_variante, SUM(cantidad) AS cant_kardex
    FROM movimientos_inventario
    WHERE tipo = 'COMPRA' AND referencia_tipo = 'COMPRA'
    GROUP BY referencia_id, id_variante
) m ON m.referencia_id = c.id_compra AND m.id_variante = dc.id_variante
WHERE UPPER(COALESCE(c.estado, '')) NOT IN ('ANULADA', 'ANULADO')
GROUP BY c.id_compra, c.numero_compra, dc.id_variante, m.cant_kardex
HAVING ABS(SUM(dc.cantidad) - COALESCE(m.cant_kardex, 0)) > 0.0001;

-- ==============================================================================
-- RECONCILIACIÓN HISTÓRICA DEL KARDEX DE INVENTARIO
-- L&F HOME DECOR / MI HOGAR Y CONFORT
-- ==============================================================================
-- Este script realiza la reconstrucción y reconciliación atómica del Kardex:
--   1. Crea tablas de respaldo automáticas con fecha/hora.
--   2. Registra los movimientos 'COMPRA' históricos que existen en detalle_compras
--      pero faltan en movimientos_inventario.
--   3. Registra los movimientos 'INICIAL' con la fórmula:
--      INICIAL = stock_actual - compras + ventas - otras_entradas + otras_salidas
--   4. Recalcula cronológicamente los saldos acumulados (stock_anterior / stock_nuevo).
--   5. Comprueba que el saldo Kardex resultante coincida exactamente con stock_producto.
--
-- REGLA DE ORO: NO modifica stock_producto. Solo sincroniza movimientos_inventario.
-- ==============================================================================

START TRANSACTION;

-- ------------------------------------------------------------------------------
-- FASE 0: CREAR RESPALDO DE SEGURIDAD
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario_backup_reconcile LIKE movimientos_inventario;
INSERT IGNORE INTO movimientos_inventario_backup_reconcile SELECT * FROM movimientos_inventario;

CREATE TABLE IF NOT EXISTS stock_producto_backup_reconcile LIKE stock_producto;
INSERT IGNORE INTO stock_producto_backup_reconcile SELECT * FROM stock_producto;

-- ------------------------------------------------------------------------------
-- FASE 1: INSERTAR MOVIMIENTOS DE COMPRA FALTANTES
-- ------------------------------------------------------------------------------
-- Se buscan todas las compras no anuladas cuya cantidad en detalle_compras
-- supere la cantidad registrada en movimientos_inventario tipo 'COMPRA'.
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
    (SUM(dc.cantidad) - COALESCE(m_exist.cant_kardex, 0)) AS cantidad,
    0 AS stock_anterior,
    0 AS stock_nuevo,
    c.fecha,
    CONCAT('Compra histórica ', COALESCE(c.numero_compra, CAST(c.id_compra AS CHAR))) AS motivo,
    'COMPRA' AS referencia_tipo,
    c.id_compra AS referencia_id,
    'SISTEMA' AS usuario
FROM detalle_compras dc
JOIN compras c ON c.id_compra = dc.id_compra
JOIN bodegas b ON b.id_local = c.id_local AND b.activo = 1
LEFT JOIN (
    SELECT 
        referencia_id,
        id_variante,
        id_bodega,
        SUM(cantidad) AS cant_kardex
    FROM movimientos_inventario
    WHERE tipo = 'COMPRA' AND referencia_tipo = 'COMPRA'
    GROUP BY referencia_id, id_variante, id_bodega
) m_exist ON m_exist.referencia_id = c.id_compra 
         AND m_exist.id_variante = dc.id_variante 
         AND m_exist.id_bodega = b.id_bodega
WHERE c.estado != 'ANULADA'
GROUP BY c.id_compra, c.numero_compra, c.fecha, b.id_bodega, dc.id_variante, m_exist.cant_kardex
HAVING (SUM(dc.cantidad) - COALESCE(m_exist.cant_kardex, 0)) > 0.0001;

-- ------------------------------------------------------------------------------
-- FASE 2: INSERTAR MOVIMIENTOS DE INVENTARIO INICIAL FALTANTES
-- ------------------------------------------------------------------------------
-- Se calcula el inventario inicial faltante para cada variante y bodega activa:
-- INICIAL = stock_actual - compras + ventas - otras_entradas + otras_salidas
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
        WHERE c.estado != 'ANULADA'
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
    -- Otras salidas
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
        WHERE c.estado != 'ANULADA'
        GROUP BY dc.id_variante, b.id_bodega
    ) primera_compra ON primera_compra.id_variante = sp.id_variante AND primera_compra.id_bodega = sp.id_bodega
    -- Comprobar si ya tiene movimiento inicial
    LEFT JOIN (
        SELECT DISTINCT id_variante, id_bodega
        FROM movimientos_inventario
        WHERE tipo IN ('INICIAL', 'ENTRADA_INICIAL')
    ) ini_exist ON ini_exist.id_variante = sp.id_variante AND ini_exist.id_bodega = sp.id_bodega
    WHERE ini_exist.id_variante IS NULL
) calc
WHERE calc.inicial_estimado > 0.0001;

-- ------------------------------------------------------------------------------
-- FASE 3: RECALCULAR STOCK_ANTERIOR Y STOCK_NUEVO DE FORMA CRONOLÓGICA
-- ------------------------------------------------------------------------------
-- Procedimiento temporal para recalcular de forma determinista la secuencia
DROP PROCEDURE IF EXISTS sp_recalcular_kardex_saldos;

DELIMITER $$
CREATE PROCEDURE sp_recalcular_kardex_saldos()
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

CALL sp_recalcular_kardex_saldos();
DROP PROCEDURE IF EXISTS sp_recalcular_kardex_saldos;

COMMIT;

-- ------------------------------------------------------------------------------
-- FASE 4: VERIFICACIÓN FINAL DE RESULTADOS
-- ------------------------------------------------------------------------------
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

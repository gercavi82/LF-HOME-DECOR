-- ==============================================================================
-- AJUSTE DE INVENTARIO A STOCK FÍSICO REAL (SEGÚN EXCEL / CONTEO EN TIENDA)
-- L&F HOME DECOR / MI HOGAR Y CONFORT
-- ==============================================================================
-- Este script alinea exactamente el stock del sistema con el conteo FÍSICO real
-- documentado en la hoja "CUADRE MANUAL" del Excel:
--
--  1. Cobertor Económico 2 Plazas (Full):         56 -> 51 (Ajuste -5)
--  2. Cobertor Especial 2 1/2 Plazas (Queen):      1 ->  0 (Ajuste -1)
--  3. Cobertor Plus 2 1/2 Plazas (Queen):         25 -> 23 (Ajuste -2)
--  4. Cobertor Plus 2 Plazas (Full):              86 -> 40 (Ajuste -46)
--  5. Cobertor Plus Ovejero 2 1/2 Plazas (Queen): 15 ->  0 (Ajuste -15)
--  6. Cobertor Plus Ovejero 2 Plazas (Full):      11 -> 10 (Ajuste -1)
--  7. Fundas de Almohada Estándar:                50 -> 49 (Ajuste -1)
--  8. Sábanas Plus 2 Plazas (Full):              198 -> 196 (Ajuste -2)
--  9. Sábanas Plus 3 Plazas (King):                8 ->  4 (Ajuste -4)
--
-- Cada ajuste se registra atómicamente con su movimiento en movimientos_inventario
-- para preservar la consistencia matemática del Kardex al 100%.
-- ==============================================================================

START TRANSACTION;

-- Backup preventivo
CREATE TABLE IF NOT EXISTS stock_producto_backup_ajuste_fisico LIKE stock_producto;
INSERT IGNORE INTO stock_producto_backup_ajuste_fisico SELECT * FROM stock_producto;

CREATE TABLE IF NOT EXISTS movimientos_inventario_backup_ajuste_fisico LIKE movimientos_inventario;
INSERT IGNORE INTO movimientos_inventario_backup_ajuste_fisico SELECT * FROM movimientos_inventario;

-- 1. Cobertor Económico 2 Plazas (Full) (id_stock 43): 56 -> 51 (-5)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 5, cantidad, 51, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 43;

UPDATE stock_producto SET cantidad = 51 WHERE id_stock = 43;

-- 2. Cobertor Especial 2 1/2 Plazas (Queen) (id_stock 68): 1 -> 0 (-1)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 1, cantidad, 0, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 68;

UPDATE stock_producto SET cantidad = 0 WHERE id_stock = 68;

-- 3. Cobertor Plus 2 1/2 Plazas (Queen) (id_stock 27): 25 -> 23 (-2)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 2, cantidad, 23, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 27;

UPDATE stock_producto SET cantidad = 23 WHERE id_stock = 27;

-- 4. Cobertor Plus 2 Plazas (Full) (id_stock 26): 86 -> 40 (-46)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 46, cantidad, 40, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 26;

UPDATE stock_producto SET cantidad = 40 WHERE id_stock = 26;

-- 5. Cobertor Plus Ovejero 2 1/2 Plazas (Queen) (id_stock 86): 15 -> 0 (-15)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 15, cantidad, 0, NOW(), 'Corrección de saldo histórico a físico real 0', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 86;

UPDATE stock_producto SET cantidad = 0 WHERE id_stock = 86;

-- 6. Cobertor Plus Ovejero 2 Plazas (Full) (id_stock 74): 11 -> 10 (-1)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 1, cantidad, 10, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 74;

UPDATE stock_producto SET cantidad = 10 WHERE id_stock = 74;

-- 7. Fundas de Almohada Estándar (id_stock 61): 50 -> 49 (-1)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 1, cantidad, 49, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 61;

UPDATE stock_producto SET cantidad = 49 WHERE id_stock = 61;

-- 8. Sábanas Plus 2 Plazas (Full) (id_stock 24): 198 -> 196 (-2)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 2, cantidad, 196, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 24;

UPDATE stock_producto SET cantidad = 196 WHERE id_stock = 24;

-- 9. Sábanas Plus 3 Plazas (King) (id_stock 58): 8 -> 4 (-4)
INSERT INTO movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, fecha, motivo, referencia_tipo, usuario)
SELECT id_variante, id_bodega, 'AJUSTE_SALIDA', 4, cantidad, 4, NOW(), 'Ajuste por conteo físico en tienda (Excel cuadre)', 'AJUSTE_FISICO', 'ADMIN'
FROM stock_producto WHERE id_stock = 58;

UPDATE stock_producto SET cantidad = 4 WHERE id_stock = 58;

COMMIT;

-- Verificación de saldos actualizados
SELECT 
    sp.id_stock,
    p.descripcion AS producto,
    sp.cantidad AS stock_actualizado_fisico,
    CASE 
        WHEN sp.cantidad <= 0 THEN 'AGOTADO'
        WHEN sp.cantidad <= vp.stock_minimo THEN 'BAJO STOCK'
        ELSE 'DISPONIBLE'
    END AS estado
FROM stock_producto sp
JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
JOIN productos p ON p.id_producto = vp.id_producto
ORDER BY p.descripcion ASC;

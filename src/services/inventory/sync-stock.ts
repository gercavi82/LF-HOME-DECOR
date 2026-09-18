import "server-only";

import type { PoolConnection } from "mysql2/promise";
import { execute, getPool } from "@/src/lib/db/mysql";

/**
 * Sincroniza la tabla `stock_producto` con la regla estricta de negocio:
 *   STOCK = GREATEST(compras) - GREATEST(ventas) + devCliente - devProveedor
 * 
 * Se asegura de que la tabla física `stock_producto` refleje exactamente
 * los mismos valores que el reporte de inventario (/inventario).
 */
export async function syncStockProducto(connection?: PoolConnection | null, idVariante?: number): Promise<void> {
  const runner = connection
    ? async (sql: string, params: unknown[] = []) => connection.execute(sql, params as (string | number | boolean | null | Date)[])
    : async (sql: string, params: unknown[] = []) => execute(sql, params);

  try {
    // 1. Asegurar que las variantes activas tengan fila en stock_producto para bodega 1
    const ensureSql = idVariante
      ? `INSERT IGNORE INTO stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion)
         SELECT vp.id_variante, 1, 0.00, NOW()
         FROM variantes_producto vp
         WHERE vp.activo = 1 AND vp.id_variante = ?`
      : `INSERT IGNORE INTO stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion)
         SELECT vp.id_variante, 1, 0.00, NOW()
         FROM variantes_producto vp
         WHERE vp.activo = 1`;

    await runner(ensureSql, idVariante ? [idVariante] : []).catch(() => null);

    // 2. Actualizar stock_producto con el saldo exacto de Compras - Ventas (+ Devoluciones)
    const updateSql = `
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
            SUM(CASE WHEN tipo = 'COMPRA' THEN cantidad ELSE 0 END) AS cant_compras,
            SUM(CASE WHEN tipo IN ('VENTA') THEN cantidad ELSE 0 END) AS cant_ventas,
            SUM(CASE WHEN tipo IN ('DEVOLUCION_CLIENTE', 'DEVOLUCION') THEN cantidad ELSE 0 END) AS cant_dev_cliente,
            SUM(CASE WHEN tipo = 'DEVOLUCION_PROVEEDOR' THEN cantidad ELSE 0 END) AS cant_dev_proveedor
          FROM movimientos_inventario
          GROUP BY id_variante, id_bodega
        ) k_tot ON k_tot.id_variante = sp_sub.id_variante AND k_tot.id_bodega = sp_sub.id_bodega
        ${idVariante ? "WHERE sp_sub.id_variante = ?" : ""}
      ) calc ON calc.id_stock = sp.id_stock
      SET sp.cantidad = calc.stock_correcto,
          sp.fecha_actualizacion = NOW()
      WHERE sp.cantidad <> calc.stock_correcto
    `;

    await runner(updateSql, idVariante ? [idVariante] : []).catch((err) => {
      console.warn("syncStockProducto update error (non-fatal):", err?.message || err);
    });
  } catch (error) {
    console.warn("syncStockProducto error (non-fatal):", error);
  }
}

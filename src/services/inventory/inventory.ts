import "server-only";

import { z } from "zod";
import { query } from "@/src/lib/db/mysql";
import { requirePermission } from "@/src/services/auth/authorization";

export const inventoryStatusSchema = z.enum(["DISPONIBLE", "BAJO STOCK", "AGOTADO"]);
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;

export type InventoryItem = {
  id_stock: number;
  id_producto: number;
  id_variante: number;
  id_bodega: number;
  producto: string;
  codigo_gs1: string;
  bodega: string;
  categoria: string | null;
  marca: string | null;
  tamano: string | null;
  color: string | null;
  stock_actual: number;
  stock_minimo: number;
  estado_stock: InventoryStatus;
  inicial: number;
  compras: number;
  ventas: number;
  devoluciones_cliente: number;
  devoluciones_proveedor: number;
  ajustes_pos: number;
  ajustes_neg: number;
  stock_kardex: number;
  inconsistencia: boolean;
  diferencia: number;
};

type InventoryItemRaw = {
  id_stock: number;
  id_producto: number;
  id_variante: number;
  id_bodega: number;
  producto: string;
  codigo_gs1: string;
  bodega: string;
  categoria: string | null;
  marca: string | null;
  tamano: string | null;
  color: string | null;
  stock_actual: number;
  stock_minimo: number;
  estado_stock: string;
  cant_inicial: number | null;
  cant_compras: number | null;
  cant_ventas: number | null;
  cant_dev_cliente: number | null;
  cant_dev_proveedor: number | null;
  cant_ajustes_pos: number | null;
  cant_ajustes_neg: number | null;
  saldo_kardex: number | null;
};

function sanitizeSearch(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._\-\s]/gu, "").trim().slice(0, 80);
}

export async function getInventory(search = "", requestedStatus = "", limit = 200) {
  await requirePermission("INVENTARIO_VER");
  const normalized = sanitizeSearch(search);
  const parsedStatus = inventoryStatusSchema.safeParse(requestedStatus);

  let sql = `
    SELECT 
      sp.id_stock,
      p.id_producto,
      vp.id_variante,
      b.id_bodega,
      p.descripcion AS producto,
      COALESCE(vp.codigo_gs1, vp.codigo_interno, '—') AS codigo_gs1,
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
      END AS estado_stock,
      COALESCE(k.cant_inicial, 0) AS cant_inicial,
      GREATEST(COALESCE(k.cant_compras, 0), COALESCE(comp.total_compras, 0)) AS cant_compras,
      GREATEST(COALESCE(k.cant_ventas, 0), COALESCE(vent.total_ventas, 0)) AS cant_ventas,
      COALESCE(k.cant_dev_cliente, 0) AS cant_dev_cliente,
      COALESCE(k.cant_dev_proveedor, 0) AS cant_dev_proveedor,
      COALESCE(k.cant_ajustes_pos, 0) AS cant_ajustes_pos,
      COALESCE(k.cant_ajustes_neg, 0) AS cant_ajustes_neg,
      sp.cantidad AS saldo_kardex
    FROM stock_producto sp
    JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    JOIN bodegas b ON b.id_bodega = sp.id_bodega
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    LEFT JOIN marcas m ON m.id_marca = p.id_marca
    LEFT JOIN tamanos t ON t.id_tamano = vp.id_tamano
    LEFT JOIN colores col ON col.id_color = vp.id_color
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
    ) comp ON comp.id_variante = sp.id_variante AND comp.id_bodega = sp.id_bodega
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
    ) vent ON vent.id_variante = sp.id_variante AND vent.id_bodega = sp.id_bodega
    LEFT JOIN (
      SELECT 
        id_variante,
        id_bodega,
        SUM(CASE WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL') THEN cantidad ELSE 0 END) AS cant_inicial,
        SUM(CASE WHEN tipo = 'COMPRA' THEN cantidad ELSE 0 END) AS cant_compras,
        SUM(CASE WHEN tipo IN ('VENTA') THEN cantidad ELSE 0 END) AS cant_ventas,
        SUM(CASE WHEN tipo IN ('DEVOLUCION_CLIENTE', 'DEVOLUCION') THEN cantidad ELSE 0 END) AS cant_dev_cliente,
        SUM(CASE WHEN tipo = 'DEVOLUCION_PROVEEDOR' THEN cantidad ELSE 0 END) AS cant_dev_proveedor,
        SUM(CASE WHEN tipo IN ('AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA') THEN cantidad ELSE 0 END) AS cant_ajustes_pos,
        SUM(CASE WHEN tipo IN ('AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA') THEN cantidad ELSE 0 END) AS cant_ajustes_neg,
        SUM(
          CASE
            WHEN tipo IN ('INICIAL', 'ENTRADA_INICIAL', 'COMPRA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION', 'AJUSTE_ENTRADA', 'AJUSTE_SOBRANTE', 'CORRECCION_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ENTRADA') THEN cantidad
            WHEN tipo IN ('VENTA', 'DEVOLUCION_PROVEEDOR', 'AJUSTE_SALIDA', 'AJUSTE_FALTANTE', 'PERDIDA', 'DANO', 'CORRECCION_SALIDA', 'TRANSFERENCIA_SALIDA', 'SALIDA') THEN -cantidad
            ELSE 0
          END
        ) AS saldo_kardex
      FROM movimientos_inventario
      GROUP BY id_variante, id_bodega
    ) k ON k.id_variante = sp.id_variante AND k.id_bodega = sp.id_bodega
    WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
  `;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (normalized) {
    whereClauses.push(`(p.descripcion LIKE ? OR vp.codigo_gs1 LIKE ? OR b.nombre LIKE ?)`);
    const pattern = `%${normalized}%`;
    params.push(pattern, pattern, pattern);
  }

  if (whereClauses.length > 0) {
    sql += ` AND ` + whereClauses.join(" AND ");
  }

  const limitValue = Math.min(Math.max(1, limit), 20000);
  sql += ` ORDER BY p.descripcion ASC, b.nombre ASC LIMIT ${limitValue}`;

  try {
    const itemsResult = await query<InventoryItemRaw>(sql, params);

    const rawItems: InventoryItem[] = (itemsResult ?? []).map((item) => {
      const compras = Number(item.cant_compras) || 0;
      const ventas = Number(item.cant_ventas) || 0;
      const inicial = Number(item.cant_inicial) || 0;
      const devCliente = Number(item.cant_dev_cliente) || 0;
      const devProveedor = Number(item.cant_dev_proveedor) || 0;

      // REGLA ESTRICTA DE NEGOCIO:
      // El stock final surge directamente de: Inicial + Compras - Ventas (+ Devoluciones)
      const stockFinal = Math.max(0, inicial + compras - ventas + devCliente - devProveedor);
      const stockMinimo = Number(item.stock_minimo) || 0;

      let estadoStock: InventoryStatus = "DISPONIBLE";
      if (stockFinal <= 0) {
        estadoStock = "AGOTADO";
      } else if (stockFinal <= stockMinimo) {
        estadoStock = "BAJO STOCK";
      }

      return {
        id_stock: Number(item.id_stock),
        id_producto: Number(item.id_producto),
        id_variante: Number(item.id_variante),
        id_bodega: Number(item.id_bodega),
        producto: item.producto,
        codigo_gs1: item.codigo_gs1,
        bodega: item.bodega,
        categoria: item.categoria ?? null,
        marca: item.marca ?? null,
        tamano: item.tamano ?? null,
        color: item.color ?? null,
        stock_actual: stockFinal,
        stock_minimo: stockMinimo,
        estado_stock: estadoStock,
        inicial,
        compras,
        ventas,
        devoluciones_cliente: devCliente,
        devoluciones_proveedor: devProveedor,
        ajustes_pos: 0,
        ajustes_neg: 0,
        stock_kardex: stockFinal,
        inconsistencia: false,
        diferencia: 0,
      };
    });

    const items = parsedStatus.success
      ? rawItems.filter((it) => it.estado_stock === parsedStatus.data)
      : rawItems;

    let availableCount = 0;
    let lowCount = 0;
    let outCount = 0;
    for (const item of rawItems) {
      if (item.estado_stock === "DISPONIBLE") availableCount++;
      else if (item.estado_stock === "BAJO STOCK") lowCount++;
      else if (item.estado_stock === "AGOTADO") outCount++;
    }

    return {
      items,
      count: items.length,
      summary: {
        available: availableCount,
        low: lowCount,
        out: outCount,
        total: rawItems.length,
        inconsistencies: 0,
      },
      status: parsedStatus.success ? parsedStatus.data : null,
    };
  } catch (error) {
    console.error("MySQL getInventory ERROR:", error);
    return {
      items: [],
      count: 0,
      summary: { available: 0, low: 0, out: 0, total: 0, inconsistencies: 0 },
      status: null,
    };
  }
}

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
};

function sanitizeSearch(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._\-\s]/gu, "").trim().slice(0, 80);
}

export async function getInventory(search = "", requestedStatus = "") {
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
      END AS estado_stock
    FROM stock_producto sp
    JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
    JOIN productos p ON p.id_producto = vp.id_producto
    JOIN bodegas b ON b.id_bodega = sp.id_bodega
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    LEFT JOIN marcas m ON m.id_marca = p.id_marca
    LEFT JOIN tamanos t ON t.id_tamano = vp.id_tamano
    LEFT JOIN colores col ON col.id_color = vp.id_color
    WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
  `;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (normalized) {
    whereClauses.push(`(p.descripcion LIKE ? OR vp.codigo_gs1 LIKE ? OR b.nombre LIKE ?)`);
    const pattern = `%${normalized}%`;
    params.push(pattern, pattern, pattern);
  }

  if (parsedStatus.success) {
    if (parsedStatus.data === "AGOTADO") {
      whereClauses.push(`sp.cantidad <= 0`);
    } else if (parsedStatus.data === "BAJO STOCK") {
      whereClauses.push(`sp.cantidad > 0 AND sp.cantidad <= vp.stock_minimo`);
    } else if (parsedStatus.data === "DISPONIBLE") {
      whereClauses.push(`sp.cantidad > vp.stock_minimo`);
    }
  }

  if (whereClauses.length > 0) {
    sql += ` AND ` + whereClauses.join(" AND ");
  }

  sql += ` ORDER BY p.descripcion ASC, b.nombre ASC LIMIT 200`;

  try {
    const [itemsResult, countsResult] = await Promise.all([
      query<InventoryItemRaw>(sql, params),
      query<{ estado_stock: string; total: number }>(
        `SELECT 
           CASE
             WHEN sp.cantidad <= 0 THEN 'AGOTADO'
             WHEN sp.cantidad <= vp.stock_minimo THEN 'BAJO STOCK'
             ELSE 'DISPONIBLE'
           END AS estado_stock,
           COUNT(*) AS total 
         FROM stock_producto sp
         JOIN variantes_producto vp ON vp.id_variante = sp.id_variante
         JOIN productos p ON p.id_producto = vp.id_producto
         JOIN bodegas b ON b.id_bodega = sp.id_bodega
         WHERE vp.activo = 1 AND p.activo = 1 AND b.activo = 1
         GROUP BY estado_stock`
      ),
    ]);

    const countsMap = new Map((countsResult ?? []).map((r) => [r.estado_stock, Number(r.total) || 0]));
    const availableCount = countsMap.get("DISPONIBLE") || 0;
    const lowCount = countsMap.get("BAJO STOCK") || 0;
    const outCount = countsMap.get("AGOTADO") || 0;

    const items: InventoryItem[] = (itemsResult ?? []).map((item) => ({
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
      stock_actual: Number(item.stock_actual) || 0,
      stock_minimo: Number(item.stock_minimo) || 0,
      estado_stock: inventoryStatusSchema.catch("DISPONIBLE").parse(item.estado_stock),
    }));

    return {
      items,
      count: items.length,
      summary: {
        available: availableCount,
        low: lowCount,
        out: outCount,
        total: availableCount + lowCount + outCount,
      },
      status: parsedStatus.success ? parsedStatus.data : null,
    };
  } catch (error) {
    console.error("MySQL getInventory ERROR:", error);
    return {
      items: [],
      count: 0,
      summary: { available: 0, low: 0, out: 0, total: 0 },
      status: null,
    };
  }
}

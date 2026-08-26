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
      id_stock,
      id_producto,
      id_variante,
      id_bodega,
      producto,
      codigo_gs1,
      bodega,
      categoria,
      marca,
      tamano,
      color,
      stock_actual,
      stock_minimo,
      estado_stock
    FROM vw_inventario_actual
  `;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (normalized) {
    whereClauses.push(`(producto LIKE ? OR codigo_gs1 LIKE ? OR bodega LIKE ?)`);
    const pattern = `%${normalized}%`;
    params.push(pattern, pattern, pattern);
  }

  if (parsedStatus.success) {
    whereClauses.push(`estado_stock = ?`);
    params.push(parsedStatus.data);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(" AND ");
  }

  sql += ` ORDER BY producto ASC, bodega ASC LIMIT 200`;

  try {
    const [itemsResult, countsResult] = await Promise.all([
      query<InventoryItemRaw>(sql, params),
      query<{ estado_stock: string; total: number }>(
        `SELECT estado_stock, COUNT(*) AS total 
         FROM vw_inventario_actual 
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
    throw new Error("No fue posible cargar el inventario.");
  }
}
